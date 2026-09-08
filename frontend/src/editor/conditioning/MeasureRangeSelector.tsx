/**
 * frontend/src/editor/conditioning/MeasureRangeSelector.tsx
 * UI controls for selecting measure generation window (range vs entire chart).
 */

import React from 'react';

export interface MeasureRangeSelectorProps {
  mode: 'range' | 'full';
  onModeChange: (mode: 'range' | 'full') => void;
  startMeasure: number;
  onStartMeasureChange: (m: number) => void;
  endMeasure: number;
  onEndMeasureChange: (m: number) => void;
  totalMeasures: number;
  className?: string;
}

export const MeasureRangeSelector: React.FC<MeasureRangeSelectorProps> = ({
  mode,
  onModeChange,
  startMeasure,
  onStartMeasureChange,
  endMeasure,
  onEndMeasureChange,
  totalMeasures,
  className = '',
}) => {
  const safeTotal = Math.max(1, totalMeasures);

  const startBeat = mode === 'full' ? 0.0 : startMeasure * 4.0;
  const numBeats = mode === 'full' ? safeTotal * 4.0 : Math.max(4.0, (endMeasure - startMeasure) * 4.0);

  const handleSetQuickRange = (start: number, count: number) => {
    onModeChange('range');
    onStartMeasureChange(start);
    onEndMeasureChange(Math.min(safeTotal, start + count));
  };

  return (
    <div
      className={`flex flex-col bg-[#12151e] p-2.5 rounded border border-[#202738] text-xs gap-2 ${className}`}
      data-testid="measure-range-selector"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] uppercase tracking-wider text-[#8b949e]">
          Generation Window
        </span>
        <div className="flex items-center gap-1 font-mono text-[10px] text-[#00e5ff]">
          <span>Beats {startBeat.toFixed(0)}–{(startBeat + numBeats).toFixed(0)}</span>
          <span className="text-[#586074]">({numBeats.toFixed(0)} beats)</span>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-1 bg-[#0a0c10] p-0.5 rounded border border-[#1e2333]">
        <button
          type="button"
          onClick={() => onModeChange('range')}
          className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors ${
            mode === 'range'
              ? 'bg-[#1f2638] text-white font-bold'
              : 'text-[#6e7687] hover:text-[#8b949e]'
          }`}
          data-testid="mode-range-btn"
        >
          Selected Measures
        </button>
        <button
          type="button"
          onClick={() => onModeChange('full')}
          className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors ${
            mode === 'full'
              ? 'bg-[#1f2638] text-white font-bold'
              : 'text-[#6e7687] hover:text-[#8b949e]'
          }`}
          data-testid="mode-full-btn"
        >
          Full Chart ({safeTotal} Meas)
        </button>
      </div>

      {/* Measure Range Numeric Inputs (if range mode) */}
      {mode === 'range' && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[#6e7687] text-[10px]">From M:</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, endMeasure - 1)}
              value={startMeasure}
              onChange={(e) => {
                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                onStartMeasureChange(Math.min(val, endMeasure - 1));
              }}
              className="w-14 px-1.5 py-0.5 bg-[#0a0c10] border border-[#2b354b] rounded text-white text-center font-bold"
              data-testid="start-measure-input"
            />
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[#6e7687] text-[10px]">To M:</span>
            <input
              type="number"
              min={startMeasure + 1}
              max={Math.max(safeTotal, startMeasure + 1)}
              value={endMeasure}
              onChange={(e) => {
                const val = Math.max(startMeasure + 1, parseInt(e.target.value, 10) || (startMeasure + 1));
                onEndMeasureChange(val);
              }}
              className="w-14 px-1.5 py-0.5 bg-[#0a0c10] border border-[#2b354b] rounded text-white text-center font-bold"
              data-testid="end-measure-input"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSetQuickRange(0, 4)}
              className="px-1.5 py-0.5 bg-[#181d2a] hover:bg-[#22293b] border border-[#273043] rounded text-[10px] text-[#8b949e]"
            >
              0–4
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickRange(4, 4)}
              className="px-1.5 py-0.5 bg-[#181d2a] hover:bg-[#22293b] border border-[#273043] rounded text-[10px] text-[#8b949e]"
            >
              4–8
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickRange(8, 8)}
              className="px-1.5 py-0.5 bg-[#181d2a] hover:bg-[#22293b] border border-[#273043] rounded text-[10px] text-[#8b949e]"
            >
              8–16
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
