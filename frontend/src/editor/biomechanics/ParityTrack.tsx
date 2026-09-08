/**
 * frontend/src/editor/biomechanics/ParityTrack.tsx
 * Visual foot parity ribbon component for the stepchart note grid.
 * Displays Left foot (#00b0ff), Right foot (#ff3366), Brackets, and Heel-Toe labels.
 */

import React from 'react';
import type { BiomechanicalStep } from './types';

export interface ParityTrackProps {
  step?: BiomechanicalStep | null;
  showHeelToe?: boolean;
  showCost?: boolean;
  compact?: boolean;
  className?: string;
}

export const ParityTrack: React.FC<ParityTrackProps> = ({
  step,
  showHeelToe = true,
  showCost = true,
  compact = false,
  className = '',
}) => {
  if (!step) {
    return (
      <div
        className={`flex items-center justify-center font-mono text-[10px] text-[#30364d] ${className}`}
        data-testid="parity-track-empty"
      >
        —
      </div>
    );
  }

  const { foot, heelToe, cost, warning, flags } = step;

  // Colors: Left (#00b0ff), Right (#ff3366)
  const isLeft = foot === 'L';
  const isRight = foot === 'R';
  const isJump = foot === 'LR';
  const isBracket = flags.is_bracket;

  // Cost color mapping (strain meter)
  let costColor = '#00e676'; // Low (green)
  if (cost > 2.0) {
    costColor = '#ff2a55'; // High strain (red)
  } else if (cost > 1.2) {
    costColor = '#ff7b00'; // Medium-high (orange)
  } else if (cost > 0.6) {
    costColor = '#ffd000'; // Medium (yellow)
  }

  return (
    <div
      className={`flex items-center gap-1.5 font-mono select-none ${className}`}
      data-testid={`parity-track-${step.beat.toFixed(2)}`}
      title={`Foot: ${foot}, Cost: ${cost.toFixed(2)}${warning ? ` — Warning: ${warning}` : ''}`}
    >
      {/* Foot Designation Ribbon Badge */}
      <div className="flex items-center gap-1">
        {isLeft && (
          <span
            className="px-1.5 py-0.5 rounded font-bold text-[10px] tracking-wider border shadow-sm transition-all"
            style={{
              backgroundColor: '#00b0ff22',
              borderColor: '#00b0ff',
              color: '#00b0ff',
            }}
            data-testid="foot-left"
          >
            L
          </span>
        )}

        {isRight && (
          <span
            className="px-1.5 py-0.5 rounded font-bold text-[10px] tracking-wider border shadow-sm transition-all"
            style={{
              backgroundColor: '#ff336622',
              borderColor: '#ff3366',
              color: '#ff3366',
            }}
            data-testid="foot-right"
          >
            R
          </span>
        )}

        {isJump && (
          <div className="flex items-center text-[10px] font-bold tracking-wider" data-testid="foot-jump">
            <span
              className="px-1 py-0.5 rounded-l border border-r-0"
              style={{
                backgroundColor: '#00b0ff22',
                borderColor: '#00b0ff',
                color: '#00b0ff',
              }}
            >
              L
            </span>
            <span
              className="px-1 py-0.5 rounded-r border"
              style={{
                backgroundColor: '#ff336622',
                borderColor: '#ff3366',
                color: '#ff3366',
              }}
            >
              R
            </span>
          </div>
        )}

        {/* Bracket Designation */}
        {isBracket && (
          <span
            className="px-1 py-0.5 rounded bg-[#9e3cff22] border border-[#9e3cff] text-[#9e3cff] font-bold text-[9px] uppercase"
            title="Bracket Step (two arrows with one foot)"
            data-testid="bracket-badge"
          >
            BR
          </span>
        )}

        {/* Heel-Toe Indicator */}
        {showHeelToe && heelToe && (
          <span
            className="px-1 py-0.2 rounded text-[9px] font-semibold border"
            style={{
              backgroundColor: heelToe.startsWith('L') ? '#00b0ff15' : '#ff336615',
              borderColor: heelToe.startsWith('L') ? '#00b0ff55' : '#ff336655',
              color: heelToe.startsWith('L') ? '#79c0ff' : '#ff7b90',
            }}
            data-testid="heel-toe-badge"
            title={`Heel-Toe: ${heelToe}`}
          >
            {heelToe}
          </span>
        )}
      </div>

      {/* Transition Cost Strain Meter */}
      {showCost && !compact && (
        <div className="flex items-center gap-1">
          <div
            className="w-1.5 h-3 rounded-sm"
            style={{ backgroundColor: costColor }}
            title={`Transition strain: ${cost.toFixed(2)}`}
            data-testid="strain-indicator"
          />
          <span className="text-[9px] text-[#6e7687]" style={{ color: costColor }}>
            {cost.toFixed(1)}
          </span>
        </div>
      )}

      {/* Physical Warning Flag */}
      {warning && (
        <span
          className={`px-1 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider ${
            warning.includes('unplayable')
              ? 'bg-[#ff2a5522] border-[#ff2a55] text-[#ff2a55] animate-pulse'
              : 'bg-[#ffd00022] border-[#ffd000] text-[#ffd000]'
          }`}
          title={warning}
          data-testid="step-warning-badge"
        >
          {warning.includes('Double')
            ? 'DS'
            : warning.includes('Jack')
            ? 'JACK'
            : warning.includes('unplayable')
            ? 'FAIL'
            : 'WARN'}
        </span>
      )}
    </div>
  );
};
