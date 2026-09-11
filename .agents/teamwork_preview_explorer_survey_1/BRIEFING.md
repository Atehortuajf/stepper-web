# BRIEFING — 2026-09-11T19:14:30Z

## Mission
Investigate RoPE implementation in placement_net.py, static 512 cache broadcast mismatch on sequences > 21 beats, dynamic rotary frequency update, ONNX export in export_onnx_models.py, numerical parity validation, and Python environment.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, investigation, report
- Working directory: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1
- Original parent: a770b17f-ae4e-46a0-8f24-850f3e3f4269
- Milestone: Survey: Stepper RoPE & ONNX Export

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Communicate via send_message to caller a770b17f-ae4e-46a0-8f24-850f3e3f4269
- Deliver comprehensive findings to handoff.md

## Current Parent
- Conversation ID: a770b17f-ae4e-46a0-8f24-850f3e3f4269
- Updated: 2026-09-11T19:14:30Z

## Investigation State
- **Explored paths**:
  - /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
  - /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_1/DISPATCH.md
  - /Users/ate/Projects/Stepper/stepper/model/placement_net.py
  - /Users/ate/Projects/Stepper/scripts/export_onnx_models.py
  - /Users/ate/Projects/Stepper/stepper/model/step_decoder.py
  - /Users/ate/Projects/Stepper/stepper/model/stepper_sync.py
  - /Users/ate/Projects/Stepper/stepper/model/fsm_mask.py
  - /Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt
  - /Users/ate/Projects/stepper-web/frontend/public/models/
  - /Users/ate/Projects/stepper-web/frontend/dist/models/
  - /Users/ate/Projects/stepper-web/frontend/src/editor/workers/inference.worker.ts
  - /Users/ate/Projects/stepper-web/frontend/src/editor/api/wasmInference.ts
- **Key findings**:
  - Exact bug identified: RoPE in placement_net.py (lines 31-44) allocates static cache `_seq_len_cached = max(seq_len, 512)` during TorchScript tracing. When traced with 8 beats (192 ticks), `_cos_cached` is frozen as a 512-row constant in ONNX. Sequences > 21 beats (e.g. 22 beats -> 528 downsampled ticks, 64 beats -> 1536 ticks) slice past 512, which ONNX truncates to 512, triggering broadcast mismatch: 512 by 1536.
  - Dynamic RoPE calculation using `t = torch.arange(seq_len)` and `freqs = t.unsqueeze(1) * self.inv_freq.unsqueeze(0)` eliminates the static cache completely during ONNX export, tracing as standard elementwise Mul/Cos/Sin/Range ops.
  - Multi-length numerical parity verified across 8, 16, 21, 22, 32, 48, 64, 128, 256 beats with errors < 1e-6.
  - Checkpoints verified: /Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt (MD5 d9887c98e44f3102f19a2f5b21b6f4be) is genuine epoch 11 step 7188 FP16 model.
  - Python environment confirmed: Python 3.14.7, torch 2.14.0, onnx 1.22.0, onnxruntime 1.29.0, uv 0.12.7.
- **Unexplored areas**: None for this investigation phase.

## Key Decisions Made
- Confirmed dynamic RoPE formula `t.unsqueeze(1) * self.inv_freq.unsqueeze(0)` produces simple `Mul` rather than `Einsum` in ONNX graph, maximizing WASM/WebGPU portability.
- Confirmed verification plan across 16, 32, 48, 64 beats for placement model.

## Artifact Index
- handoff.md — Comprehensive findings and actionable implementation plan
- progress.md — Liveness heartbeat
- BRIEFING.md — Persistent working memory
