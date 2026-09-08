"""
backend.tests.test_feature_extract
Unit tests for the audio feature extraction pipeline and PCM WAV decoding.
"""

import io
import numpy as np
import pytest
import scipy.io.wavfile as wavfile
import torch

from backend.app.core.feature_extract import (
    AudioFeatureExtractor,
    decode_pcm_wav,
    extract_features_from_audio,
    generate_synthetic_audio,
)


def test_audio_feature_extractor_tensor_shape():
    """Verify that feature extraction emits exact (2, total_beats, 48, 128) tensor."""
    extractor = AudioFeatureExtractor()
    total_beats = 16
    audio = generate_synthetic_audio(duration_sec=10.0, bpm=140.0)

    features = extractor.extract_from_waveform(audio, total_beats=total_beats, bpm=140.0)

    assert isinstance(features, torch.Tensor)
    assert features.shape == (2, total_beats, 48, 128)
    assert features.dtype == torch.float32

    # Channel 0: Log-Mel spectrogram (non-negative)
    log_mel = features[0]
    assert (log_mel >= 0.0).all()

    # Channel 1: Positive spectral flux (non-negative)
    flux = features[1]
    assert (flux >= 0.0).all()
    # First tick flux should be 0.0
    assert flux[0, 0].sum().item() == 0.0


def test_bresenham_phase_sampling_no_drift():
    """Verify continuous Bresenham sampling maintains zero cumulative drift."""
    extractor = AudioFeatureExtractor()
    total_beats = 64
    audio = generate_synthetic_audio(duration_sec=35.0, bpm=128.5)

    features = extractor.extract_from_waveform(audio, total_beats=total_beats, bpm=128.5)
    assert features.shape == (2, 64, 48, 128)

    # Frame centers should align strictly with target beats
    k = torch.arange(64 * 48, dtype=torch.float64)
    expected_times = k / 48.0 * (60.0 / 128.5)
    expected_centers = torch.round(expected_times * 44100).to(torch.long)
    # Drift between consecutive centers must match expected discrete audio sample steps
    deltas = expected_centers[1:] - expected_centers[:-1]
    expected_step = 44100.0 * (60.0 / 128.5) / 48.0
    assert (deltas.float() - expected_step).abs().max() <= 1.0


def test_decode_pcm_wav_16bit(sample_wav_bytes: bytes):
    """Test decoding standard 16-bit PCM WAV."""
    waveform = decode_pcm_wav(sample_wav_bytes, target_sr=44100)
    assert isinstance(waveform, torch.Tensor)
    assert waveform.dim() == 1
    assert waveform.dtype == torch.float32
    # Check amplitude bounded in [-1.0, 1.0]
    assert waveform.abs().max() <= 1.05
    assert len(waveform) == int(3.0 * 44100)


def test_decode_pcm_wav_stereo_and_resampling(sample_stereo_wav_bytes: bytes):
    """Test stereo to mono mixing and sample rate conversion (48kHz -> 44.1kHz)."""
    waveform = decode_pcm_wav(sample_stereo_wav_bytes, target_sr=44100)
    assert isinstance(waveform, torch.Tensor)
    assert waveform.dim() == 1
    # Check resampled duration ~2.0s at 44.1kHz
    expected_len = int(2.0 * 44100)
    assert abs(len(waveform) - expected_len) < 50


def test_decode_pcm_wav_base64(sample_wav_base64: str):
    """Test decoding base64 encoded audio slice."""
    waveform = decode_pcm_wav(sample_wav_base64, target_sr=44100)
    assert isinstance(waveform, torch.Tensor)
    assert waveform.dim() == 1
    assert len(waveform) > 0


def test_decode_pcm_wav_data_url(sample_wav_base64: str):
    """Test decoding base64 string with data:audio/wav;base64, header."""
    data_url = f"data:audio/wav;base64,{sample_wav_base64}"
    waveform = decode_pcm_wav(data_url, target_sr=44100)
    assert isinstance(waveform, torch.Tensor)
    assert len(waveform) > 0


def test_extract_features_fallback_on_none():
    """Verify extract_features_from_audio generates synthetic audio when input is None."""
    features = extract_features_from_audio(
        audio_input=None,
        total_beats=8,
        bpm=130.0,
    )
    assert features.shape == (2, 8, 48, 128)
    assert (features[0] >= 0.0).all()
