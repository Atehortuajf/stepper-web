"""
backend.app.core.feature_extract
Continuous Bresenham phase-accumulated audio feature extraction.
Emits beat-synchronous 128-band Slaney Mel spectrograms and positive half-wave
rectified spectral flux at exactly 48 ticks per beat.
Decodes PCM WAV buffers without external ffmpeg dependencies.
"""

import base64
import io
import math
from pathlib import Path
from typing import List, Optional, Tuple, Union
import numpy as np
import scipy.io.wavfile as wavfile
import torch
import torch.nn.functional as F
import torchaudio.functional as AF

from backend.app.core.config import settings


class AudioFeatureExtractor:
    """
    Extracts beat-synchronous Mel-filterbank spectrograms and spectral flux features.

    Guarantees:
    - Maximum temporal error <= 0.01134 ms (0.5 audio samples at 44.1 kHz).
    - Zero cumulative phase drift over infinite track durations.
    - Exactly 48 spectrogram frames per musical beat (192 frames per 4/4 measure).
    """

    def __init__(
        self,
        sample_rate: int = settings.SAMPLE_RATE,
        n_fft: int = settings.N_FFT,
        n_mels: int = settings.N_MELS,
        f_min: float = settings.F_MIN,
        f_max: float = settings.F_MAX,
        ticks_per_beat: int = settings.TICKS_PER_BEAT,
        compression_factor: float = settings.COMPRESSION_FACTOR,
    ) -> None:
        self.sample_rate = sample_rate
        self.n_fft = n_fft
        self.n_mels = n_mels
        self.f_min = f_min
        self.f_max = f_max
        self.ticks_per_beat = ticks_per_beat
        self.compression_factor = compression_factor

        # Precompute periodic Hann window
        self.window = torch.hann_window(n_fft, periodic=True)

        # Precompute Slaney-normalized Mel filterbank: shape (n_freqs=513, n_mels=128)
        n_freqs = n_fft // 2 + 1
        self.mel_fb = AF.melscale_fbanks(
            n_freqs=n_freqs,
            f_min=f_min,
            f_max=f_max,
            n_mels=n_mels,
            sample_rate=sample_rate,
            norm="slaney",
            mel_scale="slaney",
        )

    def extract_from_waveform(
        self,
        waveform: torch.Tensor,
        total_beats: int,
        bpm: Optional[float] = None,
        offset: float = 0.0,
        timing_engine: Optional[object] = None,
        start_beat: float = 0.0,
        slice_start_sec: float = 0.0,
        tick_times_sec: Optional[List[float]] = None,
    ) -> torch.Tensor:
        """
        Extract beat-synchronous features from a 1D audio waveform tensor.

        Args:
            waveform: 1D FloatTensor of raw audio samples.
            total_beats: Number of beats to extract.
            bpm: Song tempo in BPM (used if timing_engine is None).
            offset: Song offset in seconds (used if timing_engine is None).
            timing_engine: Optional TimingEngine instance with .beat_to_seconds(beat).
            start_beat: Starting beat offset (default 0.0).

        Returns:
            Tensor of shape (Channels=2, total_beats, 48, n_mels=128)
            Channel 0: Log-Mel spectrogram
            Channel 1: Half-wave rectified spectral flux
        """
        if waveform.dim() > 1:
            if waveform.dim() == 2 and waveform.shape[0] in (1, 2):
                waveform = waveform.mean(dim=0)
            else:
                waveform = waveform.squeeze()

        total_ticks = total_beats * self.ticks_per_beat
        k = torch.arange(total_ticks, dtype=torch.float64)
        beats = start_beat + (k / float(self.ticks_per_beat))

        # 1. Continuous Bresenham Phase Sampling: c_k = round(t_audio * fs)
        if tick_times_sec is not None:
            if len(tick_times_sec) != total_ticks:
                raise ValueError(f"tick_times_sec must contain exactly {total_ticks} half-open tick times")
            t_audio = torch.tensor(tick_times_sec, dtype=torch.float64)
        elif timing_engine is not None and hasattr(timing_engine, "beat_to_seconds"):
            t_audio_list = [timing_engine.beat_to_seconds(float(b)) for b in beats]
            t_audio = torch.tensor(t_audio_list, dtype=torch.float64)
        else:
            if bpm is None or bpm <= 0:
                bpm = 120.0
            t_audio = beats * (60.0 / bpm) - offset

        sample_targets = (t_audio - slice_start_sec) * self.sample_rate
        centers = torch.round(sample_targets).to(torch.long)

        # 2. Bounded audio padding for centered STFT windowing
        num_samples = waveform.shape[0]
        min_center = centers.min().item()
        max_center = centers.max().item()

        half_win = self.n_fft // 2
        pad_left = max(0, half_win - min_center)
        pad_right = max(0, (max_center + half_win) - num_samples + 1)

        padded_waveform = F.pad(waveform, (pad_left, pad_right), mode="constant", value=0.0)
        shifted_centers = centers + pad_left

        # 3. Vectorized frame slicing: shape (total_ticks, n_fft)
        frame_offsets = torch.arange(-half_win, half_win, dtype=torch.long)
        frame_indices = shifted_centers.unsqueeze(1) + frame_offsets.unsqueeze(0)
        frames = padded_waveform[frame_indices]

        # 4. Windowing and RFFT
        window = self.window.to(waveform.device)
        windowed_frames = frames * window
        stft = torch.fft.rfft(windowed_frames, n=self.n_fft)
        power_spec = torch.abs(stft) ** 2  # (total_ticks, 513)

        # 5. Slaney Mel Filterbank projection
        mel_fb = self.mel_fb.to(waveform.device)
        mel_spec = torch.matmul(power_spec, mel_fb)  # (total_ticks, 128)

        # 6. Non-negative Log Dynamic Range Compression: log1p(10^4 * S_mel)
        s_log = torch.log1p(self.compression_factor * mel_spec)

        # 7. Positive Half-Wave Rectified Spectral Flux (Onset Delta)
        diff = s_log[1:] - s_log[:-1]
        flux = torch.cat([torch.zeros(1, self.n_mels, device=s_log.device), F.relu(diff)], dim=0)

        # 8. Structure into beat-synchronous grid: (2, total_beats, 48, n_mels)
        s_log_grid = s_log.view(total_beats, self.ticks_per_beat, self.n_mels)
        flux_grid = flux.view(total_beats, self.ticks_per_beat, self.n_mels)

        return torch.stack([s_log_grid, flux_grid], dim=0)


def generate_synthetic_audio(
    duration_sec: float,
    bpm: float = 120.0,
    sample_rate: int = 44100,
    add_clicks: bool = True,
    click_subdivisions: int = 1,
) -> torch.Tensor:
    """
    Generates deterministic synthetic audio for offline testing and fallback loading.
    Includes ambient low-amplitude tones and sharp sinusoidal click bursts at beat intervals.
    """
    num_samples = max(int(duration_sec * sample_rate), sample_rate)
    t = torch.linspace(0, duration_sec, num_samples, dtype=torch.float32)

    # Ambient low-level synthetic background
    waveform = 0.02 * torch.sin(2.0 * math.pi * 220.0 * t) + 0.01 * torch.sin(2.0 * math.pi * 440.0 * t)

    if add_clicks:
        beat_interval = 60.0 / (bpm * click_subdivisions)
        total_clicks = int(duration_sec / beat_interval)
        click_dur = 0.015  # 15 ms click
        click_len = int(click_dur * sample_rate)
        click_t = torch.linspace(0, click_dur, click_len)
        burst = torch.sin(2.0 * math.pi * 1200.0 * click_t) * torch.exp(-click_t / 0.003)

        for i in range(total_clicks):
            start_idx = int(i * beat_interval * sample_rate)
            end_idx = min(start_idx + click_len, num_samples)
            if start_idx < num_samples:
                waveform[start_idx:end_idx] += burst[: end_idx - start_idx]

    return waveform


def decode_pcm_wav(
    audio_data: Union[bytes, str],
    target_sr: int = 44100,
) -> torch.Tensor:
    """
    Decodes a PCM WAV buffer (or base64 encoded string) into a 1D float32 tensor
    scaled in [-1.0, 1.0] at target_sr (44,100 Hz).
    Does NOT require system ffmpeg or ffprobe binaries.
    """
    if isinstance(audio_data, str):
        # Strip optional data URL prefix (e.g. data:audio/wav;base64,...)
        if "," in audio_data:
            audio_data = audio_data.split(",", 1)[1]
        raw_bytes = base64.b64decode(audio_data)
    else:
        raw_bytes = audio_data

    # Check for RIFF WAV header
    if len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WAVE":
        sr, data = wavfile.read(io.BytesIO(raw_bytes))

        # Scale according to bit-depth
        if data.dtype == np.int16:
            data_float = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data_float = data.astype(np.float32) / 2147483648.0
        elif data.dtype == np.uint8:
            data_float = (data.astype(np.float32) - 128.0) / 128.0
        else:
            data_float = data.astype(np.float32)

        # Normalize integer PCM before mixing; averaging integer channels first
        # promotes to float without applying the required bit-depth scale.
        if data_float.ndim > 1:
            data_float = data_float.mean(axis=1, dtype=np.float32)

        waveform = torch.from_numpy(data_float)
        if sr != target_sr:
            waveform = AF.resample(waveform, orig_freq=sr, new_freq=target_sr)
        return waveform

    # If raw float32 bytes without WAV header
    try:
        data_float = np.frombuffer(raw_bytes, dtype=np.float32)
        if len(data_float) > 0:
            return torch.from_numpy(data_float.copy())
    except Exception:
        pass

    # If raw int16 bytes
    try:
        data_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
        if len(data_int16) > 0:
            return torch.from_numpy(data_int16.astype(np.float32) / 32768.0)
    except Exception:
        pass

    raise ValueError("Failed to parse PCM WAV or raw PCM buffer.")


def extract_features_from_audio(
    audio_input: Optional[Union[bytes, str, torch.Tensor]],
    total_beats: int,
    bpm: float = 120.0,
    offset: float = 0.0,
    start_beat: float = 0.0,
    slice_start_sec: float = 0.0,
    tick_times_sec: Optional[List[float]] = None,
    allow_synthetic: bool = False,
    extractor: Optional[AudioFeatureExtractor] = None,
) -> torch.Tensor:
    """
    High-level helper to extract (2, total_beats, 48, 128) feature tensor
    from arbitrary audio input (base64 string, WAV bytes, tensor, or None).
    """
    if extractor is None:
        extractor = AudioFeatureExtractor()

    waveform: Optional[torch.Tensor] = None

    if audio_input is not None:
        if isinstance(audio_input, torch.Tensor):
            waveform = audio_input
        elif isinstance(audio_input, (bytes, str)) and len(audio_input) > 0:
            try:
                waveform = decode_pcm_wav(audio_input, target_sr=extractor.sample_rate)
            except Exception as exc:
                if not allow_synthetic:
                    raise ValueError("audio_input must be a valid PCM WAV or raw PCM buffer") from exc
                waveform = None

    if waveform is None or waveform.numel() == 0:
        if not allow_synthetic:
            raise ValueError("audio_input is required unless synthetic fallback is explicitly enabled")
        duration_sec = (total_beats * 60.0 / bpm) + 2.0
        waveform = generate_synthetic_audio(duration_sec=duration_sec, bpm=bpm)

    return extractor.extract_from_waveform(
        waveform=waveform,
        total_beats=total_beats,
        bpm=bpm,
        offset=offset,
        start_beat=start_beat,
        slice_start_sec=slice_start_sec,
        tick_times_sec=tick_times_sec,
    )
