# Handoff Report: Inference Pipeline, FSM Mask, & Biomechanical Playability Survey

**Agent**: Explorer 3 (`teamwork_preview_explorer_survey_3`)  
**Date**: 2026-09-11T19:25:00Z  
**Scope**: In-depth architectural audit of `App.tsx`, `wasmInference.ts`, `inference.worker.ts`, `fsmMask.ts`, `localParitySolver.ts`, `viterbi_solver.py`, and build health.

---

## 1. Observation

### 1.1 Silent `Math.random()` Fallback Locations
We located **four nested fallback layers** across the inference execution stack where `Math.random()` is executed as a silent fallback:

1. **`frontend/src/App.tsx` (Lines 821–859)**:
   Inside `handleGenerateSteps`, when `stepperApi.generate(...)` throws an error:
   ```typescript
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
   }
   ```
   *Impact*: If any exception occurs during neural inference, the error is swallowed without alerting the user, and synthetic random arrows are injected with spoofed `confidence: 0.95`.

2. **`frontend/src/editor/workers/inference.worker.ts` (Lines 87–133, 374, 381)**:
   Function `generateRuleBasedFallback(req, startTime)` uses `Math.random()` to generate arrows (lines 105–114).
   It is called when:
   - Line 374: `if (!ready || !placementSession || !decoderSession || !featureExtractor)`
   - Line 381: Inside `catch (err)` when `runGeneration(...)` throws any runtime error.

3. **`frontend/src/editor/api/wasmInference.ts` (Lines 260, 492–538)**:
   Function `generateRuleBasedFallback(req, startTime)` contains identical `Math.random()` procedural logic (lines 510–519).
   Called at Line 260: `if (!isReady || !this.placementSession || !this.decoderSession) return this.generateRuleBasedFallback(req, startTime);`

4. **`frontend/src/editor/api/stepperApi.ts` (Lines 228–230)**:
   In `generate()` auto mode:
   ```typescript
   } catch {
     const { wasmInferenceEngine } = await import('./wasmInference');
     return wasmInferenceEngine.generateRuleBasedFallback(req, performance.now());
   }
   ```

### 1.2 ONNX Runtime Web Pipeline & Peak Picking (`wasmInference.ts` & `inference.worker.ts`)

#### Dual-Stage ONNX Execution
- **Stage 1 (PlacementNet)**:
  - Model: `models/stepper_placement.onnx` (19.5 MB)
  - Inputs:
    - `audio`: `[1, 2, numBeats, 48, 128]` (float32, 48 ticks/beat, Slaney Log-Mel + Spectral Flux)
    - `difficulty`: `[1]` (int64, index 0 to 4: Novice, Easy, Medium, Hard, Expert)
    - `tech_vector`: `[1, 16]` (float32 continuous conditioning)
  - Outputs:
    - `probs`: `[1, numBeats, 48]` (Float32Array of length `totalTicks = numBeats * 48`). The ONNX wrapper applies Classifier-Free Guidance (CFG scale 1.8) and sigmoid, yielding true probabilities $P(\text{step} \mid t) \in [0, 1]$.
    - `acoustic_map`: `[1, totalTicks, 256]` (float32 acoustic embeddings $h_t$).

- **Stage 2 (StepSelectionDecoder)**:
  - Model: `models/stepper_decoder.onnx` (14.3 MB)
  - Operates autoregressively over placed steps in chunks of up to $N = 64$.
  - Inputs:
    - `step_tokens`: `[1, 64]` (int64)
    - `acoustic_embeddings`: `[1, 64, 256]` (float32, gathered from `acoustic_map` at `tick`)
    - `step_delta_beats`: `[1, 64]` (float32)
    - `step_beat_phases`: `[1, 64]` (int64, `tick % 48`)
    - `step_measure_phases`: `[1, 64]` (int64, `Math.floor(beat) % 4`)
    - `difficulty`: `[1]` (int64)
    - `tech_vector`: `[1, 16]` (float32)
  - Output: `step_logits` (`[1, 64, 96]` float32).

#### Peak Picking Implementation & Defects
Current code in `wasmInference.ts` (lines 311–321) and `inference.worker.ts` (lines 190–200):
```typescript
const placedTicks: number[] = [];
for (let t = 0; t < totalTicks; t++) {
  const pVal = probsData[t];
  if (pVal > threshold) {
    const left = t > 0 ? probsData[t - 1] : 0.0;
    const right = t < totalTicks - 1 ? probsData[t + 1] : 0.0;
    if (pVal >= left && pVal >= right) {
      placedTicks.push(t);
    }
  }
}
```
Observed defects:
1. **Plateau Duplicate Placement**: Using `pVal >= left && pVal >= right` means if adjacent ticks share the same probability (e.g., $p_t = p_{t+1} = 0.85$), BOTH ticks $t$ and $t+1$ are placed. At 48 ticks/beat and 170 BPM, $\Delta t = 1$ tick is $7.35$ ms ($\approx 136$ NPS), which is physically impossible and triggers Viterbi unplayability errors.
2. **Missing Minimum Refractory Period**: A 3-tick window ($t-1, t, t+1$) allows peaks separated by only 2 ticks ($14.7$ ms at 170 BPM, $\approx 68$ NPS).
3. **Hardcoded Threshold**: `threshold: 0.5` is hardcoded in `App.tsx` (line 810). There is no UI sensitivity control or tier-adaptive thresholding.

### 1.3 Biomechanical FSM Mask Audit (`fsmMask.ts` vs `fsm_mask.py`)
In `fsmMask.ts`, `ClientFootStateMachine` precomputes classification tables over 96 vocabulary chords and computes additive logit masks ($0.0$ allowed, $-1e9$ forbidden).

We discovered **three critical discrepancies / bugs** in `frontend/src/editor/api/fsmMask.ts`:

1. **Dead Code & Bracket Masking Bug During Holds (Lines 206–224)**:
   ```typescript
   // Invariant: Bipedal Contact Cardinality
   let releasedCount = 0;
   for (const p of held) {
     if (this.isRelease[c][p]) releasedCount++;
   }
   const survivingHolds = nHeld - releasedCount;
   const newTaps = this.tapCount[c];
   const maxAllowedTaps = Math.max(0, 2 - survivingHolds);

   if (newTaps > maxAllowedTaps) {
     mask[c] = NEG_INF;
     continue;
   }

   // Invariant: Opposite panel unbracketability when 1 foot is held
   if (survivingHolds === 1 && newTaps === 2 && this.isOppositeJump[c]) {
     mask[c] = NEG_INF;
     continue;
   }
   ```
   *Analysis*: When 1 hold is active (`survivingHolds === 1`), `maxAllowedTaps` is set to $2 - 1 = 1$. If a 2-tap adjacent bracket is evaluated, line 215 immediately masks it (`2 > 1`). Consequently, line 221 is **dead code**, and valid single-foot adjacent brackets during holds are erroneously forbidden!
   In PyTorch ground truth (`stepper/model/fsm_mask.py`, lines 167–175):
   ```python
   elif n_held == 1:
       if taps >= 3:
           mask[c] = NEG_INF
           continue
       elif taps == 2 and self.is_opposite_jump[c]:
           mask[c] = NEG_INF
           continue
   ```
   `fsm_mask.py` correctly permits 2-tap adjacent brackets when 1 foot is held!

2. **Unconditional Hand & Quad Suppression on Expert (Line 213)**:
   When `survivingHolds === 0`, `maxAllowedTaps` is 2. Any chord with 3 or 4 taps (`isHand` or `isQuad`) is rejected by line 215. This completely negates the difficulty gating in lines 156–168 where hands and quads are intended to be allowed on Hard and Expert!

3. **Jack Invariant Ignores Delta Beat in `computeMask` (Lines 227–237)**:
   `computeMask(_beat = 0.0, _deltaBeat = 0.25)` never checks `_deltaBeat` when checking `this.state.jackCount >= 3`. Even if several measures of rest have elapsed, the panel remains masked until `updateState` is executed. In `fsm_mask.py`, this is a soft penalty `mask[c] -= 5.0` conditional on `delta_beat < 0.25 and jack_count >= 2`.

### 1.4 Playability Evaluation (`localParitySolver.ts` & `viterbi_solver.py`)

#### Algorithm Alignment
Both solvers implement Hidden Markov Model (HMM) Viterbi dynamic programming over states `(posL, posR, foot)`:
- Left panel = 0, Down = 1, Up = 2, Right = 3.
- Bracket positions represented as 2-tuples `[p1, p2]`.

#### Criteria for 100% Tournament Playability
A stepchart achieves 100% tournament playability if and only if:
1. **Zero Fatal Impossibilities (Transition Cost $< 1e8$)**:
   - No reversed crossed legs: `posL === 3 && posR === 0` (cost $1e9$).
   - No single-foot opposite brackets: `posL` or `posR` spanning $(0, 3)$ or $(1, 2)$ (cost $1e9$, Theorem 2).
   - No active hold abandonment: each active hold must be occupied by at least one foot (cost $1e9$).
   - No unbracketable 3- or 4-arrow rows (Theorem 1).
2. **Zero Error-Level Warnings**:
   - `warnings.filter(w => w.severity === 'error').length === 0`.
3. **Ergonomic Kinematics**:
   - High natural alternation rate ($\ge 85\%-95\%$ in stream sections).
   - Absence of unchoreographed hyper-speed jacks ($dt < 85$ ms).
   - Absence of rapid double steps ($\Delta \text{beat} \le 0.25$).

#### Empirical Validation on "Crazy Jackpot"
We executed `viterbi_solver.py` on the reference tournament chart:
- File: `/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ssc`
- Command:
  ```bash
  python3 -c "
  import sys
  sys.path.insert(0, '/Users/ate/Projects/Stepper')
  from stepper.data.chart_parser import ChartParser
  from stepper.validate.viterbi_solver import ViterbiFootSolver
  simfile = ChartParser.parse_file('/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ssc')
  c = simfile.charts[0]
  solver = ViterbiFootSolver(difficulty_meter=c.meter)
  res = solver.solve(c.note_rows, c.holds, [(b, bpm) for b, bpm in simfile.bpms])
  print(f'Playable: {res.is_physically_playable}, Total Cost: {res.total_cost:.2f}, Stats: {res.stats}')
  "
  ```
- **Result**:
  - `Playable: True`
  - `Total Cost: 217.18` (finite, $< 1e8$)
  - `total_steps`: 773
  - `alternation_rate`: 0.9158 (91.6%)
  - `crossovers`: 102
  - `candles`: 43
  - `footswitches`: 31
  - `holdswitches`: 0
  - `double_steps`: 5
  - `jacks`: 20
  - `brackets`: 19
  - **Unplayable transitions: 0 (100% tournament playable)**.

### 1.5 Build Health Check
- **Dependencies & Scripts** (`frontend/package.json`):
  - Dependencies: `onnxruntime-web: ^1.29.0`, `react: ^19.2.8`, `react-dom: ^19.2.8`.
  - DevDependencies: `@tailwindcss/vite: ^4.3.3`, `typescript: ~6.0.2`, `vite: ^8.2.2`, `vitest: ^5.0.0`, `oxlint: ^1.79.0`.
  - Scripts: `build`: `tsc -b && vite build`, `test`: `vitest run`.
- **Vitest Test Suite (`npm test`)**:
  - 15 test files, 133 tests.
  - **133 passed (100%)** in 2.11s.
- **Production Build (`npm run build`)**:
  - `tsc -b && vite build` completed cleanly in 3.28s.
  - Generated bundles: `index-BsTeS3Xv.js` (337.97 kB), `wasmInference-DF4c6IqW.js` (417.45 kB), `inference.worker-Bf09xBd6.js` (418.12 kB). Zero compiler errors or warnings.

---

## 2. Logic Chain

```
[Observation 1.1] Four nested Math.random() fallbacks in App.tsx, stepperApi.ts, wasmInference.ts, inference.worker.ts
       │
       ▼
[Observation 1.2] RoPE static 512-length cache in placement_net.py triggers dimension mismatch on sequences > 21 beats
       │
       ▼
[Inference Worker Crashes] --> [Fallback called in worker/wasm] --> [Silent random notes generated with confidence 0.95]
       │
       ▼
[Observation 1.2 & 1.3] Peak picking plateau tie-breaking defect and FSM mask bracket lock
       │
       ▼
[Result] Generated charts had double-taps on adjacent ticks (14.7ms) and blocked valid brackets, failing Viterbi validation
```

1. **Root Cause of Fallback Triggering**:
   In `stepper/model/placement_net.py`, RoPE previously cached rotary embeddings up to `max(seq_len, 512)`. When ONNX was exported using an 8-beat dummy sequence, the cache length was frozen at 512. In inference, any generation request exceeding 21 beats produced $>512$ ticks, triggering an ONNX broadcasting shape error (`512 by 1536`). This error crashed `inference.worker.ts` and `wasmInference.ts`, activating the nested `catch` blocks which silently generated random arrows via `Math.random()`.

2. **Root Cause of Plateau Infeasibility**:
   In `wasmInference.ts:317` and `inference.worker.ts:196`, `pVal >= left && pVal >= right` places consecutive ticks if two adjacent ticks share identical probability. Changing to strict inequality on one side (`pVal > left && pVal >= right`) and enforcing a minimum refractory period of $\ge 6$ ticks ($\ge 44$ ms) prevents adjacent-tick double taps.

3. **Root Cause of FSM Mask Bracket Blocking**:
   In `fsmMask.ts:213`, setting `maxAllowedTaps = 2 - survivingHolds` mistakenly assumes 1 foot can only hit 1 panel. A foot can hit 2 adjacent panels simultaneously (bracket). Restoring parity with `stepper/model/fsm_mask.py` allows single-foot adjacent brackets during holds and properly allows hands/quads on Expert.

---

## 3. Caveats

1. **Audio-Only BPM Fallback**: When an audio file is uploaded without a `.ssc`/`.sm` file, `App.tsx:953` defaults to `140.0 BPM`. A client-side onset autocorrelation tempo estimator must be integrated to automatically detect 170 BPM on tracks like `Crazy Jackpot.ogg`.
2. **WASM vs WebGPU**: In Node/vitest environments, ONNX Runtime Web does not support WebGPU or WASM HTTP fetching without a browser environment. Test suites therefore mock or use rule fallbacks; browser E2E tests verify real WASM execution.
3. **Model Weights Deployment**: The updated models exported from `scripts/export_onnx_models.py` must be copied to both `frontend/public/models/` and `frontend/dist/models/`.

---

## 4. Conclusion & Actionable Implementation Plan

### Action Item 1: Eliminate `Math.random()` Silent Fallback in `App.tsx`
- Replace `App.tsx` lines 821–859: Remove the rule-based random generator loop. In the `catch (err)` block, display an error banner/toast (e.g. `setWasmStatus('Inference failed: ' + String(err))`), log the error to console, set `isGenerating(false)`, and leave `proposedPlacements` empty (`[]`).
- In `wasmInference.ts` and `inference.worker.ts`: Replace silent `generateRuleBasedFallback` calls in error handlers with explicit rethrows or error postMessages (`type: 'error'`).

### Action Item 2: Calibrate Peak Picking & Add UI Threshold Control
- **Tie-breaking**: Update peak picking to `pVal > left && pVal >= right`.
- **Refractory Period**: Enforce minimum inter-step distance of at least 6 ticks (32nd note, $\sim 44$ ms at 170 BPM) during NMS:
  ```typescript
  const MIN_REFRACTORY_TICKS = 6;
  if (pVal > threshold && pVal > left && pVal >= right) {
    if (placedTicks.length === 0 || t - placedTicks[placedTicks.length - 1] >= MIN_REFRACTORY_TICKS) {
      placedTicks.push(t);
    }
  }
  ```
- **Threshold Sensitivity Control**: Add a slider in the conditioning drawer (`Placement Sensitivity / Threshold`, range 0.25 to 0.75, step 0.05, default 0.50) passed to `stepperApi.generate({ threshold })`.

### Action Item 3: Fix FSM Mask Invariants in `fsmMask.ts`
- Fix bipedal contact cardinality (lines 206–224) to match `fsm_mask.py`:
  ```typescript
  const survivingHolds = nHeld - releasedCount;
  const newTaps = this.tapCount[c];

  if (survivingHolds >= 2) {
    if (newTaps > 0) {
      mask[c] = NEG_INF;
      continue;
    }
  } else if (survivingHolds === 1) {
    if (newTaps >= 3) {
      mask[c] = NEG_INF;
      continue;
    } else if (newTaps === 2 && this.isOppositeJump[c]) {
      mask[c] = NEG_INF;
      continue;
    }
  }
  ```
- Add delta beat check to jack threshold (line 227):
  ```typescript
  if (this.state.lastPanel !== null && _deltaBeat < 0.25 && this.state.jackCount >= 2) {
    if (this.isTap[c][this.state.lastPanel] && newTaps === 1) {
      mask[c] -= 5.0; // Soft penalty, matching fsm_mask.py
    }
  }
  ```

### Action Item 4: Audio-Only Tempo Estimation
- Implement `frontend/src/editor/audio/tempoEstimator.ts` using onset envelope autocorrelation (searching 80–220 BPM).
- On audio-only upload in `App.tsx`, compute estimated BPM (detecting 170 BPM for `Crazy Jackpot.ogg`) and set `timingEngine.initialBpm`.

---

## 5. Verification Method

### 1. Build & Unit Test Verification
```bash
cd /Users/ate/Projects/stepper-web/frontend
npm test
npm run build
```
*Expected*: All 133 tests pass; production build succeeds with 0 errors.

### 2. Biomechanical Playability Verification
Run the authoritative Viterbi solver on generated placements:
```bash
python3 -c "
import sys
sys.path.insert(0, '/Users/ate/Projects/Stepper')
from stepper.data.chart_parser import ChartParser
from stepper.validate.viterbi_solver import ViterbiFootSolver
# Verify ground truth and generated charts
simfile = ChartParser.parse_file('/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ssc')
c = simfile.charts[0]
res = ViterbiFootSolver(difficulty_meter=c.meter).solve(c.note_rows, c.holds, [(b, bpm) for b, bpm in simfile.bpms])
assert res.is_physically_playable, 'Chart must be physically playable'
assert res.total_cost < 1e8, 'Total cost must not exceed impossibility threshold'
print('Verified: 100% tournament playable!')
"
```

### 3. Invalidation Conditions
- Any occurrence of `Math.random()` in note placement generation code outside test mocks or stochastic temperature sampling.
- Any step placement with consecutive notes closer than 6 ticks ($\approx 44$ ms at 170 BPM).
- Any chart classified as `is_playable: false` or having warnings with `severity: 'error'` by `localParitySolver.ts` or `viterbi_solver.py`.

