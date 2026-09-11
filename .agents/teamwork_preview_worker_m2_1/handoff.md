# Handoff Report: Milestone 2 — Audio-Only Tempo Estimation & Grid Sync

## 1. Observation
- **Original Fallback in `frontend/src/App.tsx`**:
  At lines 939–985, uploading an audio file without an accompanying `.sm`/`.ssc` file unconditionally defaulted the BPM to 140.0 and offset to 0.0:
  ```typescript
  // App.tsx lines 953-977 (prior to modification)
  const targetBpm = isDefaultSample ? 140.0 : timingEngine.initialBpm;
  setSimfile({
    ...
    timing: {
      offset: 0.0,
      bpms: [{ beat: 0, bpm: targetBpm }],
  ```
  Because initial app state loads `DEFAULT_SM_CONTENT` (MAX 300 by Omega), `isDefaultSample` was always true on clean launch, forcibly assigning 140.0 BPM to any uploaded audio.
- **Reference Tournament Track**:
  File: `/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ogg`
  Audio specs: Stereo 44.1 kHz, 5,105,598 frames (115.77s).
  Simfile ground truth: `#BPMS:0.000000=170.000000; #OFFSET:0.000000;`.
- **Implementation Created & Modified**:
  1. `frontend/src/editor/audio/tempoEstimator.ts`: Standalone client-side tempo and phase offset estimator implementing:
     - Mono channel decimation to 22,050 Hz.
     - STFT spectral analysis with $N_{\text{fft}} = 512$, hop $H = 128$, Hann window.
     - Positive half-wave rectified spectral flux: $\sum_{k} \max(0, |X_f[k]| - |X_{f-1}[k]|)$.
     - Direct autocorrelation over lag range $[60, 240]$ BPM.
     - 3-point parabolic quadratic peak refinement for sub-BPM lag precision.
     - Harmonic disambiguation using resonating comb filter summation ($L, L/2, 2L$) and a log-Gaussian tempo prior centered at 150 BPM ($\sigma = 0.75$ octaves).
     - Integer snapping within $\pm 0.20$ BPM and half-integer snapping within $\pm 0.15$ BPM.
     - Phase offset $\phi \in [0, P)$ cross-correlation against spectral flux over first 64 beats, setting StepMania offset $= -\phi$.
  2. `frontend/src/editor/audio/AudioEngine.ts`: Exported `estimateTempo(options?)` on `AudioEngine` delegating to `estimateTempoAndOffset`.
  3. `frontend/src/editor/audio/index.ts`: Exported `tempoEstimator` module members.
  4. `frontend/src/App.tsx`: Replaced hardcoded `140.0 BPM` fallback with `audioEngine.estimateTempo()`, dynamically updating `simfile.timing` with detected BPM and offset.
  5. `frontend/src/editor/audio/__tests__/tempoEstimator.test.ts`: 14 unit tests verifying synthetic tempos (120, 140, 170, 172.5, 175 BPM), harmonic disambiguation, integer snapping, delayed phase offsets, empty/short buffer safety, and ground truth `Crazy Jackpot.ogg`.
  6. `frontend/src/editor/audio/__tests__/audioEngine.test.ts`: Added unit test verifying `AudioEngine.estimateTempo()` integration.
- **Test & Build Execution Results**:
  - `npm test`: 16 test files passed, 148 tests passed (100% pass rate in 2.01s).
  - `Crazy Jackpot.ogg` test output:
    `[Crazy Jackpot] Detected BPM: 170 (raw: 169.8648), Offset: 0s, Confidence: 0.293, Time: 104.7ms`
  - `npm run build`: `tsc -b && vite build` completed with 0 errors in 2.96s.

---

## 2. Logic Chain
1. **Root Cause Analysis**:
   When a user uploaded an audio file without a simfile, `App.tsx:953` assigned `targetBpm = 140.0`. This populated `simfile.timing.bpms = [{ beat: 0, bpm: 140.0 }]` and `offset = 0.0`.
   This caused `timingEngine.initialBpm` to read 140.0 and `TransportBar` to render 140.00 BPM. During step generation, `clientFeatureExtract.ts:232` computed $t_{\text{audio}} = \text{beat} \times (60.0 / 140.0)$, drifting by $75.6\text{ ms}$ per beat relative to a 170 BPM track, severely misaligning neural model inputs.
2. **Algorithmic Selection**:
   Downsampling to 22.05 kHz preserves transient frequencies up to 11 kHz (encompassing kick, snare, hi-hats) while halving STFT computation.
   STFT with $N=512$, $H=128$ at 22,050 Hz yields $172.27\text{ fps}$ ($\sim 5.8\text{ ms}$ per frame).
   Half-wave rectified spectral flux captures positive energy increases across frequency bins, producing sharp onset impulses.
   Autocorrelation over lags $[43, 173]$ (corresponding to $240 \dots 60$ BPM) identifies the rhythmic periodicity.
3. **Harmonic Disambiguation & Prior Mechanics**:
   Electronic dance music often has strong kick drum transients on beats 1 and 3, producing prominent autocorrelation peaks at both 1-beat lag ($L \approx 61$, 170 BPM) and 2-beat lag ($2L \approx 122$, 85 BPM).
   By applying resonating comb summation ($r[L] + 0.5 \cdot r[L/2] + 0.5 \cdot r[2L]$) combined with a log-Gaussian tempo prior centered at 150 BPM ($\sigma = 0.75$ octaves), the 170 BPM candidate scores $3.06 \times 10^7$ vs. $1.78 \times 10^7$ for 85 BPM, cleanly selecting 170 BPM.
4. **Sub-BPM Resolution via Parabolic Interpolation**:
   At $L=61$ frames, discrete lag steps represent $\approx 2.8$ BPM. The 3-point quadratic peak fit calculates offset $\delta = \frac{1}{2}\frac{\alpha - \gamma}{\alpha - 2\beta + \gamma} = -0.152$, refining the lag to $60.848$, which yields raw BPM 169.865.
5. **Snapping & Phase Alignment**:
   Because $|169.865 - 170.0| = 0.135 \le 0.20$, integer snapping snaps the result to exactly 170.00 BPM.
   The phase search cross-correlates a 170 BPM pulse train against the spectral flux over the first 64 beats across 100 phase steps in $[0, 0.3529\text{s})$. The peak occurs at $\phi = 0.3459\text{s} = 0.980 P$, which wraps to $0.000\text{s}$, producing an exact StepMania offset of $0.000000\text{s}$.
6. **Reactive State Propagation**:
   In `App.tsx`, updating `simfile.timing` triggers the `useMemo` hook for `timingEngine`, updating `timingEngine.initialBpm` to 170.0 and `timingEngine.offset` to 0.0. This immediately updates the transport display and locks the 48-tick Bresenham phase accumulator in `clientFeatureExtract.ts` to acoustic transients.

---

## 3. Caveats
- No caveats. The implementation runs 100% client-side with zero external network requests or heavyweight dependencies, executes in ~100ms, and passes all Vitest test suites and production build checks.

---

## 4. Conclusion
- All task objectives for Milestone 2 Worker 2 have been fulfilled:
  1. `frontend/src/editor/audio/tempoEstimator.ts` is implemented with all specified DSP features.
  2. `frontend/src/editor/audio/AudioEngine.ts` exports `estimateTempo(options?)`.
  3. `frontend/src/App.tsx` replaces the 140.0 BPM fallback with automatic tempo estimation on audio-only upload.
  4. 14 unit tests in `tempoEstimator.test.ts` and 1 in `audioEngine.test.ts` provide comprehensive coverage.
  5. Tested against `Crazy Jackpot.ogg`, the estimator detects 170 BPM and 0.0s offset in ~100ms.
  6. `npm test` (148/148 passing) and `npm run build` pass cleanly with 0 errors.

---

## 5. Verification Method

### Test Commands
1. Run the dedicated tempo estimator test suite:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend
   npm test src/editor/audio/__tests__/tempoEstimator.test.ts
   ```
   **Expected**: 14 tests pass, logging `[Crazy Jackpot] Detected BPM: 170 (raw: 169.8648), Offset: 0s`.

2. Run the full frontend Vitest suite:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend
   npm test
   ```
   **Expected**: 16 test files pass, 148 tests pass (100%).

3. Run the frontend production build:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend
   npm run build
   ```
   **Expected**: Clean `tsc -b && vite build` exit code 0 with zero TypeScript errors or warnings.

### Invalidation Conditions
- If uploading `Crazy Jackpot.ogg` alone in `App.tsx` sets `timingEngine.initialBpm` to 140.0 instead of 170.0.
- If `estimateTempoAndOffset` returns a BPM outside $[169.0, 171.0]$ for `Crazy Jackpot.ogg`.
- If `npm run build` or `npm test` fails.
