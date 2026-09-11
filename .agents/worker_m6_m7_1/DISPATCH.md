# Dispatch Assignment: Worker M6 & M7 (Network Remediation & In-Browser Web Worker Inference Pipeline)

- **Role**: Worker (Network Remediation & In-Browser WASM Web Worker Inference)
- **Working Directory**: `/Users/ate/Projects/stepper-web/.agents/worker_m6_m7_1`
- **Authoritative Request**: `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (read R2, R3, and Follow-up from 2026-09-11T05:34:00Z)
- **Survey Findings**: `/Users/ate/Projects/stepper-web/.agents/survey_network_wasm_1/handoff.md` (read for complete network call catalog and worker architecture!)
- **Project Root**: `/Users/ate/Projects/stepper-web`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusively Owned Files:
- `frontend/src/editor/api/stepperApi.ts`
- `frontend/src/editor/api/wasmInference.ts`
- `frontend/src/editor/workers/inference.worker.ts` (create if needed)
- `frontend/src/App.tsx` (offline network routing & async generation handling)

## Objectives:

### Part 1: Milestone M6 — Network Remediation & Offline Operation (R2)
1. In `frontend/src/editor/api/stepperApi.ts`:
   - Change default `engineMode` from `'backend'` to `'wasm'`.
   - In `checkHealth()`: when in `'wasm'` mode (or offline), return immediate `{ status: 'healthy', device: 'wasm-local', model_loaded: true }` without calling `fetch()`.
   - In `solveParity(req)`: when in `'wasm'` mode, directly invoke `solveParityLocally(...)` from `frontend/src/editor/biomechanics/localParitySolver.ts` with zero network requests. Completely eliminate all `POST http://localhost:8000/api/solve-parity` network failures.
   - When offline or in `'wasm'` mode, ensure zero unhandled `fetch()` or `WebSocket` connection attempts to `localhost`, `127.0.0.1`, or port `8000`.
2. In `frontend/src/App.tsx`:
   - On initial app mount, initialize in `'wasm'` mode directly without firing an unhandled `fetch("http://localhost:8000/api/health")` that logs `net::ERR_CONNECTION_REFUSED` in console.
3. Feature Preservation Guarantee:
   - Ensure mobile touch controls (`MobileTouchPad.tsx`), dual-bank Doubles pad switcher (`bank-p1` / `bank-p2`), Diff overlay (`DiffOverlay.tsx`), responsive drawer layout (`MobileDrawer.tsx`, `TechConditioningPanel.tsx`), and keyboard shortcuts remain 100% functional.

### Part 2: Milestone M7 — In-Browser Inference Pipeline & Web Worker (R3)
1. Ensure "Generate Steps" and AI conditioning execute cleanly in-browser without locking the UI thread:
   - Create or wire up a dedicated Web Worker (`frontend/src/editor/workers/inference.worker.ts`) or asynchronous chunked execution for `wasmInference.ts` and `clientFeatureExtract.ts`.
   - Audio buffer or waveform should be passed cleanly (e.g. transferable `Float32Array`).
   - Feature extraction and ONNX execution (`stepper_placement.onnx` and `stepper_decoder.onnx`) must yield to the event loop or run off the main thread, reporting progress percentages back to the UI.
   - Ensure that during generation, the canvas continues rendering at 60/120 FPS and the user interface does not freeze.
2. Handle all fallbacks safely:
   - If ONNX Runtime WASM is initializing or encounters unsupported runtime environments, seamlessly fall back to `generateRuleBasedFallback` with zero unhandled exceptions.

### Part 3: Verification
1. Run `npm run build` in `frontend/` — **MUST EXIT CODE 0 WITH ZERO ERRORS AND ZERO WARNINGS**.
2. Run `npm test -- --run` in `frontend/` — all tests must pass.
3. Run Playwright E2E suite: `npx playwright test` — all tests must pass.
4. Verify browser console logs show zero unhandled exceptions and zero failed requests to `localhost`.

Write your complete handoff report to `/Users/ate/Projects/stepper-web/.agents/worker_m6_m7_1/handoff.md` and report back via send_message.
