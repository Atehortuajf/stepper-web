/**
 * frontend/src/editor/conditioning/DiffOverlay.tsx
 * Interactive Stepper AI generation controls and live diff preview overlay.
 * Allows comparing proposed notes side-by-side with ghost arrows before committing.
 */

import React, { useMemo, useState } from 'react';
import type { NoteRow, SubdivisionTier } from '../engine/types';
import type { Placement } from '../api/stepperApi';
import { getBeatSubdivision, getSubdivisionColor } from '../engine/subdivisions';
import { CelArrow } from '../ui/noteskins';

export type DiffItemType = 'added' | 'modified' | 'deleted' | 'unchanged';

export interface DiffRow {
  beat: number;
  currentArrows: string;
  proposedArrows: string;
  type: DiffItemType;
  confidence?: number;
}

export interface DiffOverlayProps {
  currentNotes: NoteRow[];
  proposedPlacements: Placement[] | null;
  rangeStartBeat: number;
  rangeEndBeat: number;
  isGenerating: boolean;
  latencyMs?: number;
  modelUsed?: string;
  onGenerate: () => void;
  onAccept: (placements: Placement[]) => void;
  onDiscard: () => void;
  className?: string;
}

export const DiffOverlay: React.FC<DiffOverlayProps> = ({
  currentNotes,
  proposedPlacements,
  rangeStartBeat,
  rangeEndBeat,
  isGenerating,
  latencyMs,
  modelUsed,
  onGenerate,
  onAccept,
  onDiscard,
  className = '',
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  // Compute diff rows within the half-open interval [rangeStartBeat, rangeEndBeat).
  const diffRows = useMemo<DiffRow[]>(() => {
    if (!proposedPlacements) return [];

    const currentMap = new Map<string, string>();
    for (const n of currentNotes) {
      if (n.beat >= rangeStartBeat && n.beat < rangeEndBeat) {
        currentMap.set(n.beat.toFixed(3), n.arrows);
      }
    }

    const proposedMap = new Map<string, { arrows: string; confidence: number }>();
    for (const p of proposedPlacements) {
      if (p.beat >= rangeStartBeat && p.beat < rangeEndBeat) {
        proposedMap.set(p.beat.toFixed(3), { arrows: p.arrows, confidence: p.confidence });
      }
    }

    // Union of all beats
    const allBeats = Array.from(
      new Set([...currentMap.keys(), ...proposedMap.keys()])
    ).sort((a, b) => parseFloat(a) - parseFloat(b));

    return allBeats.map((bStr) => {
      const beat = parseFloat(bStr);
      const curr = currentMap.get(bStr) || '0000';
      const propObj = proposedMap.get(bStr);
      const prop = propObj ? propObj.arrows : '0000';

      let type: DiffItemType = 'unchanged';
      if (curr === '0000' && prop !== '0000') {
        type = 'added';
      } else if (curr !== '0000' && prop === '0000') {
        type = 'deleted';
      } else if (curr !== prop) {
        type = 'modified';
      }

      return {
        beat,
        currentArrows: curr,
        proposedArrows: prop,
        type,
        confidence: propObj?.confidence,
      };
    });
  }, [currentNotes, proposedPlacements, rangeStartBeat, rangeEndBeat]);

  const stats = useMemo(() => {
    let added = 0;
    let modified = 0;
    let deleted = 0;
    let unchanged = 0;

    for (const r of diffRows) {
      if (r.type === 'added') added++;
      else if (r.type === 'modified') modified++;
      else if (r.type === 'deleted') deleted++;
      else unchanged++;
    }

    return { added, modified, deleted, unchanged, total: diffRows.length };
  }, [diffRows]);

  const filteredRows = useMemo(() => {
    if (filterType === 'changes') {
      return diffRows.filter((r) => r.type !== 'unchanged');
    }
    if (filterType === 'added') {
      return diffRows.filter((r) => r.type === 'added');
    }
    if (filterType === 'modified') {
      return diffRows.filter((r) => r.type === 'modified');
    }
    return diffRows;
  }, [diffRows, filterType]);

  const hasProposed = proposedPlacements !== null;

  const renderArrowMiniatures = (chordStr: string, tier: SubdivisionTier) => {
    if (!chordStr || chordStr === '0000') {
      return <span className="text-[#30364d]">••••</span>;
    }
    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          {chordStr.split('').map((ch, idx) => {
            if (ch === '0') {
              return (
                <span key={idx} className="text-[#2a3044] text-[10px] w-3 text-center">
                  •
                </span>
              );
            }
            return (
              <CelArrow
                key={idx}
                col={(idx % 4) as 0 | 1 | 2 | 3}
                subdivision={tier}
                noteType={ch === 'M' ? 'MINE' : ch === 'L' ? 'LIFT' : ch === '2' ? 'HOLD' : ch === '4' ? 'ROLL' : 'TAP'}
                size={13}
              />
            );
          })}
        </div>
        <span className="font-mono text-[10px] opacity-75">{chordStr}</span>
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col bg-[#0d1017] border border-[#212636] rounded-md p-3 text-xs text-[#c9d1d9] gap-3 ${className}`}
      data-testid="diff-overlay"
    >
      {/* Top Action / Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isGenerating ? 'bg-[#ffd000] animate-spin' : hasProposed ? 'bg-[#00e676]' : 'bg-[#586074]'
            }`}
          />
          <span className="font-bold uppercase tracking-wider text-white text-[11px]">
            AI Chart Generation & Diff Preview
          </span>
          {modelUsed && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1c2230] text-[#79c0ff] border border-[#2d374d] font-mono uppercase">
              {modelUsed}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {latencyMs !== undefined && (
            <span className="font-mono text-[10px] text-[#8b949e]">
              Latency: <strong className="text-white">{latencyMs.toFixed(1)} ms</strong>
            </span>
          )}

          {!hasProposed ? (
            <button
              type="button"
              disabled={isGenerating}
              onClick={onGenerate}
              className={`px-3 py-1.5 rounded font-bold transition-all shadow-sm ${
                isGenerating
                  ? 'bg-[#2b354b] text-[#8b949e] cursor-wait'
                  : 'bg-[#1f6feb] hover:bg-[#388bfd] text-white active:scale-95'
              }`}
              data-testid="generate-btn"
            >
              {isGenerating ? 'Generating...' : '⚡ Generate Steps'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDiscard}
                className="px-2.5 py-1 bg-[#212636] hover:bg-[#30364d] text-[#f85149] rounded font-medium border border-[#30364d] transition-colors"
                data-testid="discard-btn"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => onAccept(proposedPlacements || [])}
                className="px-3 py-1 bg-[#238636] hover:bg-[#2ea043] text-white rounded font-bold shadow-md transition-colors"
                data-testid="accept-btn"
              >
                ✓ Accept / Commit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Latency & Telemetry Info */}
      {latencyMs !== undefined && (
        <div className="flex items-center justify-between text-[11px] font-mono text-[#8b949e] px-1">
          <span>Model: {modelUsed || 'WASM-SIMD Local'}</span>
          <span>Inference Latency: {latencyMs.toFixed(1)} ms</span>
        </div>
      )}

      {/* Diff Table and Action Bar when proposed placements exist */}
      {proposedPlacements && (
        <div className="flex flex-col gap-2" data-testid="diff-preview-container">
          {/* Diff Summary Stats Badges */}
          <div className="flex items-center justify-between bg-[#12151e] p-2 rounded border border-[#1e2333]">
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-[#8b949e]">Changes:</span>
              <span className="text-[#00e676] font-bold">+{stats.added} Add</span>
              <span className="text-[#ffd000] font-bold">~{stats.modified} Mod</span>
              <span className="text-[#ff3366] font-bold">-{stats.deleted} Del</span>
              <span className="text-[#586074]">={stats.unchanged} Same</span>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-1.5 py-0.5 rounded ${
                  filterType === 'all' ? 'bg-[#1f2638] text-white font-bold' : 'text-[#6e7687]'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('changes')}
                className={`px-1.5 py-0.5 rounded ${
                  filterType === 'changes' ? 'bg-[#1f2638] text-white font-bold' : 'text-[#6e7687]'
                }`}
              >
                Changes Only ({stats.added + stats.modified + stats.deleted})
              </button>
            </div>
          </div>

          {/* Diff Table / List View */}
          <div className="max-h-56 overflow-y-auto rounded border border-[#1e2333] bg-[#0a0c10]">
            <table className="w-full text-left font-mono text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#12151e] text-[#6e7687] text-[10px] uppercase border-b border-[#1e2333]">
                  <th className="py-1 px-2">Beat</th>
                  <th className="py-1 px-2">Current Chart</th>
                  <th className="py-1 px-2">Proposed (Ghost)</th>
                  <th className="py-1 px-2">Diff Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-[#586074]">
                      No rows match the filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const color = getSubdivisionColor(r.beat);
                    const tier = getBeatSubdivision(r.beat);
                    return (
                      <tr
                        key={r.beat.toFixed(3)}
                        className={`border-b border-[#131722] hover:bg-[#12151e] transition-colors ${
                          r.type === 'added'
                            ? 'bg-[#00e6760a]'
                            : r.type === 'modified'
                            ? 'bg-[#ffd0000a]'
                            : r.type === 'deleted'
                            ? 'bg-[#ff33660a]'
                            : ''
                        }`}
                        data-testid={`diff-row-${r.beat.toFixed(2)}`}
                      >
                        <td className="py-1 px-2 flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-[#8b949e]">{r.beat.toFixed(2)}</span>
                        </td>

                        <td className="py-1 px-2 font-bold tracking-widest text-[#58a6ff]">
                          {renderArrowMiniatures(r.currentArrows, tier)}
                        </td>

                        <td className="py-1 px-2 font-bold tracking-widest">
                          {renderArrowMiniatures(r.proposedArrows, tier)}
                        </td>

                        <td className="py-1 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider inline-block ${
                              r.type === 'added'
                                ? 'bg-[#00e67622] text-[#00e676] border border-[#00e67644]'
                                : r.type === 'modified'
                                ? 'bg-[#ffd00022] text-[#ffd000] border border-[#ffd00044]'
                                : r.type === 'deleted'
                                ? 'bg-[#ff336622] text-[#ff3366] border border-[#ff336644]'
                                : 'text-[#586074]'
                            }`}
                          >
                            {r.type}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
