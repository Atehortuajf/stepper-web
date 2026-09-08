/**
 * frontend/src/editor/ui/TransportBar.tsx
 * Utilitarian DAW Transport Bar & HUD (F15).
 * Strict tool-first Ableton Live / ArrowVortex aesthetic.
 * Displays tempo, time signature, offset, current beat/time, subdivision snap,
 * zoom, playback rate, and essential metadata.
 */

import React from 'react';
import type { SubdivisionTier } from '../engine/types';

export interface TransportBarProps {
  title: string;
  artist: string;
  bpm: number;
  offset: number;
  currentBeat: number;
  currentTimeSeconds: number;
  totalDurationSeconds: number;
  timeSignature?: { numerator: number; denominator: number };
  subdivisionSnap: SubdivisionTier;
  isPlaying: boolean;
  playbackRate: number;
  zoomLevel: number;
  fileType?: string;
  backendStatus: string;
  backendDevice: string;
  isMobileMode: boolean;
  onTogglePlay: () => void;
  onCycleSnap: (direction: 'finer' | 'coarser') => void;
  onOpenTimingDialog: () => void;
  onOpenFileUpload: () => void;
  onExportSSC: () => void;
  onExportSM: () => void;
  onToggleMobileMode: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const millis = Math.floor((s % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  title,
  artist,
  bpm,
  offset,
  currentBeat,
  currentTimeSeconds,
  totalDurationSeconds,
  timeSignature = { numerator: 4, denominator: 4 },
  subdivisionSnap,
  isPlaying,
  playbackRate,
  zoomLevel,
  fileType,
  backendStatus,
  backendDevice,
  isMobileMode,
  onTogglePlay,
  onCycleSnap,
  onOpenTimingDialog,
  onOpenFileUpload,
  onExportSSC,
  onExportSM,
  onToggleMobileMode,
}) => {
  const currentMeasure = Math.floor(currentBeat / timeSignature.numerator);
  const songLabel = title ? `${artist ? `${artist} — ` : ''}${title}` : 'Untitled Simfile';

  return (
    <header
      className="hud-bar flex items-center justify-between px-3 h-11 bg-[#161822] border-b border-[#232738] select-none shrink-0 w-full text-[#E0E2EC] font-mono text-xs"
      data-testid="hud-bar"
    >
      {/* Left Section: Brand, Song Title, File Type */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00e5ff88]" />
          <span className="font-bold tracking-wider text-white text-xs">STEPPER</span>
        </div>

        <span className="text-[#3D445D] hidden sm:inline">|</span>

        {/* HUD Title */}
        <span
          className="hud-title text-[#C0C4D6] font-medium truncate max-w-[140px] sm:max-w-[200px] md:max-w-[280px]"
          data-testid="hud-title"
          title={songLabel}
        >
          {songLabel}
        </span>

        {fileType && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-[#1F2434] text-[#79C0FF] border border-[#2E354B] uppercase font-mono shrink-0">
            .{fileType}
          </span>
        )}
      </div>

      {/* Middle Section: DAW Transport Readouts (BPM, Time, Beat, Measure, Snap) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={onTogglePlay}
          className={`px-2.5 py-1 rounded border font-bold text-xs transition-colors flex items-center gap-1 ${
            isPlaying
              ? 'bg-[#FF2A55] border-[#FF2A55] text-white'
              : 'bg-[#1F2434] border-[#363C52] text-[#E0E2EC] hover:bg-[#283048]'
          }`}
          title="Toggle Playback (Space)"
          data-testid="btn-play-transport"
        >
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          <span className="text-[9px] text-[#8A92A6] hidden md:inline">[Space]</span>
        </button>

        {/* HUD BPM & Timing Trigger */}
        <button
          type="button"
          onClick={onOpenTimingDialog}
          className="hud-bpm hover:bg-[#1F2434] px-1.5 py-0.5 rounded border border-transparent hover:border-[#363C52] text-[#00E5FF] font-bold transition-colors"
          data-testid="hud-bpm"
          title="Click or press Shift+T to adjust BPM & Timing"
        >
          {bpm.toFixed(2)} BPM
        </button>

        {/* Time Signature */}
        <span className="text-[#8A92A6] hidden lg:inline text-[11px]" title="Time Signature">
          {timeSignature.numerator}/{timeSignature.denominator}
        </span>

        {/* Offset */}
        <span className="text-[#8A92A6] hidden xl:inline text-[11px]" title="Audio Offset">
          Off: {offset.toFixed(3)}s
        </span>

        {/* HUD Time */}
        <span
          className="hud-time text-[#8A92A6] hidden md:inline text-[11px]"
          data-testid="hud-time"
          title="Current Time / Total Duration"
        >
          {formatTime(currentTimeSeconds)} / {formatTime(totalDurationSeconds)}
        </span>

        {/* HUD Beat & Measure */}
        <span
          className="hud-beat text-[#00E676] font-bold text-xs"
          data-testid="hud-beat"
          title="Current Beat and Measure"
        >
          Beat: {currentBeat.toFixed(2)} (M{currentMeasure})
        </span>

        {/* Current Beat Indicator for M3 test compatibility */}
        <span className="hidden" data-testid="current-beat-indicator">
          Beat {currentBeat.toFixed(2)}
        </span>

        {/* Snap / Subdivision indicator */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1F2434] border border-[#363C52] text-[#FFD000] cursor-pointer hover:border-[#00A2FF] transition-colors"
          onClick={() => onCycleSnap('finer')}
          title="Subdivision Snap: Left (finer) / Right (coarser)"
          data-testid="snap-indicator"
        >
          <span className="text-[10px] text-[#8A92A6]">snap:</span>
          <span className="font-bold text-xs">1/{subdivisionSnap}</span>
        </div>

        {/* DAW Zoom & Rate Badges (Desktop) */}
        <span className="text-[10px] text-[#8A92A6] hidden 2xl:inline" title="Waveform Zoom">
          zoom: {zoomLevel}x
        </span>
        <span className="text-[10px] text-[#8A92A6] hidden 2xl:inline" title="Playback Rate">
          rate: {playbackRate.toFixed(1)}x
        </span>
      </div>

      {/* Right Section: Actions & Mobile Switcher */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* AI Service Status */}
        <div
          className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#12141D] border border-[#232738] text-[10px]"
          title={`Stepper AI: ${backendStatus} (${backendDevice})`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendStatus === 'Online' || backendStatus === 'healthy'
                ? 'bg-[#00E676]'
                : 'bg-[#FFD000]'
            }`}
          />
          <span className="text-[#8A92A6] hidden lg:inline">AI:</span>
          <span className="font-bold text-[#C0C4D6]">{backendDevice || backendStatus}</span>
        </div>

        {/* Open Audio / Simfile */}
        <button
          type="button"
          onClick={onOpenFileUpload}
          className="hidden md:inline px-2 py-1 bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-[#E0E2EC] rounded text-[11px] transition-colors"
        >
          Open
        </button>

        {/* Export .SSC */}
        <button
          type="button"
          onClick={onExportSSC}
          className="px-2 py-1 bg-[#00E676] hover:bg-[#00c966] text-black font-bold rounded text-[11px] transition-colors"
          data-testid="btn-export"
          title="Export and Download .SSC (Ctrl+S)"
        >
          EXPORT
        </button>

        {/* Export .SM */}
        <button
          type="button"
          onClick={onExportSM}
          className="hidden lg:inline px-2 py-1 bg-[#1F2434] hover:bg-[#283048] border border-[#363C52] text-[#E0E2EC] rounded text-[11px] transition-colors"
        >
          .SM
        </button>

        {/* Viewport / Responsive Mode Toggle */}
        <button
          type="button"
          onClick={onToggleMobileMode}
          className={`px-1.5 py-1 rounded border text-[10px] font-bold uppercase transition-colors ${
            isMobileMode
              ? 'bg-[#00A2FF] border-[#00A2FF] text-black'
              : 'bg-[#1F2434] border-[#363C52] text-[#8A92A6] hover:text-white'
          }`}
          title="Toggle Mobile Touch Mode vs Desktop DAW Workspace"
          data-testid="toggle-mobile-mode"
        >
          {isMobileMode ? 'TOUCH' : 'DAW'}
        </button>
      </div>
    </header>
  );
};
