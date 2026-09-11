import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../editor/audio/AudioEngine', () => ({
  AudioEngine: class MockAudioEngine {
    audioBuffer: object | null = null;
    channelData: Float32Array[] = [];
    duration = 60;
    sampleRate = 44100;
    isPlaying = false;
    playbackRate = 1;
    peakPyramid = null;
    spectrogram = null;
    bookmarks: [] = [];
    setVolume() {}
    setPlaybackRate() {}
    generateSyntheticTrack() { this.audioBuffer = {}; }
    getCurrentTime() { return 0; }
    onStateChange() { return () => {}; }
    onTimeUpdate() { return () => {}; }
    play() {}
    pause() {}
    stop() {}
    seek() {}
    dispose() {}
    buildSpectrogram() {}
    addBookmark() {}
    async loadAudioFromBuffer() { this.audioBuffer = {}; }
  },
}));

vi.mock('../editor/audio/WaveformRenderer', () => ({
  WaveformRenderer: { render: vi.fn() },
}));

vi.mock('../editor/api/stepperApi', () => ({
  stepperApi: {
    setEngineMode: vi.fn(),
    checkHealth: vi.fn(async () => ({ status: 'ok', device: 'wasm-local' })),
    solveParity: vi.fn(async () => ({
      is_playable: true,
      total_cost: 0,
      foot_sequence: [],
      annotated_steps: [],
      stats: undefined,
    })),
    generate: vi.fn(),
  },
}));

vi.mock('../editor/api', () => ({
  wasmInferenceEngine: { initialize: vi.fn(async () => true) },
}));

import { App } from '../App';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TWO_CHART_SM = `#TITLE:Transaction Fixture;
#ARTIST:Test Artist;
#OFFSET:0;
#BPMS:0=120;
#NOTES:
     dance-single:
     First:
     Hard:
     9:
     0,0,0,0,0:
1000
0000
0000
0000
;
#NOTES:
     dance-single:
     Second:
     Challenge:
     11:
     0,0,0,0,0:
0010
0000
0000
0000
;
`;

function upload(input: HTMLInputElement, files: Array<Record<string, unknown>>) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: Object.assign(files, { item: (index: number) => files[index] || null }),
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('App editor transaction workflows', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    root = createRoot(container);
    await act(async () => { root.render(<App />); });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves the loaded document when audio is attached separately', async () => {
    expect(container.querySelector('[data-testid="btn-open-file"]')?.className).not.toContain('hidden');
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{
        name: 'fixture.sm',
        text: async () => TWO_CHART_SM,
      }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Transaction Fixture');
    expect(container.querySelectorAll('[data-testid^="chart-btn-"]')).toHaveLength(2);

    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{
        name: 'replacement.wav',
        arrayBuffer: async () => new ArrayBuffer(8),
      }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Transaction Fixture');
    expect(container.querySelectorAll('[data-testid^="chart-btn-"]')).toHaveLength(2);
  });

  it('cannot undo chart A into chart B', async () => {
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{ name: 'fixture.sm', text: async () => TWO_CHART_SM }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="chart-btn-1"]')!.click();
    });
    expect(container.textContent).toContain('0010');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }));
    });
    expect(container.textContent).toContain('0010');
    expect(container.textContent).not.toContain('1000');
  });

  it('does not let an older chart history undo newer global timing', async () => {
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{ name: 'fixture.sm', text: async () => TWO_CHART_SM }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    const saveOffset = async (value: string) => {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', code: 'KeyT', shiftKey: true, bubbles: true }));
      });
      await act(async () => {
        setInput(container.querySelector<HTMLInputElement>('[data-testid="input-offset"]')!, value);
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-testid="btn-save-timing"]')!.click();
      });
    };

    await saveOffset('0.1');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="chart-btn-1"]')!.click(); });
    await saveOffset('0.2');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="chart-btn-0"]')!.click(); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }));
    });
    expect(container.textContent).toContain('0.2000s');
    expect(container.textContent).not.toContain('0.1000s');
  });
});
