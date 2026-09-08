# DISPATCH: Milestone M2 Worker — Stepper AI Inference Backend Service

**Agent Working Directory**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m2_1
**Role**: Milestone M2 Worker
**Original User Request**: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
**Project Architecture & Specifications**: /Users/ate/Projects/stepper-web/PROJECT.md
**Reference Codebase**: /Users/ate/Projects/Stepper
**Stepper Architecture Report**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_stepper_1/report.md
**Environment Explorer Report**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_environment_1/report.md

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You exclusively own:
- `/Users/ate/Projects/stepper-web/backend/` (all files and directories within `backend/`)
Do NOT modify `frontend/` or `tests/`.

## Objectives (Milestone M2: Features F8–F11)
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` and `/Users/ate/Projects/stepper-web/PROJECT.md`.
2. Set up the Python backend in `/Users/ate/Projects/stepper-web/backend/` using FastAPI and Uvicorn.
3. Implement PyTorch Stepper-Sync model serving in `backend/app/core/`:
   - Integrate `StepperSync` (PlacementNet + StepSelectionDecoder) from `/Users/ate/Projects/Stepper` or modularly include the model definition in `backend/app/model/`.
   - Implement device selection supporting Apple Silicon Metal Performance Shaders (`mps:0`), CUDA, and CPU fallback.
   - Implement model loader (`model_loader.py`):
     - Support loading genuine model weights (`stepper_weights_fp16.pt` or `stepper_weights_fp32.pt`).
     - Provide an automated synthetic weight initialization script (`backend/scripts/init_weights.py`) that initializes and exports deterministic valid PyTorch weights for instant developer onboarding.
     - Provide a fallback mock/rule-based generation engine (`fallback_model.py`) that ensures instant, robust chart generation even if model weights are absent or during fast testing.
4. Implement audio feature extraction pipeline in `backend/app/core/feature_extract.py`:
   - 44,100 Hz mono audio processing, Hann windowed STFT, 128 Mel filterbank, log dynamic range compression $\ln(1 + 10^4 \cdot S_{\text{mel}})$, positive spectral flux, and continuous 48-tick Bresenham phase sampling.
   - Handle PCM WAV buffers sent via REST/WebSocket without requiring external ffmpeg binaries.
5. Implement FastAPI REST and WebSocket endpoints:
   - `GET /api/health`: System health, PyTorch device status, model loaded state.
   - `POST /api/generate`: Fast inference endpoint accepting audio slice/features, difficulty level (0-4 / Novice to Expert or 1-25+ scale), and 16-D continuous $z_{\text{tech}}$ vector. Returns predicted note placements, chord classifications, confidence logits. Latency benchmark: < 1.5s for 16-beat chunk, < 5s for full chart.
   - `WS /api/ws/generate`: Real-time streaming generation endpoint for interactive scrubbing and measure-by-measure streaming.
   - `POST /api/solve-parity`: Biomechanical foot solver endpoint wrapping `ViterbiFootSolver` from `/Users/ate/Projects/Stepper/stepper/validate/viterbi_solver.py`.
6. Implement backend unit and integration tests in `backend/tests/`:
   - Test model loading (synthetic weights and fallback mode).
   - Test audio feature extraction pipeline.
   - Test `/api/generate` and `/api/solve-parity` endpoints with pytest and httpx/TestClient.
   - Verify latency benchmarks (< 1.5s for 16-beat chunk).
7. Run the test command (`pytest backend/tests`) and document passing results.
8. Deliver your report in `handoff.md` and notify the orchestrator.

## 2026-09-08T06:50:34Z
You are the Milestone M2 Worker: Stepper AI Inference Backend Service.
Objectives (Features F8-F11):
1. Set up the Python FastAPI backend in backend/ with Uvicorn.
2. Implement Stepper-Sync model serving in backend/app/core/:
   - Integrate StepperSync model architecture (supporting Apple Silicon MPS and CPU).
   - Implement model loader supporting genuine weights, automated deterministic synthetic weights initialization script (backend/scripts/init_weights.py), and robust fallback generation mode for instant onboarding.
3. Implement audio feature extraction pipeline in backend/app/core/feature_extract.py:
   - 44.1 kHz Hann STFT, 128 Mel bands, positive spectral flux, 48-tick phase sampling over PCM WAV buffers.
4. Implement REST and WebSocket endpoints:
   - GET /api/health
   - POST /api/generate: fast inference (<1.5s 16-beat chunk, <5s full chart) accepting audio slices, difficulty (0-4 / Novice-Expert or 1-25+), and 16-D continuous z_tech vector.
   - WS /api/ws/generate: streaming generation.
   - POST /api/solve-parity: biomechanical foot solver endpoint wrapping ViterbiFootSolver from /Users/ate/Projects/Stepper/stepper/validate/viterbi_solver.py.
5. Create pytest tests in backend/tests/ verifying model loading, feature extraction, endpoints, and latency benchmarks.
6. Run tests (pytest backend/tests) and verify they pass.
7. Maintain progress.md with timestamps, deliver handoff.md with documented test results, and notify orchestrator.
