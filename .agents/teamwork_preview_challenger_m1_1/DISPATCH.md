# Dispatch Assignment for Challenger 1 (Milestone 1 Gate)

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/handoff.md
- Models in /Users/ate/Projects/stepper-web/frontend/public/models/ and frontend/dist/models/

Challenger Tasks:
1. Write and execute an adversarial numerical stress test comparing PyTorch model output against ONNX Runtime inference on `stepper_placement.onnx` across extreme sequence lengths: 8 beats, 16 beats, 21 beats, 22 beats, 32 beats, 48 beats, 64 beats, 128 beats, and 256 beats.
2. Verify that NO shape/broadcasting mismatch occurs for any sequence length.
3. Compute max absolute error and mean squared error between PyTorch and ONNX across all sequence lengths.
4. Verify `stepper_decoder.onnx` inference with extreme inputs (e.g. all-zero tokens, random tokens, edge cases).
5. State your verdict clearly: APPROVE or REJECT in handoff.md.

Write report to /Users/ate/Projects/stepper-web/.agents/teamwork_preview_challenger_m1_1/handoff.md.

## 2026-09-11T19:19:24Z
You are Challenger 1 for Milestone 1. Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_challenger_m1_1/.
Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_challenger_m1_1/DISPATCH.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/handoff.md
- Models in /Users/ate/Projects/stepper-web/frontend/public/models/ and frontend/dist/models/

Challenger Tasks:
1. Write and execute an adversarial numerical stress test comparing PyTorch model output against ONNX Runtime inference on `stepper_placement.onnx` across extreme sequence lengths: 8 beats, 16 beats, 21 beats, 22 beats, 32 beats, 48 beats, 64 beats, 128 beats, and 256 beats.
2. Verify that NO shape/broadcasting mismatch occurs for any sequence length.
3. Compute max absolute error and mean squared error between PyTorch and ONNX across all sequence lengths.
4. Verify `stepper_decoder.onnx` inference with extreme inputs (e.g. all-zero tokens, random tokens, edge cases).
5. State your verdict clearly: APPROVE or REJECT in handoff.md.

Write report to /Users/ate/Projects/stepper-web/.agents/teamwork_preview_challenger_m1_1/handoff.md and report back via send_message.
