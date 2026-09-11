# BRIEFING — 2026-09-11T19:25:00Z

## Mission
Investigate inference pipeline (wasmInference.ts, inference.worker.ts, fsmMask.ts), Math.random() silent fallbacks, localParitySolver / viterbi_solver playability criteria, and build health.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, analysis, synthesis
- Working directory: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_3
- Original parent: a770b17f-ae4e-46a0-8f24-850f3e3f4269
- Milestone: survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Produce 5-component handoff.md in working directory
- Communicate all findings to parent via send_message

## Current Parent
- Conversation ID: a770b17f-ae4e-46a0-8f24-850f3e3f4269
- Updated: 2026-09-11T19:25:00Z

## Investigation State
- **Explored paths**:
  - `frontend/src/App.tsx` (lines 800-865: handleGenerateSteps silent fallback; lines 940-980: audio upload BPM fallback)
  - `frontend/src/editor/workers/inference.worker.ts` (lines 87-133: generateRuleBasedFallback; lines 140-385: ONNX execution, peak picking, NMS, decoder)
  - `frontend/src/editor/api/wasmInference.ts` (lines 245-465, 492-538: main thread ONNX execution and fallback)
  - `frontend/src/editor/api/stepperApi.ts` (lines 205-235: auto engine fallback layer)
  - `frontend/src/editor/api/fsmMask.ts` (lines 1-293: FSM playability mask implementation)
  - `frontend/src/editor/biomechanics/localParitySolver.ts` (lines 1-695: client HMM Viterbi parity solver)
  - `stepper/validate/viterbi_solver.py` (lines 1-436: Python authoritative Viterbi solver)
  - `stepper/model/fsm_mask.py` (lines 1-214: PyTorch FSM mask reference)
  - `stepper/model/stepper_sync.py` & `stepper/model/placement_net.py` (RoPE caching and CFG inference)
  - Reference chart: `Crazy Jackpot.ssc` & `Crazy Jackpot.ogg` (Meter 13, 170 BPM)
- **Key findings**:
  - Located 4 nested layers of `Math.random()` fallbacks in `App.tsx`, `stepperApi.ts`, `wasmInference.ts`, and `inference.worker.ts`.
  - Discovered root cause of ONNX failure: RoPE static 512-length cache in `placement_net.py` causing shape mismatch for sequences > 21 beats.
  - Identified 3 bugs in `fsmMask.ts`: (1) `maxAllowedTaps = 2 - survivingHolds` blocks valid brackets when 1 hold is active; (2) blocks all hands/quads on Expert when 0 holds are active; (3) jack threshold limit does not check `deltaBeat`.
  - Identified peak picking plateau duplicate bug (adjacent ticks placed) and lack of UI threshold control.
  - Validated `Crazy Jackpot.ssc` against `viterbi_solver.py`: 100% playable, cost 217.18, 0 unplayable transitions.
  - Verified build health: `npm test` passes 133/133 tests; `npm run build` passes cleanly in 3.28s.
- **Unexplored areas**: None. All 5 prompt objectives thoroughly investigated.

## Key Decisions Made
- Fully documented all 5 survey dimensions with exact line citations and code diff proposals in handoff.md.

## Artifact Index
- handoff.md — Comprehensive 5-component survey report and actionable remediation plan
- progress.md — Heartbeat and status log
