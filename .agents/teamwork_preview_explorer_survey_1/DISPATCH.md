# Task Assignment for Explorer 1 (Survey: Stepper RoPE & ONNX Export)

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/Stepper/stepper/model/placement_net.py
- /Users/ate/Projects/Stepper/scripts/export_onnx_models.py
- /Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt
- /Users/ate/Projects/Stepper/stepper/model/

Investigate:
1. Exactly how RoPE is implemented in placement_net.py. Identify the static 512-length cache causing the 512 by 1536 broadcast mismatch on sequences > 21 beats.
2. How to update RoPE so rotary frequency embeddings are computed dynamically based on the input sequence length.
3. How `scripts/export_onnx_models.py` currently exports models, what dynamic axes are specified, how to target `checkpoints/stepper_weights_fp16.pt`, and export `stepper_placement.onnx` and `stepper_decoder.onnx` into `/Users/ate/Projects/stepper-web/frontend/public/models/` and `/Users/ate/Projects/stepper-web/frontend/dist/models/`.
4. How to validate numerical parity between PyTorch and exported ONNX models across arbitrary sequence lengths (16, 32, 64 beats).
5. Check Python environment and available packages (torch, onnx, onnxruntime, etc.).

Write your comprehensive findings to `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/handoff.md`.
