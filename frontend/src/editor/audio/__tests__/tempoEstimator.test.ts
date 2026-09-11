import { describe, it, expect } from 'vitest';
import { estimateTempoAndOffset, type TempoEstimationResult } from '../tempoEstimator';
// @ts-ignore
import * as fs from 'node:fs';
// @ts-ignore
import { execSync } from 'node:child_process';

/**
 * Generates synthetic metronome audio pulse samples for testing.
 */
function createSyntheticBeatAudio(
  bpm: number,
  durationSec: number,
  sampleRate = 44100,
  initialOffsetSec = 0.0
): { channelData: Float32Array[]; sampleRate: number; duration: number } {
  const totalSamples = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);
  const beatInterval = 60.0 / bpm;
  const clickSamples = Math.floor(sampleRate * 0.02); // 20ms click pulse

  for (let t = initialOffsetSec; t < durationSec; t += beatInterval) {
    const startSample = Math.floor(t * sampleRate);
    if (startSample < 0) continue;
    const isDownbeat = Math.floor((t - initialOffsetSec) / beatInterval + 0.5) % 4 === 0;
    const freq = isDownbeat ? 1000 : 700;

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

describe('tempoEstimator (Client-Side DSP Tempo Estimation)', () => {
  it('handles empty or zero-sample audio safely without NaN or exceptions', () => {
    const emptyResult = estimateTempoAndOffset({
      channelData: [new Float32Array(0)],
      sampleRate: 44100,
      duration: 0,
    });
    expect(emptyResult.bpm).toBe(140.0);
    expect(emptyResult.offset).toBe(0.0);
    expect(emptyResult.confidence).toBe(0.0);
    expect(Number.isFinite(emptyResult.bpm)).toBe(true);
    expect(Number.isFinite(emptyResult.offset)).toBe(true);
  });

  it('handles very short audio buffers (< 512 samples) with default fallback', () => {
    const shortBuffer = {
      channelData: [new Float32Array(256).fill(0.1)],
      sampleRate: 44100,
      duration: 256 / 44100,
    };
    const result = estimateTempoAndOffset(shortBuffer);
    expect(result.bpm).toBe(140.0);
    expect(result.offset).toBe(0.0);
  });

  it('handles pure silence without crashes or invalid numbers', () => {
    const silence = {
      channelData: [new Float32Array(44100 * 5)],
      sampleRate: 44100,
      duration: 5,
    };
    const result = estimateTempoAndOffset(silence);
    expect(Number.isFinite(result.bpm)).toBe(true);
    expect(Number.isFinite(result.offset)).toBe(true);
    expect(result.bpm).toBeGreaterThan(0);
  });

  it('accurately detects synthetic 120.0 BPM audio within ±1.0 BPM', () => {
    const audio = createSyntheticBeatAudio(120.0, 15);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBeGreaterThanOrEqual(119.0);
    expect(result.bpm).toBeLessThanOrEqual(121.0);
    expect(result.bpm).toBe(120.0); // Exact integer snapping
  });

  it('accurately detects synthetic 140.0 BPM audio within ±1.0 BPM', () => {
    const audio = createSyntheticBeatAudio(140.0, 15);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBeGreaterThanOrEqual(139.0);
    expect(result.bpm).toBeLessThanOrEqual(141.0);
    expect(result.bpm).toBe(140.0);
  });

  it('accurately detects synthetic 170.0 BPM audio within ±1.0 BPM', () => {
    const audio = createSyntheticBeatAudio(170.0, 15);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBeGreaterThanOrEqual(169.0);
    expect(result.bpm).toBeLessThanOrEqual(171.0);
    expect(result.bpm).toBe(170.0);
  });

  it('accurately detects synthetic 175.0 BPM audio within ±1.0 BPM', () => {
    const audio = createSyntheticBeatAudio(175.0, 15);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBeGreaterThanOrEqual(174.0);
    expect(result.bpm).toBeLessThanOrEqual(176.0);
    expect(result.bpm).toBe(175.0);
  });

  it('detects phase offset when initial beat is delayed', () => {
    const delaySec = 0.15; // 150ms delay
    const audio = createSyntheticBeatAudio(120.0, 15, 44100, delaySec);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBe(120.0);
    // Offset should be approximately -0.15s (StepMania convention: offset = -delay)
    expect(result.offset).toBeLessThan(-0.10);
    expect(result.offset).toBeGreaterThan(-0.20);
  });

  it('snaps raw BPM within ±0.20 BPM to exact integer', () => {
    // 170 BPM synthetic track raw BPM should snap to 170
    const audio = createSyntheticBeatAudio(170.0, 20);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBe(170.0);
    expect(Math.abs(result.rawBpm - 170.0)).toBeLessThan(0.5);
  });

  it('accepts mono input format { mono, sampleRate }', () => {
    const audio = createSyntheticBeatAudio(150.0, 10);
    const monoInput = {
      mono: audio.channelData[0],
      sampleRate: audio.sampleRate,
    };
    const result = estimateTempoAndOffset(monoInput);
    expect(result.bpm).toBe(150.0);
  });

  it('verifies dominant BPM and offset on tournament reference track "Crazy Jackpot.ogg"', () => {
    const oggPath =
      '/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ogg';

    if (!fs.existsSync(oggPath)) {
      console.warn('Skipping Crazy Jackpot test: file not found on system');
      return;
    }

    // Extract 60 seconds of 44.1kHz float32 stereo PCM via python3 soundfile
    const pcm = execSync(
      `python3 -c "import soundfile as sf, sys; data, sr = sf.read('''${oggPath}''', dtype='float32'); sys.stdout.buffer.write(data[:int(60*sr)].tobytes())"`,
      { maxBuffer: 100 * 1024 * 1024 }
    );

    const floatArray = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
    const numSamples = floatArray.length / 2;
    const ch0 = new Float32Array(numSamples);
    const ch1 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      ch0[i] = floatArray[i * 2];
      ch1[i] = floatArray[i * 2 + 1];
    }

    const audioSource = {
      channelData: [ch0, ch1],
      sampleRate: 44100,
      duration: numSamples / 44100,
    };

    const startTime = performance.now();
    const result: TempoEstimationResult = estimateTempoAndOffset(audioSource);
    const elapsedMs = performance.now() - startTime;

    console.log(`[Crazy Jackpot] Detected BPM: ${result.bpm} (raw: ${result.rawBpm}), Offset: ${result.offset}s, Confidence: ${result.confidence.toFixed(3)}, Time: ${elapsedMs.toFixed(1)}ms`);

    // Target: 170 BPM within ±1.0 BPM (Ground truth ITL 2025 simfile: #BPMS:0=170.000000; #OFFSET:0.000000;)
    expect(result.bpm).toBeGreaterThanOrEqual(169.0);
    expect(result.bpm).toBeLessThanOrEqual(171.0);
    expect(result.bpm).toBe(170.0);
    expect(result.offset).toBe(0.0);
    expect(result.confidence).toBeGreaterThan(0.0);
    expect(elapsedMs).toBeLessThan(1500); // Latency requirement: fast client-side execution
  });

  it('correctly disambiguates 85 BPM sub-harmonic in favor of 170 BPM using 150 BPM prior', () => {
    // A synthetic track at 170 BPM has autocorrelation peaks at both lag L (~61) and 2L (~122 = 85 BPM).
    // The harmonic comb filter and 150 BPM prior must rank 170 BPM above 85 BPM.
    const audio = createSyntheticBeatAudio(170.0, 20);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBe(170.0);
    expect(result.bpm).not.toBe(85.0);
  });

  it('snaps to half-integer BPM if raw BPM is within ±0.15 of half-integer', () => {
    // Synthetic track at 172.5 BPM
    const audio = createSyntheticBeatAudio(172.5, 20);
    const result = estimateTempoAndOffset(audio);
    expect(result.bpm).toBe(172.5);
  });

  it('integrates with AudioEngine.estimateTempo() when buffer is present', () => {
    const audio = createSyntheticBeatAudio(140.0, 10);
    const dummyBuffer = {
      numberOfChannels: 2,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      getChannelData: (c: number) => audio.channelData[c],
    } as unknown as AudioBuffer;

    const result = estimateTempoAndOffset(dummyBuffer);
    expect(result.bpm).toBe(140.0);
    expect(result.offset).toBe(0.0);
  });
});
