# Reviewer Report: Milestone 2 — Audio-Only Tempo Estimation & Grid Sync

**Verdict**: APPROVE  
**Risk Level**: LOW  
**Integrity Assessment**: ZERO VIOLATIONS DETECTED (Genuine DSP implementation, no hardcoding, no facades)

---

## 1. Observation

### Exact File Paths and Line Numbers
- `frontend/src/editor/audio/tempoEstimator.ts`:
  - **Lines 55–103 (`extractMonoSamples`)**: Decimates arbitrary input PCM channels (via `AudioBuffer`, `{ channelData }`, or `{ mono }`) to mono at target sample rate $22,050\text{ Hz}$ using integer downsample factor $R = \max(1, \text{round}(f_{s,\text{orig}} / f_{s,\text{target}}))$. Duration capped at `maxScanDurationSec` (default 60s).
  - **Lines 123–201 (STFT & Half-Wave Rectified Spectral Flux)**: Hann-windowed Radix-2 FFT ($N=512$, $H=128$, $f_{\text{fps}} = 172.266\text{ Hz}$). Spectral flux computed as $\sum_{k=0}^{255} \max(0, |X_f[k]| - |X_{f-1}[k]|)$.
  - **Lines 203–223 (Autocorrelation)**: Mean-centered flux $\hat{F}[n] = F[n] - \bar{F}$; direct autocorrelation $r[\tau] = \sum_n \hat{F}[n]\hat{F}[n+\tau]$ evaluated across lags corresponding to $[60, 240]\text{ BPM}$ and up to $2 \times \tau_{\max} + 2$.
  - **Lines 232–246 (Parabolic Refinement)**: 3-point quadratic peak interpolation $\delta = \frac{1}{2}\frac{\alpha - \gamma}{\alpha - 2\beta + \gamma}$ and $\hat{r} = \beta - \frac{1}{4}(\alpha - \gamma)\delta$, resolving sub-frame lag precision and raw BPM.
  - **Lines 247–258 (Comb Filtering & Log-Gaussian Prior)**: Harmonic comb weighting $r[\tau] + 0.5 \cdot r[\tau/2] + 0.5 \cdot r[2\tau]$ combined with prior $\exp\left(-0.5\left(\frac{\log_2(\text{BPM} / 150)}{0.75}\right)^2\right)$.
  - **Lines 260–267 (Snapping)**: Snaps raw BPM to integer if within $\pm 0.20\text{ BPM}$, or half-integer if within $\pm 0.15\text{ BPM}$.
  - **Lines 300–328 (Phase Offset Alignment)**: Cross-correlates periodic pulse train at interval $T_{\text{beat}} = 60/\text{BPM}$ over first 64 beats across 100 phase steps in $[0, T_{\text{beat}})$. Computes StepMania offset $= -\phi$, wrapping values within 5% of beat boundary to $0.0\text{s}$.
- `frontend/src/editor/audio/AudioEngine.ts`:
  - **Lines 165–177 (`estimateTempo`)**: Delegates to `estimateTempoAndOffset(this.audioBuffer ?? { channelData: this.channelData, sampleRate: this.sampleRate, duration: this.duration }, options)`.
- `frontend/src/App.tsx`:
  - **Lines 939–989 (Audio-Only Onboarding)**:
    Replaced the former unconditional assignment `const targetBpm = isDefaultSample ? 140.0 : timingEngine.initialBpm;` with:
    ```typescript
    const tempoResult = audioEngine.estimateTempo();
    const detectedBpm = tempoResult && tempoResult.bpm > 0
      ? tempoResult.bpm
      : (isDefaultSample ? 140.0 : timingEngine.initialBpm);
    const detectedOffset = tempoResult ? tempoResult.offset : 0.0;
    setSimfile({
      ...
      timing: {
        offset: detectedOffset,
        bpms: [{ beat: 0, bpm: detectedBpm }],
        ...
      },
    });
    ```
  - **Lines 195–198 (`useMemo` for `TimingEngine`)**:
    Re-instantiates `new TimingEngine(timing)` upon `simfile.timing` change, updating `timingEngine.initialBpm` and `timingEngine.offset`.
  - **Lines 805–808**:
    Inference generator receives `bpm: timingEngine.initialBpm` and `offset: timingEngine.offset`, ensuring the 48-tick Bresenham feature extractor in `clientFeatureExtract.ts` aligns with acoustic transients.
- `frontend/src/editor/audio/__tests__/tempoEstimator.test.ts`:
  - 14 tests covering: empty buffers, buffers $< 512$ samples, pure silence, synthetic tempos (120, 140, 170, 172.5, 175 BPM), delayed phase offsets, subharmonic disambiguation (85 vs 170 BPM), and genuine tournament ground truth audio (`Crazy Jackpot.ogg`).

### Test & Build Execution Outputs
1. `npx vitest run src/editor/audio/__tests__/tempoEstimator.test.ts`:
   ```
   stdout | src/editor/audio/__tests__/tempoEstimator.test.ts > tempoEstimator (Client-Side DSP Tempo Estimation) > verifies dominant BPM and offset on tournament reference track "Crazy Jackpot.ogg"
   [Crazy Jackpot] Detected BPM: 170 (raw: 169.8648), Offset: 0s, Confidence: 0.293, Time: 90.4ms

    ✓ src/editor/audio/__tests__/tempoEstimator.test.ts (14 tests) 579ms
    Test Files  1 passed (1)
         Tests  14 passed (14)
   ```
2. Full test suite (`npm test`):
   ```
    Test Files  16 passed (16)
         Tests  148 passed (148)
      Duration  2.56s
   ```
3. Production build (`npm run build`):
   ```
   > frontend@0.0.0 build
   > tsc -b && vite build
   ✓ 57 modules transformed.
   dist/assets/index-DujpGfU_.js      341.58 kB │ gzip: 102.98 kB
   ✓ built in 2.93s
   ```

---

## 2. Logic Chain

1. **DSP Correctness**:
   - The STFT parameters ($N=512, H=128$) at $f_s = 22,050\text{ Hz}$ yield an analysis frame rate of $172.266\text{ fps}$ ($\sim 5.8\text{ ms}$ resolution).
   - Half-wave rectification $\sum_k \max(0, \Delta |X_k|)$ ensures only transient onsets (energy increases) contribute to flux, ignoring decay tails.
   - Autocorrelation over mean-centered flux cleanly highlights periodicity without DC bias.
   - Parabolic interpolation on the local autocorrelation maximum converts discrete lag resolution ($\sim 2.8\text{ BPM}$ at 170 BPM) to sub-frame continuous accuracy ($\approx 0.1\text{ BPM}$), producing `rawBpm: 169.8648`.
   - Snapping within $\pm 0.20\text{ BPM}$ snaps $169.8648$ to exactly $170.00\text{ BPM}$, matching human rhythm-game authoring standards.
2. **Subharmonic Disambiguation**:
   - In EDM tracks with 4-on-the-floor kicks, autocorrelation peaks exist at both lag $L$ (170 BPM) and $2L$ (85 BPM).
   - The resonating comb filter sums lag $L$ with $L/2$ and $2L$, while the log-Gaussian prior centered at 150 BPM ($\sigma = 0.75$) weights 170 BPM at $0.971$ vs 85 BPM at $0.550$, correctly preferring 170 BPM.
3. **Phase Offset & Grid Synchronization**:
   - In StepMania timing, `#OFFSET: 0.000` corresponds to beat 0 occurring at $t=0.0\text{s}$. In `TimingEngine.ts`, `t_audio = t_unoffset - offset`.
   - Cross-correlation finds the peak onset phase $\phi \in [0, T_{\text{beat}})$. Setting `offset = -\phi` ensures `t_audio(beat 0) = 0 - (-\phi) = +\phi`, aligning beat 0 precisely with acoustic transients.
   - For `Crazy Jackpot.ogg`, the transient boundary wrap snaps $\phi \approx 0.98 T_{\text{beat}}$ to $0.0\text{s}$, yielding an exact match with the ground truth `#OFFSET:0.000000;`.
4. **App Integration & Hardcoded Fallback Elimination**:
   - In `App.tsx:954`, `audioEngine.estimateTempo()` is invoked immediately after decoding audio.
   - `detectedBpm` and `detectedOffset` are applied directly to `simfile.timing`.
   - `timingEngine` re-evaluates reactively via `useMemo`, immediately displaying the detected BPM on the transport bar and propagating the timing offset to `clientFeatureExtract.ts` for AI inference generation.
   - The unconditional hardcoded `140.0 BPM` fallback on audio upload has been completely eliminated.
5. **Anti-Cheating & Integrity Verification**:
   - Inspected `tempoEstimator.ts`, `AudioEngine.ts`, and `App.tsx` for string matching, file name checks, duration constants, or branch hacks targeting "Crazy Jackpot".
   - Verified that `tempoEstimator.ts` contains purely mathematical DSP logic with zero hardcoded song metadata.
   - Verified that tests independently load and execute against the real binary `Crazy Jackpot.ogg` file from the local ITGmania installation.

---

## 3. Caveats

1. **Uniform Single-Tempo Scaffolding**:
   The estimator calculates the dominant global tempo and initial phase offset across the first 60 seconds. While `Crazy Jackpot` has brief slowdown sections (85 BPM at beats 28, 90.5, 213, 243, 305), assigning the dominant 170 BPM to `timing.bpms[0]` is standard for initial simfile creation; complex multi-BPM changes and stops remain editable via the editor's timing engine.
2. **Execution Latency**:
   On a 60-second audio clip, full decimation, 512-point FFT STFT, autocorrelation, and phase search execute in $< 100\text{ ms}$ on client CPU, well within acceptable UX bounds.

---

## 4. Conclusion

- Milestone 2 implementation strictly satisfies all functional and non-functional requirements specified in `ORIGINAL_REQUEST.md`:
  - Client-side audio-only tempo estimation detects 170.0 BPM within $\pm 1.0\text{ BPM}$ and 0.0s offset on `Crazy Jackpot.ogg`.
  - The hardcoded 140.0 BPM fallback in `App.tsx` has been eliminated.
  - All 148 unit and empirical tests pass.
  - Production build (`tsc -b && vite build`) compiles with zero errors.
  - No integrity violations, shortcuts, or facades detected.
- **Verdict**: **APPROVE**.

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify tempo estimator unit tests and reference track detection**:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend
   npx vitest run src/editor/audio/__tests__/tempoEstimator.test.ts
   ```
   *Expected*: 14 passed tests, logging `[Crazy Jackpot] Detected BPM: 170 (raw: 169.8648), Offset: 0s`.

2. **Verify full frontend test suite (148 tests)**:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend
   npm test
   ```
   *Expected*: 16 test files pass, 148 tests pass (100% pass rate).

3. **Verify clean production build**:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend
   npm run build
   ```
   *Expected*: Exit code 0, clean build with zero TypeScript or Vite errors.

4. **Invalidation Conditions**:
   - If uploading `Crazy Jackpot.ogg` alone in `App.tsx` leaves BPM at 140.0.
   - If `estimateTempoAndOffset` returns a BPM outside $[169.0, 171.0]$ for `Crazy Jackpot.ogg`.
   - If any of the 148 tests fail or the build fails.
