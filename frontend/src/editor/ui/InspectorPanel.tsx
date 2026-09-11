/**
 * frontend/src/editor/ui/InspectorPanel.tsx
 * Desktop Right Inspector & Parity Panel (F15).
 * Dense information hierarchy showing chart specs, note count breakdown,
 * Viterbi biomechanical playability analysis, and StepMania color legend.
 */

import React from 'react';
import type { Chart } from '../engine/types';
import type { ParitySolveResult } from '../biomechanics';
import { ALL_SUBDIVISIONS, SUBDIVISION_COLORS, SUBDIVISION_NAMES } from '../engine/subdivisions';

export interface InspectorPanelProps {
  chart?: Chart;
  parityResult: ParitySolveResult;
  onJumpToBeat?: (beat: number) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  chart,
  parityResult,
  onJumpToBeat,
}) => {
  // Count note types in active chart
  const counts = React.useMemo(() => {
    let taps = 0;
    let holds = 0;
    let rolls = 0;
    let mines = 0;
    let lifts = 0;
    let fakes = 0;
    let jumps = 0;

    if (chart?.noteRows) {
      for (const row of chart.noteRows) {
        let activeCols = 0;
        for (const ch of row.arrows) {
          if (ch === '1') { taps++; activeCols++; }
          else if (ch === '2') { holds++; activeCols++; }
          else if (ch === '4') { rolls++; activeCols++; }
          else if (ch === 'M') { mines++; }
          else if (ch === 'L') { lifts++; activeCols++; }
          else if (ch === 'F') { fakes++; }
        }
        if (activeCols >= 2) jumps++;
      }
    }
    return { taps, holds, rolls, mines, lifts, fakes, jumps };
  }, [chart?.noteRows]);

  return (
    <aside
      className="w-72 bg-[#0D1017] border-l border-[#1E2333] flex flex-col p-3 text-xs gap-3 select-none overflow-y-auto shrink-0 font-mono text-[#C9D1D9]"
      data-testid="inspector-panel"
    >
      {/* Chart Specifications Header */}
      <div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E7687]">
          Chart Inspector
        </span>
        <div className="mt-1 bg-[#131722] p-2.5 rounded border border-[#202738] space-y-1 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Style:</span>
            <span className="text-white font-bold">{chart?.stepsType || 'dance-single'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Difficulty:</span>
            <span className="text-[#00E5FF] font-bold">{chart?.difficulty || 'Challenge'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">ITG Meter:</span>
            <span className="text-[#FFD000] font-bold text-sm">{chart?.meter || 15}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Description:</span>
            <span className="text-[#8B949E] truncate max-w-[120px]">{chart?.description || '—'}</span>
          </div>
        </div>
      </div>

      {/* Note Repertoire Counts */}
      <div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E7687]">
          Note Inventory ({chart?.noteRows?.length || 0} rows)
        </span>
        <div className="grid grid-cols-2 gap-1.5 mt-1 text-[11px]">
          <div className="flex justify-between p-1.5 bg-[#131722] rounded border border-[#202738]">
            <span className="text-[#8B949E]">Taps:</span>
            <span className="text-white font-bold">{counts.taps}</span>
          </div>
          <div className="flex justify-between p-1.5 bg-[#131722] rounded border border-[#202738]">
            <span className="text-[#8B949E]">Jumps:</span>
            <span className="text-[#00B0FF] font-bold">{counts.jumps}</span>
          </div>
          <div className="flex justify-between p-1.5 bg-[#131722] rounded border border-[#202738]">
            <span className="text-[#8B949E]">Holds:</span>
            <span className="text-[#38EF7D] font-bold">{counts.holds}</span>
          </div>
          <div className="flex justify-between p-1.5 bg-[#131722] rounded border border-[#202738]">
            <span className="text-[#8B949E]">Rolls:</span>
            <span className="text-[#FF54BE] font-bold">{counts.rolls}</span>
          </div>
          <div className="flex justify-between p-1.5 bg-[#131722] rounded border border-[#202738]">
            <span className="text-[#8B949E]">Mines:</span>
            <span className="text-[#FF3366] font-bold">{counts.mines}</span>
          </div>
          <div className="flex justify-between p-1.5 bg-[#131722] rounded border border-[#202738]">
            <span className="text-[#8B949E]">Lifts:</span>
            <span className="text-[#E0E2EC] font-bold">{counts.lifts}</span>
          </div>
        </div>
      </div>

      {/* Biomechanical Viterbi Parity Analysis */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E7687]">
            Viterbi Parity Analysis
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              parityResult.is_playable
                ? 'bg-[#00E67622] text-[#00E676] border border-[#00E67644]'
                : 'bg-[#FF336622] text-[#FF3366] border border-[#FF336644]'
            }`}
          >
            {parityResult.is_playable ? 'RULES PASSED' : 'REVIEW NEEDED'}
          </span>
        </div>

        <div className="mt-1 bg-[#131722] p-2.5 rounded border border-[#202738] space-y-1 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Strain Cost:</span>
            <span className="text-white font-bold">{parityResult.total_cost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Alternation Rate:</span>
            <span className="text-[#00E676] font-bold">
              {((parityResult.stats?.alternation_rate ?? 1.0) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Crossovers:</span>
            <span className="text-white">{parityResult.stats?.crossovers || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Double Steps:</span>
            <span className={parityResult.stats?.double_steps ? 'text-[#FF7B00] font-bold' : 'text-white'}>
              {parityResult.stats?.double_steps || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Jacks:</span>
            <span className="text-white">{parityResult.stats?.jacks || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Brackets:</span>
            <span className="text-white">{parityResult.stats?.brackets || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8B949E]">Footswitches:</span>
            <span className="text-white">{parityResult.stats?.footswitches || 0}</span>
          </div>
        </div>

        {/* Parity Warnings List */}
        {parityResult.warnings.length > 0 && (
          <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
            {parityResult.warnings.slice(0, 5).map((w, idx) => (
              <div
                key={idx}
                onClick={() => onJumpToBeat && onJumpToBeat(w.beat)}
                className={`p-1.5 rounded text-[10px] cursor-pointer flex justify-between items-center transition-colors ${
                  w.severity === 'error'
                    ? 'bg-[#FF336622] text-[#FF7B99] border border-[#FF336644] hover:bg-[#FF336633]'
                    : 'bg-[#FFD00022] text-[#FFE066] border border-[#FFD00044] hover:bg-[#FFD00033]'
                }`}
                title="Click to jump to beat"
              >
                <span className="truncate max-w-[170px]">{w.message}</span>
                <span className="font-bold underline ml-1">B {w.beat.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Canonical StepMania Color Hues Reference */}
      <div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E7687]">
          Quantization Hues
        </span>
        <div className="grid grid-cols-2 gap-1 mt-1 font-mono text-[10px]">
          {ALL_SUBDIVISIONS.map((sub) => (
            <div
              key={sub}
              className="flex items-center gap-1.5 px-1.5 py-0.5 bg-[#131722] rounded border border-[#202738]"
              title={SUBDIVISION_NAMES[sub]}
            >
              <div
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: SUBDIVISION_COLORS[sub] }}
              />
              <span className="text-[#8B949E]">{sub}th</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
