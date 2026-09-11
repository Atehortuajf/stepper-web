/**
 * frontend/src/editor/audio/tempoEstimator.ts
 * Client-side onset autocorrelation tempo estimation & phase alignment.
 * Detects dominant musical BPM within ±1.0 BPM and initial phase offset.
 *
 * Pipeline:
 * 1. Mono decimation to 22.05 kHz
 * 2. STFT with N=512, hop=128, Hann windowing
 * 3. Positive half-wave rectified spectral flux
 * 4. Direct autocorrelation across [60, 240] BPM
 * 5. 3-point parabolic interpolation for sub-BPM precision
 * 6. Harmonic comb filter summation + 150 BPM log-Gaussian prior
 * 7. Integer / half-integer snapping (±0.20 BPM / ±0.15 BPM)
 * 8. Phase alignment (StepMania offset = -phi)
 */

export interface TempoEstimationResult {
  bpm: number;
  offset: number;
  confidence: number;
  rawBpm: number;
}

export interface TempoEstimationOptions {
  minBpm?: number; // default 60.0
  maxBpm?: number; // default 240.0
  targetSampleRate?: number; // default 22050
  tempoPriorCenter?: number; // default 150.0
  tempoPriorSigma?: number; // default 0.75 octaves
  maxScanDurationSec?: number; // default 60.0 seconds
}

export type AudioInputSource =
  | AudioBuffer
  | {
      numberOfChannels: number;
      sampleRate: number;
      duration?: number;
      getChannelData: (channel: number) => Float32Array;
    }
  | {
      channelData: Float32Array[];
      sampleRate: number;
      duration?: number;
    }
  | {
      mono: Float32Array;
      sampleRate: number;
      duration?: number;
    };

/**
 * Extracts and downsamples audio to mono Float32Array at effective sample rate.
 */
function extractMonoSamples(
  input: AudioInputSource,
  targetSr: number,
  maxScanSec: number
): { mono: Float32Array; effectiveSr: number } {
  let origSr = 44100;
  let ch0: Float32Array | null = null;
  let ch1: Float32Array | null = null;
  let totalDuration = 0;

  if ('getChannelData' in input && typeof input.getChannelData === 'function') {
    origSr = input.sampleRate;
    ch0 = input.getChannelData(0);
    ch1 = input.numberOfChannels > 1 ? input.getChannelData(1) : ch0;
    totalDuration = input.duration ?? (ch0.length / origSr);
  } else if ('channelData' in input && Array.isArray(input.channelData) && input.channelData.length > 0) {
    origSr = input.sampleRate;
    ch0 = input.channelData[0];
    ch1 = input.channelData.length > 1 ? input.channelData[1] : ch0;
    totalDuration = input.duration ?? (ch0.length / origSr);
  } else if ('mono' in input && input.mono instanceof Float32Array) {
    origSr = input.sampleRate;
    ch0 = input.mono;
    ch1 = input.mono;
    totalDuration = input.duration ?? (ch0.length / origSr);
  }

  if (!ch0 || ch0.length === 0) {
    return { mono: new Float32Array(0), effectiveSr: targetSr };
  }
  if (!ch1) ch1 = ch0;

  const downsampleRatio = Math.max(1, Math.round(origSr / targetSr));
  const effectiveSr = origSr / downsampleRatio;
  const sampleDuration = totalDuration || (ch0.length / origSr);
  const maxSamples = Math.min(
    Math.min(ch0.length, ch1.length),
    Math.floor(Math.min(sampleDuration, maxScanSec) * origSr)
  );
  const downsampledLen = Math.floor(maxSamples / downsampleRatio);

  const mono = new Float32Array(downsampledLen);
  for (let i = 0; i < downsampledLen; i++) {
    const srcIdx = i * downsampleRatio;
    mono[i] = (ch0[srcIdx] + ch1[srcIdx]) * 0.5;
  }

  return { mono, effectiveSr };
}

/**
 * Estimates dominant BPM and phase offset from an AudioBuffer or PCM source.
 */
export function estimateTempoAndOffset(
  input: AudioInputSource,
  options?: TempoEstimationOptions
): TempoEstimationResult {
  const minBpm = options?.minBpm ?? 60.0;
  const maxBpm = options?.maxBpm ?? 240.0;
  const targetSr = options?.targetSampleRate ?? 22050;
  const priorCenter = options?.tempoPriorCenter ?? 150.0;
  const priorSigma = options?.tempoPriorSigma ?? 0.75;
  const maxScanSec = options?.maxScanDurationSec ?? 60.0;

  // 1. Mono decimation
  const { mono, effectiveSr } = extractMonoSamples(input, targetSr, maxScanSec);

  // 2. STFT Spectral Flux setup (N=512, hop=128)
  const nFft = 512;
  const hopSize = 128;
  const fps = effectiveSr / hopSize;
  const numFrames = Math.floor((mono.length - nFft) / hopSize);
  if (numFrames <= 0) {
    return { bpm: 140.0, offset: 0.0, confidence: 0.0, rawBpm: 140.0 };
  }

  // Precompute Hann window
  const window = new Float32Array(nFft);
  for (let i = 0; i < nFft; i++) {
    window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (nFft - 1)));
  }

  // Precompute bit reversal table for N=512 (9 bits)
  const nBits = 9;
  const bitRev = new Uint16Array(nFft);
  for (let i = 0; i < nFft; i++) {
    let rev = 0;
    for (let b = 0; b < nBits; b++) {
      if ((i >> b) & 1) rev |= 1 << (nBits - 1 - b);
    }
    bitRev[i] = rev;
  }

  // Precompute twiddle factors
  const halfFft = nFft / 2; // 256
  const twiddleReal = new Float32Array(halfFft);
  const twiddleImag = new Float32Array(halfFft);
  for (let k = 0; k < halfFft; k++) {
    const angle = (-2.0 * Math.PI * k) / nFft;
    twiddleReal[k] = Math.cos(angle);
    twiddleImag[k] = Math.sin(angle);
  }

  const workReal = new Float32Array(nFft);
  const workImag = new Float32Array(nFft);
  const prevMag = new Float32Array(halfFft);
  const flux = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize;
    for (let i = 0; i < nFft; i++) {
      workReal[bitRev[i]] = mono[offset + i] * window[i];
      workImag[bitRev[i]] = 0.0;
    }

    for (let len = 2; len <= nFft; len <<= 1) {
      const halfLen = len >> 1;
      const step = nFft / len;
      for (let i = 0; i < nFft; i += len) {
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

    let frameFlux = 0.0;
    for (let k = 0; k < halfFft; k++) {
      const mag = Math.sqrt(workReal[k] * workReal[k] + workImag[k] * workImag[k]);
      if (f > 0 && mag > prevMag[k]) {
        frameFlux += mag - prevMag[k];
      }
      prevMag[k] = mag;
    }
    flux[f] = frameFlux;
  }

  // 3. Autocorrelation over [minBpm, maxBpm]
  let fluxSum = 0;
  for (let i = 0; i < numFrames; i++) fluxSum += flux[i];
  const fluxMean = fluxSum / numFrames;
  const fluxCentered = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) fluxCentered[i] = flux[i] - fluxMean;

  const minLag = Math.floor((fps * 60.0) / maxBpm);
  const maxLag = Math.ceil((fps * 60.0) / minBpm);
  const maxScanLag = maxLag * 2 + 2;
  const ac = new Float32Array(maxScanLag);

  for (let lag = Math.max(1, Math.floor(minLag / 2)); lag < maxScanLag; lag++) {
    let sum = 0.0;
    const end = numFrames - lag;
    for (let i = 0; i < end; i++) {
      sum += fluxCentered[i] * fluxCentered[i + lag];
    }
    ac[lag] = sum;
  }

  // 4. Peak picking with Parabolic Interpolation & Harmonic Comb Prior
  interface Candidate {
    bpm: number;
    rawBpm: number;
    score: number;
  }
  const candidates: Candidate[] = [];

  for (let lag = minLag; lag <= maxLag; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] > ac[lag + 1]) {
      const alpha = ac[lag - 1];
      const beta = ac[lag];
      const gamma = ac[lag + 1];
      const denom = alpha - 2 * beta + gamma;
      let refinedLag = lag;
      let refinedVal = beta;
      if (denom !== 0) {
        const delta = (0.5 * (alpha - gamma)) / denom;
        refinedLag = lag + delta;
        refinedVal = beta - 0.25 * (alpha - gamma) * delta;
      }
      const rawBpm = (fps * 60.0) / refinedLag;

      const octaveDiff = Math.log2(rawBpm / priorCenter);
      const prior = Math.exp(-0.5 * Math.pow(octaveDiff / priorSigma, 2));

      let comb = refinedVal;
      const halfLag = Math.round(refinedLag * 0.5);
      if (halfLag >= 1 && halfLag < ac.length) {
        comb += 0.5 * ac[halfLag];
      }
      const doubleLag = Math.round(refinedLag * 2.0);
      if (doubleLag < ac.length) {
        comb += 0.5 * ac[doubleLag];
      }

      // Integer and half-integer snapping for rhythm games
      let snappedBpm = rawBpm;
      if (Math.abs(rawBpm - Math.round(rawBpm)) <= 0.20) {
        snappedBpm = Math.round(rawBpm);
      } else if (Math.abs(rawBpm - Math.round(rawBpm * 2) / 2) <= 0.15) {
        snappedBpm = Math.round(rawBpm * 2) / 2;
      }

      candidates.push({
        bpm: snappedBpm,
        rawBpm,
        score: Math.max(0, comb) * prior,
      });
    }
  }

  if (candidates.length === 0) {
    let maxVal = -Infinity;
    let bestLag = minLag;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (ac[lag] > maxVal) {
        maxVal = ac[lag];
        bestLag = lag;
      }
    }
    if (maxVal > 0) {
      const rawBpm = (fps * 60.0) / bestLag;
      candidates.push({
        bpm: Math.round(rawBpm),
        rawBpm,
        score: maxVal,
      });
    } else {
      return { bpm: 140.0, offset: 0.0, confidence: 0.0, rawBpm: 140.0 };
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // 5. Phase alignment (Offset search)
  const beatPeriodSec = 60.0 / best.bpm;
  const numBeatsToScan = Math.min(64, Math.floor((numFrames / fps) / beatPeriodSec));
  const numPhaseSteps = 100;
  let bestPhaseScore = -Infinity;
  let bestPhaseSec = 0;

  for (let s = 0; s < numPhaseSteps; s++) {
    const phaseSec = (s / numPhaseSteps) * beatPeriodSec;
    let score = 0;
    for (let k = 0; k < numBeatsToScan; k++) {
      const tSec = phaseSec + k * beatPeriodSec;
      const fIdx = Math.round(tSec * fps);
      if (fIdx >= 0 && fIdx < numFrames) {
        score += flux[fIdx];
      }
    }
    if (score > bestPhaseScore) {
      bestPhaseScore = score;
      bestPhaseSec = phaseSec;
    }
  }

  // Wrap phase near beat boundary (within 5% of period) to 0.0
  if (bestPhaseSec > beatPeriodSec * 0.95 || bestPhaseSec < beatPeriodSec * 0.05) {
    bestPhaseSec = 0.0;
  }
  const detectedOffset = bestPhaseSec === 0 ? 0.0 : -bestPhaseSec;

  const confidence = candidates.length > 1
    ? (best.score - candidates[1].score) / Math.max(1e-6, best.score)
    : 1.0;

  return {
    bpm: best.bpm,
    offset: Number(detectedOffset.toFixed(6)),
    confidence: Math.max(0.0, Math.min(1.0, confidence)),
    rawBpm: Number(best.rawBpm.toFixed(4)),
  };
}
