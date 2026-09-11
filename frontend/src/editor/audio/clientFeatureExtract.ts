/**
 * frontend/src/editor/audio/clientFeatureExtract.ts
 * Continuous Bresenham phase-accumulated audio feature extraction in pure TypeScript.
 * Emits beat-synchronous 128-band Slaney Mel spectrograms and positive half-wave
 * rectified spectral flux at exactly 48 ticks per beat.
 * Guarantees mathematical parity with backend/app/core/feature_extract.py.
 */

export interface FeatureExtractionConfig {
  sampleRate?: number;
  nFft?: number;
  nMels?: number;
  fMin?: number;
  fMax?: number;
  ticksPerBeat?: number;
  compressionFactor?: number;
}

export class ClientAudioFeatureExtractor {
  public readonly sampleRate: number;
  public readonly nFft: number;
  public readonly nMels: number;
  public readonly fMin: number;
  public readonly fMax: number;
  public readonly ticksPerBeat: number;
  public readonly compressionFactor: number;

  private readonly hannWindow: Float32Array;
  private readonly melFilterbank: Float32Array; // Flattened (513, 128)
  private readonly bitReverseTable: Uint16Array;
  private readonly twiddleReal: Float32Array;
  private readonly twiddleImag: Float32Array;

  constructor(config?: FeatureExtractionConfig) {
    this.sampleRate = config?.sampleRate ?? 44100;
    this.nFft = config?.nFft ?? 1024;
    this.nMels = config?.nMels ?? 128;
    this.fMin = config?.fMin ?? 0.0;
    this.fMax = config?.fMax ?? this.sampleRate / 2.0;
    this.ticksPerBeat = config?.ticksPerBeat ?? 48;
    this.compressionFactor = config?.compressionFactor ?? 10000.0;

    // 1. Precompute periodic Hann window: 0.5 * (1 - cos(2*pi*n / N))
    this.hannWindow = new Float32Array(this.nFft);
    for (let n = 0; n < this.nFft; n++) {
      this.hannWindow[n] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * n) / this.nFft));
    }

    // 2. Precompute Radix-2 FFT tables for N = 1024
    const nBits = Math.log2(this.nFft);
    this.bitReverseTable = new Uint16Array(this.nFft);
    for (let i = 0; i < this.nFft; i++) {
      let rev = 0;
      for (let b = 0; b < nBits; b++) {
        if ((i >> b) & 1) {
          rev |= 1 << (nBits - 1 - b);
        }
      }
      this.bitReverseTable[i] = rev;
    }

    const halfFft = this.nFft / 2;
    this.twiddleReal = new Float32Array(halfFft);
    this.twiddleImag = new Float32Array(halfFft);
    for (let k = 0; k < halfFft; k++) {
      const angle = (-2.0 * Math.PI * k) / this.nFft;
      this.twiddleReal[k] = Math.cos(angle);
      this.twiddleImag[k] = Math.sin(angle);
    }

    // 3. Precompute Slaney-normalized Mel filterbank (513 x 128)
    this.melFilterbank = this.createSlaneyMelFilterbank();
  }

  private hzToMel(hz: number): number {
    const minLogHz = 1000.0;
    const minLogMel = 15.0;
    const logStep = 27.0 / Math.log(6.4);
    const linearStep = 200.0 / 3.0;
    if (hz >= minLogHz) {
      return minLogMel + Math.log(hz / minLogHz) * logStep;
    }
    return hz / linearStep;
  }

  private melToHz(mel: number): number {
    const minLogHz = 1000.0;
    const minLogMel = 15.0;
    const logStep = Math.log(6.4) / 27.0;
    const linearStep = 200.0 / 3.0;
    if (mel >= minLogMel) {
      return minLogHz * Math.exp(logStep * (mel - minLogMel));
    }
    return mel * linearStep;
  }

  private createSlaneyMelFilterbank(): Float32Array {
    const nFreqs = this.nFft / 2 + 1; // 513
    const fb = new Float32Array(nFreqs * this.nMels);

    const minMel = this.hzToMel(this.fMin);
    const maxMel = this.hzToMel(this.fMax);
    const melPoints = new Float64Array(this.nMels + 2);
    for (let i = 0; i < this.nMels + 2; i++) {
      melPoints[i] = minMel + (i * (maxMel - minMel)) / (this.nMels + 1);
    }

    const hzPoints = new Float64Array(this.nMels + 2);
    for (let i = 0; i < this.nMels + 2; i++) {
      hzPoints[i] = this.melToHz(melPoints[i]);
    }

    const fftFreqs = new Float64Array(nFreqs);
    for (let k = 0; k < nFreqs; k++) {
      fftFreqs[k] = (k * this.sampleRate) / this.nFft;
    }

    for (let m = 0; m < this.nMels; m++) {
      const fLeft = hzPoints[m];
      const fCenter = hzPoints[m + 1];
      const fRight = hzPoints[m + 2];
      const norm = 2.0 / (fRight - fLeft);

      for (let k = 0; k < nFreqs; k++) {
        const f = fftFreqs[k];
        if (f >= fLeft && f <= fCenter) {
          const val = fCenter > fLeft ? (f - fLeft) / (fCenter - fLeft) : 0.0;
          fb[k * this.nMels + m] = val * norm;
        } else if (f >= fCenter && f <= fRight) {
          const val = fRight > fCenter ? (fRight - f) / (fRight - fCenter) : 0.0;
          fb[k * this.nMels + m] = val * norm;
        }
      }
    }

    return fb;
  }

  /**
   * Fast In-Place Real FFT for length 1024.
   * Takes windowed real input and writes power spectrum of length 513 to outPower.
   */
  private rfftPower(
    realInput: Float32Array,
    workReal: Float32Array,
    workImag: Float32Array,
    outPower: Float32Array
  ): void {
    const N = this.nFft;

    // Bit-reversal copy
    for (let i = 0; i < N; i++) {
      const rev = this.bitReverseTable[i];
      workReal[rev] = realInput[i];
      workImag[rev] = 0.0;
    }

    // Cooley-Tukey Radix-2 butterflies
    for (let len = 2; len <= N; len <<= 1) {
      const halfLen = len >> 1;
      const step = N / len;

      for (let i = 0; i < N; i += len) {
        for (let j = 0; j < halfLen; j++) {
          const k = j * step;
          const uR = workReal[i + j];
          const uI = workImag[i + j];

          const vR = workReal[i + j + halfLen];
          const vI = workImag[i + j + halfLen];

          const tR = this.twiddleReal[k];
          const tI = this.twiddleImag[k];

          const rotR = vR * tR - vI * tI;
          const rotI = vR * tI + vI * tR;

          workReal[i + j] = uR + rotR;
          workImag[i + j] = uI + rotI;

          workReal[i + j + halfLen] = uR - rotR;
          workImag[i + j + halfLen] = uI - rotI;
        }
      }
    }

    // Compute power spectrum for 0 <= k <= N / 2 (513 bins)
    const nFreqs = N / 2 + 1;
    for (let k = 0; k < nFreqs; k++) {
      const r = workReal[k];
      const im = workImag[k];
      outPower[k] = r * r + im * im;
    }
  }

  /**
   * Continuous Bresenham phase-accumulated feature extraction.
   * Emits flat Float32Array of shape [1, 2, totalBeats, 48, 128]:
   * Channel 0: Log-Mel spectrogram (log1p(10000 * S_mel))
   * Channel 1: Positive half-wave rectified spectral flux
   */
  public extract(
    waveform: Float32Array,
    totalBeats: number,
    bpm: number = 140.0,
    offset: number = 0.0,
    startBeat: number = 0.0,
    sliceStartSec: number = 0.0
  ): Float32Array {
    if (bpm <= 0) bpm = 120.0;

    const totalTicks = totalBeats * this.ticksPerBeat;
    const nFreqs = this.nFft / 2 + 1; // 513
    const halfWin = this.nFft / 2; // 512

    // Intermediate buffers for FFT and Mel projection
    const frameBuffer = new Float32Array(this.nFft);
    const workReal = new Float32Array(this.nFft);
    const workImag = new Float32Array(this.nFft);
    const powerSpec = new Float32Array(nFreqs);

    // Channel 0: Log-Mel [totalTicks, 128]
    const sLog = new Float32Array(totalTicks * this.nMels);
    // Channel 1: Flux [totalTicks, 128]
    const flux = new Float32Array(totalTicks * this.nMels);

    const numSamples = waveform.length;

    // Process each tick
    for (let t = 0; t < totalTicks; t++) {
      const beat = startBeat + t / this.ticksPerBeat;
      const tAudio = beat * (60.0 / bpm) - offset;
      const center = Math.round((tAudio - sliceStartSec) * this.sampleRate);

      // Windowing with zero-padding boundary conditions
      for (let n = 0; n < this.nFft; n++) {
        const sampleIdx = center - halfWin + n;
        const s = sampleIdx >= 0 && sampleIdx < numSamples ? waveform[sampleIdx] : 0.0;
        frameBuffer[n] = s * this.hannWindow[n];
      }

      // RFFT -> Power Spectrum
      this.rfftPower(frameBuffer, workReal, workImag, powerSpec);

      // Matrix multiplication: powerSpec (1 x 513) * melFilterbank (513 x 128)
      const tickOffset = t * this.nMels;
      for (let m = 0; m < this.nMels; m++) {
        let melVal = 0.0;
        for (let k = 0; k < nFreqs; k++) {
          melVal += powerSpec[k] * this.melFilterbank[k * this.nMels + m];
        }

        // Non-negative Log dynamic range compression: log1p(10000 * S_mel)
        const logVal = Math.log1p(this.compressionFactor * melVal);
        sLog[tickOffset + m] = logVal;

        // Positive Half-Wave Rectified Spectral Flux (diff from previous tick)
        if (t === 0) {
          flux[tickOffset + m] = 0.0;
        } else {
          const prevLog = sLog[(t - 1) * this.nMels + m];
          const diff = logVal - prevLog;
          flux[tickOffset + m] = diff > 0 ? diff : 0.0;
        }
      }
    }

    // Pack into flat array with shape [1, 2, totalBeats, 48, 128]
    // Total size = 2 * totalTicks * 128
    const totalElements = 2 * totalTicks * this.nMels;
    const result = new Float32Array(totalElements);

    // Channel 0 (sLog): offset 0 .. totalTicks * 128
    result.set(sLog, 0);
    // Channel 1 (flux): offset totalTicks * 128 .. 2 * totalTicks * 128
    result.set(flux, totalTicks * this.nMels);

    return result;
  }
}

/**
 * Helper to extract audio waveform Float32Array from Web Audio AudioBuffer.
 * Mixes multi-channel audio to mono.
 */
export function audioBufferToMonoWaveform(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  if (numChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const mono = new Float32Array(length);
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    mono[i] = (ch0[i] + ch1[i]) * 0.5;
  }
  return mono;
}

// Global default extractor instance
export const clientFeatureExtractor = new ClientAudioFeatureExtractor();
