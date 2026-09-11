## 2026-09-11T19:25:45Z

# Task Assignment for Worker 2 (Milestone 2: Audio-Only Tempo Estimation & Grid Sync)

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_2/handoff.md
- /Users/ate/Projects/stepper-web/frontend/src/editor/audio/
- /Users/ate/Projects/stepper-web/frontend/src/App.tsx
- Audio file: /Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ogg

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Implement `frontend/src/editor/audio/tempoEstimator.ts`:
   - Downsamples audio to 22.05 kHz.
   - Computes positive half-wave rectified spectral flux (STFT N=512, hop=128).
   - Computes direct autocorrelation across 60-240 BPM range.
   - Refines peak via 3-point parabolic interpolation for sub-BPM precision.
   - Disambiguates octave/harmonic ambiguity using resonating comb filter summation with a log-Gaussian tempo prior centered at 150 BPM.
   - Snaps to nearest integer if within ±0.20 BPM.
   - Computes phase offset $\phi \in [0, \text{beatPeriodSec})$ by cross-correlating beat pulse train with spectral flux, setting StepMania offset = $-\phi$.
2. Update `frontend/src/editor/audio/AudioEngine.ts` to export helper or integrate `estimateTempoAndOffset`.
3. Update `frontend/src/App.tsx` audio file upload handler (`handleAudioUpload`):
   - Replace the hardcoded `140.0 BPM` fallback (lines 953-954).
   - When an audio file is uploaded alone without a simfile, automatically run tempo estimation.
   - Update `simfile.timing` with estimated BPM and offset, updating `timingEngine.initialBpm` and the transport display.
   - Ensure the 48-tick Bresenham phase accumulator aligns with acoustic transients.
4. Add comprehensive unit tests in `frontend/src/editor/audio/__tests__/tempoEstimator.test.ts`.
5. Verify on `Crazy Jackpot.ogg` that estimated BPM is 170 BPM (within ±1.0 BPM).
6. Run `npm test` and `npm run build` in `frontend/` to ensure all tests pass and build succeeds with 0 errors.

File write ownership:
- `frontend/src/editor/audio/tempoEstimator.ts`
- `frontend/src/editor/audio/AudioEngine.ts`
- `frontend/src/App.tsx`
- `frontend/src/editor/audio/__tests__/tempoEstimator.test.ts`
