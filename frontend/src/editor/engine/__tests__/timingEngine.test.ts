import { describe, it, expect } from 'vitest';
import { TimingEngine, beatToSeconds, secondsToBeat } from '../timingEngine';
import type { TimingData } from '../types';

describe('TimingEngine', () => {
  describe('Constant BPM & Offset', () => {
    it('calculates beat to seconds and seconds to beat with zero offset', () => {
      const timing: TimingData = {
        offset: 0.0,
        bpms: [{ beat: 0, bpm: 120 }],
        stops: [],
        delays: [],
        warps: [],
        timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
      };

      const engine = new TimingEngine(timing);

      // At 120 BPM, 1 beat = 0.5s
      expect(engine.beatToSeconds(0)).toBeCloseTo(0.0, 6);
      expect(engine.beatToSeconds(1)).toBeCloseTo(0.5, 6);
      expect(engine.beatToSeconds(4)).toBeCloseTo(2.0, 6);
      expect(engine.beatToSeconds(16)).toBeCloseTo(8.0, 6);

      // Inverse
      expect(engine.secondsToBeat(0.0)).toBeCloseTo(0.0, 6);
      expect(engine.secondsToBeat(0.5)).toBeCloseTo(1.0, 6);
      expect(engine.secondsToBeat(2.0)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(8.0)).toBeCloseTo(16.0, 6);
    });

    it('correctly handles negative offset (song audio leads)', () => {
      // #OFFSET:-0.090000; means beat 0 is at audio timestamp +0.090s
      const engine = new TimingEngine({
        offset: -0.09,
        bpms: [{ beat: 0, bpm: 120 }],
      });

      expect(engine.beatToSeconds(0)).toBeCloseTo(0.09, 6);
      expect(engine.beatToSeconds(2)).toBeCloseTo(1.09, 6); // 0.09 + 2 * 0.5

      expect(engine.secondsToBeat(0.09)).toBeCloseTo(0.0, 6);
      expect(engine.secondsToBeat(1.09)).toBeCloseTo(2.0, 6);
    });

    it('correctly handles positive offset', () => {
      // #OFFSET:0.500000; means beat 0 is at audio timestamp -0.5s
      const engine = new TimingEngine({
        offset: 0.5,
        bpms: [{ beat: 0, bpm: 120 }],
      });

      expect(engine.beatToSeconds(0)).toBeCloseTo(-0.5, 6);
      expect(engine.beatToSeconds(1)).toBeCloseTo(0.0, 6);

      expect(engine.secondsToBeat(-0.5)).toBeCloseTo(0.0, 6);
      expect(engine.secondsToBeat(0.0)).toBeCloseTo(1.0, 6);
    });
  });

  describe('Variable BPM Changes', () => {
    it('correctly piecewise integrates multiple tempo changes', () => {
      const engine = new TimingEngine({
        offset: 0.0,
        bpms: [
          { beat: 0, bpm: 60 },  // 1 beat = 1.0s (beats 0..4 = 4.0s)
          { beat: 4, bpm: 120 }, // 1 beat = 0.5s (beats 4..8 = 2.0s)
          { beat: 8, bpm: 240 }, // 1 beat = 0.25s (beats 8..12 = 1.0s)
        ],
      });

      expect(engine.beatToSeconds(0)).toBeCloseTo(0.0, 6);
      expect(engine.beatToSeconds(2)).toBeCloseTo(2.0, 6);
      expect(engine.beatToSeconds(4)).toBeCloseTo(4.0, 6);
      expect(engine.beatToSeconds(6)).toBeCloseTo(5.0, 6); // 4.0 + 2 * 0.5
      expect(engine.beatToSeconds(8)).toBeCloseTo(6.0, 6); // 4.0 + 4 * 0.5
      expect(engine.beatToSeconds(10)).toBeCloseTo(6.5, 6); // 6.0 + 2 * 0.25
      expect(engine.beatToSeconds(12)).toBeCloseTo(7.0, 6);

      // Inverse conversions
      expect(engine.secondsToBeat(0.0)).toBeCloseTo(0.0, 6);
      expect(engine.secondsToBeat(2.0)).toBeCloseTo(2.0, 6);
      expect(engine.secondsToBeat(4.0)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(5.0)).toBeCloseTo(6.0, 6);
      expect(engine.secondsToBeat(6.0)).toBeCloseTo(8.0, 6);
      expect(engine.secondsToBeat(6.5)).toBeCloseTo(10.0, 6);
      expect(engine.secondsToBeat(7.0)).toBeCloseTo(12.0, 6);
    });
  });

  describe('Stops and Delays Freeze Intervals', () => {
    it('preserves stop freeze interval during forward and inverse mapping', () => {
      // 60 BPM (1s/beat), stop at beat 4 for 2.0 seconds
      const engine = new TimingEngine({
        offset: 0.0,
        bpms: [{ beat: 0, bpm: 60 }],
        stops: [{ beat: 4, duration: 2.0 }],
      });

      // Beat 0: 0s, Beat 4 arrives at 4.0s
      expect(engine.beatToSeconds(0)).toBeCloseTo(0.0, 6);
      expect(engine.beatToSeconds(4)).toBeCloseTo(4.0, 6);

      // Stop occurs AFTER beat 4: pauses audio for 2.0s from t=4.0 to t=6.0
      // Beat 5 occurs at 4.0 + 2.0 (stop) + 1.0 (beat progression) = 7.0s
      expect(engine.beatToSeconds(5)).toBeCloseTo(7.0, 6);
      expect(engine.beatToSeconds(6)).toBeCloseTo(8.0, 6);

      // Inverse mapping during pause plateau [4.0, 6.0] must lock to beat 4!
      expect(engine.secondsToBeat(4.0)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(4.5)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(5.0)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(5.99)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(6.0)).toBeCloseTo(4.0, 6);

      // After stop finishes:
      expect(engine.secondsToBeat(6.5)).toBeCloseTo(4.5, 6);
      expect(engine.secondsToBeat(7.0)).toBeCloseTo(5.0, 6);

      // isPausedAt helper
      expect(engine.isPausedAt(3.5)).toBe(false);
      expect(engine.isPausedAt(4.5)).toBe(true);
      expect(engine.isPausedAt(5.5)).toBe(true);
      expect(engine.isPausedAt(6.5)).toBe(false);
    });

    it('handles delays (pre-note pause)', () => {
      // 60 BPM, delay on beat 4 for 1.5 seconds
      const engine = new TimingEngine({
        offset: 0.0,
        bpms: [{ beat: 0, bpm: 60 }],
        delays: [{ beat: 4, duration: 1.5 }],
      });

      // Beat 4 note arrives only after delay has expired
      // Time until beat 4: 4.0s progression + 1.5s delay = 5.5s
      expect(engine.beatToSeconds(4)).toBeCloseTo(5.5, 6);
      expect(engine.beatToSeconds(5)).toBeCloseTo(6.5, 6);

      // Pause plateau is [4.0, 5.5]
      expect(engine.secondsToBeat(4.0)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(4.75)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(5.5)).toBeCloseTo(4.0, 6);
      expect(engine.secondsToBeat(6.0)).toBeCloseTo(4.5, 6);
    });
  });

  describe('Warps and Legacy Compatibility', () => {
    it('skips beats instantaneously in 0 seconds', () => {
      // 60 BPM, warp at beat 4 for 4 beats (skips beats 4..8 in 0s)
      const engine = new TimingEngine({
        offset: 0.0,
        bpms: [{ beat: 0, bpm: 60 }],
        warps: [{ beat: 4, duration: 4.0 }],
      });

      expect(engine.beatToSeconds(0)).toBeCloseTo(0.0, 6);
      expect(engine.beatToSeconds(4)).toBeCloseTo(4.0, 6);
      expect(engine.beatToSeconds(6)).toBeCloseTo(4.0, 6); // Inside warp
      expect(engine.beatToSeconds(8)).toBeCloseTo(4.0, 6); // Warp destination

      // Beat 9 (1 beat after warp ends at beat 8)
      expect(engine.beatToSeconds(9)).toBeCloseTo(5.0, 6);

      // Inverse
      expect(engine.secondsToBeat(3.0)).toBeCloseTo(3.0, 6);
      expect(engine.secondsToBeat(4.0)).toBeCloseTo(8.0, 6);
      expect(engine.secondsToBeat(5.0)).toBeCloseTo(9.0, 6);
    });

    it('converts negative stops to equivalent warps', () => {
      // Stop at beat 4 with duration -2.0 at 60 BPM
      // WarpLength = |-2.0| * (60 / 60) = 2.0 beats
      const engine = new TimingEngine({
        offset: 0.0,
        bpms: [{ beat: 0, bpm: 60 }],
        stops: [{ beat: 4, duration: -2.0 }],
      });

      expect(engine.warps.length).toBe(1);
      expect(engine.warps[0].beat).toBe(4);
      expect(engine.warps[0].duration).toBeCloseTo(2.0, 6);
    });

    it('coalesces overlapping warps into a contiguous range', () => {
      const engine = new TimingEngine({
        offset: 0.0,
        bpms: [{ beat: 0, bpm: 120 }],
        warps: [
          { beat: 4, duration: 4 }, // 4..8
          { beat: 6, duration: 4 }, // 6..10
        ],
      });

      expect(engine.warps.length).toBe(1);
      expect(engine.warps[0].beat).toBe(4);
      expect(engine.warps[0].duration).toBe(6); // 4..10
    });

    it('absorbs stops before beat 0 into the song offset', () => {
      // Stop at beat -4 with duration 1.5s
      const engine = new TimingEngine({
        offset: 0.0,
        bpms: [{ beat: 0, bpm: 120 }],
        stops: [{ beat: -4, duration: 1.5 }],
      });

      expect(engine.offset).toBeCloseTo(-1.5, 6);
    });
  });

  describe('Functional API and High-Density Round-Trip', () => {
    it('satisfies standalone beatToSeconds and secondsToBeat interface', () => {
      const timing: TimingData = {
        offset: -0.05,
        bpms: [{ beat: 0, bpm: 140 }, { beat: 64, bpm: 175 }],
        stops: [{ beat: 32, duration: 0.5 }],
        delays: [],
        warps: [],
        timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
      };

      const t16 = beatToSeconds(16, timing);
      expect(typeof t16).toBe('number');
      const b16 = secondsToBeat(t16, timing);
      expect(b16).toBeCloseTo(16, 4);
    });

    it('preserves bi-directional fidelity across regular non-pause beats', () => {
      const engine = new TimingEngine({
        offset: -0.035,
        bpms: [
          { beat: 0, bpm: 140 },
          { beat: 32, bpm: 200 },
          { beat: 64, bpm: 100 },
        ],
        stops: [{ beat: 16, duration: 0.5 }],
      });

      for (let beat = 0; beat <= 100; beat += 0.5) {
        // Skip exactly during pause plateau
        const time = engine.beatToSeconds(beat);
        const reconstructedBeat = engine.secondsToBeat(time);
        expect(reconstructedBeat).toBeCloseTo(beat, 4);
      }
    });
  });
});
