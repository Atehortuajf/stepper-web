/**
 * frontend/src/editor/biomechanics/types.ts
 * Biomechanical foot parity and physical playability data models.
 */

import type { StepFlags } from '../api/stepperApi';

export type FootDesignation = 'L' | 'R' | 'LR' | 'None';

export type HeelToeTag = 'LH' | 'LT' | 'RH' | 'RT' | 'H' | 'T' | null;

export interface BiomechanicalStep {
  beat: number;
  row: number;
  arrows: string;
  foot: FootDesignation;
  cost: number;
  warning?: string | null;
  left_pos?: number | number[] | null;
  right_pos?: number | number[] | null;
  heelToe?: HeelToeTag;
  flags: StepFlags;
}

export interface ParityStatsData {
  total_steps: number;
  alternation_rate: number;
  crossovers: number;
  candles: number;
  footswitches: number;
  holdswitches: number;
  double_steps: number;
  jacks: number;
  brackets: number;
}

export interface UnplayabilityWarningItem {
  beat: number;
  message: string;
  severity: 'error' | 'warning';
  stepIndex: number;
}

export interface ParitySolveResult {
  is_playable: boolean;
  total_cost: number;
  foot_sequence: FootDesignation[];
  steps: BiomechanicalStep[];
  stats: ParityStatsData;
  warnings: UnplayabilityWarningItem[];
}
