# Dispatch Assignment: Forensic Auditor (Final Project Integrity Verification)

- **Role**: Forensic Auditor
- **Working Directory**: `/Users/ate/Projects/stepper-web/.agents/auditor_final`
- **Authoritative Request**: `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (read all requirements R1–R4 and follow-up from 2026-09-11T05:34:00Z)
- **Worker Handoff**: `/Users/ate/Projects/stepper-web/.agents/worker_m6_m7_1/handoff.md`
- **Project Root**: `/Users/ate/Projects/stepper-web`

## Objectives:
Conduct a strict, zero-tolerance Forensic Integrity Audit across the entire `stepper-web` repository:
1. **Network Hygiene & Offline Operation**:
   - Verify that there are zero hardcoded localhost network calls that throw unhandled exceptions in offline mode.
   - Verify that parity solving routes genuinely through the local Viterbi solver (`localParitySolver.ts`).
2. **In-Browser Inference Authenticity**:
   - Check `frontend/src/editor/workers/inference.worker.ts` and `frontend/src/editor/api/wasmInference.ts`.
   - Verify that ONNX model loading, feature extraction, and step decoding are genuine neural/algorithmic implementations, not mocked return values or fake stubs.
3. **Audio Playback & Synchronization**:
   - Confirm genuine Radix-2 Cooley-Tukey FFT, direct rAF canvas clock loop, and persistent canvas backing store.
4. **Qualitative Figures & Report**:
   - Verify that all 11 figures exist in `output/figures/` and `docs/figures/` with valid binary PNG headers and 300 DPI.
   - Verify `docs/qualitative_evaluation_report.md` exists and contains authentic tournament metrics.
5. **Build and Test Verification**:
   - Run `npm run build` in `frontend/` — **MUST EXIT CODE 0 WITH ZERO TS ERRORS/WARNINGS**.
   - Run `npm test -- --run` in `frontend/`.
   - Run `npx playwright test` — verify all tests pass.
6. Render your verdict (`CLEAN` or `INTEGRITY VIOLATION`) with an itemized forensic evidence chain in `/Users/ate/Projects/stepper-web/.agents/auditor_final/handoff.md` and report back via send_message.

## 2026-09-11T06:17:53Z
You are auditor_final (Forensic Auditor for Final Project Verification).
Working Directory: /Users/ate/Projects/stepper-web/.agents/auditor_final
Authoritative Request: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md (read all requirements R1–R5 and follow-up from 2026-09-11T05:34:00Z)
Dispatch Assignment: /Users/ate/Projects/stepper-web/.agents/auditor_final/DISPATCH.md
Worker M6 & M7 Handoff: /Users/ate/Projects/stepper-web/.agents/worker_m6_m7_1/handoff.md
Project Root: /Users/ate/Projects/stepper-web

Your task:
Conduct a strict, zero-tolerance Forensic Integrity Audit across the entire stepper-web project:
1. Network Hygiene & Offline Operation (R2):
   - Check stepperApi.ts and App.tsx: verify zero hardcoded localhost calls that fail in offline mode.
   - Verify authentic parity solving via localParitySolver.ts.
2. In-Browser WASM Inference (R3):
   - Check inference.worker.ts and wasmInference.ts: verify genuine ONNX neural model loading, real feature extraction, authentic decoding, and genuine fallback. Zero dummy stubs or fake mocked outputs.
3. Audio Playback & Synchronization (R1):
   - Check AudioEngine.ts and StepchartCanvas.tsx: verify genuine Cooley-Tukey Radix-2 FFT, direct rAF clock loop, persistent canvas backing store, and latency compensation.
4. Qualitative Figures & Report (R4):
   - Verify all 11 figures in output/figures/ and docs/figures/ have authentic PNG headers (\x89PNG\r\n\x1a\n) and 300 DPI.
   - Verify docs/qualitative_evaluation_report.md has authentic calibration metrics across all 16 ITL tournament songs.
5. Production Build & Test Execution (R5):
   - Run `npm run build` in `frontend/` — MUST EXIT CODE 0 WITH ZERO TS ERRORS/WARNINGS.
   - Run `npm test -- --run` in `frontend/` — all tests must pass.
6. Render your verdict (CLEAN or INTEGRITY VIOLATION) with itemized forensic evidence in /Users/ate/Projects/stepper-web/.agents/auditor_final/handoff.md and report back via send_message to your caller.
