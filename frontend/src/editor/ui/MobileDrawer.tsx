/**
 * frontend/src/editor/ui/MobileDrawer.tsx
 * Slide-up adaptive drawer for Stepper AI conditioning sliders and
 * biomechanical parity analysis (F17 / F18).
 * Provides continuous sliders, generation trigger, diff commit, and parity inspection.
 */

import React from 'react';
import type { TechVectorDict } from '../conditioning';
import { TECH_FEATURE_METAS, TECH_TAG_KEYS } from '../conditioning';
import type { ParitySolveResult } from '../biomechanics';
import type { Placement } from '../api/stepperApi';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  techVector: TechVectorDict;
  onChangeTechVector: (vector: TechVectorDict) => void;
  difficultyMeter: number;
  onChangeDifficultyMeter: (meter: number) => void;
  placementThreshold?: number;
  onPlacementThresholdChange?: (threshold: number) => void;
  isGenerating: boolean;
  proposedPlacements: Placement[] | null;
  parityResult: ParitySolveResult;
  onGenerate: () => void;
  onCommitDiff: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  techVector,
  onChangeTechVector,
  difficultyMeter,
  onChangeDifficultyMeter,
  placementThreshold = 0.50,
  onPlacementThresholdChange,
  isGenerating,
  proposedPlacements,
  parityResult,
  onGenerate,
  onCommitDiff,
}) => {
  const handleSliderChange = (key: keyof TechVectorDict, val: number) => {
    onChangeTechVector({
      ...techVector,
      [key]: Math.min(1.0, Math.max(0.0, val)),
    });
  };

  return (
    <div
      id="aiDrawer"
      className={`drawer-panel fixed bottom-0 left-0 right-0 bg-[#161822] border-t-2 border-[#00A2FF] p-4 z-50 transition-transform duration-200 shadow-2xl overflow-y-auto max-h-[85vh] font-mono text-xs text-[#E0E2EC] ${
        isOpen ? 'open translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
      style={{
        transform: isOpen ? 'translateY(0%)' : 'translateY(100%)',
      }}
      data-testid="ai-drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#232738]">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00A2FF]" />
            Stepper AI Technique Conditioning
          </h3>
          <span className="text-[10px] text-[#8A92A6]">16-D continuous conditioning & parity validator</span>
        </div>
        <button
          id="closeAiDrawer"
          type="button"
          onClick={onClose}
          className="min-h-[48px] min-w-[48px] bg-[#232738] hover:bg-[#33384D] text-white font-bold rounded flex items-center justify-center text-lg transition-colors cursor-pointer"
          data-testid="btn-close-ai-drawer"
          aria-label="Close AI Drawer"
        >
          ✕
        </button>
      </div>

      {/* Difficulty Meter Stepper */}
      <div className="flex items-center justify-between py-2 border-b border-[#232738]">
        <span className="font-semibold text-[#8A92A6]">ITG Difficulty Meter:</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeDifficultyMeter(Math.max(1, difficultyMeter - 1))}
            className="w-10 h-10 rounded bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-white font-bold flex items-center justify-center text-base"
          >
            -
          </button>
          <span className="font-bold text-base text-[#FFD000] w-8 text-center">{difficultyMeter}</span>
          <button
            type="button"
            onClick={() => onChangeDifficultyMeter(Math.min(25, difficultyMeter + 1))}
            className="w-10 h-10 rounded bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-white font-bold flex items-center justify-center text-base"
          >
            +
          </button>
        </div>
      </div>

      {/* Placement Sensitivity / Threshold */}
      <div className="flex items-center justify-between py-2 border-b border-[#232738]">
        <div className="flex flex-col">
          <span className="font-semibold text-[#8A92A6]">Placement Sensitivity:</span>
          <span className="text-[10px] text-[#6E7687]">Peak picking threshold (0.25 to 0.75)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.25"
            max="0.75"
            step="0.05"
            value={placementThreshold}
            onChange={(e) => onPlacementThresholdChange?.(parseFloat(e.target.value))}
            className="w-24 accent-[#00A2FF] cursor-pointer"
            data-testid="mobile-slider-placement-threshold"
          />
          <span className="font-bold text-sm text-[#00A2FF] w-8 text-right">
            {placementThreshold.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 16-D Technique Conditioning Sliders */}
      <div className="py-2 space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E7687]">
          Technique Weights (0.0 to 1.0)
        </span>

        {/* Primary Sliders with Specific Element IDs */}
        <div className="slider-row flex items-center justify-between gap-2 py-1">
          <label htmlFor="slider-crossover" className="text-xs text-[#C0C4D6] min-w-[120px]">
            Crossover:
          </label>
          <input
            type="range"
            id="slider-crossover"
            min="0"
            max="1"
            step="0.05"
            value={techVector.crossover ?? 0.5}
            onChange={(e) => handleSliderChange('crossover', parseFloat(e.target.value))}
            className="flex-1 accent-[#00A2FF] min-h-[48px] cursor-pointer"
            data-testid="slider-crossover"
          />
          <span className="text-[11px] text-[#00E5FF] w-9 text-right font-bold">
            {(techVector.crossover ?? 0.5).toFixed(2)}
          </span>
        </div>

        <div className="slider-row flex items-center justify-between gap-2 py-1">
          <label htmlFor="slider-footswitch" className="text-xs text-[#C0C4D6] min-w-[120px]">
            Footswitch:
          </label>
          <input
            type="range"
            id="slider-footswitch"
            min="0"
            max="1"
            step="0.05"
            value={techVector.footswitch ?? 0.2}
            onChange={(e) => handleSliderChange('footswitch', parseFloat(e.target.value))}
            className="flex-1 accent-[#00A2FF] min-h-[48px] cursor-pointer"
            data-testid="slider-footswitch"
          />
          <span className="text-[11px] text-[#00E5FF] w-9 text-right font-bold">
            {(techVector.footswitch ?? 0.2).toFixed(2)}
          </span>
        </div>

        <div className="slider-row flex items-center justify-between gap-2 py-1">
          <label htmlFor="slider-bracket" className="text-xs text-[#C0C4D6] min-w-[120px]">
            Bracket:
          </label>
          <input
            type="range"
            id="slider-bracket"
            min="0"
            max="1"
            step="0.05"
            value={techVector.bracket ?? 0.1}
            onChange={(e) => handleSliderChange('bracket', parseFloat(e.target.value))}
            className="flex-1 accent-[#00A2FF] min-h-[48px] cursor-pointer"
            data-testid="slider-bracket"
          />
          <span className="text-[11px] text-[#00E5FF] w-9 text-right font-bold">
            {(techVector.bracket ?? 0.1).toFixed(2)}
          </span>
        </div>

        <div className="slider-row flex items-center justify-between gap-2 py-1">
          <label htmlFor="slider-stream_stamina" className="text-xs text-[#C0C4D6] min-w-[120px]">
            Stream Stamina:
          </label>
          <input
            type="range"
            id="slider-stream_stamina"
            min="0"
            max="1"
            step="0.05"
            value={techVector.stream_stamina ?? 0.8}
            onChange={(e) => handleSliderChange('stream_stamina', parseFloat(e.target.value))}
            className="flex-1 accent-[#00A2FF] min-h-[48px] cursor-pointer"
            data-testid="slider-stream-stamina"
          />
          <span className="text-[11px] text-[#00E5FF] w-9 text-right font-bold">
            {(techVector.stream_stamina ?? 0.8).toFixed(2)}
          </span>
        </div>

        {/* Remaining 12 features in an expandable or compact grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-[#232738]">
          {TECH_TAG_KEYS.filter(
            (k) => !['crossover', 'footswitch', 'bracket', 'stream_stamina'].includes(k)
          ).map((key) => {
            const meta = TECH_FEATURE_METAS[key];
            const val = techVector[key] ?? 0.0;
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#8A92A6] min-w-[90px]">{meta.label}:</span>
                <input
                  type="range"
                  id={`slider-${key}`}
                  min="0"
                  max="1"
                  step="0.05"
                  value={val}
                  onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                  className="flex-1 accent-[#00E5FF] min-h-[36px] cursor-pointer"
                />
                <span className="text-[10px] text-white w-7 text-right">{val.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generation Actions: Generate & Commit */}
      <div className="mt-3 pt-3 border-t border-[#232738] flex gap-3">
        <button
          id="btnGenerate"
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="tool-btn flex-1 min-h-[48px] bg-[#00A2FF] hover:bg-[#0090e0] text-black font-bold rounded flex items-center justify-center text-sm transition-colors cursor-pointer disabled:opacity-50"
          data-testid="btn-generate"
        >
          {isGenerating ? 'GENERATING...' : 'GENERATE'}
        </button>

        <button
          id="btnCommit"
          type="button"
          onClick={onCommitDiff}
          disabled={!proposedPlacements || proposedPlacements.length === 0}
          className="tool-btn flex-1 min-h-[48px] bg-[#00E676] hover:bg-[#00c966] text-black font-bold rounded flex items-center justify-center text-sm transition-colors cursor-pointer disabled:opacity-50"
          data-testid="btn-commit"
        >
          COMMIT {proposedPlacements ? `(${proposedPlacements.length})` : ''}
        </button>
      </div>

      {/* Parity Analysis Summary */}
      <div className="mt-3 p-2 bg-[#12141D] rounded border border-[#232738] flex items-center justify-between text-[11px]">
        <div>
          <span className="text-[#8A92A6]">Parity Status: </span>
          <span className={parityResult.is_playable ? 'text-[#00E676] font-bold' : 'text-[#FF3366] font-bold'}>
            {parityResult.is_playable ? 'PLAYABLE' : 'UNPLAYABLE'}
          </span>
        </div>
        <div>
          <span className="text-[#8A92A6]">Strain: </span>
          <span className="font-bold text-white">{parityResult.total_cost.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[#8A92A6]">Alt Rate: </span>
          <span className="font-bold text-[#00E676]">
            {((parityResult.stats?.alternation_rate ?? 1.0) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};
