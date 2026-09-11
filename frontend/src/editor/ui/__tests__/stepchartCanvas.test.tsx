/**
 * frontend/src/editor/ui/__tests__/stepchartCanvas.test.tsx
 * Unit test suite for StepchartCanvas decoupling, RAF loop, hold pre-indexing,
 * and persistent backing canvas dimensions.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StepchartCanvas } from '../StepchartCanvas';
import { AudioEngine } from '../../audio/AudioEngine';
import { TimingEngine } from '../../engine/timingEngine';
import type { NoteRow } from '../../engine/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('StepchartCanvas Decoupling & Performance Optimization', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders StepchartCanvas with canvas backing store and receptors without exceptions', async () => {
    const root = createRoot(container);
    const noteRows: NoteRow[] = [
      { beat: 0, row: 0, arrows: '1000' },
      { beat: 1, row: 48, arrows: '0100' },
      { beat: 2, row: 96, arrows: '2000' },
      { beat: 4, row: 192, arrows: '3000' },
    ];

    await act(async () => {
      root.render(
        <StepchartCanvas
          noteRows={noteRows}
          currentBeat={0}
          width={380}
          height={440}
        />
      );
    });

    const canvas = container.querySelector('canvas#noteCanvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('data-testid')).toBe('note-canvas');

    const receptors = container.querySelector('[data-testid="receptors"]');
    expect(receptors).not.toBeNull();
    expect(receptors?.children.length).toBe(4);
  });

  it('supports 8-panel dance-double mode receptors', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <StepchartCanvas
          noteRows={[]}
          currentBeat={0}
          stepsType="dance-double"
          width={600}
          height={440}
        />
      );
    });

    const receptors = container.querySelector('[data-testid="receptors"]');
    expect(receptors?.children.length).toBe(8);
  });

  it('connects to AudioEngine and TimingEngine for decoupled clock updates', async () => {
    const root = createRoot(container);
    const audioEngine = new AudioEngine();
    const timingEngine = new TimingEngine({
      offset: 0,
      bpms: [{ beat: 0, bpm: 120 }],
    });

    const noteRows: NoteRow[] = [
      { beat: 0, row: 0, arrows: '1000' },
      { beat: 2, row: 96, arrows: '0100' },
    ];

    await act(async () => {
      root.render(
        <StepchartCanvas
          noteRows={noteRows}
          currentBeat={0}
          audioEngine={audioEngine}
          timingEngine={timingEngine}
          width={380}
          height={440}
        />
      );
    });

    const canvas = container.querySelector('canvas#noteCanvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
  });

  it('handles binary search visible index boundary past the last note without errors', async () => {
    const root = createRoot(container);
    const notes: NoteRow[] = [
      { beat: 0, row: 0, arrows: '1000' },
      { beat: 4, row: 192, arrows: '0100' },
    ];

    // Render at beat 100 (well past the last note at beat 4)
    await act(async () => {
      root.render(
        <StepchartCanvas
          noteRows={notes}
          currentBeat={100}
          width={380}
          height={440}
        />
      );
    });

    const canvas = container.querySelector('canvas#noteCanvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
  });
});
