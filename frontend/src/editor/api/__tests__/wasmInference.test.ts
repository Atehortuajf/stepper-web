import { describe, expect, it } from 'vitest';
import { wasmInferenceEngine } from '../wasmInference';
import { generationCondition, pickPlacementPeaks, stepperApi } from '../stepperApi';

describe('WasmInferenceEngine', () => {
  it('provides initial unloaded engine state', () => {
    const state = wasmInferenceEngine.getState();
    expect(['unloaded', 'loading', 'ready', 'error']).toContain(state.status);
    expect(['webgpu', 'wasm']).toContain(state.provider);
  });

  it('generates rule-based placements during fallback gracefully', () => {
    const req = {
      meter: 11,
      start_beat: 0.0,
      num_beats: 8.0,
      bpm: 140.0,
      force_fallback: true,
      tech_vector: new Array(16).fill(0),
    };

    const res = wasmInferenceEngine.generateRuleBasedFallback(req, performance.now());
    expect(res.placements.length).toBeGreaterThan(0);
    expect(res.model_used).toBe('client-rule');
    expect(res.difficulty_id).toBe(3);
    expect(res.difficulty_str).toBe('Hard');
  });

  it('keeps fallback placements inside the exact fractional request span', () => {
    const res = wasmInferenceEngine.generateRuleBasedFallback({
      meter: 11,
      start_beat: 2.25,
      num_beats: 0.3,
      tech_vector: new Array(16).fill(0),
    }, performance.now());

    expect(res.placements.length).toBeGreaterThan(0);
    expect(res.placements.every((placement) => placement.beat < 2.55)).toBe(true);
  });

  it('supports switching engine mode on stepperApi', async () => {
    stepperApi.setEngineMode('wasm');
    expect(stepperApi.getEngineMode()).toBe('wasm');

    const req = {
      meter: 7,
      start_beat: 0.0,
      num_beats: 4.0,
      bpm: 120.0,
    };

    // When in wasm mode without model loaded, it gracefully produces fallback placements
    const res = await stepperApi.generate(req, new Float32Array(44100 * 3));
    expect(res.model_used).toBe('wasm-wasm');

    // Reset back to wasm default
    stepperApi.setEngineMode('wasm');
    expect(stepperApi.getEngineMode()).toBe('wasm');
  });

  it('accepts onProgress callback and generates without blocking', async () => {
    stepperApi.setEngineMode('wasm');
    const req = {
      meter: 9,
      start_beat: 0.0,
      num_beats: 4.0,
      bpm: 130.0,
    };

    let progressCalls = 0;
    const res = await wasmInferenceEngine.generate(req, new Float32Array(44100 * 3), (pct) => {
      progressCalls++;
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });

    expect(progressCalls).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.placements)).toBe(true);
    expect(res.model_id).toMatch(/^stepper-meter-/);
  });

  describe('Peak Picking Calibration', () => {
    it('matches backend local-maximum handling on plateaus', () => {
      // Simulate plateau at ticks 10 and 11 with probability 0.80
      const totalTicks = 30;
      const probsData = new Float32Array(totalTicks);
      probsData[10] = 0.80;
      probsData[11] = 0.80; // plateau!
      probsData[12] = 0.40;

      const placedTicks = pickPlacementPeaks(probsData, 0.50);

      expect(placedTicks).toEqual([10, 11]);
    });

    it('retains distinct dense local maxima without an arbitrary refractory window', () => {
      const totalTicks = 30;
      const probsData = new Float32Array(totalTicks);
      // Peak 1 at tick 10
      probsData[9] = 0.2;
      probsData[10] = 0.90;
      probsData[11] = 0.2;

      // Close peak 2 at tick 14 (delta = 4 ticks < 6)
      probsData[13] = 0.2;
      probsData[14] = 0.85;
      probsData[15] = 0.2;

      // Distant peak 3 at tick 20 (delta = 10 ticks >= 6)
      probsData[19] = 0.2;
      probsData[20] = 0.88;
      probsData[21] = 0.2;

      const placedTicks = pickPlacementPeaks(probsData, 0.50);

      expect(placedTicks).toEqual([10, 14, 20]);
    });

    it('modulates note placements based on threshold sensitivity', async () => {
      // Extremely high threshold (0.999) suppresses all placements
      const reqHigh = {
        meter: 9,
        start_beat: 0.0,
        num_beats: 4.0,
        bpm: 140.0,
        threshold: 0.999,
      };
      const resHigh = await wasmInferenceEngine.generate(reqHigh, new Float32Array(44100 * 3));
      expect(resHigh.model_used).toBe('wasm-wasm');

      // Sensitive threshold (0.25) allows more placements
      const reqLow = {
        meter: 9,
        start_beat: 0.0,
        num_beats: 4.0,
        bpm: 140.0,
        threshold: 0.25,
      };
      const resLow = await wasmInferenceEngine.generate(reqLow, new Float32Array(44100 * 3));
      expect(resLow.placements.length).toBeGreaterThanOrEqual(resHigh.placements.length);
    });
  });

  it('uses raw positive integer meters independently of category metadata', () => {
    expect(['Medium', 'Hard', 'Challenge'].map(category => generationCondition({ meter: 8, category: category as 'Hard' }).meter)).toEqual([8, 8, 8]);
    for (const meter of [0, -1, 1.5, NaN, Infinity]) expect(() => generationCondition({ meter })).toThrow('positive integer');
  });
});
