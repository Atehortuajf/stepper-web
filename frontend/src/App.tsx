/**
 * frontend/src/App.tsx
 * ArrowVortex-grade Dance Stepchart Editor — Utilitarian DAW Desktop & Mobile UI.
 * Integrates 16-D Technique Conditioning, Interactive AI Diff Generation,
 * and Viterbi Biomechanical Foot Parity Overlay.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AudioEngine } from './editor/audio/AudioEngine';
import { AudioWaveformViewer } from './editor/audio/AudioWaveformViewer';
import { encodeWAV } from './editor/audio/wavEncoder';
import { parseSimfile } from './editor/engine/msdParser';
import { serializeSM, serializeSSC } from './editor/engine/smSerializer';
import { ALL_SUBDIVISIONS, SUBDIVISION_COLORS, getSubdivisionColor } from './editor/engine/subdivisions';
import { TimingEngine } from './editor/engine/timingEngine';
import { beatToRow, getSmallestNoteTypeForMeasure, notesToMeasureGrids } from './editor/engine/measureUtil';
import type { Chart, Measure, NoteRow, Simfile } from './editor/engine/types';

import {
  DiffOverlay,
  MeasureRangeSelector,
  TechConditioningPanel,
  createDefaultTechVector,
  techVectorToArray,
} from './editor/conditioning';
import type { TechVectorDict } from './editor/conditioning';

import {
  HeatmapOverlay,
  ParityTrack,
  UnplayabilityBanner,
  solveParityLocally,
} from './editor/biomechanics';
import type { HeelToeTag, ParitySolveResult } from './editor/biomechanics';

import { stepperApi } from './editor/api/stepperApi';
import type { Placement } from './editor/api/stepperApi';

const DEFAULT_SM_CONTENT = `#TITLE:MAX 300;
#SUBTITLE:;
#ARTIST:Omega;
#CREDIT:Stepper AI;
#MUSIC:max300.mp3;
#OFFSET:-0.035000;
#SAMPLESTART:12.000000;
#SAMPLELENGTH:12.000000;
#SELECTABLE:YES;
#BPMS:0.000000=300.000000;
#STOPS:32.000000=0.500000;
#BGCHANGES:;
#KEYSOUNDS:;

#NOTES:
     dance-single:
     Challenge Chart:
     Challenge:
     15:
     0.850000,0.920000,0.150000,0.300000,0.450000:
1000
0100
0010
0001
,
1001
0000
0110
0000
,
1000
0100
0010
0001
,
0000
0000
0000
0000
;
`;

export function App() {
  const audioEngine = useMemo(() => new AudioEngine(), []);
  const [simfile, setSimfile] = useState<Simfile>(() => parseSimfile(DEFAULT_SM_CONTENT));
  const [activeChartIndex, setActiveChartIndex] = useState(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Backend Health / Device state
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [backendDevice, setBackendDevice] = useState<string>('');

  // 16-D Technique Conditioning state
  const [techVector, setTechVector] = useState<TechVectorDict>(() => createDefaultTechVector());
  const [difficultyTier, setDifficultyTier] = useState<number>(3); // Hard
  const [difficultyMeter, setDifficultyMeter] = useState<number>(15);

  // Generation & Range state
  const [rangeMode, setRangeMode] = useState<'range' | 'full'>('range');
  const [startMeasure, setStartMeasure] = useState<number>(0);
  const [endMeasure, setEndMeasure] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [proposedPlacements, setProposedPlacements] = useState<Placement[] | null>(null);
  const [generationLatency, setGenerationLatency] = useState<number | undefined>(undefined);
  const [modelUsed, setModelUsed] = useState<string | undefined>(undefined);

  // Parity & Biomechanics state
  const [parityResult, setParityResult] = useState<ParitySolveResult>(() => ({
    is_playable: true,
    total_cost: 0.0,
    foot_sequence: [],
    steps: [],
    stats: {
      total_steps: 0,
      alternation_rate: 1.0,
      crossovers: 0,
      candles: 0,
      footswitches: 0,
      holdswitches: 0,
      double_steps: 0,
      jacks: 0,
      brackets: 0,
    },
    warnings: [],
  }));

  const activeChart: Chart | undefined = simfile.charts[activeChartIndex] || simfile.charts[0];

  // Timing engine based on active chart
  const timingEngine = useMemo(() => {
    const timing = (activeChart && activeChart.timing) ? activeChart.timing : simfile.timing;
    return new TimingEngine(timing);
  }, [simfile.timing, activeChart]);

  // Initial synthetic audio and backend health check
  useEffect(() => {
    if (!audioEngine.audioBuffer) {
      const initialBpm = timingEngine.initialBpm || 140;
      audioEngine.generateSyntheticTrack(initialBpm, 45);
    }

    // Check backend health
    stepperApi
      .checkHealth()
      .then((h) => {
        setBackendStatus(h.status === 'ok' ? 'Online' : 'Degraded');
        setBackendDevice(h.device || (h.mps_available ? 'MPS' : 'CPU'));
      })
      .catch(() => {
        setBackendStatus('Local Mode');
        setBackendDevice('Client Engine');
      });

    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine, timingEngine.initialBpm]);

  // Re-solve biomechanical foot parity whenever active chart notes change
  useEffect(() => {
    if (!activeChart || !activeChart.noteRows || activeChart.noteRows.length === 0) {
      return;
    }

    let isCurrent = true;
    const bpms = simfile.timing.bpms.map((b) => ({ beat: b.beat, bpm: b.bpm }));

    // Try backend /api/solve-parity first
    stepperApi
      .solveParity({
        steps_type: activeChart.stepsType,
        notes: activeChart.noteRows.map((r) => ({ beat: r.beat, arrows: r.arrows })),
        bpms,
        difficulty_meter: activeChart.meter || difficultyMeter,
      })
      .then((res) => {
        if (!isCurrent) return;
        const steps = res.annotated_steps.map((s) => ({
          beat: s.beat,
          row: beatToRow(s.beat),
          arrows: s.arrows,
          foot: s.foot as any,
          cost: s.cost || 0.0,
          warning: s.warning,
          left_pos: s.left_pos as any,
          right_pos: s.right_pos as any,
          heelToe: (s.flags.is_bracket
            ? s.foot === 'L'
              ? 'LH'
              : 'RH'
            : s.foot === 'L'
            ? s.left_pos === 1
              ? 'LH'
              : 'LT'
            : s.right_pos === 1
            ? 'RH'
            : 'RT') as HeelToeTag,
          flags: s.flags,
        }));

        const warnings = res.annotated_steps
          .filter((s) => s.warning)
          .map((s, idx) => ({
            beat: s.beat,
            message: s.warning || '',
            severity: (s.warning || '').includes('unplayable') ? ('error' as const) : ('warning' as const),
            stepIndex: idx,
          }));

        setParityResult({
          is_playable: res.is_playable,
          total_cost: res.total_cost,
          foot_sequence: res.foot_sequence as any,
          steps,
          stats: res.stats || {
            total_steps: steps.length,
            alternation_rate: 1.0,
            crossovers: 0,
            candles: 0,
            footswitches: 0,
            holdswitches: 0,
            double_steps: 0,
            jacks: 0,
            brackets: 0,
          },
          warnings,
        });
      })
      .catch(() => {
        if (!isCurrent) return;
        // Fallback to local Viterbi solver seamlessly
        const localRes = solveParityLocally(
          activeChart.noteRows,
          activeChart.holds,
          bpms,
          activeChart.meter || difficultyMeter
        );
        setParityResult(localRes);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeChart, simfile.timing.bpms, difficultyMeter]);

  // Total measures computation
  const totalMeasures = useMemo(() => {
    if (!activeChart || !activeChart.notes) return 1;
    return Math.max(1, activeChart.notes.length);
  }, [activeChart]);

  const rangeStartBeat = rangeMode === 'full' ? 0.0 : startMeasure * 4.0;
  const rangeEndBeat = rangeMode === 'full' ? totalMeasures * 4.0 : endMeasure * 4.0;

  // Chart generation handler
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setProposedPlacements(null);

    const startBeat = rangeStartBeat;
    const numBeats = Math.max(4.0, rangeEndBeat - rangeStartBeat);
    const bpm = timingEngine.initialBpm || 140.0;
    const rawVector = techVectorToArray(techVector);

    // Prepare audio slice in base64 if audio data available
    let audioSliceBase64: string | null = null;
    if (audioEngine.channelData && audioEngine.channelData.length > 0) {
      try {
        const startSec = Math.max(0, timingEngine.beatToSeconds(startBeat));
        const endSec = Math.min(audioEngine.duration, timingEngine.beatToSeconds(startBeat + numBeats));
        const startSample = Math.floor(startSec * audioEngine.sampleRate);
        const endSample = Math.min(audioEngine.channelData[0].length, Math.floor(endSec * audioEngine.sampleRate));

        if (endSample > startSample) {
          const sliced = audioEngine.channelData.map((ch) => ch.slice(startSample, endSample));
          const wavBuf = encodeWAV(sliced, audioEngine.sampleRate);
          const bytes = new Uint8Array(wavBuf);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          audioSliceBase64 = btoa(binary);
        }
      } catch (err) {
        console.warn('Could not slice audio buffer, falling back to synthetic audio:', err);
      }
    }

    try {
      const resp = await stepperApi.generate({
        audio_slice: audioSliceBase64,
        difficulty: difficultyMeter,
        tech_vector: rawVector,
        start_beat: startBeat,
        num_beats: numBeats,
        bpm,
        threshold: 0.5,
      });

      setProposedPlacements(resp.placements);
      setGenerationLatency(resp.latency_ms);
      setModelUsed(resp.model_used);
    } catch (apiErr) {
      console.warn('Backend /api/generate unavailable or failed. Using client rule-based generator:', apiErr);

      // Client-side rule-based generator for offline preview
      const startTime = performance.now();
      const generated: Placement[] = [];
      const density = Math.min(1.0, 0.4 + (difficultyMeter / 25.0) * 0.6);
      const stepInterval = difficultyMeter >= 11 ? 0.25 : difficultyMeter >= 6 ? 0.5 : 1.0;

      const singleTracks = ['1000', '0100', '0010', '0001'];
      let lastTrack = 0;

      for (let b = startBeat; b < startBeat + numBeats; b += stepInterval) {
        if (Math.random() > density) continue;

        let chord = '0000';
        const isBracket = rawVector[3] > 0.4 && Math.random() < rawVector[3] * 0.5;
        const isJack = rawVector[9] > 0.4 && Math.random() < rawVector[9] * 0.6;
        const isFootswitch = rawVector[1] > 0.4 && Math.random() < rawVector[1] * 0.5;

        if (isBracket) {
          chord = '1100';
        } else if (isJack) {
          chord = singleTracks[lastTrack];
        } else if (isFootswitch) {
          chord = singleTracks[lastTrack];
        } else {
          lastTrack = (lastTrack + 1 + Math.floor(Math.random() * 3)) % 4;
          chord = singleTracks[lastTrack];
        }

        generated.push({
          beat: b,
          arrows: chord,
          chord_idx: 1,
          confidence: 0.95,
        });
      }

      setProposedPlacements(generated);
      setGenerationLatency(performance.now() - startTime);
      setModelUsed('fallback-local');
    } finally {
      setIsGenerating(false);
    }
  }, [rangeStartBeat, rangeEndBeat, timingEngine, techVector, difficultyMeter, audioEngine]);

  // Accept & Commit proposed notes to active chart
  const handleAcceptProposed = useCallback(
    (placements: Placement[]) => {
      if (!activeChart) return;

      // 1. Filter out notes within the range
      const remainingNotes = activeChart.noteRows.filter(
        (n) => n.beat < rangeStartBeat - 0.001 || n.beat >= rangeEndBeat + 0.001
      );

      // 2. Convert proposed placements to NoteRows
      const newRows: NoteRow[] = placements.map((p) => ({
        row: beatToRow(p.beat),
        beat: p.beat,
        arrows: p.arrows,
      }));

      // 3. Union and sort
      const mergedRows = [...remainingNotes, ...newRows].sort((a, b) => a.row - b.row);

      // 4. Update measures representation
      const isDoubles = activeChart.stepsType === 'dance-double';
      const panelCount = isDoubles ? 8 : 4;
      const grids = notesToMeasureGrids(mergedRows, { panelCount });
      const updatedMeasures: Measure[] = grids.map((grid) => {
        const opt = getSmallestNoteTypeForMeasure(grid);
        const stride = opt.stride;
        const numRows = opt.numRows;
        const lines: string[] = [];
        const emptyChord = '0'.repeat(panelCount);
        for (let r = 0; r < numRows; r++) {
          lines.push(grid.get(r * stride) || emptyChord);
        }
        return { lines };
      });

      const updatedChart: Chart = {
        ...activeChart,
        noteRows: mergedRows,
        notes: updatedMeasures,
      };

      const updatedCharts = [...simfile.charts];
      updatedCharts[activeChartIndex] = updatedChart;

      setSimfile({
        ...simfile,
        charts: updatedCharts,
      });

      setProposedPlacements(null);
    },
    [activeChart, rangeStartBeat, rangeEndBeat, simfile, activeChartIndex]
  );

  // Discard proposed notes
  const handleDiscardProposed = useCallback(() => {
    setProposedPlacements(null);
  }, []);

  // Simfile file loaders & exporters
  const handleLoadSimfileText = (text: string, filename?: string) => {
    const isSSC = filename?.toLowerCase().endsWith('.ssc');
    const parsed = parseSimfile(text, isSSC ? 'ssc' : 'sm');
    setSimfile(parsed);
    setActiveChartIndex(0);
    setProposedPlacements(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();

      if (name.endsWith('.sm') || name.endsWith('.ssc')) {
        const text = await file.text();
        handleLoadSimfileText(text, file.name);
      } else if (
        name.endsWith('.mp3') ||
        name.endsWith('.ogg') ||
        name.endsWith('.wav') ||
        name.endsWith('.flac') ||
        name.endsWith('.m4a')
      ) {
        const arrayBuffer = await file.arrayBuffer();
        await audioEngine.loadAudioFromBuffer(arrayBuffer);
      }
    }
    setFileInputKey((k) => k + 1);
  };

  const handleExportSSC = () => {
    const text = serializeSSC(simfile);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${simfile.title || 'stepchart'}.ssc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSM = () => {
    const text = serializeSM(simfile);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${simfile.title || 'stepchart'}.sm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentBeat = timingEngine.secondsToBeat(currentPlaybackTime);

  // Proposed notes map for ghost arrows overlay
  const proposedMap = useMemo(() => {
    const map = new Map<number, string>();
    if (proposedPlacements) {
      for (const p of proposedPlacements) {
        map.set(Math.round(p.beat * 48), p.arrows);
      }
    }
    return map;
  }, [proposedPlacements]);

  // Biomechanical steps lookup map
  const stepMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const s of parityResult.steps) {
      map.set(s.row, s);
    }
    return map;
  }, [parityResult.steps]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0c10] text-[#c9d1d9] font-sans overflow-hidden">
      {/* Top DAW Header Bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#12151e] border-b border-[#212636] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] animate-pulse" />
            <span className="font-bold text-sm tracking-wider text-white">STEPPER-WEB</span>
          </div>
          <span className="text-xs text-[#586074]">|</span>
          <span className="text-xs font-medium text-[#8b949e]">
            {simfile.title ? `${simfile.artist} — ${simfile.title}` : 'Untitled Simfile'}
          </span>
          {simfile.fileType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c2230] text-[#79c0ff] border border-[#2d374d] uppercase font-mono">
              .{simfile.fileType}
            </span>
          )}
          <span className="text-xs text-[#586074]">|</span>
          <span className="text-xs font-mono text-[#00e5ff]" data-testid="current-beat-indicator">
            Beat {currentBeat.toFixed(2)}
          </span>

          {/* Backend / Hardware Inference Status */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131722] border border-[#262f43] text-[10px] font-mono"
            title={`Backend Service Status: ${backendStatus} (${backendDevice})`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendStatus === 'Online' ? 'bg-[#00e676]' : 'bg-[#ffd000]'
              }`}
            />
            <span className="text-[#8b949e]">AI Service:</span>
            <span className="font-bold text-white">{backendDevice || backendStatus}</span>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <label className="cursor-pointer px-2.5 py-1 bg-[#1e2333] hover:bg-[#283045] border border-[#313952] rounded text-[#e6edf3] transition-colors">
            Open Audio / Simfile
            <input
              key={fileInputKey}
              type="file"
              multiple
              accept=".sm,.ssc,.mp3,.ogg,.wav"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <button
            type="button"
            onClick={handleExportSSC}
            className="px-2.5 py-1 bg-[#238636] hover:bg-[#2ea043] text-white rounded font-medium transition-colors"
          >
            Export .SSC
          </button>

          <button
            type="button"
            onClick={handleExportSM}
            className="px-2.5 py-1 bg-[#1e2333] hover:bg-[#283045] border border-[#313952] text-[#e6edf3] rounded transition-colors"
          >
            Export .SM
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: Metadata, Charts List, and 16-D Technique Conditioning */}
        <aside className="w-80 bg-[#0d1017] border-r border-[#1e2333] flex flex-col p-3 text-xs gap-3 overflow-y-auto shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7687]">
              Simfile Metadata
            </span>
            <div className="mt-1 space-y-1 bg-[#131722] p-2 rounded border border-[#202738]">
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Title:</span>
                <span className="text-white font-medium truncate max-w-[150px]">{simfile.title || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Artist:</span>
                <span className="text-white truncate max-w-[150px]">{simfile.artist || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Offset:</span>
                <span className="font-mono text-[#e6edf3]">{simfile.timing.offset.toFixed(4)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Initial BPM:</span>
                <span className="font-mono text-[#00e5ff]">{timingEngine.initialBpm.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Charts / Difficulties */}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7687]">
              Charts ({simfile.charts.length})
            </span>
            <div className="mt-1 space-y-1">
              {simfile.charts.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveChartIndex(idx);
                    setProposedPlacements(null);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded border transition-colors flex items-center justify-between ${
                    idx === activeChartIndex
                      ? 'bg-[#1f2638] border-[#388bfd] text-white font-semibold'
                      : 'bg-[#131722] border-[#202738] text-[#8b949e] hover:bg-[#181d2a]'
                  }`}
                  data-testid={`chart-btn-${idx}`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs">{c.difficulty}</span>
                    <span className="text-[10px] text-[#6e7687] font-mono">{c.stepsType}</span>
                  </div>
                  <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-[#0b0e14] border border-[#2b3245] text-[#00e5ff]">
                    {c.meter}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 16-D Technique Conditioning Panel */}
          <TechConditioningPanel
            techVector={techVector}
            onChange={setTechVector}
            difficultyTier={difficultyTier}
            onDifficultyTierChange={setDifficultyTier}
            difficultyMeter={difficultyMeter}
            onDifficultyMeterChange={setDifficultyMeter}
          />

          {/* Canonical StepMania Color Legend */}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7687]">
              StepMania Quantization Hues
            </span>
            <div className="grid grid-cols-2 gap-1 mt-1 font-mono text-[10px]">
              {ALL_SUBDIVISIONS.map((sub) => (
                <div
                  key={sub}
                  className="flex items-center gap-1.5 px-1.5 py-0.5 bg-[#131722] rounded border border-[#202738]"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: SUBDIVISION_COLORS[sub] }}
                  />
                  <span className="text-[#8b949e]">{sub}th</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Stage: Audio Waveform, Diff Controls, Parity Heatmap, and Note Stream */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0c10] overflow-hidden">
          {/* Top Audio Waveform Strip */}
          <div className="p-3 bg-[#0d1017] border-b border-[#1e2333]">
            <AudioWaveformViewer
              audioEngine={audioEngine}
              timingEngine={timingEngine}
              onTimeChange={(t) => setCurrentPlaybackTime(t)}
              height={100}
            />
          </div>

          {/* Active Chart Inspector & Generation / Parity Overlays */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-3">
            {activeChart ? (
              <>
                {/* Physical Unplayability Warning Banner */}
                <UnplayabilityBanner
                  isPlayable={parityResult.is_playable}
                  warnings={parityResult.warnings}
                  onJumpToBeat={(b) => {
                    const sec = timingEngine.beatToSeconds(b);
                    audioEngine.seek(sec);
                  }}
                />

                {/* AI Generation Toolbar & Measure Range Selector */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <MeasureRangeSelector
                    mode={rangeMode}
                    onModeChange={setRangeMode}
                    startMeasure={startMeasure}
                    onStartMeasureChange={setStartMeasure}
                    endMeasure={endMeasure}
                    onEndMeasureChange={setEndMeasure}
                    totalMeasures={totalMeasures}
                  />

                  {/* Transition Cost Heatmap Overlay */}
                  <HeatmapOverlay
                    steps={parityResult.steps}
                    stats={parityResult.stats}
                    totalCost={parityResult.total_cost}
                    isPlayable={parityResult.is_playable}
                    onSelectBeat={(b) => {
                      const sec = timingEngine.beatToSeconds(b);
                      audioEngine.seek(sec);
                    }}
                  />
                </div>

                {/* Interactive Chart Generation & Diff Preview Overlay */}
                <DiffOverlay
                  currentNotes={activeChart.noteRows}
                  proposedPlacements={proposedPlacements}
                  rangeStartBeat={rangeStartBeat}
                  rangeEndBeat={rangeEndBeat}
                  isGenerating={isGenerating}
                  latencyMs={generationLatency}
                  modelUsed={modelUsed}
                  onGenerate={handleGenerate}
                  onAccept={handleAcceptProposed}
                  onDiscard={handleDiscardProposed}
                />

                {/* 192-tick Note Stream Visualizer with Foot Parity Ribbon & Ghost Arrows */}
                <div className="bg-[#12151e] p-3 rounded border border-[#1e2333] space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider flex items-center gap-2">
                      <span>Note Stream & Foot Parity Ribbon</span>
                      <span className="text-[10px] font-mono text-[#00e5ff]">
                        ({activeChart.noteRows.length} rows)
                      </span>
                    </h3>

                    {/* Parity Ribbon Legend */}
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="flex items-center gap-1 text-[#00b0ff]">
                        <span className="w-2 h-2 rounded-full bg-[#00b0ff]" />
                        Left (L)
                      </span>
                      <span className="flex items-center gap-1 text-[#ff3366]">
                        <span className="w-2 h-2 rounded-full bg-[#ff3366]" />
                        Right (R)
                      </span>
                      <span className="flex items-center gap-1 text-[#9e3cff]">
                        <span className="w-2 h-2 rounded-sm bg-[#9e3cff]" />
                        Bracket (BR)
                      </span>
                      {proposedPlacements && (
                        <span className="flex items-center gap-1 text-[#00e676]">
                          <span className="w-2 h-2 rounded-full bg-[#00e676]" />
                          Ghost Arrow
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Note Grid Rows */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-xs">
                    {activeChart.noteRows.slice(0, 48).map((r, i) => {
                      const color = getSubdivisionColor(r.beat);
                      const parityStep = stepMap.get(r.row);
                      const ghostArrow = proposedMap.get(r.row);

                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between px-2 py-1.5 bg-[#0a0c10] rounded border border-[#1e2333] hover:border-[#2b354b] transition-colors"
                          data-testid={`note-stream-row-${r.beat.toFixed(2)}`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: color }}
                              title={`Subdivision Color: ${color}`}
                            />
                            <span className="text-[#8b949e] w-14">B {r.beat.toFixed(2)}</span>
                            <span className="font-bold tracking-widest text-white">{r.arrows}</span>

                            {/* Ghost arrow preview in contrasting green */}
                            {ghostArrow && ghostArrow !== r.arrows && (
                              <span
                                className="font-bold tracking-widest text-[#00e676] bg-[#00e67615] px-1 rounded border border-[#00e67644]"
                                title="Proposed Ghost Arrow"
                              >
                                → {ghostArrow}
                              </span>
                            )}
                          </div>

                          {/* Foot Parity Ribbon */}
                          <ParityTrack step={parityStep} showHeelToe={true} showCost={true} />
                        </div>
                      );
                    })}
                  </div>

                  {activeChart.noteRows.length > 48 && (
                    <p className="text-xs text-[#586074] mt-2 text-center">
                      Showing first 48 of {activeChart.noteRows.length} rows...
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[#586074]">
                No stepcharts loaded in this simfile.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
