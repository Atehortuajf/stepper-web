# Task Assignment for Worker 3 (Milestone 3: Inference Remediation, Peak Picking, & FSM Mask)

## 2026-09-11T19:35:18Z

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_3/handoff.md
- /Users/ate/Projects/stepper-web/frontend/src/App.tsx
- /Users/ate/Projects/stepper-web/frontend/src/editor/api/wasmInference.ts
- /Users/ate/Projects/stepper-web/frontend/src/editor/workers/inference.worker.ts
- /Users/ate/Projects/stepper-web/frontend/src/editor/api/fsmMask.ts
- /Users/ate/Projects/stepper-web/frontend/src/editor/api/stepperApi.ts
- Ground truth FSM mask: /Users/ate/Projects/Stepper/stepper/model/fsm_mask.py

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Eliminate all silent `Math.random()` fallbacks across the inference pipeline:
   - In `frontend/src/App.tsx`: In `handleGenerateSteps` `catch (err)`, completely remove the rule-based procedural arrow generator (lines 821–859) that injected random arrows with spoofed confidence 0.95. Display an error message/banner to the user, log to console, set `proposedPlacements([])`, and finish cleanly.
   - In `frontend/src/editor/workers/inference.worker.ts`: Replace silent `generateRuleBasedFallback` calls in error catch blocks and unready checks with explicit `{ type: 'error', error: ... }` messages.
   - In `frontend/src/editor/api/wasmInference.ts`: Remove silent `generateRuleBasedFallback` from error catch blocks and unready checks; report explicit errors and empty placements.
   - In `frontend/src/editor/api/stepperApi.ts`: Ensure error handlers propagate real errors rather than silently substituting random noise.
2. Calibrate peak picking in `wasmInference.ts` and `inference.worker.ts`:
   - Enforce strict inequality on one side: `pVal > left && pVal >= right` (eliminating adjacent tick duplicate placements on plateaus at $\Delta t = 7.35$ ms).
   - Enforce minimum refractory window of at least 6 ticks ($\ge 44$ ms) between consecutive placed notes.
   - Support adjustable threshold (default 0.50).
3. Fix biomechanical FSM mask in `frontend/src/editor/api/fsmMask.ts` to match PyTorch ground truth (`stepper/model/fsm_mask.py`):
   - Fix bipedal contact cardinality: When 1 foot is held (`survivingHolds === 1`), do NOT cap `newTaps` to 1. Allow 2-tap brackets (`newTaps >= 3` -> mask; `newTaps === 2 && isOppositeJump` -> mask; allow adjacent brackets).
   - Do NOT unconditionally suppress hands/quads on Expert when `survivingHolds === 0`.
   - In jack count penalty, check `_deltaBeat < 0.25 && this.state.jackCount >= 2` and apply soft penalty `-5.0`.
4. Run `npm test` and `npm run build` in `frontend/` to confirm all existing and new tests pass cleanly with 0 errors.

File write ownership:
- `frontend/src/App.tsx`
- `frontend/src/editor/api/wasmInference.ts`
- `frontend/src/editor/workers/inference.worker.ts`
- `frontend/src/editor/api/fsmMask.ts`
- `frontend/src/editor/api/stepperApi.ts`
- `frontend/src/editor/conditioning/ConditioningDrawer.tsx` (if sensitivity slider added)
- `frontend/src/editor/api/__tests__/*`

Write report to /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m3_1/handoff.md.
