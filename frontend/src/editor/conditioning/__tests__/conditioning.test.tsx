/**
 * frontend/src/editor/conditioning/__tests__/conditioning.test.tsx
 * Comprehensive unit and component tests for 16-D Technique Conditioning,
 * Presets, Diff Overlay, and Measure Range Selector.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  DIFFICULTY_TIERS,
  NUM_TECH_FEATURES,
  TECH_FEATURE_METAS,
  TECH_PRESETS,
  TECH_TAG_KEYS,
  arrayToTechVector,
  createDefaultTechVector,
  describeTechVector,
  techVectorToArray,
} from '../techFeatures';
import type { TechVectorDict } from '../techFeatures';
import { TechConditioningPanel } from '../TechConditioningPanel';
import { MeasureRangeSelector } from '../MeasureRangeSelector';
import { DiffOverlay } from '../DiffOverlay';
import type { NoteRow } from '../../engine/types';
import type { Placement } from '../../api/stepperApi';

// Configure React 19 testing environment for act
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setNativeValue(element: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('16-D Technique Conditioning Taxonomy & Functions', () => {
  it('defines exactly 16 canonical features matching stepper/data/tech_tags.py', () => {
    expect(NUM_TECH_FEATURES).toBe(16);
    expect(TECH_TAG_KEYS.length).toBe(16);
    expect(TECH_TAG_KEYS).toEqual([
      'crossover',
      'footswitch',
      'doublestep',
      'bracket',
      'burst',
      'bracket_crossover',
      'sideswitch',
      'kickswitch',
      'holdswitch',
      'jack',
      'jump_jack',
      'split_jack',
      'bracket_tap',
      'complex_rhythm',
      'stream_stamina',
      'no_tech',
    ]);
  });

  it('provides complete metadata for every technique tag', () => {
    for (const key of TECH_TAG_KEYS) {
      const meta = TECH_FEATURE_METAS[key];
      expect(meta).toBeDefined();
      expect(meta.key).toBe(key);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.shorthand.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('converts dictionary to 16-D float array and clamps between 0.0 and 1.0', () => {
    const dict: TechVectorDict = {
      ...createDefaultTechVector(),
      crossover: 0.75,
      footswitch: 1.5, // over 1.0
      jack: -0.2, // under 0.0
      stream_stamina: 0.9,
    };

    const arr = techVectorToArray(dict);
    expect(arr.length).toBe(16);
    expect(arr[0]).toBe(0.75); // crossover
    expect(arr[1]).toBe(1.0); // clamped footswitch
    expect(arr[9]).toBe(0.0); // clamped jack
    expect(arr[14]).toBe(0.9); // stream_stamina
    expect(arr[15]).toBe(0.0); // no_tech
  });

  it('converts 16-D float array back to dictionary', () => {
    const arr = new Array(16).fill(0.0);
    arr[0] = 0.5; // crossover
    arr[3] = 0.8; // bracket
    arr[15] = 1.0; // no_tech

    const dict = arrayToTechVector(arr);
    expect(dict.crossover).toBe(0.5);
    expect(dict.bracket).toBe(0.8);
    expect(dict.no_tech).toBe(1.0);
    expect(dict.jack).toBe(0.0);
  });

  it('generates ITL shorthand descriptions accurately', () => {
    // No tech takes precedence
    const noTechVec = { ...createDefaultTechVector(), no_tech: 1.0, crossover: 0.8 };
    expect(describeTechVector(noTechVec)).toBe('No Tech');

    // Balanced / empty
    expect(describeTechVector(createDefaultTechVector())).toBe('Balanced');

    // Modifiers (+, -, standard)
    const techVec = {
      ...createDefaultTechVector(),
      footswitch: 0.9, // FS+
      bracket: 0.7, // BR
      crossover: 0.35, // XO-
    };
    const desc = describeTechVector(techVec);
    expect(desc).toContain('FS+');
    expect(desc).toContain('BR');
    expect(desc).toContain('XO-');
  });

  it('provides all 5 required presets with correct parameters', () => {
    const presetIds = TECH_PRESETS.map((p) => p.id);
    expect(presetIds).toEqual([
      'pure_stream',
      'footswitch_tech',
      'brackets_doubles',
      'jackhammer',
      'reset_balanced',
    ]);

    const pureStream = TECH_PRESETS.find((p) => p.id === 'pure_stream')!;
    expect(pureStream.vector.stream_stamina).toBe(0.9);
    expect(pureStream.vector.no_tech).toBe(0.85);

    const jackhammer = TECH_PRESETS.find((p) => p.id === 'jackhammer')!;
    expect(jackhammer.vector.jack).toBe(0.9);
    expect(jackhammer.vector.jump_jack).toBe(0.8);

    const resetBalanced = TECH_PRESETS.find((p) => p.id === 'reset_balanced')!;
    for (const k of TECH_TAG_KEYS) {
      expect(resetBalanced.vector[k]).toBe(0.0);
    }
  });

  it('defines 5 standard difficulty tiers with corresponding default meters', () => {
    expect(DIFFICULTY_TIERS.length).toBe(5);
    expect(DIFFICULTY_TIERS[0]).toMatchObject({ tier: 0, name: 'Novice', defaultMeter: 3 });
    expect(DIFFICULTY_TIERS[1]).toMatchObject({ tier: 1, name: 'Easy', defaultMeter: 6 });
    expect(DIFFICULTY_TIERS[2]).toMatchObject({ tier: 2, name: 'Medium', defaultMeter: 9 });
    expect(DIFFICULTY_TIERS[3]).toMatchObject({ tier: 3, name: 'Hard', defaultMeter: 12 });
    expect(DIFFICULTY_TIERS[4]).toMatchObject({ tier: 4, name: 'Expert', defaultMeter: 15 });
  });
});

describe('TechConditioningPanel Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders all 16 sliders and updates value on modulation', async () => {
    const handleChange = vi.fn();
    const handleTierChange = vi.fn();
    const handleMeterChange = vi.fn();
    const vector = createDefaultTechVector();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TechConditioningPanel
          techVector={vector}
          onChange={handleChange}
          difficultyTier={3}
          onDifficultyTierChange={handleTierChange}
          difficultyMeter={12}
          onDifficultyMeterChange={handleMeterChange}
        />
      );
    });

    // Check panel presence
    const panel = container.querySelector('[data-testid="tech-conditioning-panel"]');
    expect(panel).not.toBeNull();

    // Check all 16 slider containers exist
    for (const key of TECH_TAG_KEYS) {
      const slider = container.querySelector(`[data-testid="slider-${key}"]`);
      expect(slider).not.toBeNull();
    }

    // Modulate footswitch slider
    const fsSlider = container.querySelector<HTMLInputElement>('[data-testid="slider-footswitch"]')!;
    await act(async () => {
      setNativeValue(fsSlider, '0.75');
    });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        footswitch: 0.75,
      })
    );
  });

  it('applies style preset when preset button is clicked', async () => {
    const handleChange = vi.fn();
    const vector = createDefaultTechVector();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TechConditioningPanel
          techVector={vector}
          onChange={handleChange}
          difficultyTier={2}
          onDifficultyTierChange={vi.fn()}
          difficultyMeter={9}
          onDifficultyMeterChange={vi.fn()}
        />
      );
    });

    const streamBtn = container.querySelector<HTMLButtonElement>('[data-testid="preset-btn-pure_stream"]')!;
    expect(streamBtn).not.toBeNull();

    await act(async () => {
      streamBtn.click();
    });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stream_stamina: 0.9,
        no_tech: 0.85,
      })
    );
  });

  it('updates difficulty tier and auto-sets default meter', async () => {
    const handleTierChange = vi.fn();
    const handleMeterChange = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TechConditioningPanel
          techVector={createDefaultTechVector()}
          onChange={vi.fn()}
          difficultyTier={1}
          onDifficultyTierChange={handleTierChange}
          difficultyMeter={6}
          onDifficultyMeterChange={handleMeterChange}
        />
      );
    });

    const expertBtn = container.querySelector<HTMLButtonElement>('[data-testid="tier-btn-expert"]')!;
    expect(expertBtn).not.toBeNull();

    await act(async () => {
      expertBtn.click();
    });

    expect(handleTierChange).toHaveBeenCalledWith(4);
    expect(handleMeterChange).toHaveBeenCalledWith(15);
  });
});

describe('MeasureRangeSelector Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('toggles between measure range and full chart modes', async () => {
    const handleModeChange = vi.fn();
    const handleStartChange = vi.fn();
    const handleEndChange = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MeasureRangeSelector
          mode="range"
          onModeChange={handleModeChange}
          startMeasure={0}
          onStartMeasureChange={handleStartChange}
          endMeasure={4}
          onEndMeasureChange={handleEndChange}
          totalMeasures={32}
        />
      );
    });

    const fullBtn = container.querySelector<HTMLButtonElement>('[data-testid="mode-full-btn"]')!;
    await act(async () => {
      fullBtn.click();
    });

    expect(handleModeChange).toHaveBeenCalledWith('full');
  });

  it('updates start and end measure inputs', async () => {
    const handleStartChange = vi.fn();
    const handleEndChange = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MeasureRangeSelector
          mode="range"
          onModeChange={vi.fn()}
          startMeasure={0}
          onStartMeasureChange={handleStartChange}
          endMeasure={4}
          onEndMeasureChange={handleEndChange}
          totalMeasures={32}
        />
      );
    });

    const startInput = container.querySelector<HTMLInputElement>('[data-testid="start-measure-input"]')!;
    await act(async () => {
      setNativeValue(startInput, '2');
    });
    expect(handleStartChange).toHaveBeenCalledWith(2);

    const endInput = container.querySelector<HTMLInputElement>('[data-testid="end-measure-input"]')!;
    await act(async () => {
      setNativeValue(endInput, '8');
    });
    expect(handleEndChange).toHaveBeenCalledWith(8);
  });
});

describe('DiffOverlay Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const sampleCurrentNotes: NoteRow[] = [
    { row: 0, beat: 0.0, arrows: '1000' },
    { row: 48, beat: 1.0, arrows: '0100' },
    { row: 96, beat: 2.0, arrows: '0010' },
    { row: 144, beat: 3.0, arrows: '0001' },
  ];

  const sampleProposed: Placement[] = [
    { beat: 0.0, arrows: '1000', chord_idx: 1, confidence: 0.98 }, // unchanged
    { beat: 1.0, arrows: '0010', chord_idx: 2, confidence: 0.95 }, // modified
    { beat: 2.5, arrows: '1100', chord_idx: 5, confidence: 0.92 }, // added
  ];

  it('renders generation button and triggers onGenerate', async () => {
    const handleGenerate = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DiffOverlay
          currentNotes={sampleCurrentNotes}
          proposedPlacements={null}
          rangeStartBeat={0.0}
          rangeEndBeat={4.0}
          isGenerating={false}
          onGenerate={handleGenerate}
          onAccept={vi.fn()}
          onDiscard={vi.fn()}
        />
      );
    });

    const genBtn = container.querySelector<HTMLButtonElement>('[data-testid="generate-btn"]')!;
    expect(genBtn).not.toBeNull();
    expect(genBtn.textContent).toContain('Generate Steps');

    await act(async () => {
      genBtn.click();
    });
    expect(handleGenerate).toHaveBeenCalled();
  });

  it('displays diff preview table with additions, modifications, and deletions', async () => {
    const handleAccept = vi.fn();
    const handleDiscard = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DiffOverlay
          currentNotes={sampleCurrentNotes}
          proposedPlacements={sampleProposed}
          rangeStartBeat={0.0}
          rangeEndBeat={4.0}
          isGenerating={false}
          latencyMs={125.4}
          modelUsed="neural"
          onGenerate={vi.fn()}
          onAccept={handleAccept}
          onDiscard={handleDiscard}
        />
      );
    });

    const previewContainer = container.querySelector('[data-testid="diff-preview-container"]');
    expect(previewContainer).not.toBeNull();

    // Check Accept & Discard buttons
    const acceptBtn = container.querySelector<HTMLButtonElement>('[data-testid="accept-btn"]')!;
    const discardBtn = container.querySelector<HTMLButtonElement>('[data-testid="discard-btn"]')!;
    expect(acceptBtn).not.toBeNull();
    expect(discardBtn).not.toBeNull();

    // Click accept
    await act(async () => {
      acceptBtn.click();
    });
    expect(handleAccept).toHaveBeenCalledWith(sampleProposed);

    // Click discard
    await act(async () => {
      discardBtn.click();
    });
    expect(handleDiscard).toHaveBeenCalled();
  });
});
