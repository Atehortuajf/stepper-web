# Scope & Decomposition — teamwork_preview_orchestrator_5

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | RoPE Dynamic Sequence Dimension | Update RoPE in PlacementNet to compute rotary frequencies dynamically for arbitrary lengths without 512 static cache broadcast errors | M1 | ORIGINAL_REQUEST R1 |
| F2 | Genuine ONNX Export & Parity | Export stepper_placement.onnx & stepper_decoder.onnx from genuine stepper_weights_fp16.pt into frontend/public/models and dist/models; verify numerical parity | M1 | ORIGINAL_REQUEST R1 |
| F3 | Client-Side Audio Tempo Estimation | Implement onset autocorrelation in frontend/src/editor/audio/ to estimate BPM from audio (170 BPM for Crazy Jackpot ±1.0 BPM) | M2 | ORIGINAL_REQUEST R2 |
| F4 | Bresenham Phase Alignment & Transport Sync | Align 48-tick Bresenham phase accumulator with acoustic transients and update timingEngine / transport display | M2 | ORIGINAL_REQUEST R2 |
| F5 | Eliminate Silent Random Fallback | Remove Math.random() fallback in App.tsx on inference failure; present clear user error alerts | M3 | ORIGINAL_REQUEST R3 |
| F6 | Genuine Logits & Peak Picking Calibration | Calibrate peak picking in wasmInference.ts and inference.worker.ts with dynamic/adjustable threshold | M3 | ORIGINAL_REQUEST R3 |
| F7 | Biomechanical FSM Mask Parity | Ensure FSM mask in fsmMask.ts guarantees 0 physical impossibility violations with genuine model logits | M3 | ORIGINAL_REQUEST R3 |
| F8 | Crazy Jackpot Tournament Playability E2E | Run E2E test on Crazy Jackpot producing 100% playable chart in viterbi_solver.py and localParitySolver.ts | M4 | ORIGINAL_REQUEST R4 |
| F9 | Full Production Build & Test Health | Verify frontend `npm run build` and test suites pass with 0 errors | M4 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | RoPE Dynamic Dimension & Genuine ONNX Export | F1, F2 | none | DONE |
| M2 | Client-Side Audio-Only Tempo Estimation | F3, F4 | none | DONE |
| M3 | Inference Pipeline Remediation & FSM Mask | F5, F6, F7 | M1 | IN_PROGRESS (Gate Verification) |
| M4 | E2E Tournament Playability & Build Health | F8, F9 | M1, M2, M3 | PLANNED |
