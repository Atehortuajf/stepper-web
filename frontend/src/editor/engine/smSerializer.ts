/**
 * frontend/src/editor/engine/smSerializer.ts
 * Lossless serializer for StepMania legacy .sm and modern .ssc formats.
 * Applies measure line minimization (getSmallestNoteTypeForMeasure)
 * and formats floating-point timing values with 6 decimal places (%.6f).
 */

import { formatChartMeasures } from './measureUtil';
import { TICKS_PER_BEAT } from './subdivisions';
import type {
  BpmChange,
  Chart,
  DelayEvent,
  NoteRow,
  Simfile,
  StopEvent,
  WarpEvent,
  TimingData,
  TimingTagName,
} from './types';

export function escapeMSDParameter(value: string): string {
  return String(value ?? '').replace(/([\\;#])/g, '\\$1').replace(/:/g, '\\:');
}

function escapeUnknownTagValue(value: string): string {
  // Colons may delimit parameters in unknown tags, so retain them structurally.
  return String(value ?? '').replace(/([\\;#])/g, '\\$1');
}


export function formatFloat(val: number): string {
  return Number(val).toFixed(6);
}

export function formatBpmList(bpms: BpmChange[]): string {
  if (!bpms || bpms.length === 0) {
    return '0.000000=140.000000';
  }
  return bpms
    .map((b) => `${formatFloat(b.beat)}=${formatFloat(b.bpm)}`)
    .join(',');
}

export function formatStopList(stops: StopEvent[]): string {
  if (!stops || stops.length === 0) return '';
  return stops
    .map((s) => `${formatFloat(s.beat)}=${formatFloat(s.duration)}`)
    .join(',');
}

export function formatDelayList(delays: DelayEvent[]): string {
  if (!delays || delays.length === 0) return '';
  return delays
    .map((d) => `${formatFloat(d.beat)}=${formatFloat(d.duration)}`)
    .join(',');
}

export function formatWarpList(warps: WarpEvent[]): string {
  if (!warps || warps.length === 0) return '';
  return warps
    .map((w) => `${formatFloat(w.beat)}=${formatFloat(w.duration)}`)
    .join(',');
}

function formatTimeSignatures(t: TimingData): string {
  return (t.timeSignatures || []).map((x) => `${formatFloat(x.beat)}=${x.numerator}=${x.denominator}`).join(',');
}

function formatTimingTag(name: TimingTagName, t: TimingData): string {
  switch (name) {
    case 'OFFSET': return formatFloat(t.offset);
    case 'BPMS': return t.bpms?.length ? formatBpmList(t.bpms) : '';
    case 'STOPS': return formatStopList(t.stops || []);
    case 'DELAYS': return formatDelayList(t.delays || []);
    case 'WARPS': return formatWarpList(t.warps || []);
    case 'TIMESIGNATURES': return formatTimeSignatures(t);
    case 'TICKCOUNTS': return (t.tickcounts || []).map((x) => `${formatFloat(x.beat)}=${x.ticks}`).join(',');
    case 'COMBOS': return (t.combos || []).map((x) => `${formatFloat(x.beat)}=${x.hit}=${x.miss}`).join(',');
    case 'SPEEDS': return (t.speeds || []).map((x) => `${formatFloat(x.beat)}=${formatFloat(x.ratio)}=${formatFloat(x.delay)}=${x.unit}`).join(',');
    case 'SCROLLS': return (t.scrolls || []).map((x) => `${formatFloat(x.beat)}=${formatFloat(x.ratio)}`).join(',');
    case 'FAKES': return (t.fakes || []).map((x) => `${formatFloat(x.beat)}=${formatFloat(x.duration)}`).join(',');
    case 'LABELS': return (t.labels || []).map((x) => `${formatFloat(x.beat)}=${escapeMSDParameter(x.label)}`).join(',');
  }
}

const OPTIONAL_TIMING_TAGS: TimingTagName[] = [
  'TICKCOUNTS', 'COMBOS', 'SPEEDS', 'SCROLLS', 'FAKES', 'LABELS',
];

export function computeRadarValues(notes: NoteRow[], totalBeats = 64.0): number[] {
  let taps = 0;
  let jumps = 0;
  let holds = 0;
  let offbeat = 0;

  for (const item of notes) {
    const arrows = item.arrows;
    if (!arrows || arrows === '0000' || arrows === '00000000') continue;

    let stepCount = 0;
    let hasHold = false;
    for (let i = 0; i < arrows.length; i++) {
      const c = arrows[i];
      if (c === '1' || c === '2' || c === '4') stepCount++;
      if (c === '2' || c === '4') hasHold = true;
    }

    if (stepCount >= 1) taps++;
    if (stepCount >= 2) jumps++;
    if (hasHold) holds++;

    const row = item.row !== undefined ? item.row : Math.round(item.beat * TICKS_PER_BEAT);
    if (row % TICKS_PER_BEAT !== 0) {
      offbeat++;
    }
  }

  const stream = Math.min(1.0, taps / Math.max(1.0, totalBeats * 0.5));
  const voltage = Math.min(1.0, taps / Math.max(1.0, totalBeats * 0.25));
  const air = Math.min(1.0, jumps / Math.max(1.0, taps * 0.5));
  const freeze = Math.min(1.0, holds / Math.max(1.0, taps * 0.25));
  const chaos = Math.min(1.0, offbeat / Math.max(1.0, taps));

  return [stream, voltage, air, freeze, chaos];
}

export function formatRadarValues(radar?: string | number[]): string {
  if (Array.isArray(radar)) {
    const padded = [...radar];
    while (padded.length < 5) padded.push(0);
    return padded.slice(0, 5).map(formatFloat).join(',');
  }
  if (typeof radar === 'string' && radar.trim()) {
    return radar.trim();
  }
  return '0.000000,0.000000,0.000000,0.000000,0.000000';
}

/**
 * Serializes chart note data into StepMania measures with line minimization.
 */
export function serializeChartNotes(chart: Chart): string {
  const panelCount = chart.stepsType === 'dance-double' ? 8 : 4;
  const totalMeasures = chart.notes && chart.notes.length > 0 ? chart.notes.length : undefined;
  if (chart.noteRows && chart.noteRows.length > 0) {
    return formatChartMeasures(chart.noteRows, { panelCount, totalMeasures });
  }

  if (chart.notes && chart.notes.length > 0) {
    return chart.notes.map((m, idx) => {
      const isLast = idx === chart.notes.length - 1;
      return m.lines.join('\n') + `\n${isLast ? ';' : ','}`;
    }).join('\n');
  }
  // Empty measure fallback
  return '0'.repeat(panelCount) + '\n' +
         '0'.repeat(panelCount) + '\n' +
         '0'.repeat(panelCount) + '\n' +
         '0'.repeat(panelCount) + '\n;';
}

/**
 * Serializes a Simfile into legacy .sm format.
 */
export function serializeSM(simfile: Simfile): string {
  const t = simfile.timing;
  const headerLines = [
    `#TITLE:${escapeMSDParameter(simfile.title)};`,
    `#SUBTITLE:${escapeMSDParameter(simfile.subtitle)};`,
    `#ARTIST:${escapeMSDParameter(simfile.artist)};`,
    `#TITLETRANSLIT:${escapeMSDParameter(simfile.titleTranslit || '')};`,
    `#SUBTITLETRANSLIT:${escapeMSDParameter(simfile.subtitleTranslit || '')};`,
    `#ARTISTTRANSLIT:${escapeMSDParameter(simfile.artistTranslit || '')};`,
    `#GENRE:${escapeMSDParameter(simfile.genre || '')};`,
    `#CREDIT:${escapeMSDParameter(simfile.credit || '')};`,
    `#BANNER:${escapeMSDParameter(simfile.banner || '')};`,
    `#BACKGROUND:${escapeMSDParameter(simfile.background || '')};`,
    `#LYRICSPATH:${escapeMSDParameter(simfile.lyricsPath || '')};`,
    `#CDTITLE:${escapeMSDParameter(simfile.cdTitle || '')};`,
    `#MUSIC:${escapeMSDParameter(simfile.music || '')};`,
    `#OFFSET:${formatFloat(t.offset)};`,
    `#SAMPLESTART:${formatFloat(simfile.sampleStart || 0)};`,
    `#SAMPLELENGTH:${formatFloat(simfile.sampleLength || 12)};`,
    `#SELECTABLE:${escapeMSDParameter(simfile.selectable || 'YES')};`,
  ];

  if (simfile.displayBpm) {
    headerLines.push(`#DISPLAYBPM:${simfile.displayBpm};`);
  }

  headerLines.push(`#BPMS:${formatBpmList(t.bpms)};`);
  headerLines.push(`#STOPS:${formatStopList(t.stops)};`);
  if (simfile.extraTags) {
    for (const [key, val] of Object.entries(simfile.extraTags)) {
      if (!headerLines.some((l) => l.startsWith(`#${key}:`))) {
        headerLines.push(`#${key}:${escapeUnknownTagValue(val)};`);
      }
    }
  }

  const chartBlocks: string[] = [];

  for (const chart of simfile.charts) {
    const radar = chart.radarValues
      ? formatRadarValues(chart.radarValues)
      : formatRadarValues(computeRadarValues(chart.noteRows || []));

    const noteData = serializeChartNotes(chart);

    const block = [
      '#NOTES:',
      `     ${chart.stepsType}:`,
      `     ${escapeMSDParameter(chart.description || simfile.credit || '')}:`,
      `     ${chart.difficulty}:`,
      `     ${chart.meter}:`,
      `     ${radar}:`,
      noteData,
    ].join('\n');

    chartBlocks.push(block);
  }

  return headerLines.join('\n') + '\n\n' + chartBlocks.join('\n\n') + '\n';
}

/**
 * Serializes a single chart block for modern .ssc format.
 */
export function formatSSCChartBlock(
  chart: Chart,
  songTiming: Simfile['timing'],
  forceSplitTiming = false
): string {
  const radar = chart.radarValues

    ? formatRadarValues(chart.radarValues)
    : formatRadarValues(computeRadarValues(chart.noteRows || []));

  const noteData = serializeChartNotes(chart);

  const lines = [
    '#NOTEDATA:;',
    `#CHARTNAME:${escapeMSDParameter(chart.chartName || '')};`,
    `#STEPSTYPE:${chart.stepsType};`,
    `#DESCRIPTION:${escapeMSDParameter(chart.description || '')};`,
    `#CHARTSTYLE:${escapeMSDParameter(chart.chartStyle || '')};`,
    `#DIFFICULTY:${chart.difficulty};`,
    `#METER:${chart.meter};`,
    `#RADARVALUES:${radar};`,
    `#CREDIT:${escapeMSDParameter(chart.credit || '')};`,
  ];

  if (chart.music) {
    lines.push(`#MUSIC:${escapeMSDParameter(chart.music)};`);
  }

  // Split timing check
  const ct = chart.timing;
  const comparedTags: TimingTagName[] = ['OFFSET', 'BPMS', 'STOPS', 'DELAYS', 'WARPS', 'TIMESIGNATURES', ...OPTIONAL_TIMING_TAGS];
  const hasSplit =
    forceSplitTiming ||
    (ct !== undefined &&
      ((ct.presentTags?.length || 0) > 0 || comparedTags.some((tag) => formatTimingTag(tag, ct) !== formatTimingTag(tag, songTiming))));

  if (hasSplit && ct) {
    const comparisonBase = chart.inheritedTiming || songTiming;
    const changedTags = comparedTags.filter((tag) =>
      forceSplitTiming || formatTimingTag(tag, ct) !== formatTimingTag(tag, comparisonBase)
    );
    const tags = [...new Set([...(ct.presentTags || []), ...changedTags])];
    for (const tag of tags) {
      lines.push(`#${tag}:${formatTimingTag(tag, ct)};`);
    }
  }

  if (chart.extraTags) {
    for (const [key, val] of Object.entries(chart.extraTags)) {
      if (!lines.some((line) => line.startsWith(`#${key}:`))) {
        lines.push(`#${key}:${escapeUnknownTagValue(val)};`);
      }
    }
  }

  lines.push(`#NOTES:\n${noteData}`);
  return lines.join('\n');
}

/**
 * Serializes a Simfile into modern .ssc format.
 */
export function serializeSSC(simfile: Simfile, forceSplitTiming = false): string {
  const version = simfile.version || 0.83;
  const t = simfile.timing;

  const headerLines = [
    `#VERSION:${version.toFixed(2)};`,
    `#TITLE:${escapeMSDParameter(simfile.title)};`,
    `#SUBTITLE:${escapeMSDParameter(simfile.subtitle)};`,
    `#ARTIST:${escapeMSDParameter(simfile.artist)};`,
    `#TITLETRANSLIT:${escapeMSDParameter(simfile.titleTranslit || '')};`,
    `#SUBTITLETRANSLIT:${escapeMSDParameter(simfile.subtitleTranslit || '')};`,
    `#ARTISTTRANSLIT:${escapeMSDParameter(simfile.artistTranslit || '')};`,
    `#GENRE:${escapeMSDParameter(simfile.genre || '')};`,
    `#CREDIT:${escapeMSDParameter(simfile.credit || '')};`,
    `#BANNER:${escapeMSDParameter(simfile.banner || '')};`,
    `#BACKGROUND:${escapeMSDParameter(simfile.background || '')};`,
    `#LYRICSPATH:${escapeMSDParameter(simfile.lyricsPath || '')};`,
    `#CDTITLE:${escapeMSDParameter(simfile.cdTitle || '')};`,
    `#MUSIC:${escapeMSDParameter(simfile.music || '')};`,
    `#OFFSET:${formatFloat(t.offset)};`,
    `#SAMPLESTART:${formatFloat(simfile.sampleStart || 0)};`,
    `#SAMPLELENGTH:${formatFloat(simfile.sampleLength || 12)};`,
    `#SELECTABLE:${escapeMSDParameter(simfile.selectable || 'YES')};`,
  ];

  if (simfile.displayBpm) {
    headerLines.push(`#DISPLAYBPM:${simfile.displayBpm};`);
  }

  for (const tag of ['BPMS', 'STOPS', 'DELAYS', 'WARPS', 'TIMESIGNATURES'] as TimingTagName[]) {
    headerLines.push(`#${tag}:${formatTimingTag(tag, t)};`);
  }
  for (const tag of OPTIONAL_TIMING_TAGS) {
    if (t.presentTags?.includes(tag) || formatTimingTag(tag, t)) {
      headerLines.push(`#${tag}:${formatTimingTag(tag, t)};`);
    }
  }
  if (simfile.extraTags) {
    for (const [key, val] of Object.entries(simfile.extraTags)) {
      if (!headerLines.some((l) => l.startsWith(`#${key}:`))) {
        headerLines.push(`#${key}:${escapeUnknownTagValue(val)};`);
      }
    }
  }

  const chartBlocks = simfile.charts.map((c) =>
    formatSSCChartBlock(c, simfile.timing, forceSplitTiming)
  );

  return headerLines.join('\n') + '\n\n' + chartBlocks.join('\n\n') + '\n';
}
