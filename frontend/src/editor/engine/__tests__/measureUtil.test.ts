import { describe, it, expect } from 'vitest';
import {
  getSmallestNoteTypeForMeasure,
  formatMeasure,
  notesToMeasureGrids,
  formatChartMeasures,
  beatToRow,
  rowToBeat,
  isTickEmpty,
} from '../measureUtil';

describe('Measure Line Minimization (GetSmallestNoteTypeForMeasure)', () => {
  it('minimizes empty measure to 4 lines of 0000', () => {
    const emptyMap = new Map<number, string>();
    const result = getSmallestNoteTypeForMeasure(emptyMap);
    expect(result.numRows).toBe(4);
    expect(result.stride).toBe(48);

    const formatted = formatMeasure(emptyMap);
    expect(formatted).toBe('0000\n0000\n0000\n0000\n,');
  });

  it('minimizes measure with quarter notes (ticks 0, 48, 96, 144) to 4 lines', () => {
    const ticks = new Map<number, string>([
      [0, '1000'],
      [48, '0100'],
      [96, '0010'],
      [144, '0001'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(4);
    expect(result.stride).toBe(48);

    const formatted = formatMeasure(ticks);
    expect(formatted).toBe('1000\n0100\n0010\n0001\n,');
  });

  it('minimizes measure with 8th notes to 8 lines', () => {
    const ticks = new Map<number, string>([
      [0, '1000'],
      [24, '0100'], // 8th note
      [96, '0010'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(8);
    expect(result.stride).toBe(24);

    const formatted = formatMeasure(ticks);
    const lines = formatted.split('\n');
    expect(lines.length).toBe(9); // 8 rows + delimiter
    expect(lines[0]).toBe('1000');
    expect(lines[1]).toBe('0100');
    expect(lines[2]).toBe('0000');
    expect(lines[4]).toBe('0010');
    expect(lines[8]).toBe(',');
  });

  it('minimizes measure with 12th notes (quarter triplets) to 12 lines', () => {
    // 12 lines means stride 16 (192 / 12 = 16)
    const ticks = new Map<number, string>([
      [0, '1000'],
      [16, '0100'],
      [32, '0010'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(12);
    expect(result.stride).toBe(16);
  });

  it('minimizes measure with 16th notes to 16 lines', () => {
    // 16 lines means stride 12
    const ticks = new Map<number, string>([
      [0, '1000'],
      [12, '0100'], // 16th note
      [48, '0010'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(16);
    expect(result.stride).toBe(12);
  });

  it('minimizes measure with 24th notes to 24 lines', () => {
    // 24 lines means stride 8
    const ticks = new Map<number, string>([
      [0, '1000'],
      [8, '0100'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(24);
    expect(result.stride).toBe(8);
  });

  it('minimizes measure with 32nd notes to 32 lines', () => {
    // 32 lines means stride 6
    const ticks = new Map<number, string>([
      [0, '1000'],
      [6, '0100'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(32);
    expect(result.stride).toBe(6);
  });

  it('minimizes measure with 48th notes to 48 lines', () => {
    // 48 lines means stride 4
    const ticks = new Map<number, string>([
      [0, '1000'],
      [4, '0100'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(48);
    expect(result.stride).toBe(4);
  });

  it('minimizes measure with 64th notes to 64 lines', () => {
    // 64 lines means stride 3
    const ticks = new Map<number, string>([
      [0, '1000'],
      [3, '0100'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(64);
    expect(result.stride).toBe(3);
  });

  it('minimizes measure with 96th notes to 96 lines', () => {
    // 96 lines means stride 2
    const ticks = new Map<number, string>([
      [0, '1000'],
      [2, '0100'],
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(96);
    expect(result.stride).toBe(2);
  });

  it('falls back to 192 lines for off-grid / 192nd micro-steps (stride 1)', () => {
    const ticks = new Map<number, string>([
      [0, '1000'],
      [1, '0100'], // tick 1 requires stride 1
    ]);
    const result = getSmallestNoteTypeForMeasure(ticks);
    expect(result.numRows).toBe(192);
    expect(result.stride).toBe(1);
  });

  it('supports doubles (8-panel) formatting', () => {
    const ticks = new Map<number, string>([
      [0, '10000001'],
      [48, '01000010'],
    ]);
    const formatted = formatMeasure(ticks, { panelCount: 8, isLast: true });
    const lines = formatted.split('\n');
    expect(lines[0]).toBe('10000001');
    expect(lines[1]).toBe('01000010');
    expect(lines[lines.length - 1]).toBe(';');
  });
});

describe('Grid conversions & Chart Formatting', () => {
  it('converts between beat and row accurately', () => {
    expect(beatToRow(0.0)).toBe(0);
    expect(beatToRow(1.0)).toBe(48);
    expect(beatToRow(4.0)).toBe(192);
    expect(beatToRow(0.25)).toBe(12);

    expect(rowToBeat(0)).toBe(0.0);
    expect(rowToBeat(48)).toBe(1.0);
    expect(rowToBeat(192)).toBe(4.0);
    expect(rowToBeat(12)).toBe(0.25);
  });

  it('formats entire chart measures with individual minimization', () => {
    const notes = [
      { beat: 0.0, arrows: '1000' },
      { beat: 1.0, arrows: '0100' },
      { beat: 2.0, arrows: '0010' },
      { beat: 3.0, arrows: '0001' },
      // Measure 1: contains 8th note at beat 4.5
      { beat: 4.0, arrows: '1000' },
      { beat: 4.5, arrows: '0100' },
    ];

    const formatted = formatChartMeasures(notes);
    const measureBlocks = formatted.split(',');
    expect(measureBlocks.length).toBe(2);

    // Measure 0 has quarter notes only -> 4 lines
    const m0Lines = measureBlocks[0].trim().split('\n');
    expect(m0Lines.length).toBe(4);

    // Measure 1 has 8th notes -> 8 lines (ends with ';')
    const m1Clean = measureBlocks[1].replace(';', '').trim();
    const m1Lines = m1Clean.split('\n');
    expect(m1Lines.length).toBe(8);
  });

  it('converts notes to measure grids correctly', () => {
    const grids = notesToMeasureGrids([{ beat: 0, arrows: '1000' }]);
    expect(grids.length).toBe(1);
    expect(grids[0].get(0)).toBe('1000');
  });

  it('correctly detects empty tick chords', () => {
    expect(isTickEmpty('0000')).toBe(true);
    expect(isTickEmpty('00000000')).toBe(true);
    expect(isTickEmpty('')).toBe(true);
    expect(isTickEmpty('1000')).toBe(false);
    expect(isTickEmpty('0200')).toBe(false);
    expect(isTickEmpty('00M0')).toBe(false);
  });
});

