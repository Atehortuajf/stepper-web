# Environment & Infrastructure Exploration Report: Stepper-Web

**Date**: 2026-09-08  
**Agent**: Environment & Infrastructure Explorer (`teamwork_preview_explorer_environment_1`)  
**Target Workspace**: `/Users/ate/Projects/stepper-web`  
**Reference Workspace**: `/Users/ate/Projects/Stepper`  
**Host System**: Apple M4 (macOS 15.1 Sequoia, Darwin 24.1.0, arm64, 16 GB Unified Memory)

---

## Executive Summary

A comprehensive forensic audit of the development environment on the host machine was conducted to determine readiness, tool availability, hardware acceleration, audio pipeline constraints, model weight accessibility, testing capabilities, and project architecture for `stepper-web`.

### Key Takeaways:
1. **Node.js & Tooling**: Node.js `v22.23.2` (managed by `fnm`), `npm 10.9.8`, and `bun 1.4.0` are installed and ready. Modern frontend tooling (Vite 6, React 19, TypeScript 5.7, Tailwind CSS) is fully supported.
2. **Python & Tooling**: `uv 0.12.7` is installed via Homebrew. Homebrew provides Python `3.12.8`, `3.13.1`, and `3.14.7`. `/Users/ate/Projects/Stepper/.venv` already has a working Python `3.14.7` environment with PyTorch `2.14.0`.
3. **PyTorch & Acceleration**: PyTorch `2.14.0` with Apple Silicon **Metal Performance Shaders (MPS)** is verified functional (`torch.backends.mps.is_available() == True`). Neural forward passes with continuous technique vectors and FSM logit masking execute on `mps:0`.
4. **Audio Tooling**: System `ffmpeg` and `ffprobe` are **not** installed in PATH. However, `scipy.io.wavfile` and `torchaudio.functional` (`resample`, `melscale_fbanks`) work out of the box. Browser Web Audio API natively decodes MP3/OGG/WAV/FLAC client-side without server-side ffmpeg dependencies.
5. **Pretrained Weights & Fallback**: Google Drive weight links (`1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3` and `1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2`) require Google account authentication (HTTP 303/302 redirect to ServiceLogin) and cannot be downloaded anonymously via curl or gdown without credentials. A **deterministic synthetic weight generator** and a **dual-mode inference engine** (fallback/mock mode) must be provided for 100% automated developer onboarding and CI test passes.
6. **E2E & Screenshot Testing**: Playwright `v1.63.0` is available via `npx`. Google Chrome `152.0.7977.77` is installed at `/Applications/Google Chrome.app`. High-resolution visual screenshots across desktop (`1920x1080`) and mobile (`390x844`) viewports can be automated directly.
7. **Clean Workspace**: `/Users/ate/Projects/stepper-web` is currently pristine (only `.agents/` and `ORIGINAL_REQUEST.md` exist).

---

## 1. Node.js & Frontend Tooling Audit

| Tool | Version | Path | Status / Notes |
|---|---|---|---|
| **Node.js** | `v22.23.2` | `/Users/ate/.local/state/fnm_multishells/2909_1788548071184/bin/node` | Primary runtime (Node 22 LTS). Native fetch, Web Streams, Web Worker support. |
| **npm** | `10.9.8` | `/Users/ate/.local/state/fnm_multishells/2909_1788548071184/bin/npm` | Available for package management. |
| **bun** | `1.4.0` | `/opt/homebrew/bin/bun` | High-performance alternative for package installation and scripts. |
| **pnpm** | Not installed | N/A | Can be installed or use `npm`. |
| **yarn** | Not installed | N/A | Not needed; npm/bun sufficient. |

### Frontend Recommendation:
- Initialize frontend using **Vite 6 + React 19 + TypeScript + Tailwind CSS**.
- Use Canvas 2D or WebGL for the ArrowVortex-grade high-DPI waveform / spectrogram display and beat grid.
- Use Web Audio API (`AudioContext`, `decodeAudioData`, `AudioBufferSourceNode`) for zero-latency audio playback, variable pitch/speed scrubbing, and sample-accurate cursor alignment.

---

## 2. Python Environment & Dependency Management Audit

| Tool | Version | Path | Status / Notes |
|---|---|---|---|
| **uv** | `0.12.7` | `/opt/homebrew/bin/uv` | Highly recommended for lightning-fast virtualenv creation, package resolution, and dependency caching. |
| **python3** (default) | `3.14.7` | `/opt/homebrew/bin/python3` | Homebrew Python 3.14. |
| **python3.13** | `3.13.1` | `/opt/homebrew/bin/python3.13` | Homebrew Python 3.13. |
| **python3.12** | `3.12.8` | `/opt/homebrew/bin/python3.12` | Homebrew Python 3.12 (industry standard for ML/PyTorch stability). |
| **System python3** | `3.9.6` | `/usr/bin/python3` | Apple Xcode tools Python (do not use). |
| **pip3** | `26.2.1` | `/opt/homebrew/bin/pip3` | Homebrew pip. |
| **Existing Venv** | `3.14.7` | `/Users/ate/Projects/Stepper/.venv` | Contains PyTorch 2.14.0, torchaudio 2.11.0, scipy 1.18.1, numpy 2.5.2. |

### Resolution & Compatibility Test:
Package compilation tests using `uv pip compile` against both Python 3.12 and 3.14 succeeded instantaneously for `fastapi==0.141.1`, `uvicorn`, `pydantic`, `scipy`, and `torch`.
- Recommendation: Use `uv` to manage a dedicated `.venv` in `/Users/ate/Projects/stepper-web/backend/.venv` (or share dependencies from `/Users/ate/Projects/Stepper/.venv`).

---

## 3. PyTorch, Hardware Acceleration, and Device Capabilities

### Hardware Specifications:
- **Processor**: Apple M4 (Apple Silicon arm64)
- **Unified Memory**: 16 GB (17,179,869,184 bytes)
- **OS**: macOS 15.1 (Sequoia), Kernel Darwin 24.1.0

### PyTorch Capabilities:
- **PyTorch Version**: `2.14.0`
- **MPS Built**: `True` (`torch.backends.mps.is_built()`)
- **MPS Available**: `True` (`torch.backends.mps.is_available()`)
- **Verified Device**: `mps:0` (tensor operations verified on GPU)
- **CUDA Available**: `False` (CUDA is Nvidia-specific; Mac uses MPS)

### Model Execution Verification:
`stepper.model.stepper_sync.StepperSync` was instantiated and evaluated in memory:
- **Total Parameters**: 8,344,417 (~8.3M params)
- **Input Spec**: `audio: (B, 2, T_beats, 48, 128)`, `difficulty: (B,)`, `tech_vector: (B, 16)`
- **Output Spec**: `placement_logits: (B, T_beats, 48)`, `acoustic_map: (B, T_ticks, 256)`
- **Device Fallback**:
  ```python
  device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
  ```

---

## 4. Audio Tooling & Feature Ingestion Pipeline

### Audit Findings:
1. `ffmpeg` and `ffprobe` are **absent** from the host PATH (`which ffmpeg` returned code 1).
2. `scipy.io.wavfile` is installed and verified capable of reading and writing 16-bit and 32-bit PCM WAV buffers.
3. `torchaudio.load` failed because `TorchCodec` is not installed; however, `torchaudio.functional.resample` and `torchaudio.functional.melscale_fbanks` execute purely in PyTorch tensor memory without external codecs.
4. `stepper.data.audio_features.AudioFeatureExtractor` was tested:
   - Successfully converts waveform to 2-channel beat-synchronous Mel spectrograms:
     - Channel 0: Log-Mel spectrogram (128 bands, Slaney normalization).
     - Channel 1: Positive half-wave rectified spectral flux.
     - Rate: Exactly 48 ticks per beat (192 ticks per 4/4 measure).
   - `load_audio_with_fallback` automatically catches missing audio codecs and generates deterministic synthetic click-track audio for offline testing.

### Architecture Optimization for Web:
Because browsers natively support Web Audio decoding (`AudioContext.decodeAudioData`), the frontend can:
1. Decode user audio files (MP3, OGG, WAV, AAC, FLAC) client-side in the browser.
2. Render high-resolution waveforms and spectrograms directly on HTML5 Canvas using raw PCM channel buffers.
3. For AI inference (`/api/generate`), the frontend can encode audio slices (e.g. 16 measures) to standard WAV format via a client-side WAV serializer (or upload raw PCM float32 arrays), eliminating any backend dependency on system `ffmpeg`.

---

## 5. Model Weights Accessibility & Fallback/Mock Architecture

### Google Drive Accessibility Test:
Testing HTTP GET / HEAD requests against Google Drive file IDs:
- **FP16 (16 MB)**: `1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3`
- **FP32 (32 MB)**: `1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2`

**Observed Result**:
Both URLs return `HTTP/2 303` followed by `HTTP/2 302` redirecting to:
`https://accounts.google.com/ServiceLogin?service=wise&passive=1209600&continue=...`
This indicates that the files are restricted to authenticated Google Workspace users or require user sign-in cookies. Direct automated CLI downloads (`curl`, `gdown`) will fail without manual authentication.

### Fallback & Mock Architecture:
To satisfy Acceptance Criteria R2 ("Provides an automated setup/download script or fallback mock mode for instant developer onboarding without manual weight setup"):
1. **Deterministic Initialization Script (`scripts/init_model_weights.py`)**:
   Instantiates `StepperSync` with a fixed RNG seed (`torch.manual_seed(42)`), creating a valid `stepper_weights_fp16.pt` (~16.7 MB) checkpoint file.
2. **Dual-Mode Inference Service**:
   - Mode 1 (**Trained Checkpoint**): If `backend/models/stepper_weights_fp16.pt` exists and is non-empty, load weights via `torch.load(..., weights_only=True)`.
   - Mode 2 (**Procedural / Untrained Neural Mode**): If weights are absent, instantiate `StepperSync` in evaluation mode. All tensor dimensions, embeddings, and FSM masks remain 100% active and functional.
   - Mode 3 (**Ultra-Fast Heuristic Mock Mode**): For rapid CI tests and unit test suites requiring <50ms response times, provide a rule-based mock generator that respects `z_tech` parameters (e.g. high footswitch ratio generates alternating steps on single tracks, stream density controls note spacing).

---

## 6. Playwright & Automated E2E Testing Infrastructure

| Component | Status | Location / Details |
|---|---|---|
| **Playwright CLI** | Version `1.63.0` | Accessible via `npx playwright` |
| **System Browser** | Google Chrome `152.0.7977.77` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| **Browser Cache** | `~/Library/Caches/ms-playwright` | Can be initialized via `npx playwright install chromium` or configured to use system Google Chrome (`channel: 'chrome'`). |

### Testing Capabilities:
- Automated headless browser tests can run via `@playwright/test`.
- Multi-viewport screenshot generation:
  - **Desktop Viewport**: `1920x1080`
  - **Mobile Viewport**: `390x844` (simulating iPhone 14/15/16)
- Artifact directory for screenshots: `output/screenshots/`.

---

## 7. Current Repository State (`/Users/ate/Projects/stepper-web`)

Currently, `/Users/ate/Projects/stepper-web` contains:
- `.agents/`: Agent working directories, plans, and dispatches.
- `ORIGINAL_REQUEST.md`: Initial requirements specification.
- No source code or build configuration exists yet.

---

## 8. Reference Codebase Findings (`/Users/ate/Projects/Stepper`)

The reference repository `/Users/ate/Projects/Stepper` provides mature, production-tested implementations that should be leveraged:
1. **Technique Vector Taxonomy (`stepper/data/tech_tags.py`)**:
   - 16-dimensional continuous technique vector `z_tech`:
     `crossover`, `footswitch`, `doublestep`, `bracket`, `bracket_under`, `bracket_crossover`, `sideswitch`, `kickswitch`, `holdswitch`, `jack`, `jump_jack`, `split_jack`, `bracket_tap`, `complex_rhythm`, `stream_stamina`, `no_tech`.
   - Complete helper functions: `extract_tech_vector`, `tech_vector_to_dict`, `dict_to_tech_vector`, `describe_tech_vector`.
2. **Biomechanical Foot Solver (`stepper/validate/viterbi_solver.py`)**:
   - `ViterbiFootSolver` computes the optimal foot sequence (`['L', 'R', 'LR']`) using dynamic programming on an HMM.
   - Evaluates transition costs, foot switches, crossovers, brackets, candles, jacks, and physical impossibilities.
   - Verified working in environment tests (`is_physically_playable`, `total_cost`, `stats`).
3. **Timing Engine (`stepper/timing/engine.py`)**:
   - `TimingEngine` compiles BPM changes, stops, delays, and warps into exact piecewise linear segments.
   - Provides bi-directional mapping: `beat_to_seconds` and `seconds_to_beat`.
4. **Stepchart Parsers & Writers (`stepper/data/msd_parser.py`, `export/sm_writer.py`, `export/ssc_writer.py`)**:
   - Full `.sm` and `.ssc` file structure with multi-difficulty chart parsing and serialization.

---

## 9. Recommended Project Architecture & Directory Layout

### Technology Stack:
- **Frontend**:
  - React 19 + TypeScript 5.7 + Vite 6
  - Tailwind CSS (DAW utilitarian dark theme: #121214 base, high contrast, zero vibe fluff)
  - HTML5 Canvas for beat grid & waveform (ArrowVortex-grade multi-level zoom 1x-64x)
  - Web Audio API for multi-speed playback (0.25x-2.0x), waveform decoding, and precise audio scheduling
  - Mobile touch controls (on-screen 4-panel directional pad, responsive drawers, touch scrub bar)
- **Backend**:
  - FastAPI + Uvicorn + Pydantic v2
  - PyTorch 2.14 (Apple Silicon MPS enabled) + scipy + numpy
  - Reference stepper model integration (`stepper.model.stepper_sync.StepperSync`, `ViterbiFootSolver`)
- **Testing**:
  - Backend: `pytest` with latency benchmarks (<1.5s 16-beat chunk, <5s full chart)
  - Frontend: `vitest` for parser & timing unit tests
  - End-to-End: `@playwright/test` for desktop (1920x1080) and mobile (390x844) automated testing with visual screenshots captured in `output/screenshots/`

### Proposed Directory Layout:
```
/Users/ate/Projects/stepper-web/
├── .agents/                      # Teamwork agent metadata & coordination (ONLY)
├── backend/                      # Python FastAPI AI & Biomechanical Service
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate.py       # REST & WS chart generation endpoints
│   │   │   ├── validate.py       # Viterbi foot solver & parity endpoints
│   │   │   └── health.py         # Service status, device (mps/cpu), model state
│   │   ├── core/
│   │   │   ├── config.py         # Environment & device configuration
│   │   │   └── model_loader.py   # Dual-mode StepperSync loader (checkpoint / procedural fallback)
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── inference.py      # Autoregressive generation & conditioning logic
│   │   │   └── biomechanics.py   # Foot solver wrapper & transition cost analysis
│   │   └── main.py               # FastAPI application entrypoint
│   ├── models/                   # Local weights directory (.pt files)
│   ├── scripts/
│   │   └── init_weights.py       # Deterministic weight synthesizer for instant onboarding
│   ├── tests/
│   │   ├── test_api.py           # Endpoint validation & latency benchmarks
│   │   └── test_inference.py     # Model forward pass & conditioning tests
│   ├── pyproject.toml            # Backend dependencies (managed with uv)
│   └── requirements.txt
├── frontend/                     # React + Vite + TypeScript Client Application
│   ├── public/
│   │   └── audio/                # Default sample song/clicks for testing
│   ├── src/
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts    # Web Audio API context, playback rates, waveform buffer
│   │   │   └── wavEncoder.ts     # Client-side WAV serializer
│   │   ├── components/
│   │   │   ├── editor/           # Canvas beat grid, note placement, subdivision lines
│   │   │   ├── waveform/         # Interactive waveform/spectrogram canvas with scrub bar
│   │   │   ├── conditioning/     # 16-D z_tech slider drawer with ITL preset chips
│   │   │   ├── biomechanics/     # Foot parity tracks, heatmap overlay, unplayability flags
│   │   │   └── mobile/           # Mobile touch pad (4 arrows), compact toolbar, drawer
│   │   ├── formats/
│   │   │   ├── smParser.ts       # Lossless .sm parser & writer
│   │   │   ├── sscParser.ts      # Lossless .ssc parser & writer
│   │   │   └── timingEngine.ts   # Client-side beat-to-seconds piecewise timing engine
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── tests/                        # Automated End-to-End & Visual Test Suite
│   ├── e2e/
│   │   ├── editor.spec.ts        # Note placement, subdivision color tests, undo/redo
│   │   ├── inference.spec.ts     # AI generation flow, diff preview, commit
│   │   ├── mobile.spec.ts        # Mobile touch controls, drawer, responsive layout
│   │   └── file_roundtrip.spec.ts# SM/SSC lossless parsing & export
│   └── playwright.config.ts      # Multi-device viewports (1920x1080 & 390x844)
├── output/
│   └── screenshots/              # Automated screenshot captures from Playwright
├── ORIGINAL_REQUEST.md
└── PROJECT.md                    # Core project blueprint & interface contracts
```
