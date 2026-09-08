/**
 * frontend/src/editor/audio/WaveformRenderer.ts
 * High-performance HTML5 Canvas audio waveform & spectrogram renderer.
 * Features:
 * - Multi-level zoom (1x to 64x) with smooth horizontal scrubbing.
 * - Synchronized beat grid lines colored by canonical StepMania subdivision colors.
 * - Spectrogram heat-map rendering.
 * - Interactive audio bookmark pins and playhead cursor.
 */

import { getSubdivisionColor } from '../engine/subdivisions';
import { TimingEngine } from '../engine/timingEngine';
import type { AudioBookmark, PeakPyramid, SpectrogramData } from './AudioEngine';


export interface RenderOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  currentTime: number;
  duration: number;
  zoom: number; // 1x to 64x
  scrollOffsetSec: number; // time corresponding to left edge of canvas
  peakPyramid: PeakPyramid | null;
  spectrogram: SpectrogramData | null;
  showSpectrogram?: boolean;
  timingEngine?: TimingEngine;
  bookmarks?: AudioBookmark[];
  cursorColor?: string;
  waveformColor?: string;
  backgroundColor?: string;
}

export class WaveformRenderer {
  /**
   * Renders the complete audio strip: background, spectrogram, waveform,
   * beat markers, bookmarks, and cursor.
   */
  public static render(options: RenderOptions): void {
    const {
      canvas,
      width,
      height,
      currentTime,
      duration,
      zoom,
      scrollOffsetSec,
      peakPyramid,
      spectrogram,
      showSpectrogram = false,
      timingEngine,
      bookmarks = [],
      cursorColor = '#ff2a55',
      waveformColor = '#00e5ff',
      backgroundColor = '#0e1015',
    } = options;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (duration <= 0) {
      // Empty track placeholder
      ctx.fillStyle = '#2b3040';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No audio track loaded. Drop an MP3, OGG, or WAV file.', width / 2, height / 2);
      ctx.restore();
      return;
    }

    // Time window calculation:
    // At zoom 1x, base visible window is e.g. min(duration, 30 seconds).
    // At zoom 64x, visible window is base / 64.
    const baseWindowSec = Math.max(5.0, Math.min(duration, 30.0));
    const visibleDuration = baseWindowSec / Math.max(1.0, Math.min(64.0, zoom));
    const pixelsPerSec = width / visibleDuration;

    const startTime = scrollOffsetSec;
    const endTime = scrollOffsetSec + visibleDuration;

    // Helper: converts time in seconds to canvas X pixel coordinate
    const timeToX = (t: number) => (t - startTime) * pixelsPerSec;


    // 2. Spectrogram Layer (if enabled)
    if (showSpectrogram && spectrogram) {
      this.drawSpectrogram(ctx, spectrogram, startTime, endTime, width, height);
    }

    // 3. Beat Grid Lines (synchronized with TimingEngine)
    if (timingEngine) {
      this.drawBeatGrid(ctx, timingEngine, startTime, endTime, timeToX, height);
    }

    // 4. Waveform Layer (Peak Pyramid)
    if (peakPyramid) {
      this.drawWaveform(ctx, peakPyramid, startTime, endTime, width, height, waveformColor);
    }

    // 5. Audio Bookmarks
    this.drawBookmarks(ctx, bookmarks, timeToX, height);

    // 6. Center Axis Line
    const midY = height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // 7. Visual Cursor
    const cursorX = timeToX(currentTime);
    if (cursorX >= 0 && cursorX <= width) {
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();

      // Draw playhead triangle indicator
      ctx.fillStyle = cursorColor;
      ctx.beginPath();
      ctx.moveTo(cursorX - 5, 0);
      ctx.lineTo(cursorX + 5, 0);
      ctx.lineTo(cursorX, 8);
      ctx.closePath();
      ctx.fill();
    }

    // 8. Time ruler ticks
    this.drawTimeRuler(ctx, startTime, endTime, timeToX, height);

    ctx.restore();
  }

  private static drawWaveform(
    ctx: CanvasRenderingContext2D,
    pyramid: PeakPyramid,
    startTime: number,
    endTime: number,
    width: number,
    height: number,
    waveformColor: string
  ): void {
    const sr = pyramid.sampleRate;
    const midY = height / 2;
    const maxHalfHeight = (height / 2) * 0.85;

    // Choose optimal pyramid level based on pixels and duration
    const totalSamplesInView = (endTime - startTime) * sr;
    const samplesPerPixel = totalSamplesInView / width;

    let chosenLevel = pyramid.levels[0];
    for (let l = pyramid.levels.length - 1; l >= 0; l--) {
      if (pyramid.levels[l].step <= samplesPerPixel) {
        chosenLevel = pyramid.levels[l];
        break;
      }
    }

    const { step, mins, maxs } = chosenLevel;
    const startBucket = Math.max(0, Math.floor((startTime * sr) / step));
    const endBucket = Math.min(mins.length - 1, Math.ceil((endTime * sr) / step));

    ctx.fillStyle = waveformColor;
    ctx.strokeStyle = waveformColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let b = startBucket; b <= endBucket; b++) {
      const bucketTime = (b * step) / sr;
      const x = ((bucketTime - startTime) / (endTime - startTime)) * width;

      const minVal = mins[b];
      const maxVal = maxs[b];

      const yTop = midY - maxVal * maxHalfHeight;
      const yBottom = midY - minVal * maxHalfHeight;
      const barH = Math.max(1.5, yBottom - yTop);

      ctx.fillRect(Math.floor(x), yTop, Math.max(1, Math.ceil(width / (endBucket - startBucket + 1))), barH);
    }
  }

  private static drawSpectrogram(
    ctx: CanvasRenderingContext2D,
    spectrogram: SpectrogramData,
    startTime: number,
    endTime: number,
    width: number,
    height: number
  ): void {
    const { timeBins, freqBins, hopSize, sampleRate, magnitudes } = spectrogram;
    const binDuration = hopSize / sampleRate;

    const startBin = Math.max(0, Math.floor(startTime / binDuration));
    const endBin = Math.min(timeBins - 1, Math.ceil(endTime / binDuration));

    if (startBin >= endBin) return;

    const colWidth = Math.max(1, width / (endBin - startBin));

    for (let t = startBin; t <= endBin; t++) {
      const x = ((t * binDuration - startTime) / (endTime - startTime)) * width;

      for (let f = 0; f < freqBins; f++) {
        // High frequencies at top, low frequencies at bottom
        const y = height - (f / freqBins) * height;
        const h = Math.max(1, height / freqBins);
        const intensity = magnitudes[t * freqBins + f];

        if (intensity > 0.05) {
          // Heat map color palette (Dark Purple -> Magenta -> Orange -> Yellow)
          const r = Math.floor(Math.min(255, intensity * 255 * 1.5));
          const g = Math.floor(Math.max(0, (intensity - 0.4) * 255 * 1.6));
          const b = Math.floor(Math.max(0, (0.7 - intensity) * 255 * 1.2));
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.6, intensity * 0.8)})`;
          ctx.fillRect(x, y - h, colWidth + 0.5, h + 0.5);
        }
      }
    }
  }

  private static drawBeatGrid(
    ctx: CanvasRenderingContext2D,
    timing: TimingEngine,
    startTime: number,
    endTime: number,
    timeToX: (t: number) => number,
    height: number
  ): void {
    const startBeat = Math.floor(timing.secondsToBeat(startTime));
    const endBeat = Math.ceil(timing.secondsToBeat(endTime));

    // Limit grid density to prevent performance collapse when zoomed far out
    const totalBeatsInView = endBeat - startBeat;
    let beatStep = 1; // 4th notes
    if (totalBeatsInView > 120) beatStep = 4; // measure only
    if (totalBeatsInView > 300) beatStep = 16; // 4 measures

    for (let b = startBeat; b <= endBeat; b += beatStep) {
      const t = timing.beatToSeconds(b);
      if (t < startTime || t > endTime) continue;

      const x = timeToX(t);
      const isMeasure = Math.abs(b % 4) < 1e-4;

      if (isMeasure) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Measure number badge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px monospace';
        ctx.fillText(`M${Math.round(b / 4)}`, x + 2, 10);
      } else {
        const color = getSubdivisionColor(b);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  private static drawBookmarks(
    ctx: CanvasRenderingContext2D,
    bookmarks: AudioBookmark[],
    timeToX: (t: number) => number,
    height: number
  ): void {
    for (const bm of bookmarks) {
      const x = timeToX(bm.time);
      const color = bm.color || '#ffd000';

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Bookmark flag pin
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 10, 5);
      ctx.lineTo(x, 10);
      ctx.closePath();
      ctx.fill();

      // Bookmark label
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillText(bm.name, x + 2, 22);
    }
  }

  private static drawTimeRuler(
    ctx: CanvasRenderingContext2D,
    startTime: number,
    endTime: number,
    timeToX: (t: number) => number,
    height: number
  ): void {
    const range = endTime - startTime;
    // Select reasonable time step: 0.5s, 1s, 2s, 5s, 10s
    let step = 1.0;
    if (range < 2) step = 0.25;
    else if (range < 5) step = 0.5;
    else if (range < 15) step = 1.0;
    else if (range < 30) step = 2.0;
    else step = 5.0;

    const firstTick = Math.ceil(startTime / step) * step;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '9px monospace';

    for (let t = firstTick; t <= endTime; t += step) {
      const x = timeToX(t);
      ctx.fillRect(x, height - 6, 1, 6);

      const mins = Math.floor(t / 60);
      const secs = (t % 60).toFixed(step < 1 ? 2 : 0).padStart(step < 1 ? 5 : 2, '0');
      const text = `${mins}:${secs}`;
      ctx.fillText(text, x - 10, height - 8);
    }
  }
}
