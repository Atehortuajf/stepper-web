/**
 * frontend/src/editor/conditioning/TechConditioningPanel.tsx
 * Professional DAW-grade 16-D Technique Conditioning Panel.
 * Provides continuous sliders [0.0, 1.0], competitive style presets,
 * and difficulty tier/meter selectors.
 */

import React, { useMemo, useState } from 'react';
import {
  DIFFICULTY_TIERS,
  NUM_TECH_FEATURES,
  TECH_FEATURE_METAS,
  TECH_PRESETS,
  TECH_TAG_KEYS,
  describeTechVector,
} from './techFeatures';
import type { TechTagKey, TechVectorDict } from './techFeatures';

export interface TechConditioningPanelProps {
  techVector: TechVectorDict;
  onChange: (vector: TechVectorDict) => void;
  difficultyTier: number;
  onDifficultyTierChange: (tier: number) => void;
  difficultyMeter: number;
  onDifficultyMeterChange: (meter: number) => void;
  placementThreshold?: number;
  onPlacementThresholdChange?: (threshold: number) => void;
  className?: string;
}

export const TechConditioningPanel: React.FC<TechConditioningPanelProps> = ({
  techVector,
  onChange,
  difficultyTier,
  onDifficultyTierChange,
  difficultyMeter,
  onDifficultyMeterChange,
  placementThreshold = 0.50,
  onPlacementThresholdChange,
  className = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activePresetId, setActivePresetId] = useState<string>('');

  const itlTagSummary = useMemo(() => describeTechVector(techVector), [techVector]);

  // Handle single feature slider change
  const handleSliderChange = (key: TechTagKey, value: number) => {
    setActivePresetId('');
    onChange({
      ...techVector,
      [key]: Math.max(0.0, Math.min(1.0, value)),
    });
  };

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    const preset = TECH_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setActivePresetId(presetId);
      onChange({ ...preset.vector });
    }
  };

  // Handle difficulty tier selection
  const handleTierSelect = (tier: number) => {
    onDifficultyTierChange(tier);
    const tierMeta = DIFFICULTY_TIERS.find((t) => t.tier === tier);
    if (tierMeta) {
      onDifficultyMeterChange(tierMeta.defaultMeter);
    }
  };

  const categories = ['All', 'Switches', 'Brackets', 'Jacks', 'Rhythm & Stream', 'Baseline'] as const;

  const filteredKeys = useMemo(() => {
    if (activeCategory === 'All') return TECH_TAG_KEYS;
    return TECH_TAG_KEYS.filter((k) => TECH_FEATURE_METAS[k].category === activeCategory);
  }, [activeCategory]);

  return (
    <div
      className={`flex flex-col bg-[#0d1017] border border-[#212636] rounded-md p-3 text-xs text-[#c9d1d9] gap-3 select-none ${className}`}
      data-testid="tech-conditioning-panel"
    >
      {/* Header & ITL Tag Badge */}
      <div className="flex items-center justify-between border-b border-[#212636] pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-white text-[11px]">
            Technique Conditioning
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1c2230] text-[#79c0ff] border border-[#2b354b] font-mono">
            {NUM_TECH_FEATURES}-D Vector
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131722] border border-[#262f43] font-mono text-[11px]"
          title="Generated ITL Competitive Shorthand Tags"
        >
          <span className="text-[#6e7687]">Tags:</span>
          <span className="font-bold text-[#00e5ff]">{itlTagSummary}</span>
        </div>
      </div>

      {/* Difficulty Level & Meter Selector */}
      <div className="space-y-1.5 bg-[#12151e] p-2.5 rounded border border-[#1e2333]">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#8b949e]">
          <span>Target Difficulty</span>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-[#6e7687]">Meter:</span>
            <input
              type="number"
              min={1}
              max={30}
              value={difficultyMeter}
              onChange={(e) => onDifficultyMeterChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-12 px-1.5 py-0.5 bg-[#0a0c10] border border-[#2b354b] rounded text-white font-bold text-center focus:outline-none focus:border-[#00e5ff]"
              data-testid="difficulty-meter-input"
            />
          </div>
        </div>

        {/* Tier Buttons */}
        <div className="grid grid-cols-5 gap-1 pt-1">
          {DIFFICULTY_TIERS.map((t) => {
            const isSelected = difficultyTier === t.tier;
            return (
              <button
                key={t.tier}
                type="button"
                onClick={() => handleTierSelect(t.tier)}
                style={{
                  borderColor: isSelected ? t.color : '#202738',
                  color: isSelected ? '#ffffff' : '#8b949e',
                  backgroundColor: isSelected ? `${t.color}22` : '#131722',
                }}
                className={`px-1.5 py-1 rounded border text-[10px] font-medium transition-colors text-center hover:bg-[#1a202d] ${
                  isSelected ? 'font-bold shadow-sm' : ''
                }`}
                data-testid={`tier-btn-${t.name.toLowerCase()}`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Style Presets */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7687]">
            Chart Style Presets
          </span>
          {activePresetId && (
            <span className="text-[10px] text-[#00e5ff] font-mono">
              Active: {TECH_PRESETS.find((p) => p.id === activePresetId)?.name}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {TECH_PRESETS.map((preset) => {
            const isCurrent = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset.id)}
                title={preset.description}
                className={`px-2 py-1 rounded border text-[10px] transition-colors ${
                  isCurrent
                    ? 'bg-[#1f2638] border-[#388bfd] text-white font-bold'
                    : 'bg-[#131722] border-[#202738] text-[#8b949e] hover:bg-[#191e2b] hover:text-[#c9d1d9]'
                }`}
                data-testid={`preset-btn-${preset.id}`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-[#212636] pb-1 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-[#21283b] text-white font-semibold'
                : 'text-[#6e7687] hover:text-[#8b949e]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Continuous Sliders */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {filteredKeys.map((key) => {
          const meta = TECH_FEATURE_METAS[key];
          const val = techVector[key] ?? 0.0;
          const pct = Math.round(val * 100);

          return (
            <div
              key={key}
              className="bg-[#12151e] p-2 rounded border border-[#1d2331] hover:border-[#2b354b] transition-colors"
              data-testid={`slider-container-${key}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5" title={meta.description}>
                  <span className="font-semibold text-white text-[11px]">{meta.label}</span>
                  <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-[#1c2230] text-[#79c0ff]">
                    {meta.shorthand}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <span
                    className={`font-bold ${
                      val > 0.0 ? 'text-[#00e5ff]' : 'text-[#586074]'
                    }`}
                  >
                    {val.toFixed(2)}
                  </span>
                  <span className="text-[#586074]">({pct}%)</span>
                  {val > 0.0 && (
                    <button
                      type="button"
                      onClick={() => handleSliderChange(key, 0.0)}
                      className="ml-1 text-[9px] text-[#586074] hover:text-[#ff3366]"
                      title="Reset to 0"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={val}
                onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#1b202e] rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
                data-testid={`slider-${key}`}
              />
            </div>
          );
        })}
      </div>

      {/* Placement Sensitivity / Threshold Control */}
      <div className="flex items-center justify-between border-t border-[#212636] pt-2 mt-1">
        <div className="flex flex-col">
          <span className="font-semibold text-[#8b949e] text-[11px]">Placement Sensitivity</span>
          <span className="text-[10px] text-[#586074]">Peak picking threshold (lower = denser)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.25"
            max="0.75"
            step="0.05"
            value={placementThreshold}
            onChange={(e) => onPlacementThresholdChange?.(parseFloat(e.target.value))}
            className="w-24 accent-[#00e5ff] cursor-pointer"
            data-testid="slider-placement-threshold"
          />
          <span className="font-mono text-[11px] text-[#00e5ff] w-8 text-right">
            {placementThreshold.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
