/**
 * frontend/src/editor/audio/AudioWaveformViewer.tsx
 * Interactive DAW Audio Waveform & Spectrogram component.
 * Features:
 * - HTML5 Canvas rendering with smooth scrubbing and high-precision playhead.
 * - Zoom controls (1x to 64x).
 * - Variable playback rates (0.25x, 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x).
 * - Spectrogram toggle and audio bookmarking.
 * - Synchronized beat grid locked to audio time across BPM changes and stops.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TimingEngine } from '../engine/timingEngine';
import { AudioEngine } from './AudioEngine';
import { WaveformRenderer } from './WaveformRenderer';

interface AudioWaveformViewerProps {
  audioEngine: AudioEngine;
  timingEngine?: TimingEngine;
  onTimeChange?: (timeSec: number) => void;
  height?: number;
}

export const AudioWaveformViewer: React.FC<AudioWaveformViewerProps> = ({
  audioEngine,
  timingEngine,
  onTimeChange,
  height = 120,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(() => audioEngine.isPlaying);
  const [duration, setDuration] = useState(() => audioEngine.duration);
  const [zoom, setZoom] = useState(1); // 1x to 64x
  const [playbackRate, setPlaybackRate] = useState(() => audioEngine.playbackRate);
  const [showSpectrogram, setShowSpectrogram] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Sync state from AudioEngine
  useEffect(() => {
    const unsubTime = audioEngine.onTimeUpdate((t) => {
      setCurrentTime(t);
      if (onTimeChange) onTimeChange(t);

      // Keep playhead in view during playback
      setScrollOffset((currentOffset) => {
        if (audioEngine.duration <= 0) return currentOffset;
        const baseWindowSec = Math.max(5.0, Math.min(audioEngine.duration, 30.0));
        const visibleDuration = baseWindowSec / zoom;
        if (t > currentOffset + visibleDuration * 0.8 || t < currentOffset) {
          return Math.max(0, t - visibleDuration * 0.2);
        }
        return currentOffset;
      });
    });

    const unsubState = audioEngine.onStateChange((playing) => {
      setIsPlaying(playing);
      setDuration(audioEngine.duration);
    });

    return () => {
      unsubTime();
      unsubState();
    };
  }, [audioEngine, onTimeChange, zoom]);


  // Redraw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    WaveformRenderer.render({
      canvas,
      width,
      height,
      currentTime,
      duration: audioEngine.duration,
      zoom,
      scrollOffsetSec: scrollOffset,
      peakPyramid: audioEngine.peakPyramid,
      spectrogram: audioEngine.spectrogram,
      showSpectrogram,
      timingEngine,
      bookmarks: audioEngine.bookmarks,
    });
  }, [audioEngine, currentTime, height, scrollOffset, showSpectrogram, timingEngine, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Window resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      draw();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Scrubbing & seeking handlers
  const calculateTimeFromEvent = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const fraction = x / rect.width;

    const baseWindowSec = Math.max(5.0, Math.min(audioEngine.duration, 30.0));
    const visibleDuration = baseWindowSec / zoom;
    const targetTime = scrollOffset + fraction * visibleDuration;
    return Math.max(0, Math.min(targetTime, audioEngine.duration));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = calculateTimeFromEvent(e.clientX);
    audioEngine.seek(t);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const t = calculateTimeFromEvent(e.clientX);
    audioEngine.seek(t);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture released
      }
    }
  };

  // Wheel zoom / scroll
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom in/out
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      const nextZoom = Math.max(1, Math.min(64, zoom * factor));
      setZoom(nextZoom);
    } else {
      // Horizontal scroll
      const baseWindowSec = Math.max(5.0, Math.min(audioEngine.duration, 30.0));
      const visibleDuration = baseWindowSec / zoom;
      const deltaSec = (e.deltaY / 100) * (visibleDuration * 0.1);
      setScrollOffset((prev) => Math.max(0, Math.min(audioEngine.duration - visibleDuration, prev + deltaSec)));
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  };

  // Rate change
  const handleRateChange = (rate: number) => {
    audioEngine.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  // Bookmark creation
  const handleAddBookmark = () => {
    const current = audioEngine.getCurrentTime();
    audioEngine.addBookmark(current);
    draw();
  };

  // Current beat formatted
  const currentBeat = timingEngine
    ? timingEngine.secondsToBeat(currentTime).toFixed(2)
    : '0.00';

  const isPausedStop = timingEngine ? timingEngine.isPausedAt(currentTime) : false;

  return (
    <div
      className="flex flex-col bg-[#12141c] border border-[#262a38] rounded select-none text-xs text-[#a0a8b8]"
      ref={containerRef}
    >
      {/* Waveform Controls Header */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#181b26] border-b border-[#262a38] gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className={`px-3 py-1 rounded font-semibold text-white transition-colors ${
              isPlaying
                ? 'bg-[#e53e3e] hover:bg-[#c53030]'
                : 'bg-[#00a2ff] hover:bg-[#0088dd]'
            }`}
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          <button
            type="button"
            onClick={() => audioEngine.stop()}
            className="px-2.5 py-1 bg-[#232736] hover:bg-[#2e3447] text-[#c0c6d4] rounded"
          >
            STOP
          </button>

          {/* Time & Beat Display */}
          <div className="flex items-center gap-2 font-mono text-[13px] bg-[#0c0d14] px-2.5 py-0.5 rounded border border-[#2b3042]">
            <span className="text-[#e2e8f0]">
              {Math.floor(currentTime / 60)}:
              {(currentTime % 60).toFixed(3).padStart(6, '0')}
              <span className="text-[#64748b] text-[11px] ml-1">
                / {Math.floor(duration / 60)}:{(duration % 60).toFixed(1).padStart(4, '0')}
              </span>
            </span>
            <span className="text-[#64748b]">|</span>

            <span className="text-[#00e5ff]">BEAT {currentBeat}</span>
            {isPausedStop && (
              <span className="px-1 text-[10px] bg-[#ff2a55] text-white rounded font-bold">
                STOP FREEZE
              </span>
            )}
          </div>
        </div>

        {/* Playback Rate, Zoom & Spectrogram */}
        <div className="flex items-center gap-2">
          {/* Playback Rates */}
          <div className="flex items-center gap-1">
            <span className="text-[#64748b]">Rate:</span>
            {[0.5, 0.75, 1.0, 1.5, 2.0].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRateChange(r)}
                className={`px-1.5 py-0.5 rounded text-[11px] ${
                  playbackRate === r
                    ? 'bg-[#00e5ff] text-black font-bold'
                    : 'bg-[#232736] hover:bg-[#2e3447] text-[#cbd5e1]'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>

          {/* Zoom Level */}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-[#64748b]">Zoom:</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z / 2))}
              className="px-1.5 py-0.5 bg-[#232736] hover:bg-[#2e3447] rounded"
            >
              -
            </button>
            <span className="font-mono text-[11px] w-7 text-center">{zoom}x</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(64, z * 2))}
              className="px-1.5 py-0.5 bg-[#232736] hover:bg-[#2e3447] rounded"
            >
              +
            </button>
          </div>

          {/* Spectrogram Toggle */}
          <button
            type="button"
            onClick={() => setShowSpectrogram(!showSpectrogram)}
            className={`px-2 py-0.5 rounded text-[11px] border ${
              showSpectrogram
                ? 'bg-[#9e3cff] text-white border-[#b357ff]'
                : 'bg-[#232736] border-[#31374a] text-[#94a3b8]'
            }`}
          >
            Spectrogram
          </button>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleAddBookmark}
            className="px-2 py-0.5 bg-[#232736] hover:bg-[#2e3447] text-[#ffd000] border border-[#3b3520] rounded text-[11px]"
          >
            + Bookmark
          </button>
        </div>
      </div>

      {/* Interactive Canvas Strip */}
      <div
        className="relative w-full cursor-crosshair overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="w-full block"
          style={{ height: `${height}px` }}
        />
      </div>
    </div>
  );
};
