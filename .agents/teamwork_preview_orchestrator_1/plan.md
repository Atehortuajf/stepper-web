# Project Plan: Stepper-Web Dance Stepchart Editor & AI Inference Platform

## Objective
Build a full-stack, mobile-compatible dance stepchart editor web application with ArrowVortex-grade editing capabilities, integrated Stepper AI inference conditioning, and biomechanical playability analysis in `/Users/ate/Projects/stepper-web`.

## Phase 0: Survey & Scope Mapping
1. **Explorer 1 (Reference Codebase / Stepper Model)**:
   - Explore `/Users/ate/Projects/Stepper` (`stepper/model/stepper_sync.py`, `stepper/data/tech_tags.py`, audio processing, conditioning vectors, checkpoint structure, foot solver/Viterbi implementation).
2. **Explorer 2 (Spec Miner - ArrowVortex & StepMania Engine)**:
   - Survey .sm / .ssc file format specifications, ArrowVortex feature matrix, timing events (BPM, stops, delays, warps, time signatures), note types, subdivisions (4th to 192nd) with canonical StepMania colors, and Web Audio/Canvas rendering patterns.
3. **Explorer 3 (Environment & Testing Prerequisites)**:
   - Survey `/Users/ate/Projects/stepper-web` workspace, system tools (Python, Node/npm, Playwright, PyTorch, gdown, audio libs), and setup requirements.
4. **Synthesize & Document**:
   - Synthesize findings into `PROJECT.md` at project root, defining complete Feature Inventory, Interface Contracts, and Code Layout.

## Phase 1: Dual Track Initiation
- **E2E Testing Track**:
  - Spawn E2E Testing Orchestrator to define `TEST_INFRA.md`, build test harness, and implement Tier 1-4 tests (Feature, Boundary, Cross-feature, Real-World), culminating in `TEST_READY.md`.
- **Implementation Track**:
  - **Milestone M1**: Core Stepchart Editor Engine & Audio/Timing (R1)
    - Data models, .sm/.ssc lossless parser & serializer, audio waveform/spectrogram engine, timing math (BPM, stops, warps, delays, time signatures), beat subdivision color coding.
  - **Milestone M2**: Stepper AI Inference Backend Service (R2)
    - FastAPI service, model weights loader (FP16/FP32 via gdown or fallback mode), audio feature extraction, /api/generate REST/WebSocket endpoints, latency optimization (<1.5s 16-beat, <5s full chart).
  - **Milestone M3**: Interactive Conditioning & Biomechanical Parity/Viterbi Solver (R3)
    - 16-D z_tech continuous conditioning sliders, one-click measure/chart generation with diff preview, Viterbi biomechanical foot parity solver (L/R/bracket/heel-toe), transition cost heatmaps, unplayability warnings.
  - **Milestone M4**: Utilitarian DAW/ArrowVortex Desktop & Mobile UI (R4)
    - High-density DAW aesthetic (Ableton/REAPER style, no fluff), full keyboard shortcuts & numpad mapping, touch-optimized mobile mode (375px-430px) with on-screen directional touch pads, scrub bars, and adaptive drawer controls.

## Phase 2: Final Milestone & Acceptance
1. **Phase 1 Acceptance**: Pass 100% of E2E Test Suite (Tiers 1-4).
2. **Phase 2 Hardening**: Tier 5 Adversarial Coverage Hardening via Challenger → Worker → Reviewer cycle.
3. **Forensic Integrity Verification**: Comprehensive audit by `teamwork_preview_auditor`.
4. **Visual & Screenshot Verification**: High-resolution desktop and mobile screenshot capture and visual verification.
5. **Final Human Report**: Structured delivery report with verified outcomes.
