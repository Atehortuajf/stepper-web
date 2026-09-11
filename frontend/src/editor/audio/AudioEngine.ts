/**
 * frontend/src/editor/audio/AudioEngine.ts
 * Web Audio API engine for ArrowVortex-grade rhythm game stepchart editing.
 * Handles client-side audio decoding (MP3, OGG, WAV), multi-speed playback (0.25x - 2.0x),
 * waveform peak pyramids, STFT spectrogram extraction, and audio bookmarking.
 */

export interface AudioBookmark {
  id: string;
  time: number; // in seconds
  name: string;
  color?: string;
}

export interface PeakPyramid {
  sampleRate: number;
  duration: number;
  levels: Array<{
    step: number; // samples per bucket
    mins: Float32Array;
    maxs: Float32Array;
  }>;
}

export interface SpectrogramData {
  timeBins: number;
  freqBins: number;
  hopSize: number;
  fftSize: number;
  sampleRate: number;
  // Matrix of shape [timeBins, freqBins], normalized 0.0 to 1.0
  magnitudes: Float32Array;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  public audioBuffer: AudioBuffer | null = null;
  public channelData: Float32Array[] = [];
  public duration = 0.0;
  public sampleRate = 44100;

  // Playback state
  public isPlaying = false;
  public playbackRate = 1.0;
  private startCtxTime = 0;
  private pauseOffset = 0;

  // Bookmarking
  public bookmarks: AudioBookmark[] = [];

  // Precomputed visual caches (lazy on-demand)
  private _peakPyramid: PeakPyramid | null = null;
  public get peakPyramid(): PeakPyramid | null {
    if (!this._peakPyramid && this.channelData.length > 0) {
      this.buildPeakPyramid();
    }
    return this._peakPyramid;
  }
  public set peakPyramid(val: PeakPyramid | null) {
    this._peakPyramid = val;
  }
  public spectrogram: SpectrogramData | null = null;
  private monoSamples: Float32Array | null = null;

  // Listeners
  private timeListeners = new Set<(timeSec: number) => void>();
  private stateListeners = new Set<(isPlaying: boolean) => void>();
  private animFrameId: number | null = null;

  private volume = 0.7;

  constructor() {
    // AudioContext lazily initialized to conform to browser autoplay policies
  }

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Decodes an audio file (MP3, OGG, WAV, etc.) from ArrayBuffer.
   */
  public async loadAudioFromBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    // Use slice to preserve original arrayBuffer
    const copy = arrayBuffer.slice(0);
    const decoded = await ctx.decodeAudioData(copy);
    this.setAudioBuffer(decoded);
    return decoded;
  }

  /**
   * Generates a deterministic synthetic metronome/beat audio track.
   * Useful for unit tests or instant developer onboarding without an external audio file.
   */
  public generateSyntheticTrack(bpm = 140, durationSec = 30): AudioBuffer {
    const ctx = this.getAudioContext();
    const sr = ctx.sampleRate || 44100;
    const totalSamples = Math.floor(sr * durationSec);
    const buffer = ctx.createBuffer(2, totalSamples, sr);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const beatInterval = 60.0 / bpm;
    const clickSamples = Math.floor(sr * 0.02); // 20ms click

    for (let t = 0; t < durationSec; t += beatInterval) {
      const startSample = Math.floor(t * sr);
      const isDownbeat = Math.floor(t / beatInterval) % 4 === 0;
      const freq = isDownbeat ? 1000 : 700;

      for (let s = 0; s < clickSamples && startSample + s < totalSamples; s++) {
        const env = Math.exp(-s / (sr * 0.005));
        const val = Math.sin((2 * Math.PI * freq * s) / sr) * env * 0.3;
        left[startSample + s] += val;
        right[startSample + s] += val;
      }
    }

    this.setAudioBuffer(buffer);
    return buffer;
  }

  /**
   * Sets the active AudioBuffer and builds peak pyramids & spectrogram cache.
   */
  public setAudioBuffer(buffer: AudioBuffer): void {
    this.stop();
    this.audioBuffer = buffer;
    this.duration = buffer.duration;
    this.sampleRate = buffer.sampleRate;
    this.channelData = [];
    this.monoSamples = null;

    for (let c = 0; c < buffer.numberOfChannels; c++) {
      this.channelData.push(buffer.getChannelData(c));
    }

    this._peakPyramid = null;
    this.spectrogram = null;
  }

  /**
   * Builds multi-resolution min/max peak pyramids for smooth 1x-64x zoom rendering.
   */
  private buildPeakPyramid(): void {
    if (!this.channelData || this.channelData.length === 0) return;

    const ch0 = this.channelData[0];
    const ch1 = this.channelData.length > 1 ? this.channelData[1] : null;
    const totalSamples = ch0.length;

    // Multi-resolution bucket sizes
    const steps = [128, 512, 2048, 8192];
    const levels: PeakPyramid['levels'] = [];

    // Base level (step 128): single pass over channel buffers directly (no intermediate allocation)
    const baseStep = steps[0];
    const numBaseBuckets = Math.ceil(totalSamples / baseStep);
    const baseMins = new Float32Array(numBaseBuckets);
    const baseMaxs = new Float32Array(numBaseBuckets);

    if (ch1) {
      for (let b = 0; b < numBaseBuckets; b++) {
        const start = b * baseStep;
        const end = Math.min(start + baseStep, totalSamples);
        let min = 1.0;
        let max = -1.0;

        for (let s = start; s < end; s++) {
          const v = (ch0[s] + ch1[s]) * 0.5;
          if (v < min) min = v;
          if (v > max) max = v;
        }

        baseMins[b] = min > max ? 0 : min;
        baseMaxs[b] = min > max ? 0 : max;
      }
    } else {
      for (let b = 0; b < numBaseBuckets; b++) {
        const start = b * baseStep;
        const end = Math.min(start + baseStep, totalSamples);
        let min = 1.0;
        let max = -1.0;

        for (let s = start; s < end; s++) {
          const v = ch0[s];
          if (v < min) min = v;
          if (v > max) max = v;
        }

        baseMins[b] = min > max ? 0 : min;
        baseMaxs[b] = min > max ? 0 : max;
      }
    }

    levels.push({ step: baseStep, mins: baseMins, maxs: baseMaxs });

    // Higher levels downsampled hierarchically from previous level in O(numBuckets)
    for (let l = 1; l < steps.length; l++) {
      const step = steps[l];
      const prevLevel = levels[l - 1];
      const ratio = step / prevLevel.step;
      const numBuckets = Math.ceil(totalSamples / step);
      const mins = new Float32Array(numBuckets);
      const maxs = new Float32Array(numBuckets);

      for (let b = 0; b < numBuckets; b++) {
        const start = b * ratio;
        const end = Math.min(start + ratio, prevLevel.mins.length);
        let min = 1.0;
        let max = -1.0;

        for (let i = start; i < end; i++) {
          const vMin = prevLevel.mins[i];
          const vMax = prevLevel.maxs[i];
          if (vMin < min) min = vMin;
          if (vMax > max) max = vMax;
        }

        mins[b] = min > max ? 0 : min;
        maxs[b] = min > max ? 0 : max;
      }

      levels.push({ step, mins, maxs });
    }

    this._peakPyramid = {
      sampleRate: this.sampleRate,
      duration: this.duration,
      levels,
    };
  }

  /**
   * Computes STFT spectrogram magnitudes using Radix-2 Cooley-Tukey FFT.
   * Generates spectrogram on-demand with zero thread-locking.
   */
  public buildSpectrogram(): SpectrogramData | null {
    if (this.spectrogram) return this.spectrogram;
    if (!this.channelData || this.channelData.length === 0) return null;

    const mono = this.getMonoSamples();
    const totalSamples = mono.length;
    const fftSize = 512;
    const hopSize = 256;
    const freqBins = fftSize / 2;
    const timeBins = Math.floor((totalSamples - fftSize) / hopSize);

    if (timeBins <= 0) return null;

    // 1. Precompute Hann window
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // 2. Precompute bit reversal table for N = 512 (9 bits)
    const nBits = Math.log2(fftSize);
    const bitReverseTable = new Uint16Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      let rev = 0;
      for (let b = 0; b < nBits; b++) {
        if ((i >> b) & 1) {
          rev |= 1 << (nBits - 1 - b);
        }
      }
      bitReverseTable[i] = rev;
    }

    // 3. Precompute twiddle factors
    const halfFft = fftSize / 2;
    const twiddleReal = new Float32Array(halfFft);
    const twiddleImag = new Float32Array(halfFft);
    for (let k = 0; k < halfFft; k++) {
      const angle = (-2.0 * Math.PI * k) / fftSize;
      twiddleReal[k] = Math.cos(angle);
      twiddleImag[k] = Math.sin(angle);
    }

    // Work arrays
    const workReal = new Float32Array(fftSize);
    const workImag = new Float32Array(fftSize);
    const magnitudes = new Float32Array(timeBins * freqBins);

    // 4. Compute STFT using Cooley-Tukey Radix-2 FFT
    for (let t = 0; t < timeBins; t++) {
      const offset = t * hopSize;
      let maxMag = 1e-6;

      // Bit-reversal copy with Hann window
      for (let i = 0; i < fftSize; i++) {
        const rev = bitReverseTable[i];
        workReal[rev] = mono[offset + i] * window[i];
        workImag[rev] = 0.0;
      }

      // Radix-2 butterflies
      for (let len = 2; len <= fftSize; len <<= 1) {
        const halfLen = len >> 1;
        const step = fftSize / len;

        for (let i = 0; i < fftSize; i += len) {
          for (let j = 0; j < halfLen; j++) {
            const k = j * step;
            const uR = workReal[i + j];
            const uI = workImag[i + j];
            const vR = workReal[i + j + halfLen];
            const vI = workImag[i + j + halfLen];
            const tR = twiddleReal[k];
            const tI = twiddleImag[k];

            const rotR = vR * tR - vI * tI;
            const rotI = vR * tI + vI * tR;

            workReal[i + j] = uR + rotR;
            workImag[i + j] = uI + rotI;
            workReal[i + j + halfLen] = uR - rotR;
            workImag[i + j + halfLen] = uI - rotI;
          }
        }
      }

      const binOffset = t * freqBins;
      for (let k = 0; k < freqBins; k++) {
        const r = workReal[k];
        const im = workImag[k];
        const mag = Math.sqrt(r * r + im * im);
        magnitudes[binOffset + k] = mag;
        if (mag > maxMag) maxMag = mag;
      }

      // Local logarithmic normalization
      for (let k = 0; k < freqBins; k++) {
        const raw = magnitudes[binOffset + k];
        const logMag = Math.log10(1 + 9 * (raw / maxMag));
        magnitudes[binOffset + k] = Math.max(0, Math.min(1, logMag));
      }
    }

    this.spectrogram = {
      timeBins,
      freqBins,
      hopSize,
      fftSize,
      sampleRate: this.sampleRate,
      magnitudes,
    };

    return this.spectrogram;
  }

  public ensureSpectrogram(): SpectrogramData | null {
    return this.buildSpectrogram();
  }

  public getMonoSamples(): Float32Array {
    if (this.monoSamples) return this.monoSamples;
    if (this.channelData.length === 0) return new Float32Array(0);
    if (this.channelData.length === 1) {
      this.monoSamples = this.channelData[0];
      return this.monoSamples;
    }

    const len = this.channelData[0].length;
    const mono = new Float32Array(len);
    const left = this.channelData[0];
    const right = this.channelData[1];

    for (let i = 0; i < len; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }
    this.monoSamples = mono;
    return mono;
  }

  /**
   * Starts playback from current pauseOffset or specified time.
   */
  public async play(startSec?: number): Promise<void> {
    if (!this.audioBuffer) return;
    const ctx = this.getAudioContext();

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // AudioContext resume error handling
      }
    }

    if (this.isPlaying) {
      this.stopSource();
    }

    if (startSec !== undefined) {
      this.pauseOffset = Math.max(0, Math.min(startSec, this.duration));
    }

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.playbackRate.value = this.playbackRate;
    this.sourceNode.connect(this.gainNode!);

    this.sourceNode.onended = () => {
      if (this.isPlaying && this.getCurrentTime() >= this.duration) {
        this.pause();
        this.pauseOffset = 0;
      }
    };

    this.startCtxTime = ctx.currentTime;
    this.sourceNode.start(0, this.pauseOffset);
    this.isPlaying = true;
    this.notifyState();
    this.startTicker();
  }

  /**
   * Pauses audio playback preserving position.
   */
  public pause(): void {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.stopSource();
    this.isPlaying = false;
    this.stopTicker();
    this.notifyState();
    this.notifyTime(this.pauseOffset);
  }

  /**
   * Stops playback and resets cursor to start.
   */
  public stop(): void {
    this.stopSource();
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.stopTicker();
    this.notifyState();
    this.notifyTime(0);
  }

  /**
   * Seeks to a specific audio time (in seconds).
   */
  public seek(targetSec: number): void {
    const clamped = Math.max(0, Math.min(targetSec, this.duration));
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.play(clamped);
    } else {
      this.pauseOffset = clamped;
      this.notifyTime(clamped);
    }
  }

  /**
   * Sets playback rate (supported: 0.25x to 2.0x).
   */
  public setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.25, Math.min(2.0, rate));
    if (this.isPlaying) {
      const current = this.getCurrentTime();
      this.playbackRate = clamped;
      if (this.sourceNode) {
        this.sourceNode.playbackRate.value = clamped;
      }
      this.pauseOffset = current;
      this.startCtxTime = this.getAudioContext().currentTime;
    } else {
      this.playbackRate = clamped;
    }
  }

  /**
   * Sets volume level between 0.0 and 1.0.
   */
  public setVolume(vol: number): void {
    this.volume = Math.max(0.0, Math.min(1.0, vol));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  /**
   * Returns current master volume level (0.0 to 1.0).
   */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * Returns exact audio playback timestamp in seconds.
   */
  public getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.pauseOffset;
    }
    const ctx = this.getAudioContext();
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    const elapsed = Math.max(0, (ctx.currentTime - this.startCtxTime - latency) * this.playbackRate);
    return Math.max(0, Math.min(this.duration, this.pauseOffset + elapsed));
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Node might have already finished
      }
      this.sourceNode = null;
    }
  }

  private startTicker(): void {
    this.stopTicker();
    const tick = () => {
      if (this.isPlaying) {
        this.notifyTime(this.getCurrentTime());
        this.animFrameId = requestAnimationFrame(tick);
      }
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopTicker(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // --- Bookmarks ---
  public addBookmark(time: number, name?: string, color = '#ffd000'): AudioBookmark {
    const bookmark: AudioBookmark = {
      id: 'bm_' + Math.random().toString(36).substring(2, 9),
      time: Math.max(0, Math.min(time, this.duration)),
      name: name || `Mark ${this.bookmarks.length + 1}`,
      color,
    };
    this.bookmarks.push(bookmark);
    this.bookmarks.sort((a, b) => a.time - b.time);
    return bookmark;
  }

  public removeBookmark(id: string): void {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
  }

  public jumpToNextBookmark(): void {
    const curr = this.getCurrentTime();
    const next = this.bookmarks.find((b) => b.time > curr + 0.05);
    if (next) this.seek(next.time);
  }

  public jumpToPrevBookmark(): void {
    const curr = this.getCurrentTime();
    const prev = [...this.bookmarks].reverse().find((b) => b.time < curr - 0.05);
    if (prev) this.seek(prev.time);
  }

  // --- Subscription Listeners ---
  public onTimeUpdate(listener: (timeSec: number) => void): () => void {
    this.timeListeners.add(listener);
    return () => this.timeListeners.delete(listener);
  }

  public onStateChange(listener: (isPlaying: boolean) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyTime(timeSec: number): void {
    for (const listener of this.timeListeners) {
      listener(timeSec);
    }
  }

  private notifyState(): void {
    for (const listener of this.stateListeners) {
      listener(this.isPlaying);
    }
  }

  public dispose(): void {
    this.stop();
    this.timeListeners.clear();
    this.stateListeners.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.gainNode = null;
  }
}
