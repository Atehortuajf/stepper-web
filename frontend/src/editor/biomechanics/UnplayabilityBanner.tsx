/**
 * frontend/src/editor/biomechanics/UnplayabilityBanner.tsx
 * High-visibility warning banner alerting to anatomical impossibilities,
 * double-steps, and impossible crossovers.
 */

import React, { useState } from 'react';
import type { UnplayabilityWarningItem } from './types';

export interface UnplayabilityBannerProps {
  isPlayable: boolean;
  warnings: UnplayabilityWarningItem[];
  onJumpToBeat?: (beat: number) => void;
  className?: string;
}

export const UnplayabilityBanner: React.FC<UnplayabilityBannerProps> = ({
  isPlayable,
  warnings,
  onJumpToBeat,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isPlayable && warnings.length === 0) {
    return null;
  }

  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warnCount = warnings.length - errorCount;
  const hasFatal = !isPlayable || errorCount > 0;

  return (
    <div
      className={`flex flex-col rounded border p-2.5 text-xs transition-all ${
        hasFatal
          ? 'bg-[#2b1016] border-[#ff2a55] text-[#ffccd5]'
          : 'bg-[#261f0d] border-[#ffd000] text-[#fff0cc]'
      } ${className}`}
      data-testid="unplayability-banner"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{hasFatal ? '⛔' : '⚠️'}</span>
          <div>
            <div className="font-bold text-[11px] tracking-wide">
              {hasFatal ? 'PHYSICAL UNPLAYABILITY DETECTED' : 'BIOMECHANICAL WARNINGS'}
            </div>
            <div className="text-[10px] opacity-80">
              {hasFatal
                ? 'Chart contains anatomically impossible transitions or severe cross-locks.'
                : 'Chart contains ergonomic anomalies (rapid double-steps or jacks).'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-[#ff2a5533] border border-[#ff2a55] font-bold text-[#ff2a55]">
                {errorCount} Fatal
              </span>
            )}
            {warnCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-[#ffd00033] border border-[#ffd000] font-bold text-[#ffd000]">
                {warnCount} Warning{warnCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2 py-0.5 rounded border border-current opacity-80 hover:opacity-100 text-[10px] font-semibold"
            data-testid="toggle-warnings-btn"
          >
            {isExpanded ? 'Hide Details' : `View ${warnings.length} Issues`}
          </button>
        </div>
      </div>

      {/* Expanded Warning Items List */}
      {isExpanded && warnings.length > 0 && (
        <div className="mt-2 pt-2 border-t border-current/20 space-y-1 max-h-40 overflow-y-auto font-mono text-[11px]">
          {warnings.map((w, idx) => (
            <div
              key={idx}
              onClick={() => onJumpToBeat?.(w.beat)}
              className="flex items-center justify-between px-2 py-1 rounded bg-black/20 hover:bg-black/40 cursor-pointer transition-colors"
              data-testid={`warning-item-${idx}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    w.severity === 'error' ? 'bg-[#ff2a55]' : 'bg-[#ffd000]'
                  }`}
                />
                <span className="font-bold">Beat {w.beat.toFixed(2)}</span>
                <span className="opacity-80">— {w.message}</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider opacity-60 underline">
                Jump →
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
