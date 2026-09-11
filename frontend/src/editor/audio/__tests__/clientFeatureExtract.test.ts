import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ClientAudioFeatureExtractor, resampleMonoWaveform } from '../clientFeatureExtract';

describe('ClientAudioFeatureExtractor', () => {
  it('instantiates with default configuration parameters', () => {
    const extractor = new ClientAudioFeatureExtractor();
    expect(extractor.sampleRate).toBe(44100);
    expect(extractor.nFft).toBe(1024);
    expect(extractor.nMels).toBe(128);
    expect(extractor.ticksPerBeat).toBe(48);
    expect(extractor.fMin).toBe(20);
    expect(extractor.fMax).toBe(16000);
  });

  it('extracts non-negative beat-synchronous features from waveform', () => {
    const extractor = new ClientAudioFeatureExtractor();
    const sampleRate = 44100;
    const duration = 2.0; // 2 seconds
    const numSamples = Math.floor(duration * sampleRate);
    const waveform = new Float32Array(numSamples);

    // Generate 440 Hz sinusoidal test tone
    for (let i = 0; i < numSamples; i++) {
      waveform[i] = 0.5 * Math.sin((2.0 * Math.PI * 440.0 * i) / sampleRate);
    }

    const totalBeats = 4;
    const bpm = 120.0;
    const features = extractor.extract(waveform, totalBeats, bpm, 0.0, 0.0);

    const expectedSize = 2 * totalBeats * 48 * 128; // 2 channels
    expect(features.length).toBe(expectedSize);

    // Verify all values are valid and non-negative
    let hasNonZero = false;
    for (let i = 0; i < features.length; i++) {
      const v = features[i];
      expect(Number.isNaN(v)).toBe(false);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0.0);
      if (v > 0.001) hasNonZero = true;
    }
    expect(hasNonZero).toBe(true);
  });

  it('resamples browser waveforms to the fixed 44.1 kHz model rate', () => {
    const source = new Float32Array(48000);
    for (let i = 0; i < source.length; i++) source[i] = Math.sin(2 * Math.PI * 440 * i / 48000);
    const output = resampleMonoWaveform(source, 48000);
    expect(output.length).toBe(44100);
    expect(output[11025]).toBeCloseTo(source[12000], 3);
  });

  it('uses absolute tick times relative to the supplied slice origin', () => {
    const extractor = new ClientAudioFeatureExtractor();
    const waveform = new Float32Array(44100);
    for (let i = 0; i < 512; i++) waveform[i] = Math.sin(2 * Math.PI * 1000 * i / 44100);
    const tickTimes = Array.from({ length: 48 }, (_, i) => 2 + i / 96);
    const features = extractor.extract(waveform, 1, 120, 0, 4, 2, tickTimes);
    const firstTickEnergy = features.slice(0, 128).reduce((sum, value) => sum + value, 0);
    expect(firstTickEnergy).toBeGreaterThan(0);
    const dominantMel = Array.from(features.slice(0, 128)).reduce(
      (best, value, index, values) => value > values[best] ? index : best,
      0
    );
    // Shared real-DSP parity anchor with backend test_feature_extract.py.
    expect(dominantMel).toBe(33);
    expect(() => extractor.extract(waveform, 1, 120, 0, 4, 2, tickTimes.slice(1))).toThrow(
      'tick_times_sec must contain exactly 48'
    );
  });

  const bundledPython = resolve(process.cwd(), '../../audit-venv/bin/python');
  const parityPython = process.env.STEPPER_TEST_PYTHON || (existsSync(bundledPython) ? bundledPython : '');
  it.skipIf(!parityPython)('matches the Python extractor across the full deterministic feature tensor', () => {
    const waveform = new Float32Array(44100);
    for (let index = 0; index < waveform.length; index++) {
      waveform[index] = ((index * 17) % 101) / 50 - 1;
    }
    const sliceStartSec = 0.25;
    const tickTimes = Array.from({ length: 48 }, (_, index) =>
      sliceStartSec + (index < 24 ? index / 96 : 0.25 + (index - 24) / 144)
    );
    const browser = new ClientAudioFeatureExtractor().extract(
      waveform, 1, 120, 0, 0, sliceStartSec, tickTimes
    );
    const referenceScript = resolve(process.cwd(), '../backend/tests/browser_dsp_reference.py');
    const reference = spawnSync(parityPython, [referenceScript], {
      cwd: resolve(process.cwd(), '..'),
      env: {
        ...process.env,
        PYTHONPATH: `${resolve(process.cwd(), '..')}:${resolve(process.cwd(), '../../Stepper')}`,
        OMP_NUM_THREADS: '2',
      },
      encoding: 'utf8',
    });
    expect(reference.status, reference.stderr).toBe(0);
    const payload = JSON.parse(reference.stdout) as { shape: number[]; float32_base64: string };
    expect(payload.shape).toEqual([2, 1, 48, 128]);
    const bytes = Buffer.from(payload.float32_base64, 'base64');
    const python = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    expect(python.length).toBe(browser.length);

    let maxAbsoluteError = 0;
    let totalAbsoluteError = 0;
    for (let index = 0; index < browser.length; index++) {
      const error = Math.abs(browser[index] - python[index]);
      maxAbsoluteError = Math.max(maxAbsoluteError, error);
      totalAbsoluteError += error;
    }
    const meanAbsoluteError = totalAbsoluteError / browser.length;
    console.info(`[DSP parity] mean_abs_error=${meanAbsoluteError} max_abs_error=${maxAbsoluteError}`);
    expect(meanAbsoluteError).toBeLessThan(0.002);
    expect(maxAbsoluteError).toBeLessThan(0.05);
  });
});
