# Milestone M3 Remediation Handoff Report: AI Inference Calibration & Biomechanical FSM Ground-Truth Parity

**Agent**: Milestone M3 Worker (`teamwork_preview_worker_m3_1`)  
**Role**: implementer, qa, specialist  
**Working Directory**: `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m3_1`  
**Target Ownership**: `/Users/ate/Projects/stepper-web/frontend/`  
**Date**: 2026-09-11T19:46:00Z  
**Status**: COMPLETE (Hard Handoff)

---

## 1. Observation

1. **Survey Findings & Defect Discovery (Survey 3 Handoff)**:
   - In `frontend/src/App.tsx` (lines 821–859), `handleGenerateSteps` contained an unannounced silent fallback in its `catch` block that procedurally placed random steps (`Math.random() > 0.65 ? '1000' : ...`), completely concealing genuine ONNX WASM or backend inference failures from users.
   - In `frontend/src/editor/workers/inference.worker.ts` and `frontend/src/editor/api/wasmInference.ts`, unready models or runtime exceptions silently fell back to `generateRuleBasedFallback(req)` populated with `Math.random()`.
   - In `frontend/src/editor/api/stepperApi.ts`, the `'auto'` engine mode caught both WASM and backend failures and silently returned `generateRuleBasedFallback(req)`.
   - Peak picking in `wasmInference.ts` used non-strict comparisons and an overly permissive refractory period (4 ticks = 29ms at 170 BPM), risking double-triggering on plateaus.
   - In `frontend/src/editor/api/fsmMask.ts`, contact cardinality logic was over-restrictive compared to ground truth `stepper/model/fsm_mask.py`:
     - When 1 foot held a freeze arrow, all 2-tap chords (chords with 2 taps) were strictly masked out, rejecting valid 2-tap brackets (e.g., heel-and-toe on Up+Right while Left foot holds Left).
     - Hands and quads were unconditionally masked out on all difficulties, even though `fsm_mask.py` explicitly allows hands/quads for Expert difficulty (`difficulty_tier == 4`).
     - Jack restrictions applied a hard mask $-\infty$, whereas `fsm_mask.py` applies a soft heuristic penalty logit reduction ($-5.0$) on rapid consecutive taps on the same panel.

2. **Remediation Implemented in Codebase**:
   - `frontend/src/editor/api/fsmMask.ts`:
     - Implemented ground-truth bipedal contact cardinality matching `fsm_mask.py`: when 1 foot is held, up to 2 active taps are permitted, provided they do not form an opposite jump (`(0,3)` or `(1,2)`). 3 or more taps while holding remain masked out.
     - Updated `fsmMask.updateState` and mask generation: allowed hands (3 arrows) and quads (4 arrows) when `difficulty >= 5` (Expert difficulty tier).
     - Replaced hard jack mask with soft logit penalty: when `_deltaBeat < 0.25` and `this.state.jackCount >= 2`, applies a `-5.0` logit penalty rather than $-\infty$, mirroring the PyTorch ground truth.
   - `frontend/src/editor/api/stepperApi.ts`:
     - Eliminated silent random fallback in auto mode catch block. Both WASM and Backend errors are preserved and re-thrown with descriptive context: `"Auto inference failed: WASM engine failed (...) and Backend engine failed (...)"`.
   - `frontend/src/editor/workers/inference.worker.ts`:
     - Removed `generateRuleBasedFallback` entirely.
     - Posts explicit `{ type: 'error', id, error: string }` messages when models are unready or runtime exceptions occur.
     - Calibrated peak picking with strict inequality tie-breaking (`pVal > left && pVal >= right`), refractory window $\ge 6$ ticks (~44ms at 170 BPM), and adaptive peak detection when threshold is not specified.
   - `frontend/src/editor/api/wasmInference.ts`:
     - Removed silent fallback invocation from unready and error execution paths. Throws explicit `Error` unless the caller explicitly requested `force_fallback: true`.
     - Calibrated peak picking using strict plateau tie-breaking and refractory window $\ge 6$ ticks.
     - Added `isNodeEnv()` environment detection using `(globalThis as any).process` to safely locate local `public/models/*.onnx` assets during Vitest / Node.js runs without browser URL scheme failures.
     - Replaced non-deterministic `Math.random()` in `generateRuleBasedFallback` with deterministic arithmetic hashing.
   - `frontend/src/editor/conditioning/TechConditioningPanel.tsx` & `frontend/src/editor/ui/MobileDrawer.tsx`:
     - Added user-adjustable Sensitivity / Placement Threshold slider `[0.25, 0.75]` (default `0.50`) with step `0.01`.
   - `frontend/src/App.tsx`:
     - Removed silent `Math.random()` procedural fallback from `handleGenerate` `catch` block (lines 821–859).
     - Added clear user-facing error alert banner under `TransportBar` (`generationError` state), clearing proposed placements and resetting latency on failure.
     - Bound placement sensitivity slider state (`placementThreshold`, default `0.50`) into `stepperApi.generate` request payload and conditioning panel drawers.

3. **Verification Command Results**:
   - `npm run build` (`tsc -b && vite build`):
     ```
     vite v8.2.2 building client environment for production...
     transforming...
     ✓ 57 modules transformed.
     rendering chunks...
     computing gzip size...
     dist/index.html                                             0.46 kB │ gzip:     0.29 kB
     dist/assets/inference.worker-Bz4xPXTz.js                  417.51 kB
     dist/assets/ort-wasm-simd-threaded.jsep-D-icqfN-.wasm  27,797.17 kB │ gzip: 6,651.22 kB
     dist/assets/index-B-4tZ5Yh.css                             37.31 kB │ gzip:     7.72 kB
     dist/assets/api-DvKOe_Qp.js                                 0.12 kB │ gzip:     0.10 kB
     dist/assets/index-DRcjLwCA.js                             343.57 kB │ gzip:   103.30 kB
     dist/assets/wasmInference-CmNsWMVA.js                     417.93 kB │ gzip:   114.19 kB
     ✓ built in 2.94s
     ```
   - `npm test` (`vitest run`):
     ```
     Test Files  17 passed (17)
          Tests  175 passed (175)
       Duration  5.18s
     ```
     Passed all test suites including:
     - `src/editor/api/__tests__/fsmMask.test.ts` (6 tests passed)
     - `src/editor/api/__tests__/wasmInference.test.ts` (7 tests passed)
     - `src/editor/api/__tests__/stepperApi.test.ts` (10 tests passed)
     - `src/editor/__tests__/m6_m7_empirical_challenge.test.ts` (13 tests passed)
     - `src/editor/__tests__/m2_adversarial_challenge.test.ts` (21 tests passed)
     - `src/editor/__tests__/m5_adversarial_challenge.test.tsx` (10 tests passed)
     - `src/editor/conditioning/__tests__/conditioning.test.tsx` (14 tests passed)
     - `src/editor/biomechanics/__tests__/biomechanics.test.tsx` (13 tests passed)

---

## 2. Logic Chain

1. **Biomechanical FSM Mask Ground-Truth Parity**:
   - PyTorch ground truth in `stepper/model/fsm_mask.py` lines 140–165 enforces anatomical constraints:
     - Holding 1 foot on a panel consumes 1 limb. If a dancer taps with their other foot, they can hit 1 panel (single tap) or 2 panels simultaneously using a bracket (e.g., heel-toe on Left+Down or Up+Right). However, hitting 2 opposite panels (Left+Right `(0,3)` or Down+Up `(1,2)`) with a single foot is physically impossible (opposite jump).
     - Furthermore, tapping 3 or more panels while 1 foot is pinned requires 4 limbs, which violates bipedal anatomy without hands.
     - Therefore, in `fsmMask.ts`, when 1 foot is held:
       `if (tapIndices.length >= 3) return -Infinity;`
       `if (tapIndices.length === 2 && isOppositeJump(tapIndices[0], tapIndices[1])) return -Infinity;`
     - When `difficulty >= 5` (Expert / ITG 12+), stamina and tech charts regularly feature hands (3 arrows) and quads (4 arrows). Masking hands/quads on Expert contradicted `fsm_mask.py` (`allow_hands = (difficulty_tier == 4)`). Allowing hands/quads on Expert aligns with high-level tournament charting standards.
     - Fast consecutive taps on the same panel (jacks) are physically difficult but not impossible. Applying a soft logit penalty (`-5.0`) when `_deltaBeat < 0.25 && this.state.jackCount >= 2` discourages degenerate jackhammers while enabling intentional rhythmic jacks.

2. **Calibrated Peak Picking**:
   - In onset detection, continuous probability curves often exhibit plateaus where multiple adjacent 48-tick slices share equal probabilities.
   - Strict left inequality and inclusive right inequality (`pVal > left && pVal >= right`) breaks ties deterministically in favor of the earliest tick of the plateau.
   - A minimum refractory period of 6 ticks corresponds to a 32nd note at 48 ticks/beat. At 170 BPM, 6 ticks is ~44.1 ms, which represents the biomechanical limit for foot actuation and prevents false double-triggers on noisy onset curves.
   - Adding the user-configurable sensitivity threshold slider (`[0.25, 0.75]`) allows mappers to tune density dynamically depending on whether they desire dense stream charts or sparse technical charts.

3. **Total Elimination of Silent Fallbacks**:
   - Silent fallbacks that generate random notes when an inference engine fails deceive users into thinking the AI model produced the choreography.
   - By eliminating `generateRuleBasedFallback` from `App.tsx` and `inference.worker.ts`, and removing silent fallback catches from `stepperApi.ts` and `wasmInference.ts`:
     - Genuine ONNX model inference is executed.
     - In the event of an unrecoverable failure (e.g. missing weights or corrupted audio buffer), an explicit error is thrown, caught, and displayed in the UI banner.
     - No random arrows can ever be silently injected into the chart.

---

## 3. Caveats

- In pure Node.js / Vitest test environments without DOM worker thread support, `isNodeEnv()` loads the ONNX models directly into memory via `ort.InferenceSession.create('public/models/...')` rather than spawning a Web Worker, ensuring deterministic test execution.
- In production browser environments, inference runs inside the dedicated Web Worker (`inference.worker.ts`) via `postMessage`, offloading all heavy linear algebra and FFT computations from the main UI thread.
- No caveats regarding biomechanical ground truth or FSM mask correctness.

---

## 4. Conclusion

Milestone M3 remediation is fully implemented, verified, and passing:
- Silent `Math.random()` fallbacks have been completely eradicated across `App.tsx`, `stepperApi.ts`, `wasmInference.ts`, and `inference.worker.ts`.
- Peak picking onset detection is calibrated with strict inequality plateau resolution, $\ge 6$ ticks refractory window, and adjustable threshold slider `[0.25, 0.75]`.
- Biomechanical FSM mask in `fsmMask.ts` matches `fsm_mask.py` ground truth: permits 2-tap brackets when 1 foot is held, masks opposite jumps and 3+ taps, allows hands/quads on Expert difficulty, and applies soft logit penalties (`-5.0`) for rapid jacks.
- 100% tests pass (175/175 tests across 17 test suites).
- Clean production build with `tsc -b && vite build` (built in 2.94s with 0 errors).

---

## 5. Verification Method

To independently verify this implementation:

1. **Run Full Test Suite**:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend
   npm test
   ```
   *Expected result*: 17 test files passed, 175 tests passed (100%), 0 failures.

2. **Verify Targeted Unit Tests**:
   ```bash
   npx vitest run src/editor/api/__tests__/fsmMask.test.ts src/editor/api/__tests__/wasmInference.test.ts
   ```
   *Expected result*: Both suites pass (13 tests total), verifying bipedal brackets, opposite jumps, hands/quads on Expert, jack soft penalty, strict inequality, refractory period, and threshold sensitivity.

3. **Verify Production Build**:
   ```bash
   npm run build
   ```
   *Expected result*: `tsc -b && vite build` succeeds with 0 errors and creates production bundle in `dist/`.

4. **Verify No Silent Fallbacks in Source**:
   ```bash
   grep -rn "generateRuleBasedFallback" src/
   ```
   *Expected result*: `generateRuleBasedFallback` is only defined in `wasmInference.ts` for explicit `force_fallback: true` unit testing; it is never called silently in `App.tsx`, `inference.worker.ts`, or `stepperApi.ts`.

Invalidation conditions:
- Any test failure in `npm test`.
- Any TypeScript error during `npm run build`.
- Silent generation of random arrows upon model failure.
- Inability to play 2-tap brackets when 1 foot is held.

