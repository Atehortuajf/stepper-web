import { describe, expect, it } from 'vitest';
import type { Chart, NoteRow, TimingData } from '../../engine/types';
import {
  ScopedUndoHistory,
  deriveHolds,
  findAvailableHoldTailBeat,
  fullSongEndBeat,
  replaceRowsInHalfOpenRange,
  sameProposalTarget,
  updateInitialTiming,
  validateHoldTopology,
} from '../editorTransactions';

const chart = (noteRows: NoteRow[]): Chart => ({
  stepsType: 'dance-single',
  description: 'test',
  difficulty: 'Hard',
  meter: 9,
  notes: [],
  noteRows,
  holds: [],
});

const timing: TimingData = {
  offset: -0.1,
  bpms: [{ beat: 0, bpm: 120 }, { beat: 16, bpm: 180 }],
  stops: [{ beat: 8, duration: 1 }],
  delays: [],
  warps: [],
  timeSignatures: [
    { beat: 0, numerator: 4, denominator: 4 },
    { beat: 32, numerator: 3, denominator: 4 },
  ],
};

describe('editor transactions', () => {
  it('changes initial timing fields without flattening later timing events', () => {
    const result = updateInitialTiming(timing, {
      bpm: 120,
      offset: 0.25,
      timeSignature: { numerator: 4, denominator: 4 },
    });
    expect(result.offset).toBe(0.25);
    expect(result.bpms).toEqual(timing.bpms);
    expect(result.timeSignatures).toEqual(timing.timeSignatures);
    expect(result.stops).toEqual(timing.stops);
    expect(result.presentTags).toEqual(['OFFSET']);
  });

  it('marks only changed chart timing fields as explicit for export', () => {
    const result = updateInitialTiming({ ...timing, presentTags: ['OFFSET'] }, {
      bpm: 150,
      offset: timing.offset,
      timeSignature: { numerator: 7, denominator: 8 },
    });
    expect(result.presentTags).toEqual(['OFFSET', 'BPMS', 'TIMESIGNATURES']);
  });

  it('keeps a row exactly at the exclusive proposal end boundary', () => {
    const result = replaceRowsInHalfOpenRange(
      chart([
        { row: 0, beat: 0, arrows: '1000' },
        { row: 192, beat: 4, arrows: '0100' },
      ]),
      [{ beat: 0, arrows: '0010' }, { beat: 4, arrows: '0001' }],
      0,
      4,
      4
    );
    expect(result.noteRows).toEqual([
      { row: 0, beat: 0, arrows: '0010' },
      { row: 192, beat: 4, arrows: '0100' },
    ]);
  });

  it('derives holds after edits, including cross-measure spans and orphan tails', () => {
    const rows: NoteRow[] = [
      { row: 144, beat: 3, arrows: '2000' },
      { row: 192, beat: 4, arrows: '0300' },
      { row: 240, beat: 5, arrows: '3000' },
    ];
    expect(deriveHolds(rows, 4)).toEqual([
      { track: 0, startRow: 144, endRow: 240, startBeat: 3, endBeat: 5, isRoll: false },
    ]);
  });

  it('does not fabricate a tail for an unclosed hold', () => {
    const rows = [
      { row: 0, beat: 0, arrows: '2000' },
      { row: 48, beat: 1, arrows: '0100' },
    ];
    expect(deriveHolds(rows, 4)).toEqual([]);
    expect(validateHoldTopology(rows, 4)).toEqual(['unclosed hold head on column 1 at beat 0']);
  });

  it('rejects generated orphan releases and overlapping heads', () => {
    expect(validateHoldTopology([
      { row: 0, beat: 0, arrows: '3000' },
      { row: 48, beat: 1, arrows: '2000' },
      { row: 96, beat: 2, arrows: '4000' },
    ], 4)).toEqual([
      'orphan hold tail on column 1 at beat 0',
      'overlapping hold heads on column 1 at beat 2',
      'unclosed hold head on column 1 at beat 1',
    ]);
  });

  it('rejects a replacement whose exclusive end boundary separates a head from its tail', () => {
    const withBoundaryHold = chart([
      { row: 144, beat: 3, arrows: '2000' },
      { row: 192, beat: 4, arrows: '3000' },
    ]);
    expect(() => replaceRowsInHalfOpenRange(withBoundaryHold, [], 0, 4, 4))
      .toThrow('Selection boundary crosses a hold');
  });

  it('moves an automatic hold tail forward instead of overwriting a collision', () => {
    const rows = [
      { row: 12, beat: 0.25, arrows: '1000' },
      { row: 24, beat: 0.5, arrows: 'M000' },
    ];
    expect(findAvailableHoldTailBeat(rows, 0, 0.25, 0.25)).toBe(0.75);
  });

  it('isolates undo and redo branches by document/chart scope', () => {
    const history = new ScopedUndoHistory<number>();
    history.push('doc1:0', 1);
    history.push('doc1:1', 10);
    expect(history.undo('doc1:1', 11)).toBe(10);
    expect(history.undo('doc1:0', 2)).toBe(1);
    expect(history.undo('doc2:0', 99)).toBeNull();
    history.push('doc1:0', 3);
    expect(history.redo('doc1:0', 4)).toBeNull();
  });

  it('binds proposals to document, chart, and revision while retaining their range', () => {
    const base = { documentId: 1, chartIndex: 0, revision: 2, startBeat: 4, endBeat: 8 };
    expect(sameProposalTarget(base, { ...base, startBeat: 100, endBeat: 104 })).toBe(true);
    expect(sameProposalTarget(base, { ...base, chartIndex: 1 })).toBe(false);
    expect(sameProposalTarget(base, { ...base, revision: 3 })).toBe(false);
  });

  it('uses audio duration for a full-song draft range', () => {
    expect(fullSongEndBeat(timing, 60, 4)).toBeGreaterThan(100);
  });
});
