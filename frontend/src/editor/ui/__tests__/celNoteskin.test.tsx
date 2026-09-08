/**
 * frontend/src/editor/ui/__tests__/celNoteskin.test.tsx
 * Unit test suite for Cel Noteskin Engine & CelArrow SVG component.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCelNoteCoord,
  getCelReceptorCoord,
  CEL_SPECIAL_COORDS,
  CEL_FRAME_SIZE,
  drawCelArrow,
  drawCelReceptor,
  drawCelHold,
  drawCelMine,
  drawCelLift,
  CelArrow,
} from '../noteskins';
import type { SubdivisionTier } from '../../engine/types';

// Configure React 19 testing environment for act
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Cel Noteskin Engine (celNoteskin.ts)', () => {
  it('computes correct atlas coordinates for all 10 subdivision tiers', () => {
    const tiers: SubdivisionTier[] = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192];
    for (const tier of tiers) {
      for (let col = 0; col < 4; col++) {
        const coord = getCelNoteCoord(tier, col);
        expect(coord.sw).toBe(CEL_FRAME_SIZE);
        expect(coord.sh).toBe(CEL_FRAME_SIZE);
        expect(coord.sx).toBeGreaterThanOrEqual(0);
        expect(coord.sy).toBeGreaterThanOrEqual(0);
        expect(coord.sx + coord.sw).toBeLessThanOrEqual(1024);
        expect(coord.sy + coord.sh).toBeLessThanOrEqual(1024);
      }
    }
  });

  it('computes separate unpressed and active receptor coordinates', () => {
    for (let col = 0; col < 4; col++) {
      const unpressed = getCelReceptorCoord(col, false);
      const active = getCelReceptorCoord(col, true);
      expect(unpressed.sy).toBe(5 * CEL_FRAME_SIZE);
      expect(active.sy).toBe(5 * CEL_FRAME_SIZE);
      expect(active.sx).toBe(unpressed.sx + 4 * CEL_FRAME_SIZE);
    }
  });

  it('provides valid coordinates for all special Cel assets', () => {
    expect(CEL_SPECIAL_COORDS.mine().sy).toBe(7 * CEL_FRAME_SIZE);
    expect(CEL_SPECIAL_COORDS.holdBody().sy).toBe(7 * CEL_FRAME_SIZE);
    expect(CEL_SPECIAL_COORDS.rollBody().sy).toBe(7 * CEL_FRAME_SIZE);
    expect(CEL_SPECIAL_COORDS.fake().sy).toBe(7 * CEL_FRAME_SIZE);

    for (let col = 0; col < 4; col++) {
      expect(CEL_SPECIAL_COORDS.lift(col).sy).toBe(6 * CEL_FRAME_SIZE);
      expect(CEL_SPECIAL_COORDS.holdCap(col).sy).toBe(6 * CEL_FRAME_SIZE);
      expect(CEL_SPECIAL_COORDS.ghost(col).sy).toBe(7 * CEL_FRAME_SIZE);
    }
  });

  it('executes canvas drawer functions without throwing in headless context', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    expect(() => drawCelArrow(mockCtx, 0, 50, 50, 40, 4, '1')).not.toThrow();
    expect(() => drawCelReceptor(mockCtx, 1, 50, 80, 44, false)).not.toThrow();
    expect(() => drawCelReceptor(mockCtx, 2, 50, 80, 44, true)).not.toThrow();
    expect(() => drawCelMine(mockCtx, 50, 50, 36)).not.toThrow();
    expect(() => drawCelLift(mockCtx, 3, 50, 50, 40, 16)).not.toThrow();
    expect(() => drawCelHold(mockCtx, 0, 50, 80, 160, 40, false)).not.toThrow();
    expect(() => drawCelHold(mockCtx, 1, 50, 80, 160, 40, true)).not.toThrow();
  });
});

describe('CelArrow SVG Component (CelArrow.tsx)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders Cel arrows with correct rotation for all 4 directions', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <div>
          <CelArrow col={0} />
          <CelArrow col={1} />
          <CelArrow col={2} />
          <CelArrow col={3} />
        </div>
      );
    });

    const svgs = container.querySelectorAll('.cel-arrow');
    expect(svgs.length).toBe(4);
    expect(svgs[0].querySelector('g')?.getAttribute('transform')).toContain('rotate(270');
    expect(svgs[1].querySelector('g')?.getAttribute('transform')).toContain('rotate(180');
    expect(svgs[2].querySelector('g')?.getAttribute('transform')).toContain('rotate(0');
    expect(svgs[3].querySelector('g')?.getAttribute('transform')).toContain('rotate(90');
  });

  it('renders authentic Cel spiked mine and delete symbols', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <div>
          <CelArrow noteType="MINE" size={32} />
          <CelArrow noteType="DEL" size={32} />
        </div>
      );
    });

    const mine = container.querySelector('.cel-mine');
    expect(mine).not.toBeNull();
    expect(mine?.querySelectorAll('line').length).toBe(4);

    const del = container.querySelector('.cel-del');
    expect(del).not.toBeNull();
    expect(del?.querySelectorAll('line').length).toBe(2);
  });

  it('renders receptor arrow with bright luminous flash when active', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <div>
          <CelArrow col={1} isReceptor={true} isPressed={false} />
          <CelArrow col={1} isReceptor={true} isPressed={true} />
        </div>
      );
    });

    const polygons = container.querySelectorAll('polygon');
    expect(polygons[0]?.getAttribute('fill')).toBe('#1A1D29');
    expect(polygons[1]?.getAttribute('fill')).toBe('#FFFFFF');
  });

  it('renders hollow chevron contour for lift notes', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<CelArrow col={2} noteType="LIFT" subdivision={8} />);
    });

    const polygon = container.querySelector('polygon');
    expect(polygon?.getAttribute('fill')).toBe('transparent');
  });
});
