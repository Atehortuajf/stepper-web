# Execution Plan: Stepper Neural Model Deployment & Frontend Remediation

## Objective
Deliver all 4 requirements from ORIGINAL_REQUEST.md follow-up:
1. Fix RoPE dynamic sequence dimension in PlacementNet and export genuine ONNX models from stepper_weights_fp16.pt to frontend/public/models/ and frontend/dist/models/ with numerical parity validation across arbitrary sequence lengths (16, 32, 64 beats). [COMPLETED & VERIFIED]
2. Implement client-side audio-only tempo estimation via onset autocorrelation (170 BPM for Crazy Jackpot within ±1.0 BPM) and align 48-tick Bresenham phase accumulator. [COMPLETED & VERIFIED]
3. Remediate inference pipeline, calibrate peak picking, eliminate silent Math.random() fallback, and ensure biomechanical FSM mask guarantees 0 unplayable transitions. [READY]
4. End-to-end tournament playability verification on "Crazy Jackpot" (100% tournament playability in viterbi_solver.py and localParitySolver.ts) with clean build and passing tests. [PLANNED]

## Milestones & Status

### Milestone 1: RoPE Dynamic Sequences & Genuine ONNX Export (R1) — [DONE]
- Status: **PASSED GATE**
- Outcomes: Dynamic RoPE implemented in placement_net.py; genuine ONNX models exported from stepper_weights_fp16.pt to public/models/ and dist/models/; multi-length parity verified; 237 Stepper tests pass.
- Gate: Reviewer 1 & 2 (APPROVE), Challenger 1 & 2 (APPROVE), Forensic Auditor (CLEAN).

### Milestone 2: Client-Side Audio-Only Tempo Estimation (R2) — [DONE]
- Status: **PASSED GATE**
- Outcomes: Client-side DSP onset autocorrelation, comb filtering, and tempo prior implemented in `tempoEstimator.ts`; hardcoded 140.0 BPM fallback eliminated from `App.tsx`; detected 170.0 BPM and 0.0s offset on `Crazy Jackpot.ogg` (raw 169.86 BPM, error 0.135 BPM); 48-tick Bresenham accumulator aligned with 0 drift; 169/169 tests pass.
- Gate: Reviewer 1 & 2 (APPROVE), Challenger 1 & 2 (APPROVE), Forensic Auditor (CLEAN).

### Milestone 3: Inference Pipeline Remediation & FSM Calibration (R3) — [IN_PROGRESS]
- **Scope**:
  - `stepper-web/frontend/src/App.tsx`: eliminate silent Math.random() catch fallback; show explicit error UI banner, set placements to empty array.
  - `wasmInference.ts` and `inference.worker.ts`: handle genuine model logits, calibrate peak picking threshold with strict inequality (`pVal > left && pVal >= right`), enforce refractory window $\ge 6$ ticks, eliminate internal random fallbacks.
  - `fsmMask.ts`: fix bipedal contact cardinality (allow 2-tap brackets when 1 foot is held), remove unconditional hand/quad suppression on Expert, add delta beat check to jack count.
  - Add sensitivity slider to conditioning UI.

### Milestone 4: End-to-End Tournament Playability Verification & Build Health (R4) — [PLANNED]
- **Scope**:
  - End-to-end test on "Crazy Jackpot" (.ogg + .ssc) with Viterbi solver and localParitySolver.ts achieving 100% playability (0 unplayable transitions).
  - Production build `npm run build` passes with 0 errors.
  - Vitest / Playwright test suites passing.
