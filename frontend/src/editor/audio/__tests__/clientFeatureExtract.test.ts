import { describe, expect, it } from 'vitest';
import { ClientAudioFeatureExtractor } from '../clientFeatureExtract';

describe('ClientAudioFeatureExtractor', () => {
  it('instantiates with default configuration parameters', () => {
    const extractor = new ClientAudioFeatureExtractor();
    expect(extractor.sampleRate).toBe(44100);
    expect(extractor.nFft).toBe(1024);
    expect(extractor.nMels).toBe(128);
    expect(extractor.ticksPerBeat).toBe(48);
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
});
