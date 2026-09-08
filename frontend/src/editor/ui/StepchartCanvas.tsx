/**
 * frontend/src/editor/ui/StepchartCanvas.tsx
 * High-performance 192-tick Stepchart Canvas & Receptors Stage (F15).
 * Renders notes, hold/roll bodies, mines, lifts, fakes, subdivision lines,
 * receptors, ghost arrows, and locked playhead cursor.
 */

import React, { useEffect, useRef } from 'react';
import { getSubdivisionColor } from '../engine/subdivisions';
import type { NoteRow, StepsType } from '../engine/types';
import type { Placement } from '../api/stepperApi';

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

const RECEPTOR_SYMBOLS = ['←', '↓', '↑', '→', '←', '↓', '↑', '→'];
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
          const color = getSubdivisionColor(subBeat);
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

            ctx.fillStyle = ch === '4' ? '#38EF7D44' : '#00A2FF44';
            ctx.strokeStyle = ch === '4' ? '#38EF7D' : '#00A2FF';
            ctx.lineWidth = 4;

            const topY = Math.min(yHead, yTail);
            const bodyH = Math.abs(yTail - yHead);
            ctx.fillRect(x - 8, topY, 16, bodyH);
            ctx.strokeRect(x - 8, topY, 16, bodyH);
          }
        }
      }
    }

    // 5. Draw Notes
    for (const row of noteRows) {
      if (row.beat < minVisibleBeat - 0.5 || row.beat > maxVisibleBeat + 0.5) continue;
      const y = receptorY + (row.beat - currentBeat) * pixelsPerBeat;
      const subColor = getSubdivisionColor(row.beat);

      for (let c = 0; c < numCols; c++) {
        const ch = row.arrows[c];
        if (!ch || ch === '0') continue;

        const x = c * colWidth + colWidth / 2;
        const radius = Math.min(18, colWidth / 2 - 4);

        if (ch === '1' || ch === '2' || ch === '4') {
          // Tap / Hold Head / Roll Head
          ctx.fillStyle = subColor;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Symbol inside
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(RECEPTOR_SYMBOLS[c % 4], x, y);
        } else if (ch === '3') {
          // Hold Tail Cap
          ctx.fillStyle = '#8A92A6';
          ctx.fillRect(x - radius, y - 4, radius * 2, 8);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - radius, y - 4, radius * 2, 8);
        } else if (ch === 'M') {
          // Mine
          ctx.fillStyle = '#FF3366';
          ctx.beginPath();
          ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('M', x, y);
        } else if (ch === 'L') {
          // Lift
          ctx.fillStyle = '#E0E2EC';
          ctx.beginPath();
          ctx.moveTo(x, y - radius);
          ctx.lineTo(x + radius, y + radius);
          ctx.lineTo(x - radius, y + radius);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('L', x, y + 2);
        } else if (ch === 'F') {
          // Fake
          ctx.fillStyle = '#5A627A88';
          ctx.strokeStyle = '#5A627A';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('F', x, y);
        }
      }
    }

    // 6. Draw Proposed AI Ghost Arrows
    if (proposedPlacements && proposedPlacements.length > 0) {
      for (const p of proposedPlacements) {
        if (p.beat < minVisibleBeat - 0.5 || p.beat > maxVisibleBeat + 0.5) continue;
        const y = receptorY + (p.beat - currentBeat) * pixelsPerBeat;

        for (let c = 0; c < numCols; c++) {
          const ch = p.arrows[c];
          if (!ch || ch === '0') continue;

          const x = c * colWidth + colWidth / 2;
          const radius = Math.min(18, colWidth / 2 - 4);

          ctx.fillStyle = '#00E67644';
          ctx.strokeStyle = '#00E676';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#00E676';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(RECEPTOR_SYMBOLS[c % 4], x, y);
        }
      }
    }

    // 7. Receptor Strike Line
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, receptorY);
    ctx.lineTo(canvasW, receptorY);
    ctx.stroke();
  }, [noteRows, currentBeat, stepsType, proposedPlacements, width, height, numCols, isDoubles]);

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
              className={`receptor flex items-center justify-center font-bold text-xl rounded border-2 transition-all ${
                isPressed
                  ? 'border-white bg-[#00A2FF44] text-white scale-105'
                  : 'border-[#5A627A] bg-[#161822cc] text-[#8A92A6]'
              }`}
              style={{
                width: `${Math.min(56, width / numCols - 6)}px`,
                height: '48px',
                minWidth: '48px',
                minHeight: '48px',
                borderColor: isPressed ? '#FFFFFF' : colColor,
                color: isPressed ? '#FFFFFF' : colColor,
              }}
              data-col={colIdx}
            >
              {RECEPTOR_SYMBOLS[colIdx % 4]}
            </div>
          );
        })}
      </div>
    </main>
  );
};
