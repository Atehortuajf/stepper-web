import { describe, expect, it } from 'vitest';
import { sampleChordToken } from '../chordSampling';

describe('sampleChordToken', () => {
  it('selects the highest finite legal logit deterministically', () => {
    expect(sampleChordToken([100, 2, 5, -1e9], 0)).toBe(2);
  });

  it('throws instead of falling back when every chord is masked or non-finite', () => {
    expect(() => sampleChordToken([0, -1e9, -Infinity, Number.NaN], 0)).toThrow(
      'No finite legal chord candidate',
    );
  });

  it('does not select a zero-probability candidate when random returns zero', () => {
    const logits = [0, -1000, 0];
    expect(sampleChordToken(logits, 1, () => 0)).toBe(2);
  });
});
