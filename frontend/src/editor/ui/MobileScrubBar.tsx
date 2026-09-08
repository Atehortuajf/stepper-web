/**
 * frontend/src/editor/ui/MobileScrubBar.tsx
 * Mobile Scrub Bar & Navigation Strip (F17 / F18).
 * Provides measure jumping, snap stepping, and a smooth scrub slider.
 * All touch buttons meet WCAG 2.5.5 >= 48px.
 */

import React from 'react';
import type { SubdivisionTier } from '../engine/types';

export interface MobileScrubBarProps {
  currentBeat: number;
  totalBeats: number;
  subdivisionSnap: SubdivisionTier;
  onJumpMeasure: (delta: number) => void;
  onStepSnap: (delta: number) => void;
  onScrubBeat: (beat: number) => void;
}

export const MobileScrubBar: React.FC<MobileScrubBarProps> = ({
  currentBeat,
  totalBeats,
  subdivisionSnap,
  onJumpMeasure,
  onStepSnap,
  onScrubBeat,
}) => {
  const maxBeat = Math.max(16, totalBeats);

  return (
    <div
      className="mobile-scrub flex flex-col gap-1 px-2 py-1.5 bg-[#161822] border-t border-[#232738] select-none w-full shrink-0 font-mono text-xs"
      data-testid="mobile-scrub-bar"
    >
      {/* Beat Scrub Slider */}
      <div className="flex items-center gap-2 w-full">
        <span className="text-[10px] text-[#8A92A6] w-12 shrink-0">B {currentBeat.toFixed(2)}</span>
        <input
          type="range"
          min="0"
          max={maxBeat}
          step="0.25"
          value={currentBeat}
          onChange={(e) => onScrubBeat(parseFloat(e.target.value))}
          className="flex-1 accent-[#00E5FF] h-2 bg-[#0C0D12] rounded-lg cursor-pointer"
          data-testid="mobile-scrub-slider"
          aria-label="Scrub song beat"
        />
        <span className="text-[10px] text-[#8A92A6] w-12 text-right shrink-0">B {maxBeat.toFixed(0)}</span>
      </div>

      {/* Navigation Jump Buttons */}
      <div className="flex items-center justify-between gap-1 w-full">
        <button
          type="button"
          onClick={() => onJumpMeasure(-1)}
          className="tool-btn flex-1 py-1 bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-[#E0E2EC] font-bold rounded text-xs min-h-[48px] flex items-center justify-center transition-colors"
          data-testid="btn-jump-prev-measure"
          title="Jump backward 1 measure (PageDown)"
        >
          -1 M
        </button>

        <button
          type="button"
          onClick={() => onStepSnap(-1)}
          className="tool-btn flex-1 py-1 bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-[#E0E2EC] font-bold rounded text-xs min-h-[48px] flex items-center justify-center transition-colors"
          data-testid="btn-step-prev-snap"
          title="Step backward by subdivision snap (Down)"
        >
          -1/{subdivisionSnap}
        </button>

        <button
          type="button"
          onClick={() => onStepSnap(1)}
          className="tool-btn flex-1 py-1 bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-[#E0E2EC] font-bold rounded text-xs min-h-[48px] flex items-center justify-center transition-colors"
          data-testid="btn-step-next-snap"
          title="Step forward by subdivision snap (Up)"
        >
          +1/{subdivisionSnap}
        </button>

        <button
          type="button"
          onClick={() => onJumpMeasure(1)}
          className="tool-btn flex-1 py-1 bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-[#E0E2EC] font-bold rounded text-xs min-h-[48px] flex items-center justify-center transition-colors"
          data-testid="btn-jump-next-measure"
          title="Jump forward 1 measure (PageUp)"
        >
          +1 M
        </button>
      </div>
    </div>
  );
};
