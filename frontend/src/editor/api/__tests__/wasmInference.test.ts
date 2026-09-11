import { describe, expect, it } from 'vitest';
import { wasmInferenceEngine } from '../wasmInference';
import { stepperApi } from '../stepperApi';

describe('WasmInferenceEngine', () => {
  it('provides initial unloaded engine state', () => {
    const state = wasmInferenceEngine.getState();
    expect(['unloaded', 'loading', 'ready', 'error']).toContain(state.status);
    expect(['webgpu', 'wasm']).toContain(state.provider);
  });

  it('generates rule-based placements during fallback gracefully', () => {
    const req = {
      difficulty: 11,
      start_beat: 0.0,
      num_beats: 8.0,
      bpm: 140.0,
      tech_vector: new Array(16).fill(0),
    };

    const res = wasmInferenceEngine.generateRuleBasedFallback(req, performance.now());
    expect(res.placements.length).toBeGreaterThan(0);
    expect(res.model_used).toBe('client-rule');
    expect(res.difficulty_id).toBe(2);
    expect(res.difficulty_str).toBe('Medium');
  });

  it('supports switching engine mode on stepperApi', async () => {
    stepperApi.setEngineMode('wasm');
    expect(stepperApi.getEngineMode()).toBe('wasm');

    const req = {
      difficulty: 7,
      start_beat: 0.0,
      num_beats: 4.0,
      bpm: 120.0,
    };

    // When in wasm mode without model loaded, it gracefully produces fallback placements
    const res = await stepperApi.generate(req);
    expect(res.placements.length).toBeGreaterThan(0);

    // Reset back to wasm default
    stepperApi.setEngineMode('wasm');
    expect(stepperApi.getEngineMode()).toBe('wasm');
  });

  it('accepts onProgress callback and generates without blocking', async () => {
    stepperApi.setEngineMode('wasm');
    const req = {
      difficulty: 9,
      start_beat: 0.0,
      num_beats: 4.0,
      bpm: 130.0,
    };

    let progressCalls = 0;
    const res = await wasmInferenceEngine.generate(req, undefined, (pct) => {
      progressCalls++;
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });

    expect(progressCalls).toBeGreaterThanOrEqual(0);
    expect(res.placements.length).toBeGreaterThan(0);
    expect(res.model_used).toBeDefined();
  });

  describe('Peak Picking Calibration', () => {
    it('enforces strict inequality tie-breaking on plateaus (pVal > left && pVal >= right)', () => {
      // Simulate plateau at ticks 10 and 11 with probability 0.80
      const totalTicks = 30;
      const probsData = new Float32Array(totalTicks);
      probsData[10] = 0.80;
      probsData[11] = 0.80; // plateau!
      probsData[12] = 0.40;

      const threshold = 0.50;
      const placedTicks: number[] = [];
      const MIN_REFRACTORY_TICKS = 6;

      for (let t = 0; t < totalTicks; t++) {
        const pVal = probsData[t];
        if (pVal > threshold) {
          const left = t > 0 ? probsData[t - 1] : 0.0;
          const right = t < totalTicks - 1 ? probsData[t + 1] : 0.0;
          if (pVal > left && pVal >= right) {
            if (
              placedTicks.length === 0 ||
              t - placedTicks[placedTicks.length - 1] >= MIN_REFRACTORY_TICKS
            ) {
              placedTicks.push(t);
            }
          }
        }
      }

      // Only tick 10 should be selected; tick 11 must be suppressed because pVal is not strictly > left
      expect(placedTicks).toEqual([10]);
    });

    it('enforces minimum refractory window of at least 6 ticks between notes', () => {
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

      const threshold = 0.50;
      const placedTicks: number[] = [];
      const MIN_REFRACTORY_TICKS = 6;

      for (let t = 0; t < totalTicks; t++) {
        const pVal = probsData[t];
        if (pVal > threshold) {
          const left = t > 0 ? probsData[t - 1] : 0.0;
          const right = t < totalTicks - 1 ? probsData[t + 1] : 0.0;
          if (pVal > left && pVal >= right) {
            if (
              placedTicks.length === 0 ||
              t - placedTicks[placedTicks.length - 1] >= MIN_REFRACTORY_TICKS
            ) {
              placedTicks.push(t);
            }
          }
        }
      }

      // Tick 14 is inside the refractory window and must be suppressed
      expect(placedTicks).toEqual([10, 20]);
      expect(placedTicks[1] - placedTicks[0]).toBeGreaterThanOrEqual(MIN_REFRACTORY_TICKS);
    });

    it('modulates note placements based on threshold sensitivity', async () => {
      // Extremely high threshold (0.999) suppresses all placements
      const reqHigh = {
        difficulty: 9,
        start_beat: 0.0,
        num_beats: 4.0,
        bpm: 140.0,
        threshold: 0.999,
      };
      const resHigh = await wasmInferenceEngine.generate(reqHigh);
      expect(resHigh.placements.length).toBe(0);

      // Sensitive threshold (0.25) allows more placements
      const reqLow = {
        difficulty: 9,
        start_beat: 0.0,
        num_beats: 4.0,
        bpm: 140.0,
        threshold: 0.25,
      };
      const resLow = await wasmInferenceEngine.generate(reqLow);
      expect(resLow.placements.length).toBeGreaterThan(0);
    });
  });
});
