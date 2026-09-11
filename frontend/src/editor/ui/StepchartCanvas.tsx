/**
 * frontend/src/editor/ui/StepchartCanvas.tsx
 * High-performance 192-tick Stepchart Canvas & Receptors Stage (F15).
 * Renders notes, hold/roll bodies, mines, lifts, fakes, subdivision lines,
 * receptors, ghost arrows, and locked playhead cursor.
 * Decoupled from React state re-renders via independent RAF loop and persistent backing canvas.
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { getBeatSubdivision, getBeatSubdivisionColor } from '../engine/subdivisions';
import type { NoteRow, StepsType } from '../engine/types';
import type { Placement } from '../api/stepperApi';
import type { AudioEngine } from '../audio/AudioEngine';
import type { TimingEngine } from '../engine/timingEngine';
import {
  drawCelArrow,
  drawCelReceptor,
  drawCelHold,
  drawCelMine,
  drawCelLift,
} from './noteskins';

export interface StepchartCanvasProps {
  noteRows: NoteRow[];
  currentBeat: number;
  stepsType?: StepsType | string;
  proposedPlacements?: Placement[] | null;
  onBeatClick?: (beat: number) => void;
  onColumnClick?: (col: number, beat: number) => void;
  activeKeys?: Set<number>;
  width?: number;
  height?: number;
  audioEngine?: AudioEngine;
  timingEngine?: TimingEngine;
}

interface HoldSpan {
  headBeat: number;
  tailBeat: number;
  col: number;
  isRoll: boolean;
}

export const StepchartCanvas: React.FC<StepchartCanvasProps> = ({
  noteRows,
  currentBeat,
  stepsType = 'dance-single',
  proposedPlacements,
  onBeatClick,
  onColumnClick,
  activeKeys,
  width = 380,
  height = 440,
  audioEngine,
  timingEngine,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDoubles = stepsType === 'dance-double' || stepsType === 'dance-couple';
  const numCols = isDoubles ? 8 : 4;

  // Pixels per beat for vertical scrolling view
  const pixelsPerBeat = 120;
  // Receptor line Y position from top of canvas
  const receptorY = 80;

  // Pre-index hold spans whenever noteRows or numCols changes (O(visible) hold rendering)
  const holdSpans = useMemo<HoldSpan[]>(() => {
    const spans: HoldSpan[] = [];
    for (let i = 0; i < noteRows.length; i++) {
      const r = noteRows[i];
      for (let c = 0; c < numCols; c++) {
        const ch = r.arrows[c];
        if (ch === '2' || ch === '4') {
          // Find matching tail '3' in subsequent rows
          for (let j = i + 1; j < noteRows.length; j++) {
            if (noteRows[j].arrows[c] === '3') {
              spans.push({
                headBeat: r.beat,
                tailBeat: noteRows[j].beat,
                col: c,
                isRoll: ch === '4',
              });
              break;
            }
          }
        }
      }
    }
    return spans;
  }, [noteRows, numCols]);

  // Binary search for first visible note row
  const findFirstVisibleIndex = (rows: NoteRow[], minBeat: number): number => {
    let low = 0;
    let high = rows.length - 1;
    let result = rows.length;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (rows[mid].beat >= minBeat) {
        result = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return result;
  };

  // Resize canvas backing store ONLY when dimensions or DPR change
  const resizeCanvasIfNeeded = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  // Props ref to allow RAF render loop to read latest state without tearing
  const propsRef = useRef({
    noteRows,
    currentBeat,
    stepsType,
    proposedPlacements,
    activeKeys,
    width,
    height,
    numCols,
    isDoubles,
    holdSpans,
  });
  propsRef.current = {
    noteRows,
    currentBeat,
    stepsType,
    proposedPlacements,
    activeKeys,
    width,
    height,
    numCols,
    isDoubles,
    holdSpans,
  };

  const drawFrame = useCallback((beat: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const {
      noteRows: currentNotes,
      proposedPlacements: currentProposed,
      activeKeys: currentKeys,
      width: canvasW,
      height: canvasH,
      numCols: currentCols,
      isDoubles: currentDoubles,
      holdSpans: currentSpans,
    } = propsRef.current;

    resizeCanvasIfNeeded(canvas, ctx, canvasW, canvasH);

    // 1. Clear background using fillRect (eliminates GPU texture reallocation)
    ctx.fillStyle = '#0C0D12';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const colWidth = canvasW / currentCols;

    // 2. Draw vertical column guidelines
    for (let c = 0; c <= currentCols; c++) {
      const x = c * colWidth;
      ctx.strokeStyle = c === 0 || c === currentCols || (currentDoubles && c === 4) ? '#283048' : '#161924';
      ctx.lineWidth = c === 4 && currentDoubles ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }

    // 3. Compute visible beat range
    const minVisibleBeat = Math.max(0, beat - receptorY / pixelsPerBeat);
    const maxVisibleBeat = beat + (canvasH - receptorY) / pixelsPerBeat;

    // Draw horizontal grid lines (measures and beats)
    const startBeatInt = Math.floor(minVisibleBeat);
    const endBeatInt = Math.ceil(maxVisibleBeat);

    for (let b = startBeatInt; b <= endBeatInt; b++) {
      // Quarter note line
      const y = receptorY + (b - beat) * pixelsPerBeat;
      if (y >= 0 && y <= canvasH) {
        const isMeasure = b % 4 === 0;
        ctx.strokeStyle = isMeasure ? '#FF2A5588' : '#2A3144';
        ctx.lineWidth = isMeasure ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasW, y);
        ctx.stroke();

        if (isMeasure) {
          ctx.fillStyle = '#FF2A55';
          ctx.font = '10px monospace';
          ctx.fillText(`M${Math.floor(b / 4)}`, 4, y - 4);
        }
      }

      // Intermediate 16th and 8th subdivisions
      for (let s = 1; s < 4; s++) {
        const subBeat = b + s * 0.25;
        const subY = receptorY + (subBeat - beat) * pixelsPerBeat;
        if (subY >= 0 && subY <= canvasH) {
          const color = getBeatSubdivisionColor(subBeat);
          ctx.strokeStyle = `${color}33`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(0, subY);
          ctx.lineTo(canvasW, subY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 4. Draw Hold / Roll body lines with pre-indexed spans (O(visible))
    for (let i = 0; i < currentSpans.length; i++) {
      const span = currentSpans[i];
      if (span.tailBeat < minVisibleBeat || span.headBeat > maxVisibleBeat + 4) continue;
      const yHead = receptorY + (span.headBeat - beat) * pixelsPerBeat;
      const yTail = receptorY + (span.tailBeat - beat) * pixelsPerBeat;
      const x = span.col * colWidth + colWidth / 2;
      drawCelHold(ctx, (span.col % 4) as 0 | 1 | 2 | 3, x, Math.min(yHead, yTail), Math.max(yHead, yTail), colWidth, span.isRoll);
    }

    // 5. Draw Notes with Cel Noteskin (Binary-search visible window)
    const startIndex = findFirstVisibleIndex(currentNotes, minVisibleBeat - 0.5);
    for (let i = startIndex; i < currentNotes.length; i++) {
      const row = currentNotes[i];
      if (row.beat < minVisibleBeat - 0.5) continue;
      if (row.beat > maxVisibleBeat + 0.5) break;

      const y = receptorY + (row.beat - beat) * pixelsPerBeat;
      const tier = getBeatSubdivision(row.beat);
      const arrowSize = Math.min(42, colWidth - 4);

      for (let c = 0; c < currentCols; c++) {
        const ch = row.arrows[c];
        if (!ch || ch === '0' || ch === '3') continue;

        const x = c * colWidth + colWidth / 2;

        if (ch === '1' || ch === '2' || ch === '4') {
          drawCelArrow(ctx, (c % 4) as 0 | 1 | 2 | 3, x, y, arrowSize, tier, ch);
        } else if (ch === 'M') {
          drawCelMine(ctx, x, y, arrowSize);
        } else if (ch === 'L') {
          drawCelLift(ctx, (c % 4) as 0 | 1 | 2 | 3, x, y, arrowSize, tier);
        } else if (ch === 'F') {
          drawCelArrow(ctx, (c % 4) as 0 | 1 | 2 | 3, x, y, arrowSize, tier, 'F');
        }
      }
    }

    // 6. Draw Proposed AI Ghost Arrows
    if (currentProposed && currentProposed.length > 0) {
      for (let i = 0; i < currentProposed.length; i++) {
        const p = currentProposed[i];
        if (p.beat < minVisibleBeat - 0.5 || p.beat > maxVisibleBeat + 0.5) continue;
        const y = receptorY + (p.beat - beat) * pixelsPerBeat;
        const tier = getBeatSubdivision(p.beat);
        const arrowSize = Math.min(42, colWidth - 4);

        for (let c = 0; c < currentCols; c++) {
          const ch = p.arrows[c];
          if (!ch || ch === '0') continue;

          const x = c * colWidth + colWidth / 2;
          drawCelArrow(ctx, (c % 4) as 0 | 1 | 2 | 3, x, y, arrowSize, tier, '1', true);
        }
      }
    }

    // 7. Cel Receptors on Canvas Strike Line
    for (let c = 0; c < currentCols; c++) {
      const x = c * colWidth + colWidth / 2;
      const arrowSize = Math.min(44, colWidth - 4);
      const isPressed = !!currentKeys?.has(c);
      drawCelReceptor(ctx, (c % 4) as 0 | 1 | 2 | 3, x, receptorY, arrowSize, isPressed);
    }
  }, []);

  // Internal animation frame loop for decoupling canvas from React root state during active playback
  useEffect(() => {
    let animId: number | null = null;

    const renderLoop = () => {
      if (audioEngine && audioEngine.isPlaying) {
        const timeSec = audioEngine.getCurrentTime();
        const beat = timingEngine ? timingEngine.secondsToBeat(timeSec) : propsRef.current.currentBeat;
        drawFrame(beat);
        animId = requestAnimationFrame(renderLoop);
      }
    };

    if (audioEngine && audioEngine.isPlaying) {
      animId = requestAnimationFrame(renderLoop);
    } else {
      drawFrame(propsRef.current.currentBeat);
    }

    const unsubState = audioEngine?.onStateChange((playing) => {
      if (playing) {
        if (animId !== null) cancelAnimationFrame(animId);
        animId = requestAnimationFrame(renderLoop);
      } else {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
        drawFrame(propsRef.current.currentBeat);
      }
    });

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      if (unsubState) unsubState();
    };
  }, [audioEngine, timingEngine, drawFrame]);

  // Re-draw when dependencies change while paused or in static mode
  useEffect(() => {
    if (!audioEngine || !audioEngine.isPlaying) {
      drawFrame(currentBeat);
    }
  }, [noteRows, activeKeys, proposedPlacements, width, height, currentBeat, audioEngine, drawFrame]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const colWidth = rect.width / numCols;
    const col = Math.min(numCols - 1, Math.max(0, Math.floor(clickX / colWidth)));
    const beatOffset = (clickY - receptorY) / pixelsPerBeat;
    const activeBeat = audioEngine && audioEngine.isPlaying
      ? (timingEngine ? timingEngine.secondsToBeat(audioEngine.getCurrentTime()) : currentBeat)
      : currentBeat;
    const clickedBeat = Math.max(0, Math.round((activeBeat + beatOffset) * 4) / 4);

    if (onColumnClick) {
      onColumnClick(col, clickedBeat);
    } else if (onBeatClick) {
      onBeatClick(clickedBeat);
    }
  };

  return (
    <main
      className="stage-container relative flex flex-col items-center justify-center w-full overflow-hidden select-none bg-[#0C0D12]"
      data-testid="stage-container"
      style={{ minHeight: `${height}px` }}
    >
      {/* Parity Ribbon Overlay indicator */}
      <div
        className="parity-ribbon absolute left-2 top-0 bottom-0 w-2 rounded-full pointer-events-none z-10"
        data-testid="parity-ribbon"
        title="Biomechanical Foot Parity Ribbon"
        style={{
          background: 'linear-gradient(to bottom, #00B0FF 0%, #FF3366 50%, #9E3CFF 100%)',
          opacity: 0.85,
        }}
      />

      {/* 192-tick Canvas Note Grid */}
      <canvas
        ref={canvasRef}
        id="noteCanvas"
        className="grid-canvas cursor-pointer shadow-inner rounded border border-[#1F2434]"
        width={width}
        height={height}
        data-testid="note-canvas"
        onClick={handleCanvasClick}
        style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%' }}
      />

      {/* Target Receptors Overlay Bar */}
      <div
        className="receptors absolute top-0 left-0 w-full pointer-events-none"
        style={{ height: `${height}px`, width: `${width}px`, maxWidth: '100%' }}
        data-testid="receptors"
      >
        {Array.from({ length: numCols }).map((_, colIdx) => {
          const isPressed = activeKeys?.has(colIdx);
          const colW = width / numCols;
          const colX = colIdx * colW;

          return (
            <div
              key={colIdx}
              className={`receptor absolute flex items-center justify-center transition-all ${
                isPressed
                  ? 'bg-[#00E5FF22] shadow-[0_0_24px_#00E5FF88]'
                  : ''
              }`}
              style={{
                left: `${colX}px`,
                width: `${colW}px`,
                top: `${receptorY - 24}px`,
                height: '48px',
              }}
              data-col={colIdx}
            />
          );
        })}
      </div>
    </main>
  );
};
