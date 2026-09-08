/**
 * frontend/src/editor/ui/StepchartCanvas.tsx
 * High-performance 192-tick Stepchart Canvas & Receptors Stage (F15).
 * Renders notes, hold/roll bodies, mines, lifts, fakes, subdivision lines,
 * receptors, ghost arrows, and locked playhead cursor.
 */

import React, { useEffect, useRef } from 'react';
import { getBeatSubdivision, getBeatSubdivisionColor } from '../engine/subdivisions';
import type { NoteRow, StepsType } from '../engine/types';
import type { Placement } from '../api/stepperApi';
import {
  drawCelArrow,
  drawCelReceptor,
  drawCelHold,
  drawCelMine,
  drawCelLift,
  CelArrow,
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
}

const RECEPTOR_COLORS = ['#FF2A55', '#00A2FF', '#9E3CFF', '#FFD000', '#FF2A55', '#00A2FF', '#9E3CFF', '#FFD000'];

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDoubles = stepsType === 'dance-double' || stepsType === 'dance-couple';
  const numCols = isDoubles ? 8 : 4;

  // Pixels per beat for vertical scrolling view
  const pixelsPerBeat = 120;
  // Receptor line Y position from top of canvas
  const receptorY = 80;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const canvasW = width;
    const canvasH = height;

    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);

    // 1. Clear background
    ctx.fillStyle = '#0C0D12';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const colWidth = canvasW / numCols;

    // 2. Draw vertical column guidelines
    for (let c = 0; c <= numCols; c++) {
      const x = c * colWidth;
      ctx.strokeStyle = c === 0 || c === numCols || (isDoubles && c === 4) ? '#283048' : '#161924';
      ctx.lineWidth = c === 4 && isDoubles ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }

    // 3. Compute visible beat range
    // beat at receptor line is currentBeat
    // Y(beat) = receptorY + (beat - currentBeat) * pixelsPerBeat
    const minVisibleBeat = Math.max(0, currentBeat - receptorY / pixelsPerBeat);
    const maxVisibleBeat = currentBeat + (canvasH - receptorY) / pixelsPerBeat;

    // Draw horizontal grid lines (measures and beats)
    const startBeatInt = Math.floor(minVisibleBeat);
    const endBeatInt = Math.ceil(maxVisibleBeat);

    for (let b = startBeatInt; b <= endBeatInt; b++) {
      // Quarter note line
      const y = receptorY + (b - currentBeat) * pixelsPerBeat;
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
        const subY = receptorY + (subBeat - currentBeat) * pixelsPerBeat;
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

    // 4. Draw Hold / Roll body lines
    for (const row of noteRows) {
      if (row.beat > maxVisibleBeat + 4) break;
      for (let c = 0; c < numCols; c++) {
        const ch = row.arrows[c];
        if (ch === '2' || ch === '4') {
          // Find corresponding tail '3'
          const tailRow = noteRows.find((r) => r.beat > row.beat && r.arrows[c] === '3');
          if (tailRow) {
            const yHead = receptorY + (row.beat - currentBeat) * pixelsPerBeat;
            const yTail = receptorY + (tailRow.beat - currentBeat) * pixelsPerBeat;
            const x = c * colWidth + colWidth / 2;
            drawCelHold(ctx, (c % 4) as 0 | 1 | 2 | 3, x, Math.min(yHead, yTail), Math.max(yHead, yTail), colWidth, ch === '4');
          }
        }
      }
    }

    // 5. Draw Notes with Cel Noteskin
    for (const row of noteRows) {
      if (row.beat < minVisibleBeat - 0.5 || row.beat > maxVisibleBeat + 0.5) continue;
      const y = receptorY + (row.beat - currentBeat) * pixelsPerBeat;
      const tier = getBeatSubdivision(row.beat);
      const arrowSize = Math.min(42, colWidth - 4);

      for (let c = 0; c < numCols; c++) {
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
    if (proposedPlacements && proposedPlacements.length > 0) {
      for (const p of proposedPlacements) {
        if (p.beat < minVisibleBeat - 0.5 || p.beat > maxVisibleBeat + 0.5) continue;
        const y = receptorY + (p.beat - currentBeat) * pixelsPerBeat;
        const tier = getBeatSubdivision(p.beat);
        const arrowSize = Math.min(42, colWidth - 4);

        for (let c = 0; c < numCols; c++) {
          const ch = p.arrows[c];
          if (!ch || ch === '0') continue;

          const x = c * colWidth + colWidth / 2;
          drawCelArrow(ctx, (c % 4) as 0 | 1 | 2 | 3, x, y, arrowSize, tier, '1', true);
        }
      }
    }

    // 7. Cel Receptors on Canvas Strike Line
    for (let c = 0; c < numCols; c++) {
      const x = c * colWidth + colWidth / 2;
      const arrowSize = Math.min(44, colWidth - 4);
      const isPressed = !!activeKeys?.has(c);
      drawCelReceptor(ctx, (c % 4) as 0 | 1 | 2 | 3, x, receptorY, arrowSize, isPressed);
    }
  }, [noteRows, currentBeat, stepsType, proposedPlacements, width, height, numCols, isDoubles, activeKeys]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const colWidth = rect.width / numCols;
    const col = Math.min(numCols - 1, Math.max(0, Math.floor(clickX / colWidth)));
    const beatOffset = (clickY - receptorY) / pixelsPerBeat;
    const clickedBeat = Math.max(0, Math.round((currentBeat + beatOffset) * 4) / 4);

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

      {/* Target Receptors Bar */}
      <div
        className="receptors absolute flex items-center justify-center gap-2 pointer-events-none"
        style={{ top: `${receptorY - 24}px`, width: `${width}px`, maxWidth: '100%' }}
        data-testid="receptors"
      >
        {Array.from({ length: numCols }).map((_, colIdx) => {
          const isPressed = activeKeys?.has(colIdx);
          const colColor = RECEPTOR_COLORS[colIdx % 4];

          return (
            <div
              key={colIdx}
              className={`receptor flex items-center justify-center rounded border transition-all ${
                isPressed
                  ? 'border-white bg-[#00A2FF44] scale-105 shadow-[0_0_12px_#00E5FF88]'
                  : 'border-[#3D445D] bg-[#161822cc]'
              }`}
              style={{
                width: `${Math.min(56, width / numCols - 6)}px`,
                height: '48px',
                minWidth: '48px',
                minHeight: '48px',
                borderColor: isPressed ? '#FFFFFF' : `${colColor}88`,
              }}
              data-col={colIdx}
            >
              <CelArrow
                col={(colIdx % 4) as 0 | 1 | 2 | 3}
                isReceptor={true}
                isPressed={isPressed}
                size={34}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
};
