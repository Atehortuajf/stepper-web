# Task Assignment for Worker 1 (Milestone 1: RoPE Dynamic Sequences & ONNX Export)

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/handoff.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/proposed_placement_net_rope.patch
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/proposed_export_onnx_models.patch

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
1. Update `RoPE` in `/Users/ate/Projects/Stepper/stepper/model/placement_net.py` so rotary frequency embeddings are computed dynamically based on the input sequence length, eliminating the static 512-length cache truncation during ONNX tracing.
2. Update `/Users/ate/Projects/Stepper/scripts/export_onnx_models.py` to target checkpoint `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt`, compile genuine `stepper_placement.onnx` and `stepper_decoder.onnx`, and output/copy them to both `/Users/ate/Projects/stepper-web/frontend/public/models/` and `/Users/ate/Projects/stepper-web/frontend/dist/models/`.
3. Validate numerical parity between PyTorch and exported ONNX models across arbitrary sequence lengths (16, 32, 64 beats) using `/Users/ate/Projects/Stepper/.venv/bin/python`. Confirm max absolute error is < 1e-5.
4. Run Stepper test suite (`pytest tests/`) to ensure no regressions.

File write ownership:
- `/Users/ate/Projects/Stepper/stepper/model/placement_net.py`
- `/Users/ate/Projects/Stepper/scripts/export_onnx_models.py`
- `/Users/ate/Projects/stepper-web/frontend/public/models/*`
- `/Users/ate/Projects/stepper-web/frontend/dist/models/*`

Report your complete execution results and verification in `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/handoff.md`.

## 2026-09-11T19:15:27Z
You are Worker 1 for Milestone 1. Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/.

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/DISPATCH.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/handoff.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/proposed_placement_net_rope.patch
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/proposed_export_onnx_models.patch

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Apply the dynamic RoPE update to /Users/ate/Projects/Stepper/stepper/model/placement_net.py so rotary embeddings are computed dynamically during tracing for arbitrary sequence lengths.
2. Update /Users/ate/Projects/Stepper/scripts/export_onnx_models.py targeting genuine checkpoint /Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt.
3. Run the export script using /Users/ate/Projects/Stepper/.venv/bin/python to compile stepper_placement.onnx and stepper_decoder.onnx. Ensure both models are deployed to /Users/ate/Projects/stepper-web/frontend/public/models/ and /Users/ate/Projects/stepper-web/frontend/dist/models/.
4. Run numerical parity checks comparing PyTorch against ONNX Runtime across 16, 32, and 64 beats. Ensure max diff < 1e-5.
5. Run Stepper tests (/Users/ate/Projects/Stepper/.venv/bin/pytest tests/) to confirm all unit tests pass cleanly.

Write your report to /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/handoff.md and report back via send_message.
