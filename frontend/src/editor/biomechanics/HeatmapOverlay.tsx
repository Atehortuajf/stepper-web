/**
 * frontend/src/editor/biomechanics/HeatmapOverlay.tsx
 * Transition cost heatmap visualizer representing physical strain & movement distance.
 */

import React, { useMemo } from 'react';
import type { BiomechanicalStep, ParityStatsData } from './types';

export interface HeatmapOverlayProps {
  steps: BiomechanicalStep[];
  stats?: ParityStatsData;
  totalCost: number;
  isPlayable: boolean;
  onSelectBeat?: (beat: number) => void;
  className?: string;
}

export const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({
  steps,
  stats,
  totalCost,
  isPlayable,
  onSelectBeat,
  className = '',
}) => {
  // Aggregate strain distribution
  const strainDistribution = useMemo(() => {
    if (!steps || steps.length === 0) {
      return { low: 100, med: 0, high: 0, extreme: 0, maxCost: 0, avgCost: 0 };
    }

    let low = 0;
    let med = 0;
    let high = 0;
    let extreme = 0;
    let maxCost = 0;
    let sumCost = 0;

    for (const s of steps) {
      const c = s.cost;
      sumCost += c;
      if (c > maxCost) maxCost = c;

      if (c <= 0.6) low++;
      else if (c <= 1.2) med++;
      else if (c <= 2.0) high++;
      else extreme++;
    }

    const n = steps.length;
    return {
      low: Math.round((low / n) * 100),
      med: Math.round((med / n) * 100),
      high: Math.round((high / n) * 100),
      extreme: Math.round((extreme / n) * 100),
      maxCost: Math.round(maxCost * 100) / 100,
      avgCost: Math.round((sumCost / n) * 100) / 100,
    };
  }, [steps]);

  // Downsample or slice steps into discrete heat columns (e.g. up to 64 buckets)
  const heatBars = useMemo(() => {
    if (!steps || steps.length === 0) return [];
    const maxBars = 64;
    const stride = Math.max(1, Math.floor(steps.length / maxBars));
    const bars: Array<{ beat: number; cost: number; color: string }> = [];

    for (let i = 0; i < steps.length; i += stride) {
      const slice = steps.slice(i, i + stride);
      const avgC = slice.reduce((acc, s) => acc + s.cost, 0) / slice.length;
      let color = '#00e676';
      if (avgC > 2.0) color = '#ff2a55';
      else if (avgC > 1.2) color = '#ff7b00';
      else if (avgC > 0.6) color = '#ffd000';

      bars.push({
        beat: slice[0].beat,
        cost: avgC,
        color,
      });
    }

    return bars;
  }, [steps]);

  return (
    <div
      className={`flex flex-col bg-[#12151e] p-2.5 rounded border border-[#202738] text-xs text-[#c9d1d9] gap-2 ${className}`}
      data-testid="heatmap-overlay"
    >
      {/* Header telemetry */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-[11px] text-white">
            Transition Cost Heatmap
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
              isPlayable
                ? 'bg-[#00e67622] text-[#00e676] border border-[#00e67644]'
                : 'bg-[#ff2a5522] text-[#ff2a55] border border-[#ff2a5544] animate-pulse'
            }`}
            data-testid="playability-status"
          >
            {isPlayable ? 'Rules passed' : 'Review needed'}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-[#8b949e]">
            Total Cost: <strong className="text-white">{totalCost.toFixed(2)}</strong>
          </span>
          <span className="text-[#8b949e]">
            Avg: <strong className="text-[#00e5ff]">{strainDistribution.avgCost.toFixed(2)}</strong>
          </span>
          <span className="text-[#8b949e]">
            Peak: <strong className="text-[#ff7b00]">{strainDistribution.maxCost.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      {/* Discrete Heatmap Bar Strip */}
      <div className="flex items-end gap-[1px] h-9 bg-[#0a0c10] p-1 rounded border border-[#1e2333] overflow-hidden">
        {heatBars.map((bar, idx) => {
          const heightPct = Math.min(100, Math.max(15, (bar.cost / 3.0) * 100));
          return (
            <div
              key={idx}
              onClick={() => onSelectBeat?.(bar.beat)}
              className="flex-1 cursor-pointer hover:opacity-80 transition-opacity rounded-t-[1px]"
              style={{
                height: `${heightPct}%`,
                backgroundColor: bar.color,
              }}
              title={`Beat ${bar.beat.toFixed(2)} — Strain: ${bar.cost.toFixed(2)}`}
              data-testid={`heat-bar-${idx}`}
            />
          );
        })}
      </div>

      {/* Strain Category Distribution Bar */}
      <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00e676]" />
            <span className="text-[#8b949e]">Low {strainDistribution.low}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ffd000]" />
            <span className="text-[#8b949e]">Med {strainDistribution.med}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ff7b00]" />
            <span className="text-[#8b949e]">High {strainDistribution.high}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ff2a55]" />
            <span className="text-[#8b949e]">Extreme {strainDistribution.extreme}%</span>
          </div>
        </div>

        {stats && (
          <div className="text-[#586074]">
            Alt Rate: <strong className="text-[#79c0ff]">{(stats.alternation_rate * 100).toFixed(1)}%</strong>
          </div>
        )}
      </div>
    </div>
  );
};
