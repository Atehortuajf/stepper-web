/**
 * frontend/src/editor/engine/msdParser.ts
 * Robust EBNF MSD (Musical Score Description) lexer and parser.
 * Supports legacy .sm and modern .ssc simfiles with split timing,
 * escape characters (\:, \;, \#, \\), comments (//), and implicit tag recovery.
 */

import type {
  Chart,
  Difficulty,
  HoldNote,
  Measure,
  NoteRow,
  StepsType,
  TimeSignature,
  Simfile,
} from './types';

export interface MSDTag {
  name: string;
  params: string[];
  raw?: string;
}

const KEYSOUND_REGEX = /\[\d+\]/g;
const ATTACK_REGEX = /\{[^}]*\}/g;

/**
 * Parses raw text conforming to the MSD grammar into a list of MSDTag blocks.
 */
export function parseMSD(text: string): MSDTag[] {
  const tags: MSDTag[] = [];
  const len = text.length;
  let i = 0;

  const STATE_SEEKING = 0;
  const STATE_TAG_NAME = 1;
  const STATE_PARAM = 2;

  let state = STATE_SEEKING;
  let currentTagNameChars: string[] = [];
  let currentParams: string[] = [];
  let currentParamChars: string[] = [];

  const flushTag = () => {
    const name = currentTagNameChars.join('').trim().toUpperCase();
    if (name.length > 0) {
      tags.push({
        name,
        params: [...currentParams],
      });
    }
    currentTagNameChars = [];
    currentParams = [];
    currentParamChars = [];
  };

  while (i < len) {
    const ch = text[i];

    // 1. Comments: '//' skips to end of line
    if (ch === '/' && i + 1 < len && text[i + 1] === '/') {
      i += 2;
      while (i < len && text[i] !== '\r' && text[i] !== '\n') {
        i++;
      }
      continue;
    }

    // 2. Seeking next '#' tag
    if (state === STATE_SEEKING) {
      if (ch === '#') {
        state = STATE_TAG_NAME;
        currentTagNameChars = [];
        currentParams = [];
        currentParamChars = [];
      }
      i++;
      continue;
    }

    // 3. Reading tag name
    if (state === STATE_TAG_NAME) {
      // Check for implicit tag recovery on newline
      if (ch === '\r' || ch === '\n') {
        let nextI = i + 1;
        if (ch === '\r' && nextI < len && text[nextI] === '\n') {
          nextI++;
        }
        while (nextI < len && (text[nextI] === ' ' || text[nextI] === '\t')) {
          nextI++;
        }
        if (nextI < len && text[nextI] === '#') {
          // Implicit recovery: previous tag terminated with no params
          flushTag();
          i = nextI + 1;
          state = STATE_TAG_NAME;
          continue;
        }
      }

      // Escaped characters in tag name
      if (ch === '\\' && i + 1 < len) {
        const escCh = text[i + 1];
        if (escCh === ':' || escCh === ';' || escCh === '#' || escCh === '\\') {
          currentTagNameChars.push(escCh);
          i += 2;
          continue;
        }
      }

      if (ch === ':') {
        state = STATE_PARAM;
        currentParamChars = [];
      } else if (ch === ';') {
        flushTag();
        state = STATE_SEEKING;
      } else {
        currentTagNameChars.push(ch);
      }
      i++;
      continue;
    }

    // 4. Reading parameters
    if (state === STATE_PARAM) {
      // Check for implicit recovery on newline
      if (ch === '\r' || ch === '\n') {
        let nextI = i + 1;
        if (ch === '\r' && nextI < len && text[nextI] === '\n') {
          nextI++;
        }
        while (nextI < len && (text[nextI] === ' ' || text[nextI] === '\t')) {
          nextI++;
        }
        if (nextI < len && text[nextI] === '#') {
          currentParams.push(currentParamChars.join(''));
          flushTag();
          i = nextI + 1;
          state = STATE_TAG_NAME;
          continue;
        }
      }

      // Escaped characters in parameter
      if (ch === '\\' && i + 1 < len) {
        const escCh = text[i + 1];
        if (escCh === ':' || escCh === ';' || escCh === '#' || escCh === '\\') {
          currentParamChars.push(escCh);
          i += 2;
          continue;
        } else {
          currentParamChars.push(ch);
          i++;
          continue;
        }
      }

      if (ch === ':') {
        currentParams.push(currentParamChars.join(''));
        currentParamChars = [];
      } else if (ch === ';') {
        currentParams.push(currentParamChars.join(''));
        flushTag();
        state = STATE_SEEKING;
      } else {
        currentParamChars.push(ch);
      }
      i++;
      continue;
    }
  }

  // Flush trailing tag if stream ended before ';'
  if (state === STATE_PARAM) {
    currentParams.push(currentParamChars.join(''));
    flushTag();
  } else if (state === STATE_TAG_NAME) {
    flushTag();
  }

  return tags;
}

/**
 * Parses comma-separated beat=value pairs into sorted Array<{ beat: number; val: number }>.
 */
export function parseBeatValueList(raw: string): Array<{ beat: number; value: number }> {
  const result: Array<{ beat: number; value: number }> = [];
  if (!raw || !raw.trim()) return result;

  const items = raw.split(',');
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed || !trimmed.includes('=')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const beat = parseFloat(parts[0].trim());
      const value = parseFloat(parts[1].trim());
      if (!Number.isNaN(beat) && !Number.isNaN(value)) {
        result.push({ beat, value });
      }
    }
  }

  result.sort((a, b) => a.beat - b.beat);
  return result;
}

/**
 * Parses comma-separated beat=num=den triplets into sorted TimeSignature array.
 */
export function parseTimeSignatures(raw: string): TimeSignature[] {
  const result: TimeSignature[] = [];
  if (!raw || !raw.trim()) return result;

  const items = raw.split(',');
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 3) {
      const beat = parseFloat(parts[0].trim());
      const numerator = parseInt(parts[1].trim(), 10);
      const denominator = parseInt(parts[2].trim(), 10);
      if (!Number.isNaN(beat) && !Number.isNaN(numerator) && !Number.isNaN(denominator)) {
        result.push({ beat, numerator, denominator });
      }
    }
  }

  result.sort((a, b) => a.beat - b.beat);
  return result;
}

/**
 * Cleans note lines by stripping keysounds, attacks, comments, and empty lines.
 */
export function cleanMeasureLines(measureStr: string): string[] {
  const rawLines = measureStr.split(/\r?\n/);
  const clean: string[] = [];

  for (let line of rawLines) {
    if (line.includes('//')) {
      line = line.split('//')[0];
    }
    if (line.includes(';')) {
      line = line.split(';')[0];
    }
    line = line.replace(KEYSOUND_REGEX, '');
    line = line.replace(ATTACK_REGEX, '');
    line = line.trim();
    if (line.length > 0) {
      clean.push(line);
    }
  }

  return clean;
}

export interface ParsedNoteData {
  measures: Measure[];
  noteRows: NoteRow[];
  holds: HoldNote[];
}

/**
 * Parses raw measure note data into 192-tick NoteRows, measures, and paired HoldNotes.
 */
export function parseNoteData(rawNotes: string, expectedPanels = 4): ParsedNoteData {
  let cleanRaw = rawNotes.trim();
  if (cleanRaw.endsWith(';')) {
    cleanRaw = cleanRaw.slice(0, -1).trim();
  }

  const measureChunks = cleanRaw.split(',');
  const measures: Measure[] = [];
  const noteRows: NoteRow[] = [];
  const holds: HoldNote[] = [];

  // track -> { startRow, startBeat, isRoll }
  const activeHolds = new Map<number, { startRow: number; startBeat: number; isRoll: boolean }>();

  for (let mIdx = 0; mIdx < measureChunks.length; mIdx++) {
    const cleanLines = cleanMeasureLines(measureChunks[mIdx]);
    if (cleanLines.length === 0) {
      measures.push({ lines: ['0'.repeat(expectedPanels)] });
      continue;
    }

    measures.push({ lines: cleanLines });
    const numLines = cleanLines.length;

    for (let lIdx = 0; lIdx < numLines; lIdx++) {
      const line = cleanLines[lIdx];
      // Pad or slice to expectedPanels
      let arrowStr = line;
      if (arrowStr.length < expectedPanels) {
        arrowStr = arrowStr.padEnd(expectedPanels, '0');
      } else if (arrowStr.length > expectedPanels) {
        arrowStr = arrowStr.slice(0, expectedPanels);
      }

      const row = mIdx * 192 + Math.round((192 * lIdx) / numLines);
      const beat = row / 48.0;

      noteRows.push({ row, beat, arrows: arrowStr });

      // Track holds and rolls
      for (let t = 0; t < expectedPanels; t++) {
        const c = arrowStr[t];
        if (c === '2' || c === '4') {
          // If already holding, close previous hold
          if (activeHolds.has(t)) {
            const prev = activeHolds.get(t)!;
            holds.push({
              track: t,
              startRow: prev.startRow,
              endRow: row,
              startBeat: prev.startBeat,
              endBeat: beat,
              isRoll: prev.isRoll,
            });
          }
          activeHolds.set(t, {
            startRow: row,
            startBeat: beat,
            isRoll: c === '4',
          });
        } else if (c === '3') {
          if (activeHolds.has(t)) {
            const prev = activeHolds.get(t)!;
            holds.push({
              track: t,
              startRow: prev.startRow,
              endRow: row,
              startBeat: prev.startBeat,
              endBeat: beat,
              isRoll: prev.isRoll,
            });
            activeHolds.delete(t);
          }
          // Orphan '3' is discarded
        }
      }
    }
  }

  // Clamp any remaining unclosed holds to chart end
  if (noteRows.length > 0) {
    const lastRow = noteRows[noteRows.length - 1].row;
    for (const [t, prev] of activeHolds.entries()) {
      const endRow = Math.max(prev.startRow + 48, lastRow);
      holds.push({
        track: t,
        startRow: prev.startRow,
        endRow,
        startBeat: prev.startBeat,
        endBeat: endRow / 48.0,
        isRoll: prev.isRoll,
      });
    }
  }

  noteRows.sort((a, b) => a.row - b.row);
  holds.sort((a, b) => (a.startRow !== b.startRow ? a.startRow - b.startRow : a.track - b.track));

  return { measures, noteRows, holds };
}

/**
 * Converts StepsType to expected panel count.
 */
export function getPanelCount(stepsType: string): number {
  const s = stepsType.toLowerCase();
  if (s === 'dance-double' || s === 'pump-double') return 8;
  if (s === 'dance-solo') return 6;
  if (s === 'pump-single') return 5;
  return 4; // default dance-single
}

export function normalizeDifficulty(diff: string): Difficulty {
  const d = diff.trim().toLowerCase();
  switch (d) {
    case 'beginner':
    case 'novice':
      return 'Beginner';
    case 'easy':
      return 'Easy';
    case 'medium':
    case 'basic':
      return 'Medium';
    case 'hard':
    case 'difficult':
      return 'Hard';
    case 'challenge':
    case 'expert':
    case 'master':
      return 'Challenge';
    case 'edit':
      return 'Edit';
    default:
      return 'Challenge';
  }
}

/**
 * Parses full MSD content from an .sm or .ssc simfile.
 */
export function parseSimfile(text: string, fileTypeHint?: 'sm' | 'ssc'): Simfile {
  const tags = parseMSD(text);

  // Detect file type if not hinted
  let isSSC = fileTypeHint === 'ssc';
  if (!isSSC) {
    isSSC = tags.some((t) => t.name === 'VERSION' || t.name === 'NOTEDATA');
  }

  const simfile: Simfile = {
    fileType: isSSC ? 'ssc' : 'sm',
    title: '',
    subtitle: '',
    artist: '',
    titleTranslit: '',
    subtitleTranslit: '',
    artistTranslit: '',
    genre: '',
    credit: '',
    banner: '',
    background: '',
    lyricsPath: '',
    cdTitle: '',
    music: '',
    sampleStart: 0.0,
    sampleLength: 12.0,
    selectable: 'YES',
    metadata: {},
    timing: {
      offset: 0.0,
      bpms: [{ beat: 0, bpm: 140 }],
      stops: [],
      delays: [],
      warps: [],
      timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
    },
    charts: [],
    extraTags: {},
  };

  if (isSSC) {
    parseSSCTags(simfile, tags);
  } else {
    parseSMTags(simfile, tags);
  }

  return simfile;
}

function parseSMTags(simfile: Simfile, tags: MSDTag[]): void {
  for (const tag of tags) {
    const val = tag.params.join(':').trim();
    simfile.metadata[tag.name] = val;

    switch (tag.name) {
      case 'TITLE':
        simfile.title = val;
        break;
      case 'SUBTITLE':
        simfile.subtitle = val;
        break;
      case 'ARTIST':
        simfile.artist = val;
        break;
      case 'TITLETRANSLIT':
        simfile.titleTranslit = val;
        break;
      case 'SUBTITLETRANSLIT':
        simfile.subtitleTranslit = val;
        break;
      case 'ARTISTTRANSLIT':
        simfile.artistTranslit = val;
        break;
      case 'GENRE':
        simfile.genre = val;
        break;
      case 'CREDIT':
        simfile.credit = val;
        break;
      case 'BANNER':
        simfile.banner = val;
        break;
      case 'BACKGROUND':
        simfile.background = val;
        break;
      case 'LYRICSPATH':
        simfile.lyricsPath = val;
        break;
      case 'CDTITLE':
        simfile.cdTitle = val;
        break;
      case 'MUSIC':
        simfile.music = val;
        break;
      case 'OFFSET': {
        const offset = parseFloat(val);
        if (!Number.isNaN(offset)) simfile.timing.offset = offset;
        break;
      }
      case 'SAMPLESTART': {
        const ss = parseFloat(val);
        if (!Number.isNaN(ss)) simfile.sampleStart = ss;
        break;
      }
      case 'SAMPLELENGTH': {
        const sl = parseFloat(val);
        if (!Number.isNaN(sl)) simfile.sampleLength = sl;
        break;
      }
      case 'SELECTABLE':
        simfile.selectable = val;
        break;
      case 'DISPLAYBPM':
        simfile.displayBpm = val;
        break;
      case 'BPMS': {
        const bpms = parseBeatValueList(val).map((p) => ({ beat: p.beat, bpm: p.value }));
        if (bpms.length > 0) simfile.timing.bpms = bpms;
        break;
      }
      case 'STOPS':
      case 'FREEZES': {
        const stops = parseBeatValueList(val).map((p) => ({ beat: p.beat, duration: p.value }));
        simfile.timing.stops = stops;
        break;
      }
      case 'NOTES':
      case 'NOTES2': {
        // 6 parameters in legacy .sm format
        if (tag.params.length >= 6) {
          const stepsType = tag.params[0].trim() as StepsType;
          const desc = tag.params[1].trim();
          const diff = normalizeDifficulty(tag.params[2]);
          const meter = parseInt(tag.params[3].trim(), 10) || 1;
          const radarStr = tag.params[4].trim();
          const radarValues = radarStr
            ? radarStr.split(',').map((v) => parseFloat(v.trim()) || 0)
            : undefined;
          const rawNotes = tag.params.slice(5).join(':');

          const panelCount = getPanelCount(stepsType);
          const parsed = parseNoteData(rawNotes, panelCount);

          simfile.charts.push({
            stepsType,
            description: desc,
            difficulty: diff,
            meter,
            radarValues,
            credit: simfile.credit,
            notes: parsed.measures,
            noteRows: parsed.noteRows,
            holds: parsed.holds,
          });
        }
        break;
      }
      default:
        simfile.extraTags![tag.name] = val;
        break;
    }
  }
}

function parseSSCTags(simfile: Simfile, tags: MSDTag[]): void {
  let currentChart: Chart | null = null;

  for (const tag of tags) {
    const val = tag.params.join(':').trim();

    if (tag.name === 'NOTEDATA') {
      if (currentChart) {
        simfile.charts.push(currentChart);
      }
      currentChart = {
        stepsType: 'dance-single',
        description: '',
        difficulty: 'Challenge',
        meter: 1,
        credit: simfile.credit,
        notes: [],
        noteRows: [],
        holds: [],
        extraTags: {},
      };
      continue;
    }

    if (!currentChart) {
      // Song-level headers
      simfile.metadata[tag.name] = val;

      switch (tag.name) {
        case 'VERSION': {
          const ver = parseFloat(val);
          if (!Number.isNaN(ver)) simfile.version = ver;
          break;
        }
        case 'TITLE':
          simfile.title = val;
          break;
        case 'SUBTITLE':
          simfile.subtitle = val;
          break;
        case 'ARTIST':
          simfile.artist = val;
        break;
        case 'TITLETRANSLIT':
          simfile.titleTranslit = val;
          break;
        case 'SUBTITLETRANSLIT':
          simfile.subtitleTranslit = val;
          break;
        case 'ARTISTTRANSLIT':
          simfile.artistTranslit = val;
          break;
        case 'GENRE':
          simfile.genre = val;
          break;
        case 'CREDIT':
          simfile.credit = val;
          break;
        case 'BANNER':
          simfile.banner = val;
          break;
        case 'BACKGROUND':
          simfile.background = val;
          break;
        case 'LYRICSPATH':
          simfile.lyricsPath = val;
          break;
        case 'CDTITLE':
          simfile.cdTitle = val;
          break;
        case 'MUSIC':
          simfile.music = val;
          break;
        case 'OFFSET': {
          const offset = parseFloat(val);
          if (!Number.isNaN(offset)) simfile.timing.offset = offset;
          break;
        }
        case 'SAMPLESTART': {
          const ss = parseFloat(val);
          if (!Number.isNaN(ss)) simfile.sampleStart = ss;
          break;
        }
        case 'SAMPLELENGTH': {
          const sl = parseFloat(val);
          if (!Number.isNaN(sl)) simfile.sampleLength = sl;
          break;
        }
        case 'SELECTABLE':
          simfile.selectable = val;
          break;
        case 'DISPLAYBPM':
          simfile.displayBpm = val;
          break;
        case 'BPMS': {
          const bpms = parseBeatValueList(val).map((p) => ({ beat: p.beat, bpm: p.value }));
          if (bpms.length > 0) simfile.timing.bpms = bpms;
          break;
        }
        case 'STOPS': {
          const stops = parseBeatValueList(val).map((p) => ({ beat: p.beat, duration: p.value }));
          simfile.timing.stops = stops;
          break;
        }
        case 'DELAYS': {
          const delays = parseBeatValueList(val).map((p) => ({ beat: p.beat, duration: p.value }));
          simfile.timing.delays = delays;
          break;
        }
        case 'WARPS': {
          const warps = parseBeatValueList(val).map((p) => ({ beat: p.beat, duration: p.value }));
          simfile.timing.warps = warps;
          break;
        }
        case 'TIMESIGNATURES': {
          const ts = parseTimeSignatures(val);
          if (ts.length > 0) simfile.timing.timeSignatures = ts;
          break;
        }
        default:
          simfile.extraTags![tag.name] = val;
          break;
      }
    } else {
      // Per-chart headers within #NOTEDATA:;
      switch (tag.name) {
        case 'STEPSTYPE':
          currentChart.stepsType = val as StepsType;
          break;
        case 'CHARTNAME':
          currentChart.chartName = val;
          break;
        case 'DESCRIPTION':
          currentChart.description = val;
          break;
        case 'CHARTSTYLE':
          currentChart.chartStyle = val;
          break;
        case 'DIFFICULTY':
          currentChart.difficulty = normalizeDifficulty(val);
          break;
        case 'METER': {
          const meter = parseInt(val, 10);
          if (!Number.isNaN(meter)) currentChart.meter = meter;
          break;
        }
        case 'RADARVALUES':
          currentChart.radarValues = val
            .split(',')
            .map((v) => parseFloat(v.trim()) || 0);
          break;
        case 'CREDIT':
          currentChart.credit = val;
          break;
        case 'MUSIC':
          currentChart.music = val;
          break;

        // Split Timing Overrides
        case 'OFFSET': {
          const off = parseFloat(val);
          if (!Number.isNaN(off)) {
            currentChart.timing = currentChart.timing || { ...simfile.timing };
            currentChart.timing.offset = off;
          }
          break;
        }
        case 'BPMS': {
          const bpms = parseBeatValueList(val).map((p) => ({ beat: p.beat, bpm: p.value }));
          if (bpms.length > 0) {
            currentChart.timing = currentChart.timing || { ...simfile.timing };
            currentChart.timing.bpms = bpms;
          }
          break;
        }
        case 'STOPS': {
          const stops = parseBeatValueList(val).map((p) => ({ beat: p.beat, duration: p.value }));
          currentChart.timing = currentChart.timing || { ...simfile.timing };
          currentChart.timing.stops = stops;
          break;
        }
        case 'DELAYS': {
          const delays = parseBeatValueList(val).map((p) => ({ beat: p.beat, duration: p.value }));
          currentChart.timing = currentChart.timing || { ...simfile.timing };
          currentChart.timing.delays = delays;
          break;
        }
        case 'WARPS': {
          const warps = parseBeatValueList(val).map((p) => ({ beat: p.beat, duration: p.value }));
          currentChart.timing = currentChart.timing || { ...simfile.timing };
          currentChart.timing.warps = warps;
          break;
        }
        case 'NOTES': {
          const panelCount = getPanelCount(currentChart.stepsType);
          const parsed = parseNoteData(val, panelCount);
          currentChart.notes = parsed.measures;
          currentChart.noteRows = parsed.noteRows;
          currentChart.holds = parsed.holds;
          break;
        }
        default:
          currentChart.extraTags![tag.name] = val;
          break;
      }
    }
  }

  if (currentChart) {
    simfile.charts.push(currentChart);
  }
}
