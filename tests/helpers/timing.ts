export interface BpmEntry {
  beat: number;
  bpm: number;
}

export interface TimedEvent {
  beat: number;
  duration: number; // in seconds for stops/delays; in beats for warps
}

export interface TimingSpec {
  offset: number; // seconds
  bpms: BpmEntry[];
  stops?: TimedEvent[];
  delays?: TimedEvent[];
  warps?: TimedEvent[];
}

export interface TimingSegment {
  startBeat: number;
  endBeat: number;
  startTime: number;
  endTime: number;
  bpm: number;
  isWarp?: boolean;
  isPause?: boolean;
}

export function compileTimingSegments(spec: TimingSpec): TimingSegment[] {
  const sortedBpms = [...spec.bpms].sort((a, b) => a.beat - b.beat);
  if (sortedBpms.length === 0) {
    sortedBpms.push({ beat: 0, bpm: 120 });
  }

  const stops = [...(spec.stops || [])].sort((a, b) => a.beat - b.beat);
  const delays = [...(spec.delays || [])].sort((a, b) => a.beat - b.beat);
  const warps = [...(spec.warps || [])].sort((a, b) => a.beat - b.beat);

  const keyBeats = new Set<number>([0]);
  for (const b of sortedBpms) keyBeats.add(b.beat);
  for (const s of stops) keyBeats.add(s.beat);
  for (const d of delays) keyBeats.add(d.beat);
  for (const w of warps) {
    keyBeats.add(w.beat);
    keyBeats.add(w.beat + w.duration);
  }

  const sortedBeats = Array.from(keyBeats).sort((a, b) => a - b);
  const segments: TimingSegment[] = [];

  let currentTime = -spec.offset;
  let currentBpm = sortedBpms[0].bpm;

  function getBpmAt(b: number): number {
    let bpm = sortedBpms[0].bpm;
    for (const entry of sortedBpms) {
      if (entry.beat <= b) bpm = entry.bpm;
      else break;
    }
    return bpm;
  }

  function isInsideWarp(b: number): boolean {
    for (const w of warps) {
      if (b >= w.beat && b < w.beat + w.duration) return true;
    }
    return false;
  }

  for (let i = 0; i < sortedBeats.length - 1; i++) {
    const b0 = sortedBeats[i];
    const b1 = sortedBeats[i + 1];

    // Check delay before note at b0
    const delayAtB0 = delays.filter(d => Math.abs(d.beat - b0) < 1e-6);
    for (const d of delayAtB0) {
      if (d.duration > 0) {
        segments.push({
          startBeat: b0,
          endBeat: b0,
          startTime: currentTime,
          endTime: currentTime + d.duration,
          bpm: getBpmAt(b0),
          isPause: true,
        });
        currentTime += d.duration;
      }
    }

    currentBpm = getBpmAt(b0);
    const inWarp = isInsideWarp(b0);
    const deltaBeat = b1 - b0;
    const deltaTime = inWarp ? 0 : deltaBeat * (60.0 / currentBpm);

    segments.push({
      startBeat: b0,
      endBeat: b1,
      startTime: currentTime,
      endTime: currentTime + deltaTime,
      bpm: currentBpm,
      isWarp: inWarp,
    });
    currentTime += deltaTime;

    // Check stop after note at b1 (or b0 if specified)
    const stopAtB0 = stops.filter(s => Math.abs(s.beat - b0) < 1e-6 && i > 0);
    for (const s of stopAtB0) {
      if (s.duration > 0) {
        segments.push({
          startBeat: b0,
          endBeat: b0,
          startTime: currentTime,
          endTime: currentTime + s.duration,
          bpm: currentBpm,
          isPause: true,
        });
        currentTime += s.duration;
      }
    }
  }

  return segments;
}

export function beatToSeconds(beat: number, spec: TimingSpec): number {
  if (beat < 0) {
    const bpm0 = spec.bpms[0]?.bpm || 120;
    return -spec.offset + beat * (60.0 / bpm0);
  }

  let totalTime = -spec.offset;
  let currentBeat = 0;
  const sortedBpms = [...spec.bpms].sort((a, b) => a.beat - b.beat);

  // Add pauses prior to beat
  const delays = spec.delays || [];
  const stops = spec.stops || [];
  const warps = spec.warps || [];

  for (const d of delays) {
    if (d.beat <= beat) totalTime += d.duration;
  }
  for (const s of stops) {
    if (s.beat < beat) totalTime += s.duration;
  }

  for (let i = 0; i < sortedBpms.length; i++) {
    const b0 = sortedBpms[i].beat;
    const bpm = sortedBpms[i].bpm;
    const b1 = i + 1 < sortedBpms.length ? sortedBpms[i + 1].beat : Infinity;

    if (beat <= b0) break;

    const spanStart = Math.max(b0, currentBeat);
    const spanEnd = Math.min(b1, beat);

    if (spanEnd > spanStart) {
      let activeBeats = spanEnd - spanStart;
      for (const w of warps) {
        const wStart = Math.max(spanStart, w.beat);
        const wEnd = Math.min(spanEnd, w.beat + w.duration);
        if (wEnd > wStart) {
          activeBeats -= (wEnd - wStart);
        }
      }
      totalTime += Math.max(0, activeBeats) * (60.0 / bpm);
    }

    currentBeat = spanEnd;
    if (beat <= b1) break;
  }

  return totalTime;
}

export function secondsToBeat(seconds: number, spec: TimingSpec): number {
  const bpm0 = spec.bpms[0]?.bpm || 120;
  const timeFromZero = seconds + spec.offset;
  if (timeFromZero <= 0) {
    return timeFromZero / (60.0 / bpm0);
  }

  // Binary search for beat given monotonic forward time
  let low = 0;
  let high = 5000;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (low + high) / 2;
    const t = beatToSeconds(mid, spec);
    if (t < seconds) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
