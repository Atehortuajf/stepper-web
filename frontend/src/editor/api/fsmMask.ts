/**
 * frontend/src/editor/api/fsmMask.ts
 * Runtime Foot-State Machine (FSM) Playability Logit Masking for StepMania / ITG.
 * Guarantees mathematical and biomechanical parity with stepper/model/fsm_mask.py.
 * Prevents impossible physical patterns while preserving crossovers, sweeps, and brackets.
 */

export const PAD_ID = 92;
export const BOS_ID = 93;
export const EOS_ID = 94;
export const UNK_ID = 95;
export const VOCAB_SIZE = 96;

export const ID_TO_CHORD: Record<number, string> = {
  0: "0000",
  1: "1000", 2: "0100", 3: "0010", 4: "0001",
  5: "1100", 6: "1010", 7: "0101", 8: "0011", 9: "1001", 10: "0110",
  11: "0111", 12: "1011", 13: "1101", 14: "1110", 15: "1111",
  16: "2000", 17: "0200", 18: "0020", 19: "0002",
  20: "4000", 21: "0400", 22: "0040", 23: "0004",
  24: "3000", 25: "0300", 26: "0030", 27: "0003",
  28: "M000", 29: "0M00", 30: "00M0", 31: "000M",
  32: "1200", 33: "1020", 34: "1002", 35: "2100", 36: "0120", 37: "0102",
  38: "2010", 39: "0210", 40: "0012", 41: "2001", 42: "0201", 43: "0021",
  44: "1300", 45: "1030", 46: "1003", 47: "3100", 48: "0130", 49: "0103",
  50: "3010", 51: "0310", 52: "0013", 53: "3001", 54: "0301", 55: "0031",
  56: "2200", 57: "2020", 58: "2002", 59: "0220", 60: "0202", 61: "0022",
  62: "3300", 63: "3030", 64: "3003", 65: "0330", 66: "0303", 67: "0033",
  68: "2300", 69: "2030", 70: "2003", 71: "3200", 72: "0230", 73: "0203",
  74: "3020", 75: "0320", 76: "0023", 77: "3002", 78: "0302", 79: "0032",
  80: "1400", 81: "1040", 82: "1004", 83: "4100", 84: "0140", 85: "0104",
  86: "4010", 87: "0410", 88: "0014", 89: "4001", 90: "0401", 91: "0041",
  92: "<PAD>", 93: "<BOS>", 94: "<EOS>", 95: "<UNK>",
};

export const CHORD_TO_ID: Record<string, number> = {};
for (const [idStr, chord] of Object.entries(ID_TO_CHORD)) {
  CHORD_TO_ID[chord] = parseInt(idStr, 10);
}

export interface FSMState {
  activeHolds: Set<number>;
  lastPanel: number | null;
  jackCount: number;
  lastBeat: number;
}

export class ClientFootStateMachine {
  public difficulty: number;
  public state: FSMState;

  // Precomputed tables
  private isTap: boolean[][] = [];
  private isHoldHead: boolean[][] = [];
  private isRollHead: boolean[][] = [];
  private isRelease: boolean[][] = [];
  private tapCount: number[] = [];
  private isHand: boolean[] = [];
  private isQuad: boolean[] = [];
  private isOppositeJump: boolean[] = [];
  private isSpecial: boolean[] = [];

  constructor(difficulty: number = 3) {
    this.difficulty = difficulty;
    this.state = {
      activeHolds: new Set(),
      lastPanel: null,
      jackCount: 0,
      lastBeat: 0.0,
    };
    this.precomputeVocabTables();
  }

  private precomputeVocabTables(): void {
    for (let c = 0; c < VOCAB_SIZE; c++) {
      this.isTap[c] = [false, false, false, false];
      this.isHoldHead[c] = [false, false, false, false];
      this.isRollHead[c] = [false, false, false, false];
      this.isRelease[c] = [false, false, false, false];

      if (c === PAD_ID || c === BOS_ID || c === EOS_ID || c === UNK_ID) {
        this.isSpecial[c] = true;
        this.tapCount[c] = 0;
        this.isHand[c] = false;
        this.isQuad[c] = false;
        this.isOppositeJump[c] = false;
        continue;
      }

      this.isSpecial[c] = false;
      const chord = ID_TO_CHORD[c] || "0000";
      let taps = 0;
      for (let p = 0; p < 4; p++) {
        const char = chord[p];
        if (char === "1") {
          this.isTap[c][p] = true;
          taps++;
        } else if (char === "2") {
          this.isHoldHead[c][p] = true;
          taps++;
        } else if (char === "4") {
          this.isRollHead[c][p] = true;
          taps++;
        } else if (char === "3") {
          this.isRelease[c][p] = true;
        }
      }

      this.tapCount[c] = taps;
      this.isHand[c] = taps >= 3;
      this.isQuad[c] = taps === 4;

      const activeTaps: number[] = [];
      for (let p = 0; p < 4; p++) {
        if (this.isTap[c][p] || this.isHoldHead[c][p] || this.isRollHead[c][p]) {
          activeTaps.push(p);
        }
      }
      if (activeTaps.length === 2) {
        const [p1, p2] = activeTaps;
        this.isOppositeJump[c] =
          (p1 === 0 && p2 === 3) ||
          (p1 === 3 && p2 === 0) ||
          (p1 === 1 && p2 === 2) ||
          (p1 === 2 && p2 === 1);
      } else {
        this.isOppositeJump[c] = false;
      }
    }
  }

  public reset(): void {
    this.state = {
      activeHolds: new Set(),
      lastPanel: null,
      jackCount: 0,
      lastBeat: 0.0,
    };
  }

  /**
   * Computes additive logit mask (0.0 for allowed, -1e9 for forbidden).
   */
  public computeMask(_beat: number = 0.0, _deltaBeat: number = 0.25): Float32Array {
    const mask = new Float32Array(VOCAB_SIZE);
    const NEG_INF = -1e9;

    // 1. Mask special control tokens & rest token
    mask[PAD_ID] = NEG_INF;
    mask[BOS_ID] = NEG_INF;
    mask[EOS_ID] = NEG_INF;
    mask[UNK_ID] = NEG_INF;
    mask[0] = NEG_INF; // Rest token (0000)

    // 2. Difficulty Gating: Novice (0) and Easy (1) forbid hands and quads
    if (this.difficulty <= 1) {
      for (let c = 0; c < VOCAB_SIZE; c++) {
        if (this.isHand[c] || this.isQuad[c]) {
          mask[c] = NEG_INF;
        }
      }
    } else if (this.difficulty === 2) {
      for (let c = 0; c < VOCAB_SIZE; c++) {
        if (this.isQuad[c]) {
          mask[c] = NEG_INF;
        }
      }
    }

    // 3. Active Hold Invariants
    const held = this.state.activeHolds;
    const nHeld = held.size;

    for (let c = 0; c < VOCAB_SIZE; c++) {
      if (mask[c] === NEG_INF) continue;

      // Invariant: Ghost releases (cannot release panel if not actively held)
      let hasGhostRelease = false;
      for (let p = 0; p < 4; p++) {
        if (this.isRelease[c][p] && !held.has(p)) {
          hasGhostRelease = true;
          break;
        }
      }
      if (hasGhostRelease) {
        mask[c] = NEG_INF;
        continue;
      }

      // Invariant: Active hold double-booking (cannot tap/head on held panel)
      let doubleBooked = false;
      for (let p = 0; p < 4; p++) {
        if (
          (this.isTap[c][p] || this.isHoldHead[c][p] || this.isRollHead[c][p]) &&
          held.has(p)
        ) {
          doubleBooked = true;
          break;
        }
      }
      if (doubleBooked) {
        mask[c] = NEG_INF;
        continue;
      }

      // Invariant: Bipedal Contact Capacity
      let releasedCount = 0;
      for (const p of held) {
        if (this.isRelease[c][p]) releasedCount++;
      }
      const survivingHolds = nHeld - releasedCount;
      const newTaps = this.tapCount[c];

      if (survivingHolds >= 2) {
        // Both feet holding: 0 free feet. Only releases allowed!
        if (newTaps > 0) {
          mask[c] = NEG_INF;
          continue;
        }
      } else if (survivingHolds === 1) {
        // 1 foot holding: 1 free foot remaining.
        // A single foot cannot hit >= 3 panels:
        if (newTaps >= 3) {
          mask[c] = NEG_INF;
          continue;
        }
        // If 2 simultaneous hits with 1 foot, it MUST be an adjacent bracket, NOT an opposite jump:
        if (newTaps === 2 && this.isOppositeJump[c]) {
          mask[c] = NEG_INF;
          continue;
        }
      }
      // When survivingHolds === 0: 2 free feet available.
      // Hands and quads are permitted according to difficulty gating.

      // Soft Heuristic: Hyper-speed sustained jacks (dt < 0.25 beats and >= 2 previous taps on same arrow)
      if (
        this.state.lastPanel !== null &&
        _deltaBeat < 0.25 &&
        this.state.jackCount >= 2
      ) {
        if (this.isTap[c][this.state.lastPanel]) {
          mask[c] -= 5.0;
        }
      }
    }

    return mask;
  }

  /**
   * Advances internal physical state after a chord token is selected.
   */
  public updateState(chordToken: number, beat: number, deltaBeat: number): void {
    if (chordToken < 0 || chordToken >= VOCAB_SIZE || this.isSpecial[chordToken]) {
      return;
    }

    // Process releases
    for (let p = 0; p < 4; p++) {
      if (this.isRelease[chordToken][p]) {
        this.state.activeHolds.delete(p);
      }
    }

    // Process new hold / roll heads
    for (let p = 0; p < 4; p++) {
      if (this.isHoldHead[chordToken][p] || this.isRollHead[chordToken][p]) {
        this.state.activeHolds.add(p);
      }
    }

    // Track active panel taps for jack counting
    const tappedPanels: number[] = [];
    for (let p = 0; p < 4; p++) {
      if (
        this.isTap[chordToken][p] ||
        this.isHoldHead[chordToken][p] ||
        this.isRollHead[chordToken][p]
      ) {
        tappedPanels.push(p);
      }
    }

    if (tappedPanels.length === 1) {
      const p = tappedPanels[0];
      if (p === this.state.lastPanel && deltaBeat < 0.35) {
        this.state.jackCount++;
      } else {
        this.state.lastPanel = p;
        this.state.jackCount = 1;
      }
    } else if (tappedPanels.length > 1) {
      this.state.lastPanel = null;
      this.state.jackCount = 0;
    }

    this.state.lastBeat = beat;
  }
}
