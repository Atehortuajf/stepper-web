/**
 * frontend/src/editor/engine/timingEngine.ts
 * Piecewise continuous bi-directional timing engine for StepMania/ITGmania.
 * Exact conversion between musical beats and physical audio seconds (t_audio <-> beat).
 * Handles #OFFSET, #BPMS, #STOPS, #DELAYS, #WARPS, and #TIMESIGNATURES.
 * Preserves freeze intervals during stops/delays.
 */

import type { BpmChange, DelayEvent, StopEvent, TimingData, WarpEvent } from './types';

export interface TimeSegment {
  tStart: number; // unoffset seconds
  tEnd: number;
  bStart: number;
  bEnd: number;
  bpm: number;
  isPause: boolean;
}

export interface BeatSegment {
  bStart: number;
  bEnd: number;
  tStart: number;
  tEnd: number;
  bpm: number;
  isWarp: boolean;
  tMarker: number; // timestamp when the note on bStart crosses receptor
}

/**
 * Binary search returning the rightmost insertion index where array[idx] <= value.
 */
function bisectRight(arr: number[], value: number): number {
  let low = 0;
  let high = arr.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (arr[mid] <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low - 1;
}

export class TimingEngine {
  public rawOffset: number;
  public offset: number;

  public bpms: BpmChange[] = [];
  public stops: StopEvent[] = [];
  public delays: DelayEvent[] = [];
  public warps: WarpEvent[] = [];

  private _timeSegments: TimeSegment[] = [];
  private _beatSegments: BeatSegment[] = [];
  private _tStarts: number[] = [];
  private _bStarts: number[] = [];

  public initialBpm = 60.0;

  constructor(timing?: Partial<TimingData> | {
    offset?: number;
    bpms?: Array<{ beat: number; bpm: number } | [number, number]>;
    stops?: Array<{ beat: number; duration: number } | [number, number]>;
    delays?: Array<{ beat: number; duration: number } | [number, number]>;
    warps?: Array<{ beat: number; duration: number } | [number, number]>;
  }) {
    const offset = timing?.offset ?? 0.0;
    this.rawOffset = offset;
    this.offset = offset;

    const rawBpms: Array<[number, number]> = [];
    if (timing?.bpms) {
      for (const item of timing.bpms) {
        if (Array.isArray(item)) rawBpms.push([item[0], item[1]]);
        else rawBpms.push([item.beat, item.bpm]);
      }
    }

    const rawStops: Array<[number, number]> = [];
    if (timing?.stops) {
      for (const item of timing.stops) {
        if (Array.isArray(item)) rawStops.push([item[0], item[1]]);
        else rawStops.push([item.beat, item.duration]);
      }
    }

    const rawDelays: Array<[number, number]> = [];
    if (timing?.delays) {
      for (const item of timing.delays) {
        if (Array.isArray(item)) rawDelays.push([item[0], item[1]]);
        else rawDelays.push([item.beat, item.duration]);
      }
    }

    const rawWarps: Array<[number, number]> = [];
    if (timing?.warps) {
      for (const item of timing.warps) {
        if (Array.isArray(item)) rawWarps.push([item[0], item[1]]);
        else rawWarps.push([item.beat, item.duration]);
      }
    }

    this.compile(rawBpms, rawStops, rawDelays, rawWarps);
  }

  private compile(
    rawBpms: Array<[number, number]>,
    rawStops: Array<[number, number]>,
    rawDelays: Array<[number, number]>,
    rawWarps: Array<[number, number]>
  ): void {
    // 1. Process Stops and Delays before Beat 0 (Offset adjustment)
    const validStops: Array<[number, number]> = [];
    for (const [b, d] of rawStops) {
      if (b < 0.0) {
        this.offset -= d;
      } else {
        validStops.push([b, d]);
      }
    }

    const validDelays: Array<[number, number]> = [];
    for (const [b, d] of rawDelays) {
      if (b < 0.0) {
        this.offset -= d;
      } else {
        validDelays.push([b, d]);
      }
    }

    // 2. Normalize and sort BPMs
    const sortedBpms = [...rawBpms].sort((a, b) => a[0] - b[0]);
    const cleanBpms: Array<[number, number]> = [];
    const derivedWarps: Array<[number, number]> = [];

    // Negative BPM conversion to warps
    for (let i = 0; i < sortedBpms.length; i++) {
      const [b, v] = sortedBpms[i];
      if (v <= 0.0) {
        if (b < 0.0) continue;
        let nextB: number | null = null;
        for (let j = i + 1; j < sortedBpms.length; j++) {
          if (sortedBpms[j][1] > 0.0) {
            nextB = sortedBpms[j][0];
            break;
          }
        }
        if (nextB !== null) {
          derivedWarps.push([b, nextB - b]);
        }
      } else {
        cleanBpms.push([b, v]);
      }
    }

    if (cleanBpms.length === 0) {
      cleanBpms.push([0.0, 60.0]);
    } else if (cleanBpms[0][0] > 0.0) {
      cleanBpms.unshift([0.0, cleanBpms[0][1]]);
    } else if (cleanBpms[0][0] < 0.0) {
      let idxZero = 0;
      for (let i = 0; i < cleanBpms.length; i++) {
        if (cleanBpms[i][0] <= 0.0) idxZero = i;
      }
      const valZero = cleanBpms[idxZero][1];
      cleanBpms.splice(0, idxZero + 1);
      cleanBpms.unshift([0.0, valZero]);
    }

    this.bpms = cleanBpms.map(([beat, bpm]) => ({ beat, bpm }));
    this.initialBpm = cleanBpms[0][1];

    const bpmBeats = cleanBpms.map((b) => b[0]);
    const getBpmAt = (beat: number): number => {
      const idx = bisectRight(bpmBeats, beat);
      return cleanBpms[Math.max(0, idx)][1];
    };

    // 3. Convert Negative Stops to Warps
    const cleanStopsMap = new Map<number, number>();
    for (const [b, d] of validStops) {
      if (d < 0.0) {
        const bpm = getBpmAt(b);
        const warpLen = Math.abs(d) * (bpm / 60.0);
        derivedWarps.push([b, warpLen]);
      } else if (d > 0.0) {
        cleanStopsMap.set(b, (cleanStopsMap.get(b) || 0) + d);
      }
    }

    const cleanDelaysMap = new Map<number, number>();
    for (const [b, d] of validDelays) {
      if (d > 0.0) {
        cleanDelaysMap.set(b, (cleanDelaysMap.get(b) || 0) + d);
      }
    }

    // 4. Coalesce Overlapping and Adjacent Warps
    const allWarps = [...rawWarps, ...derivedWarps]
      .filter(([b, l]) => l > 0.0 && b >= 0.0)
      .sort((a, b) => a[0] - b[0]);

    const mergedWarps: Array<[number, number]> = [];
    for (const [b, l] of allWarps) {
      const wEnd = b + l;
      if (mergedWarps.length === 0) {
        mergedWarps.push([b, wEnd]);
      } else {
        const last = mergedWarps[mergedWarps.length - 1];
        if (b <= last[1]) {
          last[1] = Math.max(last[1], wEnd);
        } else {
          mergedWarps.push([b, wEnd]);
        }
      }
    }

    this.warps = mergedWarps.map(([b, end]) => ({ beat: b, duration: end - b }));
    this.stops = Array.from(cleanStopsMap.entries())
      .map(([beat, duration]) => ({ beat, duration }))
      .sort((a, b) => a.beat - b.beat);
    this.delays = Array.from(cleanDelaysMap.entries())
      .map(([beat, duration]) => ({ beat, duration }))
      .sort((a, b) => a.beat - b.beat);

    // 5. Build Unified Timeline Slices
    const criticalBeats = new Set<number>([0.0]);
    for (const b of this.bpms) criticalBeats.add(b.beat);
    for (const s of this.stops) criticalBeats.add(s.beat);
    for (const d of this.delays) criticalBeats.add(d.beat);
    for (const w of this.warps) {
      criticalBeats.add(w.beat);
      criticalBeats.add(w.beat + w.duration);
    }

    const sortedBeats = Array.from(criticalBeats).sort((a, b) => a - b);
    const warpIntervals = this.warps.map((w) => ({ start: w.beat, end: w.beat + w.duration }));

    let currTime = 0.0;
    const timeSegs: TimeSegment[] = [];
    const beatSegs: BeatSegment[] = [];

    for (let i = 0; i < sortedBeats.length - 1; i++) {
      const bCurr = sortedBeats[i];
      const bNext = sortedBeats[i + 1];
      const activeBpm = getBpmAt(bCurr);

      // Priority 3: DELAY on bCurr (pre-note pause)
      if (cleanDelaysMap.has(bCurr)) {
        const dDur = cleanDelaysMap.get(bCurr)!;
        timeSegs.push({
          tStart: currTime,
          tEnd: currTime + dDur,
          bStart: bCurr,
          bEnd: bCurr,
          bpm: activeBpm,
          isPause: true,
        });
        currTime += dDur;
      }

      // Priority 4: MARKER at bCurr arrives here!
      const markerTimeCurr = currTime;

      // Priority 5: STOP on bCurr (post-note pause)
      if (cleanStopsMap.has(bCurr)) {
        const sDur = cleanStopsMap.get(bCurr)!;
        timeSegs.push({
          tStart: currTime,
          tEnd: currTime + sDur,
          bStart: bCurr,
          bEnd: bCurr,
          bpm: activeBpm,
          isPause: true,
        });
        currTime += sDur;
      }

      // Inter-beat progression [bCurr, bNext]
      const deltaB = bNext - bCurr;
      const inWarp = warpIntervals.some((w) => w.start <= bCurr && bNext <= w.end);

      if (inWarp) {
        // Warp: deltaT = 0
        beatSegs.push({
          bStart: bCurr,
          bEnd: bNext,
          tStart: currTime,
          tEnd: currTime,
          bpm: activeBpm,
          isWarp: true,
          tMarker: markerTimeCurr,
        });
      } else {
        // Normal progression
        const deltaT = deltaB * (60.0 / activeBpm);
        const tStartSeg = currTime;
        const tEndSeg = currTime + deltaT;

        timeSegs.push({
          tStart: tStartSeg,
          tEnd: tEndSeg,
          bStart: bCurr,
          bEnd: bNext,
          bpm: activeBpm,
          isPause: false,
        });

        beatSegs.push({
          bStart: bCurr,
          bEnd: bNext,
          tStart: tStartSeg,
          tEnd: tEndSeg,
          bpm: activeBpm,
          isWarp: false,
          tMarker: markerTimeCurr,
        });

        currTime += deltaT;
      }
    }

    // Final boundary at last critical beat
    const lastBeat = sortedBeats[sortedBeats.length - 1];
    const lastBpm = getBpmAt(lastBeat);

    if (cleanDelaysMap.has(lastBeat)) {
      const dDur = cleanDelaysMap.get(lastBeat)!;
      timeSegs.push({
        tStart: currTime,
        tEnd: currTime + dDur,
        bStart: lastBeat,
        bEnd: lastBeat,
        bpm: lastBpm,
        isPause: true,
      });
      currTime += dDur;
    }

    const lastMarkerTime = currTime;

    if (cleanStopsMap.has(lastBeat)) {
      const sDur = cleanStopsMap.get(lastBeat)!;
      timeSegs.push({
        tStart: currTime,
        tEnd: currTime + sDur,
        bStart: lastBeat,
        bEnd: lastBeat,
        bpm: lastBpm,
        isPause: true,
      });
      currTime += sDur;
    }

    // Infinite tail segment
    beatSegs.push({
      bStart: lastBeat,
      bEnd: Infinity,
      tStart: currTime,
      tEnd: Infinity,
      bpm: lastBpm,
      isWarp: false,
      tMarker: lastMarkerTime,
    });

    timeSegs.push({
      tStart: currTime,
      tEnd: Infinity,
      bStart: lastBeat,
      bEnd: Infinity,
      bpm: lastBpm,
      isPause: false,
    });

    this._timeSegments = timeSegs;
    this._beatSegments = beatSegs;
    this._tStarts = timeSegs.map((s) => s.tStart);
    this._bStarts = beatSegs.map((s) => s.bStart);
  }

  /**
   * Converts musical beat to physical audio timestamp in seconds.
   * t_audio = t_unoffset - OFFSET
   */
  public beatToSeconds(beat: number): number {
    if (beat < 0.0) {
      const tUnoffset = beat * (60.0 / this.initialBpm);
      return tUnoffset - this.offset;
    }

    let idx = bisectRight(this._bStarts, beat);
    if (idx < 0) idx = 0;
    const seg = this._beatSegments[idx];

    if (seg.isWarp) {
      return seg.tMarker - this.offset;
    }

    if (beat >= seg.bEnd && idx === this._beatSegments.length - 1) {
      const tUnoffset = seg.tEnd + (beat - seg.bEnd) * (60.0 / seg.bpm);
      return tUnoffset - this.offset;
    }

    if (beat === seg.bStart) {
      return seg.tMarker - this.offset;
    }

    const tUnoffset = seg.tStart + (beat - seg.bStart) * (60.0 / seg.bpm);
    return tUnoffset - this.offset;
  }

  /**
   * Converts physical audio timestamp in seconds to musical beat.
   * t_unoffset = t_audio + OFFSET
   * Stop and delay freeze intervals lock the cursor to the paused beat.
   */
  public secondsToBeat(timeSec: number): number {
    const tUnoffset = timeSec + this.offset;

    if (tUnoffset < 0.0) {
      return tUnoffset * (this.initialBpm / 60.0);
    }

    let idx = bisectRight(this._tStarts, tUnoffset);
    if (idx < 0) idx = 0;
    const seg = this._timeSegments[idx];

    if (seg.isPause) {
      return seg.bStart;
    }

    if (tUnoffset >= seg.tEnd && idx === this._timeSegments.length - 1) {
      return seg.bEnd + (tUnoffset - seg.tEnd) * (seg.bpm / 60.0);
    }

    return seg.bStart + (tUnoffset - seg.tStart) * (seg.bpm / 60.0);
  }

  /**
   * Returns true if audio timestamp falls inside a stop or delay pause plateau.
   */
  public isPausedAt(timeSec: number): boolean {
    const tUnoffset = timeSec + this.offset;
    if (tUnoffset < 0.0) return false;
    const idx = Math.max(0, bisectRight(this._tStarts, tUnoffset));
    return this._timeSegments[idx]?.isPause ?? false;
  }

  /**
   * Returns active BPM at a given musical beat.
   */
  public getBpmAt(beat: number): number {
    if (beat < 0.0) return this.initialBpm;
    const idx = bisectRight(this.bpms.map((b) => b.beat), beat);
    return this.bpms[Math.max(0, idx)].bpm;
  }
}

/**
 * Functional standalone API matching PROJECT.md interface contract.
 */
export function beatToSeconds(beat: number, timing: TimingData): number {
  const engine = new TimingEngine(timing);
  return engine.beatToSeconds(beat);
}

export function secondsToBeat(seconds: number, timing: TimingData): number {
  const engine = new TimingEngine(timing);
  return engine.secondsToBeat(seconds);
}
