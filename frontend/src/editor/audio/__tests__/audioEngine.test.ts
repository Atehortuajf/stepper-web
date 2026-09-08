import { describe, it, expect } from 'vitest';
import { AudioEngine } from '../AudioEngine';
import { encodeWAV } from '../wavEncoder';
import { WaveformRenderer } from '../WaveformRenderer';
import { TimingEngine } from '../../engine/timingEngine';

describe('AudioEngine & WAV Encoder', () => {
  it('encodes Float32Array PCM samples into valid 16-bit WAV binary format', () => {
    const sampleRate = 44100;
    const numSamples = 1000;
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    // Generate simple sine tone
    for (let i = 0; i < numSamples; i++) {
      left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      right[i] = Math.sin((2 * Math.PI * 880 * i) / sampleRate);
    }

    const wavBuffer = encodeWAV([left, right], sampleRate);
    expect(wavBuffer.byteLength).toBe(44 + numSamples * 2 * 2); // 44-byte header + 2 channels * 2 bytes/sample

    const view = new DataView(wavBuffer);
    const readString = (offset: number, len: number) => {
      let str = '';
      for (let i = 0; i < len; i++) {
        str += String.fromCharCode(view.getUint8(offset + i));
      }
      return str;
    };

    // Verify RIFF header
    expect(readString(0, 4)).toBe('RIFF');
    expect(readString(8, 4)).toBe('WAVE');
    expect(readString(12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // 2 channels
    expect(view.getUint32(24, true)).toBe(sampleRate);
    expect(view.getUint16(34, true)).toBe(16); // 16 bits per sample
    expect(readString(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(numSamples * 4);
  });

  it('manages audio bookmarks accurately', () => {
    const engine = new AudioEngine();
    engine.duration = 60.0;

    engine.addBookmark(10.5, 'Intro');
    const bm2 = engine.addBookmark(30.0, 'Chorus');
    engine.addBookmark(5.0, 'Pre-Intro');


    expect(engine.bookmarks.length).toBe(3);
    // Bookmarks should be sorted chronologically
    expect(engine.bookmarks[0].time).toBe(5.0);
    expect(engine.bookmarks[1].time).toBe(10.5);
    expect(engine.bookmarks[2].time).toBe(30.0);

    // Jump navigation
    engine.seek(0);
    engine.jumpToNextBookmark();
    expect(engine.getCurrentTime()).toBe(5.0);

    engine.jumpToNextBookmark();
    expect(engine.getCurrentTime()).toBe(10.5);

    engine.jumpToPrevBookmark();
    expect(engine.getCurrentTime()).toBe(5.0);

    // Removal
    engine.removeBookmark(bm2.id);
    expect(engine.bookmarks.length).toBe(2);
    expect(engine.bookmarks.some((b) => b.id === bm2.id)).toBe(false);
  });

  it('clamps playback rates between 0.25x and 2.0x', () => {
    const engine = new AudioEngine();
    engine.setPlaybackRate(0.1);
    expect(engine.playbackRate).toBe(0.25);

    engine.setPlaybackRate(5.0);
    expect(engine.playbackRate).toBe(2.0);

    engine.setPlaybackRate(1.5);
    expect(engine.playbackRate).toBe(1.5);
  });

  it('renders waveform and beat grid on Canvas without exceptions', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 120;

    const timing = new TimingEngine({
      offset: -0.035,
      bpms: [{ beat: 0, bpm: 140 }],
      stops: [{ beat: 16, duration: 0.5 }],
    });

    // Mock peak pyramid
    const dummyMins = new Float32Array(100).fill(-0.5);
    const dummyMaxs = new Float32Array(100).fill(0.5);
    const peakPyramid = {
      sampleRate: 44100,
      duration: 30.0,
      levels: [
        { step: 128, mins: dummyMins, maxs: dummyMaxs },
      ],
    };

    expect(() => {
      WaveformRenderer.render({
        canvas,
        width: 800,
        height: 120,
        currentTime: 5.0,
        duration: 30.0,
        zoom: 2.0,
        scrollOffsetSec: 0.0,
        peakPyramid,
        spectrogram: null,
        showSpectrogram: false,
        timingEngine: timing,
        bookmarks: [{ id: '1', time: 4.0, name: 'Drop' }],
      });
    }).not.toThrow();
  });
});
