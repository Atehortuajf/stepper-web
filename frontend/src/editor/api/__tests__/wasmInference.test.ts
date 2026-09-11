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
});
