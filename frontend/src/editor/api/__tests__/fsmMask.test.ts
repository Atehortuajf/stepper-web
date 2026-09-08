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
});
