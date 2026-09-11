# Dispatch Assignment for Challenger 1 (Milestone 3 Gate)

## 2026-09-11T19:46:15Z

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m3_1/handoff.md
- /Users/ate/Projects/stepper-web/frontend/src/App.tsx
- /Users/ate/Projects/stepper-web/frontend/src/editor/api/wasmInference.ts
- /Users/ate/Projects/stepper-web/frontend/src/editor/workers/inference.worker.ts

Challenger Tasks:
1. Write and execute an adversarial stress test against peak picking:
   - Construct adversarial probability vectors containing wide plateaus (e.g. 5 consecutive ticks with probability 0.85). Verify that strict inequality tie-breaking places only a single peak and NEVER places adjacent-tick duplicate notes.
   - Test dense peak bursts (e.g. peaks separated by 1, 2, 3, 4, 5 ticks). Verify that the minimum refractory window ($\ge 6$ ticks) strictly suppresses sub-44ms double taps.
2. Stress test inference error injection: simulate unhandled WASM exceptions / worker errors and verify that `Math.random()` is NEVER called to populate arrows, no fake notes are injected, and `proposedPlacements` remains empty.
3. State your verdict clearly: APPROVE or REJECT in handoff.md.

Write report to /Users/ate/Projects/stepper-web/.agents/teamwork_preview_challenger_m3_1/handoff.md.
