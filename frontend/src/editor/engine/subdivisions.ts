/**
 * frontend/src/editor/engine/subdivisions.ts
 * Canonical StepMania subdivisions and exact color hues.
 * 192-tick grid math: 48 ticks per beat, 192 ticks per standard 4/4 measure.
 */

import type { SubdivisionTier } from './types';

export const TICKS_PER_BEAT = 48;
export const BEATS_PER_MEASURE = 4;
export const TICKS_PER_MEASURE = TICKS_PER_BEAT * BEATS_PER_MEASURE; // 192

/**
 * Exact canonical StepMania color hues.
 */
export const SUBDIVISION_COLORS: Record<SubdivisionTier, string> = {
  4: '#ff2a55', // Red
  8: '#00a2ff', // Blue
  12: '#9e3cff', // Purple
  16: '#ffd000', // Yellow
  24: '#ff54be', // Pink / Magenta
  32: '#ff7b00', // Orange
  48: '#00e5ff', // Cyan / Teal
  64: '#00e676', // Green
  96: '#b0bec5', // Light Gray / Lavender
  192: '#78909c', // Dark Gray / Slate
};

export const SUBDIVISION_NAMES: Record<SubdivisionTier, string> = {
  4: '4th Note',
  8: '8th Note',
  12: '12th Note',
  16: '16th Note',
  24: '24th Note',
  32: '32nd Note',
  48: '48th Note',
  64: '64th Note',
  96: '96th Note',
  192: '192nd Note',
};

/**
 * Ticks per division interval within a single beat (48 ticks).
 * Stride for 192-row measure = 192 / subdivision.
 * Stride within 1 beat = 48 / (subdivision / 4).
 */
export const SUBDIVISION_STRIDES: Record<SubdivisionTier, number> = {
  4: 48,
  8: 24,
  12: 16,
  16: 12,
  24: 8,
  32: 6,
  48: 4,
  64: 3,
  96: 2,
  192: 1,
};

export const ALL_SUBDIVISIONS: SubdivisionTier[] = [
  4, 8, 12, 16, 24, 32, 48, 64, 96, 192,
];

/**
 * Determines the quantization tier for a given tick in measure (0..191) or absolute row.
 * Canonical StepMania tick condition:
 * - 4th: tick % 48 == 0
 * - 8th: tick % 24 == 0
 * - 12th: tick % 16 == 0
 * - 16th: tick % 12 == 0
 * - 24th: tick % 8 == 0
 * - 32nd: tick % 6 == 0
 * - 48th: tick % 4 == 0
 * - 64th: tick % 3 == 0
 * - 96th: tick % 2 == 0
 * - 192nd: tick % 1 == 0
 */
export function getSubdivision(tickInMeasure: number): SubdivisionTier {
  const tick = ((Math.round(tickInMeasure) % TICKS_PER_BEAT) + TICKS_PER_BEAT) % TICKS_PER_BEAT;

  if (tick === 0) return 4;
  if (tick % 24 === 0) return 8;
  if (tick % 16 === 0) return 12;
  if (tick % 12 === 0) return 16;
  if (tick % 8 === 0) return 24;
  if (tick % 6 === 0) return 32;
  if (tick % 4 === 0) return 48;
  if (tick % 3 === 0) return 64;
  if (tick % 2 === 0) return 96;
  return 192;
}

/**
 * Returns the canonical hex color for a given tick in measure (0..191).
 */
export function getSubdivisionColor(tickInMeasure: number): string {
  const tier = getSubdivision(tickInMeasure);
  return SUBDIVISION_COLORS[tier];
}

/**
 * Determines the quantization tier for a musical beat (e.g. 0.0, 1.0, 2.5, 3.25).
 */
export function getBeatSubdivision(beat: number): SubdivisionTier {
  const row = Math.round(beat * TICKS_PER_BEAT);
  return getSubdivision(row);
}

/**
 * Returns the canonical hex color for a musical beat.
 */
export function getBeatSubdivisionColor(beat: number): string {
  const tier = getBeatSubdivision(beat);
  return SUBDIVISION_COLORS[tier];
}

