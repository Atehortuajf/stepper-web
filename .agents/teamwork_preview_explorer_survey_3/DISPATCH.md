# Task Assignment for Explorer 3 (Survey: Inference Pipeline, FSM Mask, & Playability Verification)

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/frontend/src/App.tsx
- /Users/ate/Projects/stepper-web/frontend/src/editor/inference/ or wasmInference.ts, inference.worker.ts, fsmMask.ts
- /Users/ate/Projects/stepper-web/frontend/src/editor/biomechanics/localParitySolver.ts
- /Users/ate/Projects/Stepper/stepper/validate/viterbi_solver.py
- Reference simfile & audio: /Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ssc and Crazy Jackpot.ogg

Investigate:
1. Locate where `Math.random()` is used as a silent fallback in `App.tsx` or related inference files.
2. How `wasmInference.ts` and `inference.worker.ts` currently work with ONNX Runtime Web. Check how logits are processed, how peak picking is implemented, and how to calibrate it (dynamic/adjustable threshold).
3. How `fsmMask.ts` implements the biomechanical FSM mask, and verify if/how it enforces zero physical impossibility violations when processing genuine model logits.
4. How `localParitySolver.ts` and `viterbi_solver.py` evaluate tournament playability, and what criteria constitute 100% tournament playability (0 unplayable transitions).
5. Build health check: current package.json scripts (`npm run build`, `npm test`), dependencies, and test setup.

Write your comprehensive findings to `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_3/handoff.md`.
