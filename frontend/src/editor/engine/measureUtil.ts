/**
 * frontend/src/editor/engine/measureUtil.ts
 * StepMania 192-tick grid math and measure line minimization algorithm:
 * getSmallestNoteTypeForMeasure and note serialization.
 */

import { TICKS_PER_BEAT, TICKS_PER_MEASURE } from './subdivisions';
import type { NoteRow } from './types';

/**
 * Valid StepMania line counts and corresponding tick strides within a 192-tick measure.
 * Stride = 192 / numRows.
 * Ordered strictly from coarsest (4 rows, stride 48) to finest (192 rows, stride 1).
 */
export const VALID_QUANTIZATIONS: Array<{ numRows: number; stride: number }> = [
  { numRows: 4, stride: 48 }, // 4th notes
  { numRows: 8, stride: 24 }, // 8th notes
  { numRows: 12, stride: 16 }, // 12th notes (quarter triplets)
  { numRows: 16, stride: 12 }, // 16th notes
  { numRows: 24, stride: 8 }, // 24th notes (eighth triplets)
  { numRows: 32, stride: 6 }, // 32nd notes
  { numRows: 48, stride: 4 }, // 48th notes (sixteenth triplets)
  { numRows: 64, stride: 3 }, // 64th notes
  { numRows: 96, stride: 2 }, // 96th notes
  { numRows: 192, stride: 1 }, // 192nd notes
];

export const VALID_ROW_COUNTS = VALID_QUANTIZATIONS.map((q) => q.numRows);

export function beatToRow(beat: number): number {
  return Math.round(beat * TICKS_PER_BEAT);
}

export function rowToBeat(row: number): number {
  return row / TICKS_PER_BEAT;
}

export function rowToMeasureAndTick(row: number): { measure: number; tick: number } {
  const measure = Math.floor(row / TICKS_PER_MEASURE);
  const tick = ((row % TICKS_PER_MEASURE) + TICKS_PER_MEASURE) % TICKS_PER_MEASURE;
  return { measure, tick };
}

export function measureAndTickToRow(measure: number, tick: number): number {
  return measure * TICKS_PER_MEASURE + tick;
}

/**
 * Checks if a chord string contains any active notes (non-'0' and non-empty).
 */
export function isTickEmpty(chord: string): boolean {
  if (!chord) return true;
  for (let i = 0; i < chord.length; i++) {
    if (chord[i] !== '0') return false;
  }
  return true;
}

/**
 * Selects the minimal StepMania measure row count that losslessly represents
 * all non-zero ticks in a measure.
 *
 * Mathematical Invariant:
 * Let T = { t in [0, 191] | tick t has non-zero note }.
 * Find the smallest numRows in [4, 8, 12, 16, 24, 32, 48, 64, 96, 192] such that:
 *   stride = 192 / numRows
 *   forall t in T: (t % stride === 0)
 *
 * If T is empty, returns { numRows: 4, stride: 48 }.
 */
export function getSmallestNoteTypeForMeasure(
  measureTicks:
    | Map<number, string>
    | Record<number, string>
    | string[]
    | Set<number>
): { numRows: number; stride: number } {
  const activeTicks: number[] = [];

  if (measureTicks instanceof Map) {
    for (const [t, chord] of measureTicks.entries()) {
      if (t >= 0 && t < TICKS_PER_MEASURE && !isTickEmpty(chord)) {
        activeTicks.push(t);
      }
    }
  } else if (measureTicks instanceof Set) {
    for (const t of measureTicks) {
      if (t >= 0 && t < TICKS_PER_MEASURE) {
        activeTicks.push(t);
      }
    }
  } else if (Array.isArray(measureTicks)) {
    for (let t = 0; t < measureTicks.length && t < TICKS_PER_MEASURE; t++) {
      if (!isTickEmpty(measureTicks[t])) {
        activeTicks.push(t);
      }
    }
  } else if (typeof measureTicks === 'object' && measureTicks !== null) {
    for (const [key, chord] of Object.entries(measureTicks)) {
      const t = Number(key);
      if (t >= 0 && t < TICKS_PER_MEASURE && !isTickEmpty(chord)) {
        activeTicks.push(t);
      }
    }
  }

  // If measure is completely empty, minimal row count is 4 (stride 48)
  if (activeTicks.length === 0) {
    return { numRows: 4, stride: 48 };
  }

  // Search through valid quantizations from coarsest to finest
  for (const { numRows, stride } of VALID_QUANTIZATIONS) {
    const allDivisible = activeTicks.every((t) => t % stride === 0);
    if (allDivisible) {
      return { numRows, stride };
    }
  }

  return { numRows: 192, stride: 1 };
}

export interface FormatMeasureOptions {
  numRows?: number;
  isLast?: boolean;
  measureIdx?: number;
  includeComment?: boolean;
  panelCount?: number;
}

/**
 * Formats a single measure into a StepMania note string.
 */
export function formatMeasure(
  measureTicks: Map<number, string> | Record<number, string>,
  options: FormatMeasureOptions = {}
): string {
  const {
    numRows: requestedRows,
    isLast = false,
    measureIdx,
    includeComment = false,
    panelCount = 4,
  } = options;

  let numRows: number;
  let stride: number;

  if (requestedRows !== undefined) {
    if (!VALID_ROW_COUNTS.includes(requestedRows)) {
      throw new Error(
        `Invalid StepMania row count ${requestedRows}. Must be one of ${VALID_ROW_COUNTS.join(', ')}`
      );
    }
    numRows = requestedRows;
    stride = TICKS_PER_MEASURE / numRows;
  } else {
    const opt = getSmallestNoteTypeForMeasure(measureTicks);
    numRows = opt.numRows;
    stride = opt.stride;
  }

  const emptyChord = '0'.repeat(panelCount);
  const rows: string[] = [];

  if (includeComment && measureIdx !== undefined) {
    rows.push(`// measure ${measureIdx}`);
  }

  const getChord = (t: number): string => {
    if (measureTicks instanceof Map) {
      return measureTicks.get(t) || emptyChord;
    }
    return measureTicks[t] || emptyChord;
  };

  for (let r = 0; r < numRows; r++) {
    const t = r * stride;
    let chord = getChord(t);
    // Pad or trim to panelCount
    if (chord.length < panelCount) {
      chord = chord.padEnd(panelCount, '0');
    } else if (chord.length > panelCount) {
      chord = chord.slice(0, panelCount);
    }
    rows.push(chord);
  }

  const delimiter = isLast ? ';' : ',';
  return rows.join('\n') + `\n${delimiter}`;
}

export interface NoteItem {
  beat?: number;
  row?: number;
  arrows?: string;
  chord?: string;
}

/**
 * Converts a sequence of notes into a list of measure grids.
 * Each measure grid maps tick in [0, 191] to panel chord string.
 */
export function notesToMeasureGrids(
  notes: Array<NoteRow | NoteItem | [number, string]>,
  options: { totalMeasures?: number; panelCount?: number } = {}
): Array<Map<number, string>> {
  const panelCount = options.panelCount ?? 4;
  const parsedNotes: Array<{ row: number; chord: string }> = [];
  let maxRow = 0;

  for (const item of notes) {
    let r: number;
    let c: string;

    if (Array.isArray(item)) {
      r = beatToRow(item[0]);
      c = item[1];
    } else if ('row' in item && typeof item.row === 'number' && 'arrows' in item && typeof item.arrows === 'string') {
      r = item.row;
      c = item.arrows;
    } else if ('beat' in item && typeof item.beat === 'number' && 'arrows' in item && typeof item.arrows === 'string') {
      r = beatToRow(item.beat);
      c = item.arrows;
    } else if ('beat' in item && typeof item.beat === 'number' && 'chord' in item && typeof item.chord === 'string') {
      r = beatToRow(item.beat);
      c = item.chord;
    } else {
      continue;
    }


    if (!isTickEmpty(c)) {
      parsedNotes.push({ row: r, chord: c });
      if (r > maxRow) {
        maxRow = r;
      }
    }
  }

  let numMeasures: number;
  if (options.totalMeasures !== undefined) {
    numMeasures = Math.max(1, options.totalMeasures);
  } else if (notes.length > 0) {
    let highestRow = 0;
    for (const item of notes) {
      if (Array.isArray(item)) {
        highestRow = Math.max(highestRow, beatToRow(item[0]));
      } else if ('row' in item && typeof item.row === 'number') {
        highestRow = Math.max(highestRow, item.row);
      } else if ('beat' in item && typeof item.beat === 'number') {
        highestRow = Math.max(highestRow, beatToRow(item.beat));
      }
    }
    numMeasures = Math.floor(highestRow / TICKS_PER_MEASURE) + 1;
  } else {
    numMeasures = 1;
  }


  const grids: Array<Map<number, string>> = Array.from(
    { length: numMeasures },
    () => new Map<number, string>()
  );

  for (const { row, chord } of parsedNotes) {
    const mIdx = Math.floor(row / TICKS_PER_MEASURE);
    const tick = row % TICKS_PER_MEASURE;
    if (mIdx < numMeasures) {
      const grid = grids[mIdx];
      if (grid.has(tick)) {
        // Merge notes panel-wise
        const existing = (grid.get(tick) || '').padEnd(panelCount, '0').split('');
        const incoming = chord.slice(0, panelCount).split('');
        for (let p = 0; p < panelCount; p++) {
          if (incoming[p] && incoming[p] !== '0') {
            existing[p] = incoming[p];
          }
        }
        grid.set(tick, existing.join(''));
      } else {
        grid.set(tick, chord);
      }
    }
  }

  return grids;
}

/**
 * Serializes a sequence of notes into complete StepMania NoteData string.
 * Applies measure minimization to each measure individually.
 */
export function formatChartMeasures(
  notes: Array<NoteRow | NoteItem | [number, string]>,
  options: {
    totalMeasures?: number;
    panelCount?: number;
    includeComments?: boolean;
  } = {}
): string {
  const grids = notesToMeasureGrids(notes, options);
  const total = grids.length;
  const measureStrs: string[] = [];

  for (let mIdx = 0; mIdx < total; mIdx++) {
    const isLast = mIdx === total - 1;
    const mStr = formatMeasure(grids[mIdx], {
      isLast,
      measureIdx: mIdx,
      includeComment: options.includeComments ?? false,
      panelCount: options.panelCount ?? 4,
    });
    measureStrs.push(mStr);
  }

  return measureStrs.join('\n');
}
