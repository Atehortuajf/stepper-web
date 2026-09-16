import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MODEL_METADATA, validateModelMetadata } from '../modelContract';
import { WasmInferenceEngine } from '../wasmInference';
import { ClientFootStateMachine, CHORD_TO_ID } from '../fsmMask';

describe('numeric-meter model contract', () => {
  it('pins both exported model files to the verified checkpoint manifest', () => {
    validateModelMetadata(MODEL_METADATA);
    expect(MODEL_METADATA.checkpoint_sha256).toBe('704fa7775b3a0cdee1dba0af08d675fc36e18a2d5d213d56d0ad44188393e6ec');
    for (const [name, info] of Object.entries(MODEL_METADATA.files)) {
      const bytes = readFileSync(`public/models/${name}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(info.sha256);
      expect(bytes.byteLength).toBe(info.bytes);
    }
    expect(MODEL_METADATA.parity.cases.length).toBe(40);
  });

  it('rejects stale or categorical manifests before initializing inference', () => {
    for (const change of [{schema_version: 1}, {checkpoint_sha256: 'old'}, {conditioning: {mode: 'category'}}]) {
      expect(() => validateModelMetadata({ ...MODEL_METADATA, ...change })).toThrow('numeric-meter');
    }
  });

  it('keeps physical hold constraints with category gates disabled', () => {
    const fsm = new ClientFootStateMachine(null);
    expect(fsm.computeMask()[CHORD_TO_ID['1111']]).toBe(0);
    expect(fsm.computeMask()[CHORD_TO_ID['3000']]).toBeLessThan(-1000);
    fsm.updateState(CHORD_TO_ID['2000'], 0, 0);
    expect(fsm.computeMask()[CHORD_TO_ID['1000']]).toBeLessThan(-1000);
    expect(fsm.computeMask()[CHORD_TO_ID['3000']]).toBe(0);
  });

  it('runs identical real neural inference for Medium 8, Hard 8 and Challenge 8', async () => {
    const engine = new WasmInferenceEngine();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const results = [];
      for (const category of ['Medium', 'Hard', 'Challenge'] as const) {
        results.push(await engine.generate({ meter: 8, category, num_beats: 1, threshold: 0.25 }, new Float32Array(44100)));
      }
      expect(results.map(result => result.meter)).toEqual([8, 8, 8]);
      expect(results.map(result => result.category)).toEqual(['Medium', 'Hard', 'Challenge']);
      expect(results[0].placements).toEqual(results[1].placements);
      expect(results[0].placements).toEqual(results[2].placements);
      expect(results.every(result => result.model_id === MODEL_METADATA.model_id)).toBe(true);
    } finally { random.mockRestore(); }
  });
});
