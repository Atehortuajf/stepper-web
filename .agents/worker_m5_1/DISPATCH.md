# Dispatch Assignment: Milestone M5 — Audio Playback & Synchronization Engine

## 2026-09-11T05:41:17Z

- **Role**: Worker (Audio Playback & Synchronization Engine)
- **Working Directory**: `/Users/ate/Projects/stepper-web/.agents/worker_m5_1`
- **Authoritative Request**: `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (read this first!)
- **Survey Findings**: `/Users/ate/Projects/stepper-web/.agents/survey_audio_1/handoff.md` (read this for exact root causes and architecture!)
- **Project Root**: `/Users/ate/Projects/stepper-web`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusively Owned Files:
- `frontend/src/editor/audio/AudioEngine.ts`
- `frontend/src/editor/ui/StepchartCanvas.tsx`
- `frontend/src/editor/audio/AudioWaveformViewer.tsx`
- `frontend/src/App.tsx` (only audio & canvas clock decoupling sections)

## Objectives:
Implement the fixes recommended in `survey_audio_1/handoff.md` to eliminate audio loading freezing, canvas stutter, and clock drift:
1. **Optimize/Defer `buildSpectrogram()` in `AudioEngine.ts`**:
   - Eliminate the 2.03-billion-iteration synchronous loop from `setAudioBuffer`. Audio loading must complete in <50ms with zero thread-locking.
   - For spectrogram display, use the precomputed Radix-2 Cooley-Tukey FFT (available in `clientFeatureExtract.ts`) on demand or lazy computation.
2. **Decouple Canvas & Waveform Render Loops from React State Tree**:
   - In `StepchartCanvas.tsx`:
     - Maintain canvas backing dimensions persistently; do NOT re-assign `canvas.width = canvasW * dpr` on every render frame. Only resize when container dimensions or DPR change.
     - Clear the frame using `ctx.fillRect(0, 0, canvasW, canvasH)`.
     - Implement internal `requestAnimationFrame` loop that queries `audioEngine.getCurrentTime()` directly during playback.
     - Pre-index hold spans into `{ headBeat, tailBeat, col, isRoll }` whenever `noteRows` changes so hold rendering is $O(\text{visible})$, eliminating the $O(N^2)$ array search.
     - Binary-search the visible note range (`bisectRight` or binary search) so note drawing begins at the first visible note and breaks when off-screen.
   - In `App.tsx`:
     - Eliminate the 60-120Hz `setCurrentPlaybackTime` root re-render cascade.
     - Decouple the canvas from `currentPlaybackTime` prop updates during active playback.
     - Throttle HUD text updates (BPM, measure, time display in `TransportBar`) to 10 Hz (every 100ms) or update via lightweight refs.
3. **Web Audio Latency & Resumption Compensation**:
   - In `AudioEngine.ts`:
     - Ensure `play()` properly awaits `ctx.resume()` before capturing `startCtxTime` and starting the source node.
     - In `getCurrentTime()`, account for hardware latency: `(ctx.outputLatency || 0) + (ctx.baseLatency || 0)`.
     - In `AudioWaveformViewer.tsx`, invoke `onTimeChange` only on explicit user pointer dragging/scrubbing, eliminating circular feedback loops with `startTicker`.
4. **Verification**:
   - Run Vitest suite: `npm test` in `frontend/`.
   - Run production build: `npm run build` in `frontend/`.
   - Ensure all tests pass with 0 errors.
5. Write your complete handoff report to `/Users/ate/Projects/stepper-web/.agents/worker_m5_1/handoff.md` and report back via send_message.
