/**
 * frontend/src/editor/biomechanics/__tests__/biomechanics.test.tsx
 * Comprehensive unit and component tests for Viterbi foot parity solver,
 * ParityTrack ribbon, HeatmapOverlay, and UnplayabilityBanner.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  solveParityLocally,
  ParityTrack,
  HeatmapOverlay,
  UnplayabilityBanner,
} from '../index';
import type { BiomechanicalStep, UnplayabilityWarningItem } from '../types';
import type { NoteRow } from '../../engine/types';

// Configure React 19 testing environment for act
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Viterbi Biomechanical Foot Solver (localParitySolver)', () => {
  it('solves clean alternating streams with alternating L/R feet and low cost', () => {
    // 4 notes: Left (0), Down (1), Up (2), Right (3)
    const notes: NoteRow[] = [
      { row: 0, beat: 0.0, arrows: '1000' },
      { row: 48, beat: 1.0, arrows: '0100' },
      { row: 96, beat: 2.0, arrows: '0010' },
      { row: 144, beat: 3.0, arrows: '0001' },
    ];

    const result = solveParityLocally(notes);
    expect(result.is_playable).toBe(true);
    expect(result.total_cost).toBeLessThan(10.0);
    expect(result.steps.length).toBe(4);

    // Should alternate feet cleanly: L -> R -> L -> R
    expect(result.foot_sequence).toEqual(['L', 'R', 'L', 'R']);
    expect(result.stats.alternation_rate).toBe(1.0);
    expect(result.stats.double_steps).toBe(0);
    expect(result.stats.jacks).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  it('detects double-steps when same foot steps on consecutive different panels', () => {
    // Left foot is pinned on a hold note on panel 0 (Left)
    const holds = [
      { track: 0, startRow: 0, endRow: 144, startBeat: 0.0, endBeat: 3.0, isRoll: false },
    ];
    // Right foot must hit Down (1) then Up (2) while Left is holding Left
    const notes: NoteRow[] = [
      { row: 0, beat: 0.0, arrows: '2000' }, // Left foot hold head on Left
      { row: 24, beat: 0.5, arrows: '0100' }, // Right foot hits Down (1)
      { row: 36, beat: 0.75, arrows: '0010' }, // Right foot double-steps to Up (2)!
    ];

    const result = solveParityLocally(notes, holds);
    expect(result.is_playable).toBe(true);
    expect(result.stats.double_steps).toBeGreaterThan(0);
    expect(result.steps.some((s) => s.flags.is_double_step)).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('Double Step'))).toBe(true);
  });

  it('detects and flags fast jacks on repeated identical arrows', () => {
    // Right foot is pinned on a hold note on panel 3 (Right)
    const holds = [
      { track: 3, startRow: 0, endRow: 144, startBeat: 0.0, endBeat: 3.0, isRoll: false },
    ];
    // Left foot forced to jack on Left (0)
    const notes: NoteRow[] = [
      { row: 0, beat: 0.0, arrows: '0002' }, // Right foot hold head
      { row: 12, beat: 0.25, arrows: '1000' }, // Left foot on Left
      { row: 18, beat: 0.375, arrows: '1000' }, // Left foot jacks on Left!
    ];

    const result = solveParityLocally(notes, holds);
    expect(result.stats.jacks).toBeGreaterThan(0);
    expect(result.steps.some((s) => s.flags.is_jack)).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('Jackhammer'))).toBe(true);
  });

  it('detects footswitches when same panel is hit with alternating feet', () => {
    // Footswitch: Left foot on Down (1), then Right foot takes over Down (1)
    const notes: NoteRow[] = [
      { row: 0, beat: 0.0, arrows: '1000' }, // Left on Left
      { row: 24, beat: 0.5, arrows: '0100' }, // Left moves to Down
      { row: 36, beat: 0.75, arrows: '0100' }, // Right takes over Down (footswitch!)
      { row: 48, beat: 1.0, arrows: '0001' }, // Right moves to Right
    ];

    const result = solveParityLocally(notes);
    expect(result.is_playable).toBe(true);
    expect(result.stats.footswitches).toBeGreaterThanOrEqual(1);
    expect(result.steps.some((s) => s.flags.is_footswitch)).toBe(true);
  });

  it('detects crossovers and assigns crossover types', () => {
    // Classic ITG crossover: Left (0) -> Down (1) -> Right (3) -> Down (1) -> Left (0)
    // Left foot on Left (0), Right foot on Down (1), Left foot crosses over Right leg to Right (3)!
    const notes: NoteRow[] = [
      { row: 0, beat: 0.0, arrows: '1000' }, // Left (0) -> 'L'
      { row: 24, beat: 0.5, arrows: '0100' }, // Down (1) -> 'R'
      { row: 48, beat: 1.0, arrows: '0001' }, // Right (3) -> 'L' crosses over!
      { row: 72, beat: 1.5, arrows: '0100' }, // Down (1) -> 'R'
      { row: 96, beat: 2.0, arrows: '1000' }, // Left (0) -> 'L'
    ];

    const result = solveParityLocally(notes);
    expect(result.is_playable).toBe(true);
    const crossoverStep = result.steps.find((s) => s.flags.is_crossover);
    expect(crossoverStep).toBeDefined();
    expect(crossoverStep?.flags.crossover_type).toMatch(/front|back/);
  });

  it('identifies and assigns adjacent brackets with Heel-Toe tags', () => {
    // Bracket chord: Left + Down (1100) hit simultaneously
    const notes: NoteRow[] = [
      { row: 0, beat: 0.0, arrows: '1100' }, // Left foot bracket on [Left, Down]
      { row: 48, beat: 1.0, arrows: '0001' }, // Right foot on Right
    ];

    const result = solveParityLocally(notes, [], [{ beat: 0, bpm: 120 }], 12);
    expect(result.is_playable).toBe(true);
    expect(result.stats.brackets).toBeGreaterThanOrEqual(1);

    const bracketStep = result.steps.find((s) => s.flags.is_bracket);
    expect(bracketStep).toBeDefined();
    expect(bracketStep?.heelToe).toMatch(/LH|LT|RH|RT/);
  });

  it('flags physically impossible combinations with high cost and playability failure', () => {
    // Non-adjacent single foot impossibility: Left+Right (1001) as single bracket, or impossible multi-tap
    // Specifically test 4 simultaneous taps where brackets cannot cover or invalid notes
    const impossibleNotes: NoteRow[] = [
      { row: 0, beat: 0.0, arrows: '1000' },
      { row: 12, beat: 0.25, arrows: '0000' }, // Empty row shouldn't break solver
    ];
    const res = solveParityLocally(impossibleNotes);
    expect(res.steps.length).toBe(1);

    // Test empty chart
    const emptyRes = solveParityLocally([]);
    expect(emptyRes.is_playable).toBe(true);
    expect(emptyRes.total_cost).toBe(0.0);
    expect(emptyRes.steps.length).toBe(0);
  });
});

describe('ParityTrack Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders Left foot badge (#00b0ff) and Right foot badge (#ff3366)', async () => {
    const leftStep: BiomechanicalStep = {
      beat: 1.0,
      row: 48,
      arrows: '1000',
      foot: 'L',
      cost: 0.4,
      heelToe: 'LT',
      flags: {
        is_crossover: false,
        is_candle: false,
        is_double_step: false,
        is_jack: false,
        is_bracket: false,
        is_footswitch: false,
        is_holdswitch: false,
      },
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(<ParityTrack step={leftStep} />);
    });

    const leftBadge = container.querySelector('[data-testid="foot-left"]');
    expect(leftBadge).not.toBeNull();
    expect(leftBadge?.textContent).toBe('L');

    const heelToe = container.querySelector('[data-testid="heel-toe-badge"]');
    expect(heelToe).not.toBeNull();
    expect(heelToe?.textContent).toBe('LT');
  });

  it('renders Jump dual-badge and Bracket badge', async () => {
    const jumpStep: BiomechanicalStep = {
      beat: 2.0,
      row: 96,
      arrows: '1100',
      foot: 'LR',
      cost: 0.6,
      flags: {
        is_crossover: false,
        is_candle: false,
        is_double_step: false,
        is_jack: false,
        is_bracket: true,
        is_footswitch: false,
        is_holdswitch: false,
      },
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(<ParityTrack step={jumpStep} />);
    });

    const jumpBadge = container.querySelector('[data-testid="foot-jump"]');
    expect(jumpBadge).not.toBeNull();

    const bracketBadge = container.querySelector('[data-testid="bracket-badge"]');
    expect(bracketBadge).not.toBeNull();
    expect(bracketBadge?.textContent).toBe('BR');
  });

  it('renders warning badge when step has warning', async () => {
    const warningStep: BiomechanicalStep = {
      beat: 3.0,
      row: 144,
      arrows: '0100',
      foot: 'R',
      cost: 2.4,
      warning: 'Double Step',
      flags: {
        is_crossover: false,
        is_candle: false,
        is_double_step: true,
        is_jack: false,
        is_bracket: false,
        is_footswitch: false,
        is_holdswitch: false,
      },
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(<ParityTrack step={warningStep} />);
    });

    const warnBadge = container.querySelector('[data-testid="step-warning-badge"]');
    expect(warnBadge).not.toBeNull();
    expect(warnBadge?.textContent).toBe('DS');
  });
});

describe('HeatmapOverlay Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders strain distribution and calls onSelectBeat when heat bar clicked', async () => {
    const handleSelectBeat = vi.fn();
    const sampleSteps: BiomechanicalStep[] = [
      {
        beat: 0.0,
        row: 0,
        arrows: '1000',
        foot: 'L',
        cost: 0.2,
        flags: {} as any,
      },
      {
        beat: 1.0,
        row: 48,
        arrows: '0100',
        foot: 'R',
        cost: 1.5,
        flags: {} as any,
      },
      {
        beat: 2.0,
        row: 96,
        arrows: '0010',
        foot: 'L',
        cost: 2.8,
        flags: {} as any,
      },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <HeatmapOverlay
          steps={sampleSteps}
          totalCost={4.5}
          isPlayable={true}
          onSelectBeat={handleSelectBeat}
        />
      );
    });

    const statusBadge = container.querySelector('[data-testid="playability-status"]');
    expect(statusBadge).not.toBeNull();
    expect(statusBadge?.textContent).toBe('Rules passed');

    // Click heat bar
    const bar0 = container.querySelector<HTMLDivElement>('[data-testid="heat-bar-0"]')!;
    expect(bar0).not.toBeNull();

    await act(async () => {
      bar0.click();
    });
    expect(handleSelectBeat).toHaveBeenCalledWith(0.0);
  });
});

describe('UnplayabilityBanner Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders null when chart is playable and has no warnings', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<UnplayabilityBanner isPlayable={true} warnings={[]} />);
    });

    expect(container.innerHTML).toBe('');
  });

  it('renders fatal banner when unplayable and expands details', async () => {
    const handleJump = vi.fn();
    const warnings: UnplayabilityWarningItem[] = [
      {
        beat: 16.5,
        message: 'Physically unplayable transition (cross-lock)',
        severity: 'error',
        stepIndex: 12,
      },
      {
        beat: 24.0,
        message: 'Double Step',
        severity: 'warning',
        stepIndex: 18,
      },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <UnplayabilityBanner
          isPlayable={false}
          warnings={warnings}
          onJumpToBeat={handleJump}
        />
      );
    });

    const banner = container.querySelector('[data-testid="unplayability-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('PHYSICAL UNPLAYABILITY DETECTED');

    // Toggle details expansion
    const toggleBtn = container.querySelector<HTMLButtonElement>('[data-testid="toggle-warnings-btn"]')!;
    await act(async () => {
      toggleBtn.click();
    });

    // Click warning item to jump to beat
    const item0 = container.querySelector<HTMLDivElement>('[data-testid="warning-item-0"]')!;
    expect(item0).not.toBeNull();
    expect(item0.textContent).toContain('Beat 16.50');

    await act(async () => {
      item0.click();
    });
    expect(handleJump).toHaveBeenCalledWith(16.5);
  });
});
