/**
 * frontend/src/editor/biomechanics/localParitySolver.ts
 * Biomechanical Viterbi Foot-Placement Solver for 4-Panel Dance Stepcharts.
 * Fully compliant with stepper/validate/viterbi_solver.py HMM dynamic programming.
 */

import type { NoteRow, HoldNote } from '../engine/types';
import type {
  BiomechanicalStep,
  FootDesignation,
  HeelToeTag,
  ParitySolveResult,
  ParityStatsData,
  UnplayabilityWarningItem,
} from './types';
import type { StepFlags } from '../api/stepperApi';

// Panel coordinates: Left=0, Down=1, Up=2, Right=3
const PANEL_COORDS: Record<number, [number, number]> = {
  0: [-1.0, 0.0],
  1: [0.0, -1.0],
  2: [0.0, 1.0],
  3: [1.0, 0.0],
};

type FootPos = number | [number, number] | null;

function getPosCenter(pos: FootPos): [number, number] {
  if (pos === null) return [0.0, 0.0];
  if (typeof pos === 'number') return PANEL_COORDS[pos] || [0.0, 0.0];
  const c1 = PANEL_COORDS[pos[0]] || [0.0, 0.0];
  const c2 = PANEL_COORDS[pos[1]] || [0.0, 0.0];
  return [(c1[0] + c2[0]) / 2.0, (c1[1] + c2[1]) / 2.0];
}

function euclideanDist(p1: FootPos, p2: FootPos): number {
  const [x1, y1] = getPosCenter(p1);
  const [x2, y2] = getPosCenter(p2);
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Valid adjacent brackets on 4-panel pads
const VALID_ADJACENT_BRACKETS: Array<[number, number]> = [
  [0, 1], // Left + Down
  [0, 2], // Left + Up
  [1, 3], // Down + Right
  [2, 3], // Up + Right
];

function isAdjacentBracket(p1: number, p2: number): boolean {
  const a = Math.min(p1, p2);
  const b = Math.max(p1, p2);
  return VALID_ADJACENT_BRACKETS.some(([x, y]) => x === a && y === b);
}

interface ActiveEvent {
  beat: number;
  row: number;
  arrows: string;
  taps: number[];
  held: Set<number>;
}

interface TrajectoryState {
  posL: FootPos;
  posR: FootPos;
  foot: FootDesignation;
  stepCost: number;
}

/**
 * High-fidelity client-side Viterbi biomechanical foot solver.
 */
export function solveParityLocally(
  noteRows: NoteRow[],
  holds: HoldNote[] = [],
  bpms: Array<{ beat: number; bpm: number }> = [{ beat: 0.0, bpm: 120.0 }],
  difficultyMeter = 9
): ParitySolveResult {
  if (!noteRows || noteRows.length === 0) {
    return {
      is_playable: true,
      total_cost: 0.0,
      foot_sequence: [],
      steps: [],
      stats: {
        total_steps: 0,
        alternation_rate: 1.0,
        crossovers: 0,
        candles: 0,
        footswitches: 0,
        holdswitches: 0,
        double_steps: 0,
        jacks: 0,
        brackets: 0,
      },
      warnings: [],
    };
  }

  // 1. Build column hold intervals
  const colHolds: Map<number, Array<[number, number]>> = new Map([
    [0, []],
    [1, []],
    [2, []],
    [3, []],
  ]);

  for (const h of holds) {
    if (h.track >= 0 && h.track < 4) {
      colHolds.get(h.track)?.push([h.startBeat, h.endBeat]);
    }
  }

  // 2. Filter active events (rows containing steps or hold heads '1', '2', '4')
  const activeEvents: ActiveEvent[] = [];
  for (const r of noteRows) {
    const taps: number[] = [];
    for (let c = 0; c < 4 && c < r.arrows.length; c++) {
      const char = r.arrows[c];
      if (char === '1' || char === '2' || char === '4') {
        taps.push(c);
      }
    }

    if (taps.length > 0) {
      const held = new Set<number>();
      for (let c = 0; c < 4; c++) {
        const intervals = colHolds.get(c) || [];
        for (const [startB, endB] of intervals) {
          if (r.beat > startB && r.beat < endB) {
            held.add(c);
          }
        }
      }
      activeEvents.push({
        beat: r.beat,
        row: r.row,
        arrows: r.arrows,
        taps,
        held,
      });
    }
  }

  if (activeEvents.length === 0) {
    return {
      is_playable: true,
      total_cost: 0.0,
      foot_sequence: [],
      steps: [],
      stats: {
        total_steps: 0,
        alternation_rate: 1.0,
        crossovers: 0,
        candles: 0,
        footswitches: 0,
        holdswitches: 0,
        double_steps: 0,
        jacks: 0,
        brackets: 0,
      },
      warnings: [],
    };
  }

  // Helper to convert beat to elapsed audio seconds
  function beatToSec(targetBeat: number): number {
    let curSec = 0.0;
    let lastB = bpms[0]?.beat || 0.0;
    let lastBpm = bpms[0]?.bpm || 120.0;
    for (let i = 1; i < bpms.length; i++) {
      const { beat, bpm } = bpms[i];
      if (targetBeat <= beat) {
        return curSec + (targetBeat - lastB) * (60.0 / lastBpm);
      }
      curSec += (beat - lastB) * (60.0 / lastBpm);
      lastB = beat;
      lastBpm = bpm;
    }
    return curSec + (targetBeat - lastB) * (60.0 / lastBpm);
  }

  // Candidate generation
  function generateCandidates(
    taps: number[],
    held: Set<number>,
    prevL: FootPos,
    prevR: FootPos,
    prevFoot: FootDesignation,
    deltaBeat: number
  ): Array<[FootPos, FootPos, FootDesignation]> {
    const active = Array.from(new Set([...taps, ...Array.from(held)])).sort((a, b) => a - b);
    const n = active.length;
    const cands: Array<[FootPos, FootPos, FootDesignation]> = [];

    const pL = prevL !== null ? prevL : 0;
    const pR = prevR !== null ? prevR : 3;

    if (taps.length === 1 && held.size >= 1) {
      const tap = taps[0];
      const hList = Array.from(held);
      for (const h of hList) {
        if (pL === h) {
          // Left foot is holding h; Right foot must hit tap
          cands.push([h, tap, 'R']);
        } else if (pR === h) {
          // Right foot is holding h; Left foot must hit tap
          cands.push([tap, h, 'L']);
        } else {
          // Neither foot was locked yet; either foot can hold h while other taps
          cands.push([h, tap, 'R']);
          cands.push([tap, h, 'L']);
        }
      }
    } else if (n === 1) {
      const p = active[0];
      // Left hits p, Right stays at pR
      cands.push([p, pR, 'L']);
      // Right hits p, Left stays at pL
      cands.push([pL, p, 'R']);

      // Footswitches when deltaBeat <= 0.50
      if (deltaBeat <= 0.50) {
        if (prevFoot === 'L' && prevL === p) {
          cands.push([p !== 1 ? 1 : 2, p, 'R']);
        } else if (prevFoot === 'R' && prevR === p) {
          cands.push([p, p !== 2 ? 2 : 1, 'L']);
        }
      }
    } else if (n === 2) {
      const [p1, p2] = active;
      // Both feet jump
      cands.push([p1, p2, 'LR']);
      cands.push([p2, p1, 'LR']);

      // Bracket tap with one foot if adjacent
      if (isAdjacentBracket(p1, p2)) {
        cands.push([[p1, p2], pR, 'L']);
        cands.push([pL, [p1, p2], 'R']);
      }
    } else if (n === 3) {
      const [p1, p2, p3] = active;
      const pairs: Array<[number, number, number]> = [
        [p1, p2, p3],
        [p1, p3, p2],
        [p2, p3, p1],
      ];
      for (const [a, b, rem] of pairs) {
        if (isAdjacentBracket(a, b)) {
          cands.push([[a, b], rem, 'LR']);
          cands.push([rem, [a, b], 'LR']);
        }
      }
    } else if (n >= 4) {
      cands.push([[0, 1], [3, 2], 'LR']);
      cands.push([[0, 2], [3, 1], 'LR']);
    }

    return cands;
  }

  // Transition cost evaluation
  function calcTransitionCost(
    sPrev: [FootPos, FootPos, FootDesignation],
    sCurr: [FootPos, FootPos, FootDesignation],
    dBeat: number,
    dTime: number,
    heldCurr: Set<number>
  ): number {
    const [posLPrev, posRPrev, footPrev] = sPrev;
    const [posLCurr, posRCurr, footCurr] = sCurr;

    // 1. Physical Impossibility Guards
    // Left on Right AND Right on Left
    if (posLCurr === 3 && posRCurr === 0) {
      return 1e9;
    }

    // Single foot non-adjacent bracket
    const isNonAdjacent = (pos: FootPos): boolean => {
      if (Array.isArray(pos)) {
        const [a, b] = pos;
        return (a === 0 && b === 3) || (a === 1 && b === 2);
      }
      return false;
    };

    if (isNonAdjacent(posLCurr) || isNonAdjacent(posRCurr)) {
      return 1e9;
    }

    // Active held panels must be maintained
    for (const h of heldCurr) {
      const lHolds = posLCurr === h || (Array.isArray(posLCurr) && posLCurr.includes(h));
      const rHolds = posRCurr === h || (Array.isArray(posRCurr) && posRCurr.includes(h));
      if (!lHolds && !rHolds) {
        return 1e9;
      }
    }

    let cost = 0.0;

    // Check for footswitch
    const pPrev = footPrev === 'L' ? posLPrev : footPrev === 'R' ? posRPrev : null;
    const pCurr = footCurr === 'L' ? posLCurr : footCurr === 'R' ? posRCurr : null;
    const isFootswitch =
      pPrev !== null &&
      pCurr !== null &&
      pPrev === pCurr &&
      (footPrev === 'L' || footPrev === 'R') &&
      (footCurr === 'L' || footCurr === 'R') &&
      footPrev !== footCurr &&
      dBeat <= 0.50;

    if (isFootswitch) {
      cost += 0.35;
    } else if (footCurr === 'LR' || footPrev === 'LR') {
      cost += 0.50;
      if (footCurr === 'LR' && dBeat <= 0.25) {
        cost += 2.0;
      }
    } else if (footCurr === footPrev) {
      if (pPrev === pCurr) {
        // Jack
        cost += 0.80;
        if (dBeat <= 0.25) {
          cost += 3.0 / Math.max(dBeat, 0.05);
        } else if (dTime < 0.085) {
          cost += 5.0 * Math.exp((0.085 - dTime) / 0.02);
        }
      } else {
        // Double step
        cost += 1.20;
        if (dBeat <= 0.25) {
          cost += 3.5 / Math.max(dBeat, 0.05);
        } else if (dBeat <= 0.50) {
          cost += 1.50;
        }
      }
    }

    // Crossovers
    if (!isFootswitch) {
      if (posLCurr === 3) {
        cost += posRCurr === 1 ? 0.50 : 0.35;
      }
      if (posRCurr === 0) {
        cost += posLCurr === 1 ? 0.50 : 0.35;
      }
    }

    // Candle (moving between Up and Down across anchor)
    if (
      footCurr === 'L' &&
      typeof posLPrev === 'number' &&
      typeof posLCurr === 'number' &&
      (posLPrev === 1 || posLPrev === 2) &&
      (posLCurr === 1 || posLCurr === 2) &&
      posLPrev !== posLCurr
    ) {
      cost += 0.40;
    } else if (
      footCurr === 'R' &&
      typeof posRPrev === 'number' &&
      typeof posRCurr === 'number' &&
      (posRPrev === 1 || posRPrev === 2) &&
      (posRCurr === 1 || posRCurr === 2) &&
      posRPrev !== posRCurr
    ) {
      cost += 0.40;
    }

    // Brackets
    const isBr = Array.isArray(posLCurr) || Array.isArray(posRCurr);
    if (isBr) {
      cost += difficultyMeter >= 10 ? 0.30 : 0.60;
    }

    // Physical Displacement
    cost += 0.12 * (euclideanDist(posLPrev, posLCurr) + euclideanDist(posRPrev, posRCurr));

    return cost;
  }

  // Dynamic Programming Table
  const stateKey = (c: [FootPos, FootPos, FootDesignation]): string => {
    const lStr = Array.isArray(c[0]) ? `[${c[0].join(',')}]` : String(c[0]);
    const rStr = Array.isArray(c[1]) ? `[${c[1].join(',')}]` : String(c[1]);
    return `${lStr}|${rStr}|${c[2]}`;
  };

  const initCandidates = generateCandidates(
    activeEvents[0].taps,
    activeEvents[0].held,
    0,
    3,
    'None',
    1.0
  );

  if (initCandidates.length === 0) {
    return {
      is_playable: false,
      total_cost: 1e9,
      foot_sequence: [],
      steps: [],
      stats: {
        total_steps: 0,
        alternation_rate: 0,
        crossovers: 0,
        candles: 0,
        footswitches: 0,
        holdswitches: 0,
        double_steps: 0,
        jacks: 0,
        brackets: 0,
      },
      warnings: [
        {
          beat: activeEvents[0].beat,
          message: 'Physically unplayable chord',
          severity: 'error',
          stepIndex: 0,
        },
      ],
    };
  }

  type DPItem = {
    cand: [FootPos, FootPos, FootDesignation];
    totalCost: number;
    stepCost: number;
    prevKey: string | null;
  };

  const dp: Array<Map<string, DPItem>> = [];
  const dp0 = new Map<string, DPItem>();

  for (const c of initCandidates) {
    const k = stateKey(c);
    const stepCost = calcTransitionCost([0, 3, 'None'], c, 1.0, 1.0, activeEvents[0].held);
    dp0.set(k, {
      cand: c,
      totalCost: stepCost,
      stepCost,
      prevKey: null,
    });
  }
  dp.push(dp0);

  // Run forward Viterbi pass
  for (let idx = 1; idx < activeEvents.length; idx++) {
    const prevEv = activeEvents[idx - 1];
    const currEv = activeEvents[idx];
    const dBeat = Math.max(currEv.beat - prevEv.beat, 0.01);
    const dTime = Math.max(beatToSec(currEv.beat) - beatToSec(prevEv.beat), 0.02);

    const prevMap = dp[idx - 1];
    const currMap = new Map<string, DPItem>();

    for (const [, prevItem] of prevMap.entries()) {
      if (prevItem.totalCost >= 1e8) continue;

      const cands = generateCandidates(
        currEv.taps,
        currEv.held,
        prevItem.cand[0],
        prevItem.cand[1],
        prevItem.cand[2],
        dBeat
      );

      for (const cCurr of cands) {
        const cKey = stateKey(cCurr);
        const transCost = calcTransitionCost(prevItem.cand, cCurr, dBeat, dTime, currEv.held);
        const candidateTotal = prevItem.totalCost + transCost;

        const existing = currMap.get(cKey);
        if (!existing || candidateTotal < existing.totalCost) {
          currMap.set(cKey, {
            cand: cCurr,
            totalCost: candidateTotal,
            stepCost: transCost,
            prevKey: stateKey(prevItem.cand),
          });
        }
      }
    }

    if (currMap.size === 0) {
      // Unplayable
      break;
    }
    dp.push(currMap);
  }

  // Check playability
  const lastMap = dp[dp.length - 1];
  let bestKey: string | null = null;
  let minCost = Infinity;

  if (lastMap) {
    for (const [k, item] of lastMap.entries()) {
      if (item.totalCost < minCost) {
        minCost = item.totalCost;
        bestKey = k;
      }
    }
  }

  const isPlayable = minCost < 1e8 && dp.length === activeEvents.length;

  // Backtrack trajectory
  const trajectory: TrajectoryState[] = [];
  if (bestKey && lastMap) {
    let currKey: string | null = bestKey;
    for (let idx = dp.length - 1; idx >= 0; idx--) {
      if (!currKey) break;
      const item = dp[idx].get(currKey);
      if (!item) break;
      trajectory.push({
        posL: item.cand[0],
        posR: item.cand[1],
        foot: item.cand[2],
        stepCost: item.stepCost,
      });
      currKey = item.prevKey;
    }
    trajectory.reverse();
  }

  // Generate annotated steps & telemetry
  const steps: BiomechanicalStep[] = [];
  const warnings: UnplayabilityWarningItem[] = [];
  const footSequence: FootDesignation[] = [];

  let crossovers = 0;
  let candles = 0;
  let footswitches = 0;
  let holdswitches = 0;
  let doubleSteps = 0;
  let jacks = 0;
  let brackets = 0;
  let alternations = 0;

  for (let i = 0; i < trajectory.length; i++) {
    const ev = activeEvents[i];
    const { posL, posR, foot, stepCost } = trajectory[i];

    const isXo = posL === 3 || posR === 0;
    const xoType: 'front' | 'back' | null = isXo
      ? (posL === 3 && posR === 1) || (posR === 0 && posL === 1)
        ? 'back'
        : 'front'
      : null;

    let isCandle = false;
    let isDs = false;
    let isJack = false;
    let isFs = false;
    const isBr = Array.isArray(posL) || Array.isArray(posR);
    if (isBr) brackets++;

    let warningText: string | null = null;

    if (i > 0) {
      const prev = trajectory[i - 1];
      const pPrev = prev.foot === 'L' ? prev.posL : prev.foot === 'R' ? prev.posR : null;
      const pCurr = foot === 'L' ? posL : foot === 'R' ? posR : null;
      const dBeat = Math.max(ev.beat - activeEvents[i - 1].beat, 0.01);

      if (
        pPrev !== null &&
        pCurr !== null &&
        pPrev === pCurr &&
        (foot === 'L' || foot === 'R') &&
        (prev.foot === 'L' || prev.foot === 'R')
      ) {
        if (foot !== prev.foot && dBeat <= 0.50) {
          isFs = true;
          footswitches++;
          alternations++;
        } else if (foot === prev.foot) {
          isJack = true;
          jacks++;
          if (dBeat <= 0.25) {
            warningText = 'Rapid Jackhammer';
          }
        }
      } else if (
        (foot === 'L' || foot === 'R') &&
        (prev.foot === 'L' || prev.foot === 'R')
      ) {
        if (foot !== prev.foot) {
          alternations++;
          if (isXo) crossovers++;
        } else {
          isDs = true;
          doubleSteps++;
          warningText = 'Double Step';
        }
      }

      // Candle
      if (
        (foot === 'L' && typeof prev.posL === 'number' && typeof posL === 'number' && (prev.posL === 1 || prev.posL === 2) && (posL === 1 || posL === 2) && prev.posL !== posL) ||
        (foot === 'R' && typeof prev.posR === 'number' && typeof posR === 'number' && (prev.posR === 1 || prev.posR === 2) && (posR === 1 || posR === 2) && prev.posR !== posR)
      ) {
        isCandle = true;
        candles++;
      }
    }

    // Heel-Toe designation
    let heelToe: HeelToeTag = null;
    if (isBr) {
      if (Array.isArray(posL)) {
        heelToe = 'LH';
      } else if (Array.isArray(posR)) {
        heelToe = 'RH';
      }
    } else {
      if (foot === 'L') {
        heelToe = posL === 1 ? 'LH' : 'LT';
      } else if (foot === 'R') {
        heelToe = posR === 1 ? 'RH' : 'RT';
      }
    }

    if (!isPlayable && stepCost >= 1e8) {
      warningText = 'Physically unplayable transition';
    }

    if (warningText) {
      warnings.push({
        beat: ev.beat,
        message: warningText,
        severity: warningText.includes('unplayable') ? 'error' : 'warning',
        stepIndex: i,
      });
    }

    const flags: StepFlags = {
      is_crossover: isXo && !isFs,
      crossover_type: isXo && !isFs ? xoType : null,
      is_candle: isCandle,
      is_double_step: isDs,
      is_jack: isJack,
      is_bracket: isBr,
      is_footswitch: isFs,
      is_holdswitch: false,
    };

    steps.push({
      beat: ev.beat,
      row: ev.row,
      arrows: ev.arrows,
      foot,
      cost: Math.min(10.0, stepCost),
      warning: warningText,
      left_pos: posL as any,
      right_pos: posR as any,
      heelToe,
      flags,
    });

    footSequence.push(foot);
  }

  const nSteps = steps.length;
  const altRate = nSteps > 1 ? alternations / (nSteps - 1) : 1.0;

  const stats: ParityStatsData = {
    total_steps: nSteps,
    alternation_rate: Math.round(altRate * 1000) / 1000,
    crossovers,
    candles,
    footswitches,
    holdswitches,
    double_steps: doubleSteps,
    jacks,
    brackets,
  };

  return {
    is_playable: isPlayable,
    total_cost: Math.round(minCost * 10000) / 10000,
    foot_sequence: footSequence,
    steps,
    stats,
    warnings,
  };
}
