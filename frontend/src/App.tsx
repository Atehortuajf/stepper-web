/**
 * frontend/src/App.tsx
 * ArrowVortex-grade Dance Stepchart Editor — Utilitarian DAW Desktop & Mobile UI (F15, F16, F17, F18).
 * Integrates 16-D Technique Conditioning, Interactive AI Diff Generation,
 * Viterbi Biomechanical Foot Parity Overlay, ArrowVortex Desktop Shortcuts,
 * and Mobile Responsive Touch Editing Workflow.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AudioEngine } from './editor/audio/AudioEngine';
import { AudioWaveformViewer } from './editor/audio/AudioWaveformViewer';
import { encodeWAV } from './editor/audio/wavEncoder';
import { parseSimfile } from './editor/engine/msdParser';
import { serializeSM, serializeSSC } from './editor/engine/smSerializer';
import { TimingEngine } from './editor/engine/timingEngine';
import { beatToRow, getSmallestNoteTypeForMeasure, notesToMeasureGrids } from './editor/engine/measureUtil';
import type { Chart, Measure, NoteRow, Simfile, SubdivisionTier } from './editor/engine/types';

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

import {
  InspectorPanel,
  MobileDrawer,
  MobileNoteSelector,
  MobileScrubBar,
  MobileTouchPad,
  StepchartCanvas,
  TimingModal,
  TransportBar,
} from './editor/ui';
import type { NoteToolType } from './editor/ui';

import {
  UndoRedoStack,
  cycleSubdivision,
  getSnapIntervalBeats,
  isInputFocused,
  parseKeyboardShortcut,
  quantizeBeat,
} from './editor/shortcuts/keyboardShortcuts';
import type { NoteTypeChar } from './editor/shortcuts/keyboardShortcuts';

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
  const [activeChartIndex, setActiveChartIndex] = useState<number>(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fileInputKey, setFileInputKey] = useState<number>(0);

  // Editor Snap & Tool state
  const [subdivisionSnap, setSubdivisionSnap] = useState<SubdivisionTier>(16);
  const [mobileTool, setMobileTool] = useState<NoteToolType>('TAP');
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());

  // Responsive & Modal state
  const [masterVolume, setMasterVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('stepper_volume');
      return saved !== null ? parseFloat(saved) : 0.7;
    } catch {
      return 0.7;
    }
  });

  const handleVolumeChange = useCallback(
    (vol: number) => {
      setMasterVolume(vol);
      audioEngine.setVolume(vol);
      try {
        localStorage.setItem('stepper_volume', String(vol));
      } catch {}
    },
    [audioEngine]
  );

  const [isMobileMode, setIsMobileMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isTimingModalOpen, setIsTimingModalOpen] = useState<boolean>(false);

  // 50-action Undo/Redo stack
  const undoStack = useMemo(() => new UndoRedoStack<Chart>(50), []);
  const [clipboardRow, setClipboardRow] = useState<string | null>(null);

  // Backend Health / Device state
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [backendDevice, setBackendDevice] = useState<string>('');
  const [engineMode, setEngineMode] = useState<'wasm' | 'backend' | 'auto'>('wasm');
  const [wasmStatus, setWasmStatus] = useState<string>('Initializing WASM...');

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
  const isDoubles = activeChart?.stepsType === 'dance-double';
  const panelCount = isDoubles ? 8 : 4;

  // Timing engine based on active chart
  const timingEngine = useMemo(() => {
    const timing = activeChart && activeChart.timing ? activeChart.timing : simfile.timing;
    return new TimingEngine(timing);
  }, [simfile.timing, activeChart]);

  const currentBeat = timingEngine.secondsToBeat(currentPlaybackTime);

  // Window resize listener for responsive detection
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsMobileMode(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Throttled HUD update (10 Hz = 100ms) to eliminate 60-120Hz root re-render cascade
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (isPlaying) {
      intervalId = setInterval(() => {
        if (audioEngine.isPlaying) {
          setCurrentPlaybackTime(audioEngine.getCurrentTime());
        }
      }, 100);
    } else {
      setCurrentPlaybackTime(audioEngine.getCurrentTime());
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, audioEngine]);

  // Synchronize playback state and time when playback finishes or changes externally
  useEffect(() => {
    const unsub = audioEngine.onStateChange((playing) => {
      setIsPlaying(playing);
      setCurrentPlaybackTime(audioEngine.getCurrentTime());
    });
    return unsub;
  }, [audioEngine]);

  // Initial synthetic audio, volume initialization, backend health check, and WASM preloading
  useEffect(() => {
    audioEngine.setVolume(masterVolume);

    if (!audioEngine.audioBuffer) {
      audioEngine.generateSyntheticTrack(140, 45);
    }

    // Initialize in 'wasm' mode directly for 100% offline-first operation
    stepperApi.setEngineMode('wasm');
    import('./editor/api').then(({ wasmInferenceEngine }) => {
      wasmInferenceEngine
        .initialize((pct) => setWasmStatus(`WASM ${pct}%`))
        .then((ready) => {
          setWasmStatus(ready ? 'ready' : 'WASM (Rule Fallback)');
        })
        .catch(() => {
          setWasmStatus('WASM (Rule Fallback)');
        });
    });

    stepperApi
      .checkHealth()
      .then((h) => {
        if (h.device === 'wasm-local') {
          setBackendStatus('Local Mode');
          setBackendDevice('WASM (In-Browser)');
        } else {
          setBackendStatus(h.status === 'ok' || h.status === 'healthy' ? 'Online' : 'Degraded');
          setBackendDevice(h.device || (h.mps_available ? 'MPS' : 'CPU'));
        }
      })
      .catch(() => {
        setBackendStatus('Local Mode');
        setBackendDevice('Client Engine');
      });
  }, [audioEngine]);

  // Dedicated AudioEngine disposal on unmount only
  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine]);

  // Re-solve biomechanical foot parity whenever active chart notes change
  useEffect(() => {
    if (!activeChart || !activeChart.noteRows || activeChart.noteRows.length === 0) {
      return;
    }

    let isCurrent = true;
    const bpms = simfile.timing.bpms.map((b) => ({ beat: b.beat, bpm: b.bpm }));

    stepperApi
      .solveParity({
        steps_type: activeChart.stepsType,
        notes: activeChart.noteRows.map((r) => ({ beat: r.beat, arrows: r.arrows })),
        holds: (activeChart.holds || []).map((h) => ({
          track: h.track,
          start_beat: h.startBeat,
          end_beat: h.endBeat,
          is_roll: h.isRoll,
        })),
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

  // Toggle Play / Pause
  const handleTogglePlay = useCallback(() => {
    if (audioEngine.isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
      setCurrentPlaybackTime(audioEngine.getCurrentTime());
    } else {
      audioEngine.play(currentPlaybackTime);
      setIsPlaying(true);
    }
  }, [audioEngine, currentPlaybackTime]);

  // Apply updated note rows to active chart and update measures representation
  const applyUpdatedRows = useCallback(
    (newRows: NoteRow[]) => {
      if (!activeChart) return;
      undoStack.push(activeChart);

      const grids = notesToMeasureGrids(newRows, { panelCount });
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
        noteRows: newRows,
        notes: updatedMeasures,
      };

      const updatedCharts = [...simfile.charts];
      updatedCharts[activeChartIndex] = updatedChart;

      setSimfile({
        ...simfile,
        charts: updatedCharts,
      });
    },
    [activeChart, panelCount, simfile, activeChartIndex, undoStack]
  );

  // Note Placement / Toggling
  const handlePlaceOrToggleNote = useCallback(
    (col: number, targetBeat: number, explicitChar?: NoteTypeChar) => {
      if (!activeChart) return;
      const beat = quantizeBeat(targetBeat, subdivisionSnap);
      const row = beatToRow(beat);

      // Determine note char based on explicit arg or mobile tool
      let charToPlace = explicitChar;
      if (!charToPlace) {
        if (mobileTool === 'TAP') charToPlace = '1';
        else if (mobileTool === 'HOLD') charToPlace = '2';
        else if (mobileTool === 'ROLL') charToPlace = '4';
        else if (mobileTool === 'MINE') charToPlace = 'M';
        else if (mobileTool === 'LIFT') charToPlace = 'L';
        else if (mobileTool === 'FAKE') charToPlace = 'F';
        else if (mobileTool === 'DEL') charToPlace = '0';
      }

      const existingRows = [...activeChart.noteRows];
      const rowIndex = existingRows.findIndex((r) => Math.abs(r.beat - beat) < 0.001);

      if (rowIndex >= 0) {
        const curRow = existingRows[rowIndex];
        const chars = curRow.arrows.split('');
        const curChar = chars[col];

        if (mobileTool === 'DEL' || charToPlace === '0') {
          chars[col] = '0';
        } else if (curChar === charToPlace) {
          chars[col] = '0'; // Toggle off
        } else {
          chars[col] = charToPlace || '1';
        }

        if (chars.every((c) => c === '0')) {
          existingRows.splice(rowIndex, 1);
        } else {
          existingRows[rowIndex] = {
            ...curRow,
            arrows: chars.join(''),
          };
        }
      } else if (mobileTool !== 'DEL' && charToPlace !== '0') {
        const chars = new Array(panelCount).fill('0');
        chars[col] = charToPlace || '1';
        existingRows.push({
          beat,
          row,
          arrows: chars.join(''),
        });
      }

      // If placing Hold ('2') or Roll ('4'), ensure a tail ('3') exists
      if (charToPlace === '2' || charToPlace === '4') {
        const tailBeat = beat + getSnapIntervalBeats(subdivisionSnap);
        const tailRowIndex = existingRows.findIndex((r) => Math.abs(r.beat - tailBeat) < 0.001);
        if (tailRowIndex >= 0) {
          const tChars = existingRows[tailRowIndex].arrows.split('');
          tChars[col] = '3';
          existingRows[tailRowIndex] = {
            ...existingRows[tailRowIndex],
            arrows: tChars.join(''),
          };
        } else {
          const tChars = new Array(panelCount).fill('0');
          tChars[col] = '3';
          existingRows.push({
            beat: tailBeat,
            row: beatToRow(tailBeat),
            arrows: tChars.join(''),
          });
        }
      }

      existingRows.sort((a, b) => a.row - b.row);
      applyUpdatedRows(existingRows);
    },
    [activeChart, subdivisionSnap, mobileTool, panelCount, applyUpdatedRows]
  );

  // Convert Hold <-> Roll shortcut (Backquote / `)
  const handleConvertHoldRoll = useCallback(
    (targetBeat: number) => {
      if (!activeChart) return;
      const beat = quantizeBeat(targetBeat, subdivisionSnap);
      const existingRows = [...activeChart.noteRows];
      const rowIndex = existingRows.findIndex((r) => Math.abs(r.beat - beat) < 0.001);
      if (rowIndex === -1) return;

      const curRow = existingRows[rowIndex];
      let hasConverted = false;
      const newChars = curRow.arrows.split('').map((c) => {
        if (c === '2') {
          hasConverted = true;
          return '4';
        }
        if (c === '4') {
          hasConverted = true;
          return '2';
        }
        return c;
      });

      if (hasConverted) {
        existingRows[rowIndex] = { ...curRow, arrows: newChars.join('') };
        applyUpdatedRows(existingRows);
      }
    },
    [activeChart, subdivisionSnap, applyUpdatedRows]
  );

  // Delete notes at cursor beat
  const handleDeleteNotesAtBeat = useCallback(
    (targetBeat: number) => {
      if (!activeChart) return;
      const beat = quantizeBeat(targetBeat, subdivisionSnap);
      const updated = activeChart.noteRows.filter((r) => Math.abs(r.beat - beat) >= 0.001);
      if (updated.length !== activeChart.noteRows.length) {
        applyUpdatedRows(updated);
      }
    },
    [activeChart, subdivisionSnap, applyUpdatedRows]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (!activeChart || !undoStack.canUndo()) return;
    const prev = undoStack.undo(activeChart);
    if (prev) {
      const updatedCharts = [...simfile.charts];
      updatedCharts[activeChartIndex] = prev;
      setSimfile({ ...simfile, charts: updatedCharts });
    }
  }, [activeChart, undoStack, simfile, activeChartIndex]);

  const handleRedo = useCallback(() => {
    if (!activeChart || !undoStack.canRedo()) return;
    const next = undoStack.redo(activeChart);
    if (next) {
      const updatedCharts = [...simfile.charts];
      updatedCharts[activeChartIndex] = next;
      setSimfile({ ...simfile, charts: updatedCharts });
    }
  }, [activeChart, undoStack, simfile, activeChartIndex]);

  // Clipboard Copy / Paste
  const handleCopy = useCallback(() => {
    if (!activeChart) return;
    const beat = quantizeBeat(currentBeat, subdivisionSnap);
    const row = activeChart.noteRows.find((r) => Math.abs(r.beat - beat) < 0.001);
    if (row) {
      setClipboardRow(row.arrows);
    }
  }, [activeChart, currentBeat, subdivisionSnap]);

  const handlePaste = useCallback(() => {
    if (!activeChart || !clipboardRow) return;
    const beat = quantizeBeat(currentBeat, subdivisionSnap);
    const existingRows = [...activeChart.noteRows];
    const rowIndex = existingRows.findIndex((r) => Math.abs(r.beat - beat) < 0.001);
    if (rowIndex >= 0) {
      existingRows[rowIndex] = { ...existingRows[rowIndex], arrows: clipboardRow };
    } else {
      existingRows.push({ beat, row: beatToRow(beat), arrows: clipboardRow });
    }
    existingRows.sort((a, b) => a.row - b.row);
    applyUpdatedRows(existingRows);
  }, [activeChart, clipboardRow, currentBeat, subdivisionSnap, applyUpdatedRows]);

  // Jump by delta beats
  const handleSeekDeltaBeats = useCallback(
    (deltaBeats: number) => {
      const newBeat = Math.max(0, currentBeat + deltaBeats);
      const newSec = timingEngine.beatToSeconds(newBeat);
      audioEngine.seek(newSec);
      setCurrentPlaybackTime(newSec);
    },
    [currentBeat, timingEngine, audioEngine]
  );

  // Jump by delta snap steps
  const handleSeekDeltaSnap = useCallback(
    (deltaSteps: number) => {
      const stepBeats = getSnapIntervalBeats(subdivisionSnap);
      handleSeekDeltaBeats(deltaSteps * stepBeats);
    },
    [subdivisionSnap, handleSeekDeltaBeats]
  );

  const handleExportSSC = useCallback(() => {
    const text = serializeSSC(simfile);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${simfile.title || 'stepchart'}.ssc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [simfile]);

  const handleExportSM = useCallback(() => {
    const text = serializeSM(simfile);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${simfile.title || 'stepchart'}.sm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [simfile]);

  // Global Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused(e.target)) return;

      const action = parseKeyboardShortcut(e, { isDoubles });
      if (!action) return;

      e.preventDefault();

      switch (action.type) {
        case 'PLACE_NOTE':
          if (action.column !== undefined) {
            handlePlaceOrToggleNote(action.column, currentBeat, action.noteChar);
            setActiveKeys((prev) => new Set(prev).add(action.column!));
            setTimeout(() => {
              setActiveKeys((prev) => {
                const next = new Set(prev);
                next.delete(action.column!);
                return next;
              });
            }, 120);
          }
          break;
        case 'CONVERT_HOLD_ROLL':
          handleConvertHoldRoll(currentBeat);
          break;
        case 'STEP_FORWARD':
          handleSeekDeltaSnap(1);
          break;
        case 'STEP_BACKWARD':
          handleSeekDeltaSnap(-1);
          break;
        case 'CYCLE_SNAP_FINER':
          setSubdivisionSnap((s) => cycleSubdivision(s, 'finer'));
          break;
        case 'CYCLE_SNAP_COARSER':
          setSubdivisionSnap((s) => cycleSubdivision(s, 'coarser'));
          break;
        case 'JUMP_MEASURE_FORWARD':
          handleSeekDeltaBeats(4.0);
          break;
        case 'JUMP_MEASURE_BACKWARD':
          handleSeekDeltaBeats(-4.0);
          break;
        case 'JUMP_START':
          audioEngine.seek(0);
          setCurrentPlaybackTime(0);
          break;
        case 'JUMP_END': {
          const lastBeat =
            activeChart?.noteRows && activeChart.noteRows.length > 0
              ? activeChart.noteRows[activeChart.noteRows.length - 1].beat
              : 16.0;
          const endSec = timingEngine.beatToSeconds(lastBeat);
          audioEngine.seek(endSec);
          setCurrentPlaybackTime(endSec);
          break;
        }
        case 'TOGGLE_PLAY':
          handleTogglePlay();
          break;
        case 'DELETE_NOTES':
          handleDeleteNotesAtBeat(currentBeat);
          break;
        case 'OPEN_TIMING':
          setIsTimingModalOpen(true);
          break;
        case 'EXPORT_SSC':
          handleExportSSC();
          break;
        case 'UNDO':
          handleUndo();
          break;
        case 'REDO':
          handleRedo();
          break;
        case 'COPY':
          handleCopy();
          break;
        case 'PASTE':
          handlePaste();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDoubles,
    currentBeat,
    subdivisionSnap,
    activeChart,
    timingEngine,
    audioEngine,
    handlePlaceOrToggleNote,
    handleConvertHoldRoll,
    handleDeleteNotesAtBeat,
    handleSeekDeltaSnap,
    handleSeekDeltaBeats,
    handleTogglePlay,
    handleUndo,
    handleRedo,
    handleCopy,
    handlePaste,
    handleExportSSC,
  ]);

  // Chart generation handler
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setProposedPlacements(null);

    const startBeat = rangeStartBeat;
    const numBeats = Math.max(4.0, rangeEndBeat - rangeStartBeat);
    const bpm = timingEngine.initialBpm || 140.0;
    const rawVector = techVectorToArray(techVector);

    let audioSliceBase64: string | null = null;
    let waveformSlice: Float32Array | undefined = undefined;
    if (audioEngine.channelData && audioEngine.channelData.length > 0) {
      try {
        const startSec = Math.max(0, timingEngine.beatToSeconds(startBeat));
        const endSec = Math.min(audioEngine.duration, timingEngine.beatToSeconds(startBeat + numBeats));
        const startSample = Math.floor(startSec * audioEngine.sampleRate);
        const endSample = Math.min(audioEngine.channelData[0].length, Math.floor(endSec * audioEngine.sampleRate));

        if (endSample > startSample) {
          const ch0 = audioEngine.channelData[0];
          const ch1 = audioEngine.channelData.length > 1 ? audioEngine.channelData[1] : ch0;
          const sliceLen = endSample - startSample;
          const mono = new Float32Array(sliceLen);
          for (let i = 0; i < sliceLen; i++) {
            mono[i] = (ch0[startSample + i] + ch1[startSample + i]) * 0.5;
          }
          waveformSlice = mono;

          if (engineMode === 'backend') {
            const sliced = audioEngine.channelData.map((ch) => ch.slice(startSample, endSample));
            const wavBuf = encodeWAV(sliced, audioEngine.sampleRate);
            const bytes = new Uint8Array(wavBuf);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            audioSliceBase64 = btoa(binary);
          }
        }
      } catch (err) {
        console.warn('Could not slice audio buffer, falling back to synthetic audio:', err);
      }
    }

    try {
      const resp = await stepperApi.generate(
        {
          audio_slice: audioSliceBase64,
          difficulty: difficultyMeter,
          tech_vector: rawVector,
          start_beat: startBeat,
          num_beats: numBeats,
          bpm,
          offset: timingEngine.offset,
          start_sec: timingEngine.beatToSeconds(startBeat),
          threshold: 0.5,
        },
        waveformSlice,
        (pct) => {
          setWasmStatus(`Generating ${pct}%`);
        }
      );

      setProposedPlacements(resp.placements);
      setGenerationLatency(resp.latency_ms);
      setModelUsed(resp.model_used);
    } catch {
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
        } else if (isJack || isFootswitch) {
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
      setWasmStatus((prev) => (prev.startsWith('Generating') ? 'ready' : prev));
    }
  }, [rangeStartBeat, rangeEndBeat, timingEngine, techVector, difficultyMeter, audioEngine, engineMode]);

  // Accept & Commit proposed notes to active chart
  const handleAcceptProposed = useCallback(
    (placements: Placement[]) => {
      if (!activeChart) return;

      const remainingNotes = activeChart.noteRows.filter(
        (n) => n.beat < rangeStartBeat - 0.001 || n.beat >= rangeEndBeat + 0.001
      );

      const newRows: NoteRow[] = placements.map((p) => ({
        row: beatToRow(p.beat),
        beat: p.beat,
        arrows: p.arrows,
      }));

      const mergedRows = [...remainingNotes, ...newRows].sort((a, b) => a.row - b.row);
      applyUpdatedRows(mergedRows);
      setProposedPlacements(null);
    },
    [activeChart, rangeStartBeat, rangeEndBeat, applyUpdatedRows]
  );

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

    let loadedSimfile = false;
    let loadedAudio = false;
    let audioFileName = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();

      if (name.endsWith('.sm') || name.endsWith('.ssc')) {
        try {
          const text = await file.text();
          handleLoadSimfileText(text, file.name);
          loadedSimfile = true;
        } catch (err) {
          console.error('Failed to parse simfile:', err);
        }
      } else if (
        name.endsWith('.mp3') ||
        name.endsWith('.ogg') ||
        name.endsWith('.wav') ||
        name.endsWith('.flac') ||
        name.endsWith('.m4a')
      ) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          await audioEngine.loadAudioFromBuffer(arrayBuffer);
          loadedAudio = true;
          audioFileName = file.name;
        } catch (err) {
          console.error('Failed to decode audio file:', err);
        }
      }
    }

    // Audio-only onboarding: when an audio file is uploaded without an accompanying .sm/.ssc
    if (loadedAudio && !loadedSimfile) {
      const cleanTitle = audioFileName.replace(/\.[^/.]+$/, '');
      const isDefaultSample = simfile.title === 'MAX 300' && simfile.artist === 'Omega';

      const baseChart: Chart = {
        stepsType: 'dance-single',
        description: 'AI Draft',
        difficulty: 'Challenge',
        meter: 12,
        notes: [],
        noteRows: [],
        holds: [],
      };

      const targetBpm = isDefaultSample ? 140.0 : timingEngine.initialBpm;

      setSimfile({
        version: 0.83,
        fileType: 'ssc',
        title: cleanTitle,
        subtitle: '',
        artist: 'Unknown Artist',
        titleTranslit: '',
        subtitleTranslit: '',
        artistTranslit: '',
        genre: '',
        credit: 'Stepper AI',
        banner: '',
        background: '',
        lyricsPath: '',
        cdTitle: '',
        music: audioFileName,
        sampleStart: 0,
        sampleLength: 12,
        selectable: 'YES',
        displayBpm: '',
        timing: {
          offset: 0.0,
          bpms: [{ beat: 0, bpm: targetBpm }],
          stops: [],
          delays: [],
          warps: [],
          timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
        },
        charts: [baseChart],
        metadata: {},
      });

      setActiveChartIndex(0);
      setProposedPlacements(null);
      setCurrentPlaybackTime(0);
      audioEngine.seek(0);
    } else if (loadedSimfile || loadedAudio) {
      setCurrentPlaybackTime(0);
      audioEngine.seek(0);
    }

    setFileInputKey((k) => k + 1);
  };


  const handleSaveTiming = (
    bpm: number,
    offset: number,
    timeSig: { numerator: number; denominator: number }
  ) => {
    const updatedBpms = [{ beat: 0, bpm }];
    const updatedTiming = {
      ...simfile.timing,
      offset,
      bpms: updatedBpms,
      timeSignatures: [{ beat: 0, numerator: timeSig.numerator, denominator: timeSig.denominator }],
    };
    setSimfile({
      ...simfile,
      timing: updatedTiming,
    });
  };

  // Mobile Touch Pad Arrow Press
  const handlePadPress = (colIndex: number) => {
    handlePlaceOrToggleNote(colIndex, currentBeat);
    // On touch pad press, advance cursor forward by 1 snap step for seamless touch sequence input
    handleSeekDeltaSnap(1);
  };

  const handleToggleEngineMode = useCallback(() => {
    setEngineMode((prev) => {
      const next = prev === 'wasm' ? 'backend' : 'wasm';
      stepperApi.setEngineMode(next);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen max-w-full overflow-x-hidden bg-[#0C0D12] text-[#E0E2EC] font-mono text-xs select-none">
      {/* Hidden file input */}
      <input
        key={fileInputKey}
        id="fileInput"
        type="file"
        multiple
        accept=".sm,.ssc,.mp3,.ogg,.wav"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top DAW Transport Bar & HUD */}
      <TransportBar
        title={simfile.title}
        artist={simfile.artist}
        bpm={timingEngine.initialBpm}
        offset={simfile.timing.offset}
        currentBeat={currentBeat}
        currentTimeSeconds={currentPlaybackTime}
        totalDurationSeconds={audioEngine.duration || 60}
        subdivisionSnap={subdivisionSnap}
        isPlaying={isPlaying}
        playbackRate={audioEngine.playbackRate}
        zoomLevel={4}
        fileType={simfile.fileType}
        backendStatus={backendStatus}
        backendDevice={backendDevice}
        engineMode={engineMode}
        wasmStatus={wasmStatus}
        onToggleEngineMode={handleToggleEngineMode}
        isMobileMode={isMobileMode}
        onTogglePlay={handleTogglePlay}
        onCycleSnap={(dir) => setSubdivisionSnap((s) => cycleSubdivision(s, dir))}
        onOpenTimingDialog={() => setIsTimingModalOpen(true)}
        onOpenFileUpload={() => document.getElementById('fileInput')?.click()}
        onExportSSC={handleExportSSC}
        onExportSM={handleExportSM}
        volume={masterVolume}
        onVolumeChange={handleVolumeChange}
        onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
      />

      {/* Timing Modal (Shift+T) */}
      <TimingModal
        isOpen={isTimingModalOpen}
        initialBpm={timingEngine.initialBpm}
        initialOffset={simfile.timing.offset}
        onSave={handleSaveTiming}
        onClose={() => setIsTimingModalOpen(false)}
      />

      {/* Main Workspace Body */}
      {isMobileMode ? (
        /* ================= MOBILE RESPONSIVE TOUCH WORKSPACE ================= */
        <div className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-hidden">
          {/* Waveform Scrubber Strip */}
          <div className="waveform-strip shrink-0" data-testid="waveform-strip">
            <AudioWaveformViewer
              audioEngine={audioEngine}
              timingEngine={timingEngine}
              onTimeChange={(t) => setCurrentPlaybackTime(t)}
              height={48}
            />
          </div>

          {/* Center Stage: Canvas & Receptors */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-hidden">
            <StepchartCanvas
              noteRows={activeChart?.noteRows || []}
              currentBeat={currentBeat}
              stepsType={activeChart?.stepsType}
              proposedPlacements={proposedPlacements}
              audioEngine={audioEngine}
              timingEngine={timingEngine}
              onBeatClick={(b) => {
                const sec = timingEngine.beatToSeconds(b);
                audioEngine.seek(sec);
                setCurrentPlaybackTime(sec);
              }}
              onColumnClick={(c, b) => handlePlaceOrToggleNote(c, b)}
              activeKeys={activeKeys}
              width={380}
              height={320}
            />
          </div>

          {/* Segmented Note Type Selector Strip */}
          <MobileNoteSelector activeTool={mobileTool} onSelectTool={setMobileTool} />

          {/* Directional Touch Pad */}
          <MobileTouchPad onPadPress={handlePadPress} isDoubles={isDoubles} />

          {/* Mobile Scrub Bar */}
          <MobileScrubBar
            currentBeat={currentBeat}
            totalBeats={totalMeasures * 4.0}
            subdivisionSnap={subdivisionSnap}
            onJumpMeasure={(delta) => handleSeekDeltaBeats(delta * 4.0)}
            onStepSnap={(delta) => handleSeekDeltaSnap(delta)}
            onScrubBeat={(b) => {
              const sec = timingEngine.beatToSeconds(b);
              audioEngine.seek(sec);
              setCurrentPlaybackTime(sec);
            }}
          />

          {/* Mobile Bottom Dock */}
          <footer className="bottom-dock flex items-center justify-between p-1 bg-[#161822] border-t border-[#232738] shrink-0" data-testid="bottom-dock">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="tool-btn flex-1 min-h-[48px] bg-[#1F2434] text-white font-bold"
              data-testid="btn-play"
            >
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>

            <button
              type="button"
              onClick={() => setSubdivisionSnap((s) => cycleSubdivision(s, 'finer'))}
              className="tool-btn flex-1 min-h-[48px] bg-[#1F2434] text-[#FFD000] font-bold"
              data-testid="btn-snap"
            >
              1/{subdivisionSnap}
            </button>

            <button
              id="toggleAiDrawer"
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="tool-btn flex-1 min-h-[48px] bg-[#1F2434] hover:bg-[#283048] text-[#00E5FF] font-bold"
              data-testid="btn-ai-drawer"
            >
              AI TOOL
            </button>

            <button
              type="button"
              onClick={handleExportSSC}
              className="tool-btn flex-1 min-h-[48px] bg-[#00E676] text-black font-bold"
              data-testid="btn-export"
            >
              EXPORT
            </button>
          </footer>

          {/* Slide-up Adaptive Drawer for Mobile AI & Parity */}
          <MobileDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            techVector={techVector}
            onChangeTechVector={setTechVector}
            difficultyMeter={difficultyMeter}
            onChangeDifficultyMeter={setDifficultyMeter}
            isGenerating={isGenerating}
            proposedPlacements={proposedPlacements}
            parityResult={parityResult}
            onGenerate={handleGenerate}
            onCommitDiff={() => {
              if (proposedPlacements) {
                handleAcceptProposed(proposedPlacements);
                setIsDrawerOpen(false);
              }
            }}
          />
        </div>
      ) : (
        /* ================= DESKTOP DAW WORKSPACE ================= */
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar: Metadata, Charts, 16-D Tech Conditioning */}
          <aside className="w-80 bg-[#0D1017] border-r border-[#1E2333] flex flex-col p-3 text-xs gap-3 overflow-y-auto shrink-0 font-mono">
            {/* Metadata */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E7687]">
                Simfile Metadata
              </span>
              <div className="mt-1 space-y-1 bg-[#131722] p-2 rounded border border-[#202738]">
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Title:</span>
                  <span className="text-white font-medium truncate max-w-[150px]">{simfile.title || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Artist:</span>
                  <span className="text-white truncate max-w-[150px]">{simfile.artist || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Offset:</span>
                  <span className="font-mono text-[#E0E2EC]">{simfile.timing.offset.toFixed(4)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Initial BPM:</span>
                  <span className="font-mono text-[#00E5FF]">{timingEngine.initialBpm.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Charts List */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E7687]">
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
                        ? 'bg-[#1F2638] border-[#388BFD] text-white font-semibold'
                        : 'bg-[#131722] border-[#202738] text-[#8B949E] hover:bg-[#181D2A]'
                    }`}
                    data-testid={`chart-btn-${idx}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs">{c.difficulty}</span>
                      <span className="text-[10px] text-[#6E7687] font-mono">{c.stepsType}</span>
                    </div>
                    <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-[#0B0E14] border border-[#2B3245] text-[#00E5FF]">
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
          </aside>

          {/* Center Stage: Audio Waveform, Canvas, Diff Controls */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#0A0C10] overflow-hidden">
            {/* Top Audio Waveform Strip */}
            <div className="p-3 bg-[#0D1017] border-b border-[#1E2333] shrink-0" data-testid="waveform-strip">
              <AudioWaveformViewer
                audioEngine={audioEngine}
                timingEngine={timingEngine}
                onTimeChange={(t) => setCurrentPlaybackTime(t)}
                height={80}
              />
            </div>

            {/* Work Area */}
            <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-3">
              {activeChart ? (
                <>
                  {/* Physical Unplayability Warning Banner */}
                  <UnplayabilityBanner
                    isPlayable={parityResult.is_playable}
                    warnings={parityResult.warnings}
                    onJumpToBeat={(b) => {
                      const sec = timingEngine.beatToSeconds(b);
                      audioEngine.seek(sec);
                      setCurrentPlaybackTime(sec);
                    }}
                  />

                  {/* AI Generation Toolbar & Measure Range Selector */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <MeasureRangeSelector
                      mode={rangeMode}
                      onModeChange={setRangeMode}
                      startMeasure={startMeasure}
                      onStartMeasureChange={setStartMeasure}
                      endMeasure={endMeasure}
                      onEndMeasureChange={setEndMeasure}
                      totalMeasures={totalMeasures}
                    />

                    <HeatmapOverlay
                      steps={parityResult.steps}
                      stats={parityResult.stats}
                      totalCost={parityResult.total_cost}
                      isPlayable={parityResult.is_playable}
                      onSelectBeat={(b) => {
                        const sec = timingEngine.beatToSeconds(b);
                        audioEngine.seek(sec);
                        setCurrentPlaybackTime(sec);
                      }}
                    />
                  </div>

                  {/* Diff Preview Overlay */}
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

                  {/* 192-tick Canvas Stepchart Stage */}
                  <div className="bg-[#12151E] p-3 rounded border border-[#1E2333] flex flex-col items-center">
                    <StepchartCanvas
                      noteRows={activeChart.noteRows}
                      currentBeat={currentBeat}
                      stepsType={activeChart.stepsType}
                      proposedPlacements={proposedPlacements}
                      audioEngine={audioEngine}
                      timingEngine={timingEngine}
                      onBeatClick={(b) => {
                        const sec = timingEngine.beatToSeconds(b);
                        audioEngine.seek(sec);
                        setCurrentPlaybackTime(sec);
                      }}
                      onColumnClick={(c, b) => handlePlaceOrToggleNote(c, b)}
                      activeKeys={activeKeys}
                      width={480}
                      height={360}
                    />
                  </div>

                  {/* Note stream rows list */}
                  <div className="bg-[#12151E] p-3 rounded border border-[#1E2333] space-y-2">
                    <h3 className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider flex items-center justify-between">
                      <span>Note Stream ({activeChart.noteRows.length} rows)</span>
                      <span className="text-[10px] text-[#00E5FF]">
                        Shortcuts: 1-4 place taps, Shift mines, Alt lifts, Ctrl fakes, Space play, Up/Down snap
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 font-mono text-xs max-h-48 overflow-y-auto">
                      {activeChart.noteRows.slice(0, 48).map((r, i) => {
                        const parityStep = parityResult.steps.find((s) => s.row === r.row);
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between px-2 py-1 bg-[#0A0C10] rounded border border-[#1E2333]"
                            data-testid={`note-stream-row-${r.beat.toFixed(2)}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[#8B949E] w-14">B {r.beat.toFixed(2)}</span>
                              <span className="font-bold tracking-widest text-white">{r.arrows}</span>
                            </div>
                            <ParityTrack step={parityStep} showHeelToe={true} showCost={true} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-[#586074]">
                  No stepcharts loaded in this simfile.
                </div>
              )}
            </div>
          </main>

          {/* Right Inspector & Parity Panel */}
          <InspectorPanel
            chart={activeChart}
            parityResult={parityResult}
            onJumpToBeat={(b) => {
              const sec = timingEngine.beatToSeconds(b);
              audioEngine.seek(sec);
              setCurrentPlaybackTime(sec);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
