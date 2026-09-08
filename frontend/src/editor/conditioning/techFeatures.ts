/**
 * frontend/src/editor/conditioning/techFeatures.ts
 * 16-D Technique Vector Conditioning Taxonomy, Presets, and Difficulty Utilities.
 * Strictly aligned with stepper/data/tech_tags.py and Stepper-Sync model specs.
 */

export const TECH_TAG_KEYS = [
  'crossover',          // 1. XO / Crossover
  'footswitch',         // 2. FS / Footswitch
  'doublestep',         // 3. DS / Double step
  'bracket',            // 4. BR / Bracket
  'burst',              // 5. BU / Burst (speed bursts)
  'bracket_crossover',  // 6. BXF / Bracket crossover
  'sideswitch',         // 7. SS / Sideswitch
  'kickswitch',         // 8. KS / Kickswitch
  'holdswitch',         // 9. HS / Holdswitch
  'jack',               // 10. JA / Jacks
  'jump_jack',          // 11. JU / Jump jacks
  'split_jack',         // 12. SJ / Split jacks
  'bracket_tap',        // 13. BT / Bracket taps
  'complex_rhythm',     // 14. RH / Rhythms, syncopation
  'stream_stamina',     // 15. STR / Stream, stamina
  'no_tech',            // 16. NO TECH / Pure alternation
] as const;

export type TechTagKey = (typeof TECH_TAG_KEYS)[number];
export const NUM_TECH_FEATURES = TECH_TAG_KEYS.length; // 16

export interface TechFeatureMeta {
  key: TechTagKey;
  label: string;
  shorthand: string;
  category: 'Switches' | 'Brackets' | 'Jacks' | 'Rhythm & Stream' | 'Baseline';
  description: string;
}

export const TECH_FEATURE_METAS: Record<TechTagKey, TechFeatureMeta> = {
  crossover: {
    key: 'crossover',
    label: 'Crossover',
    shorthand: 'XO',
    category: 'Switches',
    description: 'Opposite foot crossing body centerline to step outer panel',
  },
  footswitch: {
    key: 'footswitch',
    label: 'Footswitch',
    shorthand: 'FS',
    category: 'Switches',
    description: 'Alternating feet on the same arrow without double stepping',
  },
  doublestep: {
    key: 'doublestep',
    label: 'Double Step',
    shorthand: 'DS',
    category: 'Switches',
    description: 'Consecutive hits with the same foot on different arrows',
  },
  bracket: {
    key: 'bracket',
    label: 'Bracket',
    shorthand: 'BR',
    category: 'Brackets',
    description: 'Single foot hitting two adjacent arrows simultaneously',
  },
  burst: {
    key: 'burst',
    label: 'Burst',
    shorthand: 'BU',
    category: 'Rhythm & Stream',
    description: 'High-density speed burst (24th/32nd note runs or mini-streams)',
  },
  bracket_crossover: {
    key: 'bracket_crossover',
    label: 'Bracket X-Over',
    shorthand: 'BXF',
    category: 'Brackets',
    description: 'Bracket executed across the body crossing the other foot',
  },
  sideswitch: {
    key: 'sideswitch',
    label: 'Sideswitch',
    shorthand: 'SS',
    category: 'Switches',
    description: 'Switching feet on side panels while maintaining sideways facing',
  },
  kickswitch: {
    key: 'kickswitch',
    label: 'Kickswitch',
    shorthand: 'KS',
    category: 'Switches',
    description: 'Rapid hop-switch motion alternating feet on single panel',
  },
  holdswitch: {
    key: 'holdswitch',
    label: 'Holdswitch',
    shorthand: 'HS',
    category: 'Switches',
    description: 'Transferring an active hold note from one foot to the other',
  },
  jack: {
    key: 'jack',
    label: 'Jackhammer',
    shorthand: 'JA',
    category: 'Jacks',
    description: 'Rapid repeated taps on the exact same arrow with one foot',
  },
  jump_jack: {
    key: 'jump_jack',
    label: 'Jump Jack',
    shorthand: 'JU',
    category: 'Jacks',
    description: 'Repeated simultaneous 2-arrow jumps in immediate succession',
  },
  split_jack: {
    key: 'split_jack',
    label: 'Split Jack',
    shorthand: 'SJ',
    category: 'Jacks',
    description: 'Alternating jack patterns divided between both feet',
  },
  bracket_tap: {
    key: 'bracket_tap',
    label: 'Bracket Tap',
    shorthand: 'BT',
    category: 'Brackets',
    description: 'Fast single-foot bracket hits integrated into stream patterns',
  },
  complex_rhythm: {
    key: 'complex_rhythm',
    label: 'Complex Rhythm',
    shorthand: 'RH',
    category: 'Rhythm & Stream',
    description: 'Syncopated, 12th/24th triplets, 32nd/64th bursts and off-beats',
  },
  stream_stamina: {
    key: 'stream_stamina',
    label: 'Stream Stamina',
    shorthand: 'STR',
    category: 'Rhythm & Stream',
    description: 'Continuous uninterrupted 16th-note streams testing endurance',
  },
  no_tech: {
    key: 'no_tech',
    label: 'No Tech / Clean',
    shorthand: 'No Tech',
    category: 'Baseline',
    description: 'Pure straightforward left-right alternation with zero technical maneuvers',
  },
};

export type TechVectorDict = Record<TechTagKey, number>;

export function createDefaultTechVector(): TechVectorDict {
  return {
    crossover: 0.0,
    footswitch: 0.0,
    doublestep: 0.0,
    bracket: 0.0,
    burst: 0.0,
    bracket_crossover: 0.0,
    sideswitch: 0.0,
    kickswitch: 0.0,
    holdswitch: 0.0,
    jack: 0.0,
    jump_jack: 0.0,
    split_jack: 0.0,
    bracket_tap: 0.0,
    complex_rhythm: 0.0,
    stream_stamina: 0.0,
    no_tech: 0.0,
  };
}

/**
 * Standard technique presets for competitive dance chart styles.
 */
export interface TechPreset {
  id: string;
  name: string;
  description: string;
  vector: TechVectorDict;
}

export const TECH_PRESETS: TechPreset[] = [
  {
    id: 'pure_stream',
    name: 'Pure Stream',
    description: 'Relentless 16th-note stamina runs with clean alternation and zero awkward tech.',
    vector: {
      ...createDefaultTechVector(),
      stream_stamina: 0.90,
      no_tech: 0.85,
      complex_rhythm: 0.15,
    },
  },
  {
    id: 'footswitch_tech',
    name: 'Footswitch/Tech',
    description: 'Heavy footswitches, sideswitches, holdswitches, and technical crossovers.',
    vector: {
      ...createDefaultTechVector(),
      footswitch: 0.85,
      sideswitch: 0.70,
      kickswitch: 0.60,
      holdswitch: 0.65,
      crossover: 0.55,
      complex_rhythm: 0.45,
    },
  },
  {
    id: 'brackets_doubles',
    name: 'Brackets & Doubles',
    description: 'High-density multi-arrow brackets, crossovers, and double steps.',
    vector: {
      ...createDefaultTechVector(),
      bracket: 0.85,
      bracket_crossover: 0.70,
      bracket_tap: 0.65,
      doublestep: 0.60,
    },
  },
  {
    id: 'jackhammer',
    name: 'Jackhammer',
    description: 'Intense single-arrow jacks, jump jacks, and split-jack burst patterns.',
    vector: {
      ...createDefaultTechVector(),
      jack: 0.90,
      jump_jack: 0.80,
      split_jack: 0.75,
    },
  },
  {
    id: 'reset_balanced',
    name: 'Reset / Balanced',
    description: 'Neutral baseline conditioning allowing AI model unconstrained inference.',
    vector: createDefaultTechVector(),
  },
];

/**
 * Converts a 16-D dictionary into an exact ordered float array [0.0, 1.0]^16.
 */
export function techVectorToArray(dict: TechVectorDict): number[] {
  return TECH_TAG_KEYS.map((k) => Math.max(0.0, Math.min(1.0, Number(dict[k]) || 0.0)));
}

/**
 * Converts a float array back into a 16-D dictionary.
 */
export function arrayToTechVector(arr: number[]): TechVectorDict {
  const dict = createDefaultTechVector();
  TECH_TAG_KEYS.forEach((k, idx) => {
    dict[k] = arr[idx] !== undefined ? Math.max(0.0, Math.min(1.0, arr[idx])) : 0.0;
  });
  return dict;
}

/**
 * Generates an ITL-style tech tag string (e.g. "FS+ BR XO-") matching stepper/data/tech_tags.py.
 */
export function describeTechVector(
  input: TechVectorDict | number[],
  threshold = 0.25
): string {
  const arr = Array.isArray(input) ? input : techVectorToArray(input);
  const noTechIdx = TECH_TAG_KEYS.indexOf('no_tech');

  if (arr[noTechIdx] >= 0.5) {
    return 'No Tech';
  }

  const tags: string[] = [];
  TECH_TAG_KEYS.forEach((key, idx) => {
    if (key === 'no_tech') return;
    const val = arr[idx];
    if (val >= threshold) {
      const sh = TECH_FEATURE_METAS[key].shorthand;
      if (val >= 0.85) {
        tags.push(`${sh}+`);
      } else if (val <= 0.45) {
        tags.push(`${sh}-`);
      } else {
        tags.push(sh);
      }
    }
  });

  return tags.length > 0 ? tags.join(' ') : 'Balanced';
}

/**
 * Standard difficulty tiers and default ITG meters.
 */
export interface DifficultyTierMeta {
  tier: number; // 0-4
  name: 'Novice' | 'Easy' | 'Medium' | 'Hard' | 'Expert';
  defaultMeter: number;
  color: string;
}

export const DIFFICULTY_TIERS: DifficultyTierMeta[] = [
  { tier: 0, name: 'Novice', defaultMeter: 3, color: '#00e5ff' },
  { tier: 1, name: 'Easy', defaultMeter: 6, color: '#00e676' },
  { tier: 2, name: 'Medium', defaultMeter: 9, color: '#ffd000' },
  { tier: 3, name: 'Hard', defaultMeter: 12, color: '#ff7b00' },
  { tier: 4, name: 'Expert', defaultMeter: 15, color: '#ff2a55' },
];
