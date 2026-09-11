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
    estimateTempo() { return { bpm: 120, offset: 0, confidence: 1, rawBpm: 120 }; }
    async loadAudioFromBuffer() { this.audioBuffer = {}; this.duration = 8.375; }
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
import { stepperApi } from '../editor/api/stepperApi';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TWO_CHART_SM = `#TITLE:Transaction Fixture;
#ARTIST:Test Artist;
#MUSIC:expected.ogg;
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

const HOLD_SM = `#TITLE:Hold Fixture;
#ARTIST:Test Artist;
#OFFSET:0;
#BPMS:0=120;
#NOTES:
     dance-single:
     Hold:
     Hard:
     9:
     0,0,0,0,0:
2000
0100
3000
0001
;
`;

const MULTI_MUSIC_SSC = `#VERSION:0.83;
#TITLE:Multi Music;
#ARTIST:Test;
#OFFSET:0;
#BPMS:0=120;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DESCRIPTION:One;
#DIFFICULTY:Hard;
#METER:9;
#MUSIC:one.ogg;
#NOTES:
1000
0000
0000
0000
;
#NOTEDATA:;
#STEPSTYPE:dance-single;
#DESCRIPTION:Two;
#DIFFICULTY:Challenge;
#METER:11;
#MUSIC:two.ogg;
#NOTES:
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
    expect(container.textContent).toContain('/ 0:08.4');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="mode-full-btn"]')!.click();
    });
    expect(container.querySelector('[data-testid="measure-range-selector"]')?.textContent).toContain('Full Song');
    expect(container.querySelector('[data-testid="measure-range-selector"]')?.textContent).toContain('0.00–16.75');
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

  it('deletes a hold head and tail atomically and restores both on undo', async () => {
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{ name: 'hold.sm', text: async () => HOLD_SM }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('2000');
    expect(container.textContent).toContain('3000');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true }));
    });
    expect(container.textContent).not.toContain('2000');
    expect(container.textContent).not.toContain('3000');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }));
    });
    expect(container.textContent).toContain('2000');
    expect(container.textContent).toContain('3000');
  });

  it('shows the attached source and blocks generation after importing a chart for different audio', async () => {
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{ name: 'old.wav', arrayBuffer: async () => new ArrayBuffer(8) }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="audio-source-label"]')?.textContent).toContain('old.wav');
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{ name: 'fixture.sm', text: async () => TWO_CHART_SM }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="generate-btn"]')!.click();
    });
    expect(container.querySelector('[data-testid="generation-error-banner"]')?.textContent)
      .toContain("Attach the chart's audio (expected.ogg)");
  });

  it('installs the unload guard only after an unsaved chart edit', async () => {
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{ name: 'fixture.sm', text: async () => TWO_CHART_SM }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true }));
    });
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true }));
    });
    const exportedEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(exportedEvent);
    expect(exportedEvent.defaultPrevented).toBe(false);
  });

  it('rechecks chart-specific MUSIC when switching SSC charts', async () => {
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [
        { name: 'multi.ssc', text: async () => MULTI_MUSIC_SSC },
        { name: 'one.ogg', arrayBuffer: async () => new ArrayBuffer(8) },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="audio-source-label"]')?.textContent).toContain('one.ogg');
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="chart-btn-1"]')!.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="generate-btn"]')!.click(); });
    expect(container.querySelector('[data-testid="generation-error-banner"]')?.textContent)
      .toContain("Attach the chart's audio (two.ogg)");
  });

  it('does not treat Demo audio as attached audio for an imported chart without MUSIC', async () => {
    const noMusic = TWO_CHART_SM.replace('#MUSIC:expected.ogg;\n', '');
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [{ name: 'no-music.sm', text: async () => noMusic }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="generate-btn"]')!.click(); });
    expect(container.querySelector('[data-testid="generation-error-banner"]')?.textContent)
      .toContain('Attach audio for this imported chart');
  });

  it('discards a pending proposal for chart B after global timing changes on chart A', async () => {
    let resolveGeneration!: (value: any) => void;
    vi.mocked(stepperApi.generate).mockImplementationOnce(
      () => new Promise((resolve) => { resolveGeneration = resolve; })
    );
    await act(async () => {
      upload(container.querySelector('#fileInput')!, [
        { name: 'fixture.sm', text: async () => TWO_CHART_SM },
        { name: 'expected.ogg', arrayBuffer: async () => new ArrayBuffer(8) },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="chart-btn-1"]')!.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="generate-btn"]')!.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="chart-btn-0"]')!.click(); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', code: 'KeyT', shiftKey: true, bubbles: true }));
    });
    await act(async () => {
      setInput(container.querySelector<HTMLInputElement>('[data-testid="input-offset"]')!, '0.25');
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="btn-save-timing"]')!.click();
    });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="chart-btn-1"]')!.click(); });
    await act(async () => {
      resolveGeneration({
        placements: [{ beat: 1, arrows: '1000', chord_idx: 1, confidence: 0.9 }],
        latency_ms: 10,
        model_used: 'test',
      });
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="accept-btn"]')).toBeNull();
  });
});
