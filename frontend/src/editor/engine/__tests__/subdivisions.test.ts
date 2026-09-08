import { describe, it, expect } from 'vitest';
import {
  ALL_SUBDIVISIONS,
  SUBDIVISION_COLORS,
  SUBDIVISION_STRIDES,
  getSubdivision,
  getSubdivisionColor,
  getBeatSubdivision,
  getBeatSubdivisionColor,
  TICKS_PER_BEAT,
  TICKS_PER_MEASURE,
} from '../subdivisions';

describe('Canonical StepMania Subdivisions & Colors', () => {
  it('defines correct tick constants', () => {
    expect(TICKS_PER_BEAT).toBe(48);
    expect(TICKS_PER_MEASURE).toBe(192);
  });

  it('defines exact canonical StepMania hex color hues', () => {
    expect(SUBDIVISION_COLORS[4]).toBe('#ff2a55');   // Red
    expect(SUBDIVISION_COLORS[8]).toBe('#00a2ff');   // Blue
    expect(SUBDIVISION_COLORS[12]).toBe('#9e3cff');  // Purple
    expect(SUBDIVISION_COLORS[16]).toBe('#ffd000');  // Yellow
    expect(SUBDIVISION_COLORS[24]).toBe('#ff54be');  // Pink
    expect(SUBDIVISION_COLORS[32]).toBe('#ff7b00');  // Orange
    expect(SUBDIVISION_COLORS[48]).toBe('#00e5ff');  // Cyan
    expect(SUBDIVISION_COLORS[64]).toBe('#00e676');  // Green
    expect(SUBDIVISION_COLORS[96]).toBe('#b0bec5');  // Light Gray
    expect(SUBDIVISION_COLORS[192]).toBe('#78909c'); // Dark Gray / Slate
  });

  it('correctly maps integer tick values to subdivisions', () => {
    // 4th note: tick 0, 48, 96, 144
    expect(getSubdivision(0)).toBe(4);
    expect(getSubdivision(48)).toBe(4);
    expect(getSubdivision(96)).toBe(4);
    expect(getSubdivision(144)).toBe(4);

    // 8th note: tick 24, 72, 120, 168
    expect(getSubdivision(24)).toBe(8);
    expect(getSubdivision(72)).toBe(8);

    // 12th note: tick 16, 32, 64, 80
    expect(getSubdivision(16)).toBe(12);
    expect(getSubdivision(32)).toBe(12);

    // 16th note: tick 12, 36, 60, 84
    expect(getSubdivision(12)).toBe(16);
    expect(getSubdivision(36)).toBe(16);

    // 24th note: tick 8, 40, 56, 88
    expect(getSubdivision(8)).toBe(24);
    expect(getSubdivision(40)).toBe(24);

    // 32nd note: tick 6, 18, 30, 42
    expect(getSubdivision(6)).toBe(32);
    expect(getSubdivision(18)).toBe(32);

    // 48th note: tick 4, 20, 28, 44
    expect(getSubdivision(4)).toBe(48);
    expect(getSubdivision(20)).toBe(48);

    // 64th note: tick 3, 9, 15, 21
    expect(getSubdivision(3)).toBe(64);
    expect(getSubdivision(9)).toBe(64);

    // 96th note: tick 2, 10, 14, 22
    expect(getSubdivision(2)).toBe(96);
    expect(getSubdivision(10)).toBe(96);

    // 192nd note: tick 1, 5, 7, 11
    expect(getSubdivision(1)).toBe(192);
    expect(getSubdivision(5)).toBe(192);
  });

  it('correctly maps musical beats to subdivisions', () => {
    expect(getBeatSubdivision(0.0)).toBe(4);
    expect(getBeatSubdivision(1.0)).toBe(4);
    expect(getBeatSubdivision(2.0)).toBe(4);
    expect(getBeatSubdivision(2.5)).toBe(8);
    expect(getBeatSubdivision(3.25)).toBe(16);
    expect(getBeatSubdivision(1.75)).toBe(16);
    expect(getBeatSubdivision(0.125)).toBe(32);
    expect(getBeatSubdivision(0.0625)).toBe(64);
    // 12th note (1/3 beat)
    expect(getBeatSubdivision(1 / 3)).toBe(12);
    expect(getBeatSubdivision(2 / 3)).toBe(12);
    // 24th note (1/6 beat)
    expect(getBeatSubdivision(1 / 6)).toBe(24);
    // 48th note (1/12 beat)
    expect(getBeatSubdivision(1 / 12)).toBe(48);

    // Color verification
    expect(getBeatSubdivisionColor(0.0)).toBe('#ff2a55');
    expect(getBeatSubdivisionColor(0.5)).toBe('#00a2ff');
    expect(getBeatSubdivisionColor(0.25)).toBe('#ffd000');
  });

  it('returns matching canonical hex color for every tier', () => {
    for (const tier of ALL_SUBDIVISIONS) {
      const stride = SUBDIVISION_STRIDES[tier];
      const expectedColor = SUBDIVISION_COLORS[tier];
      expect(getSubdivisionColor(stride)).toBe(expectedColor);
    }
  });
});

