import type { Chart, HoldNote, NoteRow, TimingData } from '../engine/types';
import { getSmallestNoteTypeForMeasure, notesToMeasureGrids } from '../engine/measureUtil';
import { TimingEngine } from '../engine/timingEngine';

export interface TimingFormValues {
  bpm: number;
  offset: number;
  timeSignature: { numerator: number; denominator: number };
}

export interface ProposalContext {
  documentId: number;
  chartIndex: number;
  revision: number;
  startBeat: number;
  endBeat: number;
}

export function deriveHolds(noteRows: NoteRow[], panelCount: number): HoldNote[] {
  const holds: HoldNote[] = [];
  const active = new Map<number, { row: NoteRow; isRoll: boolean }>();
  const rows = [...noteRows].sort((a, b) => a.row - b.row);

  for (const row of rows) {
    for (let track = 0; track < panelCount; track++) {
      const char = row.arrows[track] || '0';
      if (char === '2' || char === '4') {
        if (!active.has(track)) active.set(track, { row, isRoll: char === '4' });
      } else if (char === '3') {
        const previous = active.get(track);
        if (previous) {
          holds.push({
            track,
            startRow: previous.row.row,
            endRow: row.row,
            startBeat: previous.row.beat,
            endBeat: row.beat,
            isRoll: previous.isRoll,
          });
          active.delete(track);
        }
      }
    }
  }

  return holds;
}

export function validateHoldTopology(noteRows: NoteRow[], panelCount: number): string[] {
  const errors: string[] = [];
  const active = new Map<number, NoteRow>();
  for (const row of [...noteRows].sort((a, b) => a.row - b.row)) {
    for (let track = 0; track < panelCount; track++) {
      const char = row.arrows[track] || '0';
      if (char === '2' || char === '4') {
        if (active.has(track)) errors.push(`overlapping hold heads on column ${track + 1} at beat ${row.beat}`);
        else active.set(track, row);
      } else if (char === '3') {
        if (!active.has(track)) errors.push(`orphan hold tail on column ${track + 1} at beat ${row.beat}`);
        else active.delete(track);
      }
    }
  }
  for (const [track, row] of active) {
    errors.push(`unclosed hold head on column ${track + 1} at beat ${row.beat}`);
  }
  return errors;
}

export function rebuildChartFromRows(chart: Chart, noteRows: NoteRow[], panelCount: number): Chart {
  const rows = [...noteRows].sort((a, b) => a.row - b.row);
  const grids = notesToMeasureGrids(rows, { panelCount });
  const emptyChord = '0'.repeat(panelCount);
  const notes = grids.map((grid) => {
    const { stride, numRows } = getSmallestNoteTypeForMeasure(grid);
    const lines: string[] = [];
    for (let row = 0; row < numRows; row++) lines.push(grid.get(row * stride) || emptyChord);
    return { lines };
  });
  return { ...chart, noteRows: rows, notes, holds: deriveHolds(rows, panelCount) };
}

function replaceBeatZero<T extends { beat: number }>(events: T[], next: T): T[] {
  const index = events.findIndex((event) => Math.abs(event.beat) < 0.000001);
  if (index < 0) return [next, ...events].sort((a, b) => a.beat - b.beat);
  const updated = [...events];
  updated[index] = next;
  return updated;
}

export function updateInitialTiming(timing: TimingData, values: TimingFormValues): TimingData {
  const initialBpm = timing.bpms.find((event) => Math.abs(event.beat) < 0.000001)?.bpm;
  const initialTimeSignature = timing.timeSignatures.find((event) => Math.abs(event.beat) < 0.000001);
  const presentTags = new Set(timing.presentTags || []);
  if (timing.offset !== values.offset) presentTags.add('OFFSET');
  if (initialBpm !== values.bpm) presentTags.add('BPMS');
  if (
    initialTimeSignature?.numerator !== values.timeSignature.numerator ||
    initialTimeSignature?.denominator !== values.timeSignature.denominator
  ) {
    presentTags.add('TIMESIGNATURES');
  }
  return {
    ...timing,
    offset: values.offset,
    bpms: replaceBeatZero(timing.bpms, { beat: 0, bpm: values.bpm }),
    timeSignatures: replaceBeatZero(timing.timeSignatures, { beat: 0, ...values.timeSignature }),
    presentTags: [...presentTags],
  };
}

export function replaceRowsInHalfOpenRange(
  chart: Chart,
  placements: Array<{ beat: number; arrows: string }>,
  startBeat: number,
  endBeat: number,
  panelCount: number
): Chart {
  const crossingHold = deriveHolds(chart.noteRows, panelCount).find((hold) => {
    const headInside = hold.startBeat >= startBeat && hold.startBeat < endBeat;
    const tailInside = hold.endBeat >= startBeat && hold.endBeat < endBeat;
    return headInside !== tailInside || (hold.startBeat < startBeat && hold.endBeat >= endBeat);
  });
  if (crossingHold) {
    throw new Error(
      `Selection boundary crosses a hold on column ${crossingHold.track + 1} (${crossingHold.startBeat}–${crossingHold.endBeat}).`
    );
  }
  const outside = chart.noteRows.filter((row) => row.beat < startBeat || row.beat >= endBeat);
  const proposed = placements
    .filter((placement) => placement.beat >= startBeat && placement.beat < endBeat)
    .map((placement) => ({
      beat: placement.beat,
      row: Math.round(placement.beat * 48),
      arrows: placement.arrows,
    }));
  const merged = [...outside, ...proposed];
  const holdErrors = validateHoldTopology(merged, panelCount);
  if (holdErrors.length > 0) throw new Error(`Invalid generated holds: ${holdErrors[0]}.`);
  return rebuildChartFromRows(chart, merged, panelCount);
}

export function findAvailableHoldTailBeat(
  noteRows: NoteRow[],
  track: number,
  preferredBeat: number,
  snapBeats: number
): number {
  let beat = preferredBeat;
  for (let attempt = 0; attempt < 192; attempt++) {
    const row = noteRows.find((candidate) => Math.abs(candidate.beat - beat) < 0.000001);
    if (!row || !row.arrows[track] || row.arrows[track] === '0') return beat;
    beat += snapBeats;
  }
  return beat;
}

export function fullSongEndBeat(timing: TimingData, audioDuration: number, chartEndBeat: number): number {
  if (!(audioDuration > 0)) return Math.max(4, chartEndBeat);
  const audioBeatEstimate = new TimingEngine(timing).secondsToBeat(audioDuration);
  return Math.max(4, chartEndBeat, audioBeatEstimate);
}

export class ScopedUndoHistory<T> {
  private histories = new Map<string, { undo: T[]; redo: T[] }>();
  private readonly maxDepth: number;
  constructor(maxDepth = 50) { this.maxDepth = maxDepth; }

  private get(scope: string) {
    let history = this.histories.get(scope);
    if (!history) {
      history = { undo: [], redo: [] };
      this.histories.set(scope, history);
    }
    return history;
  }

  push(scope: string, state: T): void {
    const history = this.get(scope);
    history.undo.push(state);
    if (history.undo.length > this.maxDepth) history.undo.shift();
    history.redo = [];
  }

  undo(scope: string, current: T): T | null {
    const history = this.get(scope);
    const previous = history.undo.pop();
    if (!previous) return null;
    history.redo.push(current);
    return previous;
  }

  redo(scope: string, current: T): T | null {
    const history = this.get(scope);
    const next = history.redo.pop();
    if (!next) return null;
    history.undo.push(current);
    return next;
  }

  clearAll(): void { this.histories.clear(); }
  peekUndo(scope: string): T | null {
    const history = this.get(scope);
    return history.undo.at(-1) ?? null;
  }
  peekRedo(scope: string): T | null {
    const history = this.get(scope);
    return history.redo.at(-1) ?? null;
  }
}

export function sameProposalTarget(a: ProposalContext, b: ProposalContext): boolean {
  return a.documentId === b.documentId && a.chartIndex === b.chartIndex && a.revision === b.revision;
}
