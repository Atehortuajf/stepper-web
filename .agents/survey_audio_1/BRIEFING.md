# BRIEFING — 2026-09-11T05:40:00Z

## Mission
Investigate audio loading, decoding, playback, and canvas synchronization in stepper-web, diagnosing root causes for playback freezing/thread-locking, frame stutter/lag, and playhead drift, and recommending concrete fixes.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, audio-synchronization-investigation, architectural-diagnostics
- Working directory: /Users/ate/Projects/stepper-web/.agents/survey_audio_1
- Original parent: e76264c1-7379-4cb5-9638-5076f5033518
- Milestone: audio-playback-sync-survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Write ONLY to /Users/ate/Projects/stepper-web/.agents/survey_audio_1
- No source code edits in project tree
- Rigorous evidence chain with file paths, line numbers, and quotes

## Current Parent
- Conversation ID: e76264c1-7379-4cb5-9638-5076f5033518
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `frontend/src/editor/audio/AudioEngine.ts` (audio loading, decoding, STFT, peak pyramid, playback loop)
  - `frontend/src/editor/engine/timingEngine.ts` (piecewise timing, beat-to-seconds, seconds-to-beat, stops/delays)
  - `frontend/src/editor/ui/StepchartCanvas.tsx` (192-tick canvas rendering, useEffect trigger, canvas resizing, hold search)
  - `frontend/src/App.tsx` (top-level state, playback loop, React re-render cascade, note stream mapping)
  - `frontend/src/editor/audio/AudioWaveformViewer.tsx` & `WaveformRenderer.ts` (waveform & spectrogram rendering, scrub handlers, listeners)
  - `frontend/src/editor/ui/noteskins/celNoteskin.ts` (atlas vs vector fallback drawing)
  - `frontend/src/editor/audio/clientFeatureExtract.ts` (precomputed Radix-2 FFT baseline)
- **Key findings**:
  1. O(T * N^2) naive STFT computation in `buildSpectrogram()` (2.03 billion loop iterations with trig calls on main UI thread upon loading audio).
  2. Canvas hardware buffer reallocation (`canvas.width = canvasW * dpr`) on every frame inside `StepchartCanvas.tsx` useEffect.
  3. React root state re-render cascade: `setCurrentPlaybackTime` in root `App` at 60-120 Hz forces entire 1286-line component tree, including 48 DOM note rows with linear parity lookups, to re-render every frame.
  4. O(N^2) hold tail search: `noteRows.find()` executed per hold head from index 0 on every frame.
  5. Asynchronous `ctx.resume()` in `AudioEngine.play()` causes uncompensated startup time offset; missing outputLatency compensation.
  6. Competing rAF loops and circular state updates between `AudioEngine`, `AudioWaveformViewer`, and `App.tsx`.
- **Unexplored areas**: None regarding audio and synchronization engine.

## Key Decisions Made
- Fully diagnosed root causes across AudioEngine, timingEngine, StepchartCanvas, and App.tsx.
- Formulated concrete decoupled architectural fix: Web Audio clock-driven canvas loop, lazy worker STFT, pre-indexed holds, persistent canvas backing store, and throttled/ref-based HUD readouts.

## Artifact Index
- handoff.md — Final survey report
- progress.md — Heartbeat and status log
