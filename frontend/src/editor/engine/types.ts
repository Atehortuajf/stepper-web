/**
 * frontend/src/editor/engine/types.ts
 * Strongly-typed data models for Simfile, Chart, NoteRow, TimingData,
 * supporting Dance Singles (4-panel) and Doubles (8-panel).
 */

export type StepsType =
  | 'dance-single'
  | 'dance-double'
  | 'dance-couple'
  | 'dance-solo'
  | 'pump-single'
  | 'pump-double';

export type Difficulty =
  | 'Beginner'
  | 'Easy'
  | 'Medium'
  | 'Hard'
  | 'Challenge'
  | 'Edit';

export type NoteChar =
  | '0' // Empty
  | '1' // Tap
  | '2' // Hold Head
  | '3' // Hold/Roll Tail
  | '4' // Roll Head
  | 'M' // Shock / Mine
  | 'L' // Lift
  | 'F' // Fake
  | 'K'; // Auto Keysound

export interface BpmChange {
  beat: number;
  bpm: number;
}

export interface StopEvent {
  beat: number;
  duration: number; // seconds
}

export interface DelayEvent {
  beat: number;
  duration: number; // seconds
}

export interface WarpEvent {
  beat: number;
  duration: number; // number of beats skipped (often called length)
}

export interface TimeSignature {
  beat: number;
  numerator: number;
  denominator: number;
}

export interface TickCount {
  beat: number;
  ticks: number;
}

export interface ComboEvent {
  beat: number;
  hit: number;
  miss: number;
}

export interface SpeedEvent {
  beat: number;
  ratio: number;
  delay: number;
  unit: number; // 0 = beats, 1 = seconds
}

export interface ScrollEvent {
  beat: number;
  ratio: number;
}

export interface FakeEvent {
  beat: number;
  duration: number; // length in beats
}

export interface LabelEvent {
  beat: number;
  label: string;
}

export type TimingTagName =
  | 'OFFSET'
  | 'BPMS'
  | 'STOPS'
  | 'DELAYS'
  | 'WARPS'
  | 'TIMESIGNATURES'
  | 'TICKCOUNTS'
  | 'COMBOS'
  | 'SPEEDS'
  | 'SCROLLS'
  | 'FAKES'
  | 'LABELS';

export interface TimingData {
  offset: number; // in seconds
  bpms: BpmChange[];
  stops: StopEvent[];
  delays: DelayEvent[];
  warps: WarpEvent[];
  timeSignatures: TimeSignature[];
  tickcounts?: TickCount[];
  combos?: ComboEvent[];
  speeds?: SpeedEvent[];
  scrolls?: ScrollEvent[];
  fakes?: FakeEvent[];
  labels?: LabelEvent[];
  /** Tags explicitly present in the source, including intentional empty overrides. */
  presentTags?: TimingTagName[];
}

export interface NoteRow {
  row: number; // 48 ticks/beat, 192 ticks/measure
  beat: number; // row / 48.0
  arrows: string; // 4-char for singles, 8-char for doubles
}

export interface HoldNote {
  track: number; // column index (0-3 for singles, 0-7 for doubles)
  startRow: number;
  endRow: number;
  startBeat: number;
  endBeat: number;
  isRoll: boolean; // false = '2' (hold), true = '4' (roll)
}

export interface Measure {
  lines: string[]; // each string length 4 (singles) or 8 (doubles)
}

export interface Chart {
  stepsType: StepsType;
  description: string;
  difficulty: Difficulty;
  meter: number;
  radarValues?: string | number[];
  credit?: string;
  chartName?: string;
  chartStyle?: string;
  music?: string;
  timing?: TimingData; // Split timing override if defined
  /** Song timing copied when the first split tag was parsed; used to detect later chart edits. */
  inheritedTiming?: TimingData;
  notes: Measure[]; // Measure array representation
  noteRows: NoteRow[]; // Flat row representation on 192-tick grid
  holds: HoldNote[]; // Paired hold/roll intervals
  extraTags?: Record<string, string>;
}

export interface Simfile {
  fileType: 'sm' | 'ssc';
  version?: number;
  title: string;
  subtitle: string;
  artist: string;
  titleTranslit: string;
  subtitleTranslit: string;
  artistTranslit: string;
  genre: string;
  credit: string;
  banner: string;
  background: string;
  lyricsPath: string;
  cdTitle: string;
  music: string;
  sampleStart: number;
  sampleLength: number;
  selectable: string;
  displayBpm?: string;
  metadata: Record<string, string>;
  timing: TimingData;
  charts: Chart[];
  extraTags?: Record<string, string>;
}

export type SubdivisionTier = 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64 | 96 | 192;
