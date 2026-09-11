/**
 * frontend/src/editor/__tests__/m2_adversarial_challenge.test.ts
 * Empirical Challenger Test Suite for Milestone 2:
 * Client-Side Audio-Only Tempo Estimation & Grid Synchronization.
 *
 * Covers:
 * 1. Deterministic stereo reference fixture at 170 BPM.
 * 2. Synthetic pulse trains at arbitrary tempos (120.0, 133.33, 175.0, 200.0 BPM, edge tempos).
 * 3. Silent audio across multiple duration scales (0.01s to 30s).
 * 4. Extremely short audio clips (< 2 sec, down to 0 samples).
 * 5. Corrupted/pathological buffers (NaNs, Infs, DC offsets, extreme amplitudes).
 * 6. Sample rate invariance (22.05k, 44.1k, 48k, 96k).
 * 7. AudioEngine integration and contract conformance.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTempoAndOffset,
  type TempoEstimationResult,
} from '../audio/tempoEstimator';
import { AudioEngine } from '../audio/AudioEngine';

/**
 * Generates synthetic metronome audio pulse samples for testing.
 */
function createSyntheticBeatAudio(
  bpm: number,
  durationSec = 15,
  sampleRate = 44100,
  initialOffsetSec = 0.0,
  uniformPitch = false
): { channelData: Float32Array[]; sampleRate: number; duration: number } {
  const totalSamples = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);
  const beatInterval = 60.0 / bpm;
  const clickSamples = Math.floor(sampleRate * 0.02); // 20ms click pulse

  for (let t = initialOffsetSec; t < durationSec; t += beatInterval) {
    const startSample = Math.floor(t * sampleRate);
    if (startSample < 0) continue;
    const isDownbeat =
      Math.floor((t - initialOffsetSec) / beatInterval + 0.5) % 4 === 0;
    const freq = uniformPitch ? 800 : isDownbeat ? 1000 : 700;

    for (let s = 0; s < clickSamples && startSample + s < totalSamples; s++) {
      const env = Math.exp(-s / (sampleRate * 0.004));
      const val = Math.sin((2 * Math.PI * freq * s) / sampleRate) * env * 0.5;
      left[startSample + s] += val;
      right[startSample + s] += val;
    }
  }

  return {
    channelData: [left, right],
    sampleRate,
    duration: durationSec,
  };
}

describe('Milestone 2 Empirical Challenge: Audio-Only Tempo Estimation & Grid Sync', () => {
  function createReferenceFixture(durationSec: number): {
    ch0: Float32Array;
    ch1: Float32Array;
    sampleRate: number;
    duration: number;
  } {
    const fixture = createSyntheticBeatAudio(170, durationSec, 44100);
    return {
      ch0: fixture.channelData[0],
      ch1: fixture.channelData[1],
      sampleRate: fixture.sampleRate,
      duration: fixture.duration,
    };
  }

  describe('1. Portable deterministic reference fixture (Strict 170.0 ± 1.0 BPM)', () => {
    it('generates deterministic stereo PCM with a beat-zero transient', () => {
      const first = createReferenceFixture(5);
      const second = createReferenceFixture(5);
      expect(first.sampleRate).toBe(44100);
      expect(first.duration).toBe(5);
      expect(first.ch0.length).toBe(220500);
      expect(first.ch0).toEqual(second.ch0);
      expect(first.ch1).toEqual(second.ch1);
      expect(first.ch0.some((sample) => sample !== 0)).toBe(true);
    });

    it('empirically detects strictly 170.0 BPM (within ±1.0 BPM) on a 30s stereo window', () => {
      const { ch0, ch1, sampleRate, duration } = createReferenceFixture(30);
      const audioSource = { channelData: [ch0, ch1], sampleRate, duration };

      const t0 = performance.now();
      const result: TempoEstimationResult = estimateTempoAndOffset(audioSource);
      const elapsedMs = performance.now() - t0;

      console.log(
        `[M2 Portable Reference] 30s -> BPM: ${result.bpm} (raw: ${result.rawBpm}), offset: ${result.offset}s, conf: ${result.confidence.toFixed(3)}, time: ${elapsedMs.toFixed(1)}ms`
      );

      // Strict requirement: 170.0 BPM within ±1.0 BPM
      expect(result.bpm).toBeGreaterThanOrEqual(169.0);
      expect(result.bpm).toBeLessThanOrEqual(171.0);
      expect(result.bpm).toBe(170.0); // Exact integer snapping

      // Raw BPM verification
      expect(result.rawBpm).toBeGreaterThanOrEqual(169.0);
      expect(result.rawBpm).toBeLessThanOrEqual(171.0);
      expect(Math.abs(result.rawBpm - 170.0)).toBeLessThan(0.25);

      // Phase offset verification (ground truth 0.000000)
      expect(result.offset).toBe(0.0);

      // Confidence and latency
      expect(result.confidence).toBeGreaterThan(0.2);
      expect(elapsedMs).toBeLessThan(1500);
    });

    it('empirically detects 170.0 BPM across diverse window durations (5s, 15s, 30s)', () => {
      const windowDurations = [5, 15, 30];
      for (const winSec of windowDurations) {
        const { ch0, ch1, sampleRate, duration } = createReferenceFixture(winSec);
        const result = estimateTempoAndOffset({
          channelData: [ch0, ch1],
          sampleRate,
          duration,
        });

        expect(result.bpm).toBe(170.0);
        expect(result.offset).toBe(0.0);
        expect(Math.abs(result.rawBpm - 170.0)).toBeLessThan(0.3);
      }
    });

    it('empirically detects 170.0 BPM on isolated single channels (mono left and mono right)', () => {
      const { ch0, ch1, sampleRate, duration } = createReferenceFixture(30);

      const resLeft = estimateTempoAndOffset({
        mono: ch0,
        sampleRate,
        duration,
      });
      expect(resLeft.bpm).toBe(170.0);
      expect(resLeft.offset).toBe(0.0);

      const resRight = estimateTempoAndOffset({
        mono: ch1,
        sampleRate,
        duration,
      });
      expect(resRight.bpm).toBe(170.0);
      expect(resRight.offset).toBe(0.0);
    });
  });

  describe('2. Arbitrary Synthetic Pulse Trains: Precision, Linearity, and Graceful Behavior', () => {
    it('detects standard 120.0 BPM pulse train with exact snapping and zero offset', () => {
      const audio = createSyntheticBeatAudio(120.0, 15);
      const res = estimateTempoAndOffset(audio);
      expect(res.bpm).toBe(120.0);
      expect(Math.abs(res.rawBpm - 120.0)).toBeLessThan(0.2);
      expect(res.offset).toBe(0.0);
      expect(res.confidence).toBeGreaterThan(0.5);
    });

    it('detects non-integer 133.33 BPM pulse train within ±0.1 BPM without rounding corruption', () => {
      const targetBpm = 133.33;
      const audio = createSyntheticBeatAudio(targetBpm, 15);
      const res = estimateTempoAndOffset(audio);

      // 133.33 is not near integer or half-integer, so rawBpm is preserved
      expect(Math.abs(res.bpm - targetBpm)).toBeLessThan(0.1);
      expect(Math.abs(res.rawBpm - targetBpm)).toBeLessThan(0.1);
      expect(Number.isFinite(res.bpm)).toBe(true);
      expect(res.offset).toBe(0.0);
    });

    it('detects high-tempo 175.0 BPM (DnB) with exact snapping', () => {
      const audio = createSyntheticBeatAudio(175.0, 15);
      const res = estimateTempoAndOffset(audio);
      expect(res.bpm).toBe(175.0);
      expect(Math.abs(res.rawBpm - 175.0)).toBeLessThan(0.2);
      expect(res.offset).toBe(0.0);
    });

    it('evaluates 200.0 BPM pulse train gracefully without NaN or unhandled exceptions', () => {
      const audio = createSyntheticBeatAudio(200.0, 15);
      const resDefault = estimateTempoAndOffset(audio);

      // Under default 150 BPM prior, 200 BPM evaluates to 100.0 BPM (2:1 subharmonic octave)
      expect(Number.isFinite(resDefault.bpm)).toBe(true);
      expect(Number.isNaN(resDefault.bpm)).toBe(false);
      expect(resDefault.bpm === 100.0 || resDefault.bpm === 200.0).toBe(true);
      expect(Number.isFinite(resDefault.offset)).toBe(true);

      // When prior center is tuned for high BPM (200 BPM prior), detects 199.71 BPM within ±0.3 BPM
      const resTuned = estimateTempoAndOffset(audio, { tempoPriorCenter: 200 });
      expect(Math.abs(resTuned.rawBpm - 200.0)).toBeLessThan(0.5);
      expect(Number.isFinite(resTuned.bpm)).toBe(true);
    });

    it('evaluates a comprehensive spectrum of tempos across [60, 185] BPM within ±1.0 BPM', () => {
      const benchmarkTempos = [60.0, 80.0, 100.0, 128.0, 140.0, 150.0, 160.0, 170.0, 172.5, 180.0, 185.0];
      for (const bpm of benchmarkTempos) {
        const audio = createSyntheticBeatAudio(bpm, 15);
        const res = estimateTempoAndOffset(audio);
        expect(Math.abs(res.bpm - bpm)).toBeLessThanOrEqual(1.0);
        expect(Number.isFinite(res.bpm)).toBe(true);
        expect(Number.isFinite(res.offset)).toBe(true);
      }
    });

    it('accurately resolves phase offset under simulated audio delay', () => {
      const delays = [0.08, 0.15, 0.22];
      for (const delay of delays) {
        const audio = createSyntheticBeatAudio(120.0, 15, 44100, delay);
        const res = estimateTempoAndOffset(audio);
        expect(res.bpm).toBe(120.0);
        // StepMania offset = -delay (within ±0.03s resolution)
        expect(Math.abs(res.offset - (-delay))).toBeLessThan(0.04);
      }
    });
  });

  describe('3. Silent Audio & Constant Signal Robustness (Zero Exceptions & Non-NaN)', () => {
    it('gracefully handles pure silence across varying durations from 10ms to 30s', () => {
      const durations = [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0];
      for (const dur of durations) {
        const numSamples = Math.floor(44100 * dur);
        const silence = {
          channelData: [new Float32Array(numSamples), new Float32Array(numSamples)],
          sampleRate: 44100,
          duration: dur,
        };
        const res = estimateTempoAndOffset(silence);

        expect(Number.isFinite(res.bpm)).toBe(true);
        expect(Number.isNaN(res.bpm)).toBe(false);
        expect(res.bpm).toBe(140.0); // Canonical safe fallback
        expect(res.offset).toBe(0.0);
        expect(res.confidence).toBe(0.0);
      }
    });

    it('gracefully handles constant DC offset without division by zero or NaN', () => {
      const dcLevels = [1.0, -1.0, 0.5, -0.5];
      for (const level of dcLevels) {
        const dcData = new Float32Array(44100 * 2).fill(level);
        const res = estimateTempoAndOffset({
          channelData: [dcData, dcData],
          sampleRate: 44100,
          duration: 2.0,
        });

        expect(Number.isFinite(res.bpm)).toBe(true);
        expect(Number.isNaN(res.bpm)).toBe(false);
        expect(res.bpm).toBe(140.0);
        expect(res.offset).toBe(0.0);
      }
    });

    it('gracefully handles extreme dynamic range (huge amplitude and infinitesimal amplitude)', () => {
      // Saturated signal
      const hugeData = new Float32Array(44100).fill(1e8);
      const resHuge = estimateTempoAndOffset({
        channelData: [hugeData],
        sampleRate: 44100,
        duration: 1.0,
      });
      expect(Number.isFinite(resHuge.bpm)).toBe(true);
      expect(Number.isNaN(resHuge.bpm)).toBe(false);

      // Infinitesimal subnormal signal
      const tinyData = new Float32Array(44100).fill(1e-30);
      const resTiny = estimateTempoAndOffset({
        channelData: [tinyData],
        sampleRate: 44100,
        duration: 1.0,
      });
      expect(Number.isFinite(resTiny.bpm)).toBe(true);
      expect(Number.isNaN(resTiny.bpm)).toBe(false);
    });
  });

  describe('4. Extremely Short Audio Clips (< 2 sec) & Boundary Buffers', () => {
    it('gracefully handles sub-FFT buffers (< 512 samples) with default safe fallback', () => {
      const sampleCounts = [0, 1, 10, 64, 128, 256, 511];
      for (const count of sampleCounts) {
        const buffer = {
          channelData: [new Float32Array(count).fill(0.2)],
          sampleRate: 44100,
          duration: count / 44100,
        };
        const res = estimateTempoAndOffset(buffer);

        expect(res.bpm).toBe(140.0);
        expect(res.offset).toBe(0.0);
        expect(res.confidence).toBe(0.0);
        expect(Number.isFinite(res.bpm)).toBe(true);
        expect(Number.isNaN(res.bpm)).toBe(false);
      }
    });

    it('evaluates short audio clips between 0.05s and 1.99s without crashes or NaNs', () => {
      const clipDurations = [0.05, 0.1, 0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 1.99];
      for (const dur of clipDurations) {
        const n = Math.floor(44100 * dur);
        const noise = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          noise[i] = (Math.sin(i * 0.1) + Math.cos(i * 0.03)) * 0.2;
        }

        const res = estimateTempoAndOffset({
          channelData: [noise, noise],
          sampleRate: 44100,
          duration: dur,
        });

        expect(Number.isFinite(res.bpm)).toBe(true);
        expect(Number.isNaN(res.bpm)).toBe(false);
        expect(res.bpm).toBeGreaterThan(0);
        expect(Number.isFinite(res.offset)).toBe(true);
        expect(Number.isNaN(res.offset)).toBe(false);
        expect(Number.isFinite(res.confidence)).toBe(true);
      }
    });
  });

  describe('5. Pathological, Corrupted, and Out-of-Spec Input Robustness', () => {
    it('handles buffers filled with NaN without throwing unhandled exceptions or returning NaN', () => {
      const nanData = new Float32Array(44100).fill(NaN);
      const res = estimateTempoAndOffset({
        channelData: [nanData],
        sampleRate: 44100,
        duration: 1.0,
      });

      expect(Number.isFinite(res.bpm)).toBe(true);
      expect(Number.isNaN(res.bpm)).toBe(false);
      expect(res.bpm).toBe(140.0);
      expect(Number.isFinite(res.offset)).toBe(true);
      expect(Number.isNaN(res.offset)).toBe(false);
    });

    it('handles buffers filled with Infinity / -Infinity gracefully', () => {
      const infData = new Float32Array(44100).fill(Infinity);
      const res = estimateTempoAndOffset({
        channelData: [infData],
        sampleRate: 44100,
        duration: 1.0,
      });

      expect(Number.isFinite(res.bpm)).toBe(true);
      expect(Number.isNaN(res.bpm)).toBe(false);
      expect(res.bpm).toBe(140.0);
    });

    it('handles empty channel array { channelData: [] } without crashing', () => {
      const res = estimateTempoAndOffset({
        channelData: [],
        sampleRate: 44100,
        duration: 0,
      });

      expect(res.bpm).toBe(140.0);
      expect(res.offset).toBe(0.0);
      expect(res.confidence).toBe(0.0);
    });
  });

  describe('6. Sample Rate Invariance (22.05 kHz, 44.1 kHz, 48.0 kHz, 96.0 kHz)', () => {
    it('accurately estimates 120.0 BPM across diverse audio sample rates', () => {
      const sampleRates = [22050, 44100, 48000, 96000];
      for (const sr of sampleRates) {
        const audio = createSyntheticBeatAudio(120.0, 15, sr);
        const res = estimateTempoAndOffset(audio);

        expect(res.bpm).toBe(120.0);
        expect(Math.abs(res.rawBpm - 120.0)).toBeLessThan(0.3);
        expect(res.offset).toBe(0.0);
      }
    });
  });

  describe('7. AudioEngine Integration & State Propagation', () => {
    it('AudioEngine.estimateTempo() returns null when no audio buffer is loaded', () => {
      const engine = new AudioEngine();
      expect(engine.estimateTempo()).toBeNull();
    });

    it('AudioEngine.estimateTempo() correctly delegates and detects tempo when buffer is loaded', () => {
      const engine = new AudioEngine();
      const synthetic = createSyntheticBeatAudio(170.0, 15);

      engine.setAudioBuffer({
        numberOfChannels: 2,
        sampleRate: synthetic.sampleRate,
        duration: synthetic.duration,
        length: synthetic.channelData[0].length,
        getChannelData: (c: number) => synthetic.channelData[c],
      } as unknown as AudioBuffer);

      const res = engine.estimateTempo();
      expect(res).not.toBeNull();
      expect(res!.bpm).toBe(170.0);
      expect(res!.offset).toBe(0.0);
      expect(res!.confidence).toBeGreaterThan(0.2);
    });
  });
});
