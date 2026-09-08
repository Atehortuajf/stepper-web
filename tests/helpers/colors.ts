export const CANONICAL_COLORS = {
  4: '#ff2a55',
  8: '#00a2ff',
  12: '#9e3cff',
  16: '#ffd000',
  24: '#ff54be',
  32: '#ff7b00',
  48: '#00e5ff',
  64: '#00e676',
  96: '#b0bec5',
  192: '#78909c',
} as const;

export const FOOT_PARITY_COLORS = {
  L: '#00b0ff',
  R: '#ff3366',
  LR: '#b388ff',
  UNKNOWN: '#ffffff',
} as const;

export function getSubdivisionFromBeat(beat: number): keyof typeof CANONICAL_COLORS {
  const frac = beat - Math.floor(beat);
  const tick = Math.round(frac * 48) % 48;
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

export function getCanonicalColorForBeat(beat: number): string {
  const sub = getSubdivisionFromBeat(beat);
  return CANONICAL_COLORS[sub];
}
