import { describe, expect, it } from 'vitest';
import { CHORD_TO_ID, ClientFootStateMachine } from '../fsmMask';

describe('ClientFootStateMachine', () => {
  it('forbids hands and quads for difficulty <= 1 (Novice/Easy)', () => {
    const fsm = new ClientFootStateMachine(1);
    const mask = fsm.computeMask(0.0, 0.25);

    const quadId = CHORD_TO_ID['1111'];
    const handId = CHORD_TO_ID['1110'];
    expect(mask[quadId]).toBeLessThan(-1000);
    expect(mask[handId]).toBeLessThan(-1000);

    const singleId = CHORD_TO_ID['1000'];
    expect(mask[singleId]).toBe(0.0);
  });

  it('forbids ghost releases when panel is not held', () => {
    const fsm = new ClientFootStateMachine(3);
    const mask = fsm.computeMask(0.0, 0.25);

    const releaseLeft = CHORD_TO_ID['3000'];
    expect(mask[releaseLeft]).toBeLessThan(-1000);
  });

  it('allows release and forbids double-booking after hold head', () => {
    const fsm = new ClientFootStateMachine(3);
    const holdLeft = CHORD_TO_ID['2000'];
    fsm.updateState(holdLeft, 0.0, 0.25);
    expect(fsm.state.activeHolds.has(0)).toBe(true);

    const mask = fsm.computeMask(1.0, 1.0);
    // Tapping on left (held) panel should be forbidden
    const tapLeft = CHORD_TO_ID['1000'];
    expect(mask[tapLeft]).toBeLessThan(-1000);

    // Releasing left panel should be allowed
    const releaseLeft = CHORD_TO_ID['3000'];
    expect(mask[releaseLeft]).toBe(0.0);
  });

  it('allows 2-tap adjacent brackets when 1 foot is held but forbids opposite jumps and >=3 taps', () => {
    const fsm = new ClientFootStateMachine(4); // Expert
    const holdLeft = CHORD_TO_ID['2000']; // Panel 0 is held
    fsm.updateState(holdLeft, 0.0, 0.25);
    expect(fsm.state.activeHolds.has(0)).toBe(true);

    const mask = fsm.computeMask(1.0, 0.25);

    // Adjacent bracket (Up+Right: 0011) on the free foot should be ALLOWED
    const bracketUpRight = CHORD_TO_ID['0011'];
    expect(mask[bracketUpRight]).toBe(0.0);

    // Opposite jump (Down+Up: 0110) on 1 free foot is anatomically impossible -> FORBIDDEN
    const oppositeJump = CHORD_TO_ID['0110'];
    expect(mask[oppositeJump]).toBeLessThan(-1000);

    // 3 taps (Down+Up+Right: 0111) on 1 free foot -> FORBIDDEN
    const handWithHold = CHORD_TO_ID['0111'];
    expect(mask[handWithHold]).toBeLessThan(-1000);
  });

  it('permits hands and quads on Expert when 0 holds are active', () => {
    const fsm = new ClientFootStateMachine(4); // Expert
    const mask = fsm.computeMask(0.0, 0.25);

    const handId = CHORD_TO_ID['1110'];
    const quadId = CHORD_TO_ID['1111'];
    expect(mask[handId]).toBe(0.0);
    expect(mask[quadId]).toBe(0.0);
  });

  it('applies soft penalty -5.0 for sustained hyper-speed jacks (deltaBeat < 0.25 and jackCount >= 2)', () => {
    const fsm = new ClientFootStateMachine(3);
    const tapLeft = CHORD_TO_ID['1000'];

    // Tap 1
    fsm.updateState(tapLeft, 0.0, 0.20);
    expect(fsm.state.jackCount).toBe(1);

    // Tap 2 (jackCount becomes 2)
    fsm.updateState(tapLeft, 0.20, 0.20);
    expect(fsm.state.jackCount).toBe(2);
    expect(fsm.state.lastPanel).toBe(0);

    // When deltaBeat < 0.25, soft penalty -5.0 is applied
    const maskFast = fsm.computeMask(0.40, 0.20);
    expect(maskFast[tapLeft]).toBe(-5.0);

    // Other panels should have 0 penalty
    const tapDown = CHORD_TO_ID['0100'];
    expect(maskFast[tapDown]).toBe(0.0);

    // When deltaBeat >= 0.25, soft penalty is NOT applied
    const maskSlow = fsm.computeMask(0.50, 0.30);
    expect(maskSlow[tapLeft]).toBe(0.0);
  });
});
