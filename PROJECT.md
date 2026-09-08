# Project: Stepper-Web Dance Stepchart Editor & AI Inference Platform

## Architecture
Full-stack dance stepchart editor web application with ArrowVortex-grade editing capabilities, integrated Stepper AI inference conditioning, and biomechanical playability analysis.

### System Topology
```
                  ┌─────────────────────────────────────────────────────────────┐
                  │                      Browser Client                         │
                  │  (React 19 + TypeScript + Vite 6 + Tailwind + HTML5 Canvas) │
                  ├──────────────────────────────┬──────────────────────────────┤
                  │     ArrowVortex Editor       │  Stepper AI & Biomechanical  │
                  │   - 192-tick note grid       │  - 16-D z_tech sliders       │
                  │   - Audio waveform/scrubber  │  - One-click diff generator  │
                  │   - Piecewise timing engine  │  - Viterbi parity tracks     │
                  │   - Lossless .sm/.ssc parser │  - Transition cost heatmaps  │
                  │   - Desktop / Mobile touch UI│  - Unplayability warnings    │
                  └──────────────┬───────────────┴──────────────▲───────────────┘
                                 │ HTTP / WebSocket             │
                                 ▼                              │
                  ┌─────────────────────────────────────────────┴───────────────┐
                  │                   Python FastAPI Backend                    │
                  │  - Uvicorn server (/api/generate, /api/health, /api/solver) │
                  │  - StepperSync PyTorch neural model (MPS/CPU)               │
                  │  - Audio feature extraction (STFT, 128 Mel, Spectral Flux)  │
                  │  - Pretrained weights loader + deterministic synthetic mode │
                  │  - ViterbiFootSolver & PlayabilityValidator                 │
                  └─────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | MSD Parser & Lexer | Full EBNF MSD grammar lexer handling parameter blocks, comments, escape characters (`\:` `\;` `\#`), and malformed tags | M1 | Spec Miner / R1 |
| F2 | Lossless .sm & .ssc Serializer | Full support for legacy .sm and modern .ssc `#NOTEDATA:;` with split timing and measure line minimization (`get_smallest_note_type_for_measure`) | M1 | Spec Miner / R1 |
| F3 | 192-Tick Beat Grid & Subdivisions | Fixed-point 192 rows/measure grid supporting 4th, 8th, 12th, 16th, 24th, 32nd, 48th, 64th, 96th, 192nd subdivisions | M1 | Spec Miner / R1 |
| F4 | Canonical StepMania Subdivision Colors | Exact StepMania color hues (4th: `#ff2a55`, 8th: `#00a2ff`, 12th: `#9e3cff`, 16th: `#ffd000`, 24th: `#ff54be`, 32nd: `#ff7b00`, 48th: `#00e5ff`, 64th: `#00e676`, 96th: `#b0bec5`, 192nd: `#78909c`) | M1 | Spec Miner / R1 |
| F5 | Note Types & Game Modes | Dance Singles (4-panel) & Doubles (8-panel); Taps ('1'), Holds ('2'/'3'), Rolls ('4'/'3'), Mines ('M'), Lifts ('L'), Fakes ('F') | M1 | Spec Miner / R1 |
| F6 | Interactive Audio Waveform & Spectrogram | High-resolution interactive audio waveform and spectrogram display with smooth scrubbing, multi-level zoom (1x to 64x), playback rates (0.25x to 2.0x), and audio bookmarking | M1 | R1 |
| F7 | Piecewise Timing Engine | Precise mathematical bi-directional conversion ($t_{\text{audio}} \leftrightarrow \text{beat}$) with initial `#OFFSET`, variable `#BPMS`, `#STOPS`, `#DELAYS`, `#WARPS`, and `#TIMESIGNATURES` | M1 | Spec Miner / R1 |
| F8 | Stepper-Sync PyTorch Model Loading | Load StepperSync checkpoint (`stepper_weights_fp16.pt` / `stepper_weights_fp32.pt`) on Apple Silicon MPS or CPU | M2 | R2 / Stepper |
| F9 | Instant Onboarding & Fallback Mode | Deterministic synthetic checkpoint generator and mock rule-based generator for instant developer onboarding without manual weight download | M2 | R2 / Env |
| F10 | Audio Feature Extraction Pipeline | 44.1 kHz Hann STFT, 128 Mel bands, dynamic range compression, positive spectral flux, and 48-tick Bresenham phase sampling | M2 | R2 / Stepper |
| F11 | REST & WebSocket Inference Endpoints | Fast endpoints (`/api/generate`, `/api/health`, `/api/solve-parity`) with latency < 1.5s for 16-beat chunks and < 5s for full charts | M2 | R2 |
| F12 | 16-D Technique Conditioning Sliders | Continuous sliders for $z_{\text{tech}}$ vector: crossover, footswitch, doublestep, bracket, burst, bracket_crossover, sideswitch, kickswitch, holdswitch, jack, jump_jack, split_jack, bracket_tap, complex_rhythm, stream_stamina, no_tech | M3 | R3 / Stepper |
| F13 | Interactive Chart Generation & Diff Preview | One-click generation for selected measures or entire songs with live preview and diff overlay before committing | M3 | R3 |
| F14 | Viterbi Biomechanical Foot Parity Overlay | Real-time foot solver annotating foot parity (`'L'`, `'R'`, `'LR'`, bracket, heel-toe), transition cost heatmaps, and physical unplayability warnings | M3 | R3 / Stepper |
| F15 | Professional DAW / ArrowVortex Desktop UI | Tool-first aesthetic modeled after Ableton Live and ArrowVortex (high contrast, zero decorative fluff), dense information hierarchy | M4 | R4 |
| F16 | Desktop Keyboard-Driven Editing | Comprehensive ArrowVortex keyboard shortcuts: numpad/number row, arrow keys, space to play/pause, subdivision switching, hold conversions, sync dialogs | M4 | R4 / Spec Miner |
| F17 | Mobile Responsive Touch Mode | Responsive layout for mobile viewports (375px to 430px) with on-screen directional touch pads, scrub bars, and adaptive drawer controls | M4 | R4 / Spec Miner |
| F18 | Full Mobile Editing Workflow | Complete end-to-end editing (load audio, set BPM, place notes, run AI generation, export .ssc) on touch screens without hardware keyboard | M4 | R4 |
| F19 | E2E Test Suite (Tiers 1-4) | Comprehensive test suite covering feature tests, boundary/corner cases, cross-feature combinations, and real-world ITL charts | Final | E2E Track |
| F20 | Tier 5 Adversarial Coverage Hardening | White-box adversarial testing, edge case stress-testing, and automated Playwright desktop/mobile screenshot captures in `output/screenshots/` | Final | E2E Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Test harness, test runner, Tiers 1-4 test cases, Playwright screenshot capture, publish TEST_READY.md | none | IN_PROGRESS |
| M1 | Core Stepchart Editor Engine & Audio/Timing | F1, F2, F3, F4, F5, F6, F7: .sm/.ssc parser/serializer, 192-tick grid, color hues, audio waveform, piecewise timing engine | none | READY |
| M2 | Stepper AI Inference Backend Service | F8, F9, F10, F11: FastAPI service, PyTorch model loader, fallback/synthetic mode, audio feature extraction, /api/generate | none | READY |
| M3 | Interactive Conditioning & Biomechanical Parity | F12, F13, F14: 16-D z_tech sliders, measure/chart diff generator, Viterbi foot solver overlay & unplayability warnings | M1, M2 | PLANNED |
| M4 | Professional DAW & Mobile Touch UI | F15, F16, F17, F18: Utilitarian desktop DAW UI, keyboard shortcuts, mobile responsive viewports (375-430px), touch pads, mobile workflow | M1, M3 | PLANNED |
| Final | 100% E2E Pass & Adversarial Hardening | F19, F20: Pass all Tier 1-4 E2E tests, Tier 5 white-box adversarial coverage hardening, Playwright desktop/mobile screenshots | M4, E2E | PLANNED |

## Interface Contracts

### M1 ↔ Frontend / M3
- **SongModel**:
  ```typescript
  interface Simfile {
    metadata: Record<string, string>; // #TITLE, #ARTIST, #MUSIC, #OFFSET, etc.
    timing: TimingData;
    charts: Chart[];
  }
  interface TimingData {
    offset: number; // in seconds
    bpms: Array<{ beat: number; bpm: number }>;
    stops: Array<{ beat: number; duration: number }>;
    delays: Array<{ beat: number; duration: number }>;
    warps: Array<{ beat: number; duration: number }>;
    timeSignatures: Array<{ beat: number; numerator: number; denominator: number }>;
  }
  interface Chart {
    stepsType: 'dance-single' | 'dance-double';
    description: string;
    difficulty: 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Challenge' | 'Edit';
    meter: number;
    radarValues?: string;
    notes: Measure[];
  }
  interface Measure {
    lines: string[]; // each string length 4 (singles) or 8 (doubles)
  }
  ```
- **TimingEngine**:
  ```typescript
  function beatToSeconds(beat: number, timing: TimingData): number;
  function secondsToBeat(seconds: number, timing: TimingData): number;
  function getSubdivision(tickInMeasure: number): SubdivisionType;
  function getSubdivisionColor(tickInMeasure: number): string;
  ```

### M2 ↔ M3 / Client API
- **POST `/api/generate`**:
  - Request JSON or multipart:
    ```json
    {
      "audio_slice": "base64_encoded_pcm_wav_or_raw",
      "difficulty": 3, // 0: Novice, 1: Easy, 2: Medium, 3: Hard, 4: Expert (or meter 1-25)
      "tech_vector": [0.0, ..., 0.0], // 16-D float array [0.0, 1.0]
      "start_beat": 0.0,
      "num_beats": 16.0,
      "bpm": 140.0
    }
    ```
  - Response JSON:
    ```json
    {
      "placements": [
        { "beat": 1.0, "arrows": "1000", "chord_idx": 1, "confidence": 0.95 }
      ],
      "latency_ms": 120.5
    }
    ```
- **POST `/api/solve-parity`**:
  - Request JSON:
    ```json
    {
      "steps_type": "dance-single",
      "notes": [
        { "beat": 0.0, "arrows": "1000" },
        { "beat": 0.5, "arrows": "0100" }
      ]
    }
    ```
  - Response JSON:
    ```json
    {
      "is_playable": true,
      "total_cost": 0.509,
      "foot_sequence": ["L", "R"],
      "annotated_steps": [
        { "beat": 0.0, "arrows": "1000", "foot": "L", "cost": 0.1, "warning": null },
        { "beat": 0.5, "arrows": "0100", "foot": "R", "cost": 0.1, "warning": null }
      ]
    }
    ```

## Code Layout
```
/Users/ate/Projects/stepper-web/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI application & router mounting
│   │   ├── api/
│   │   │   ├── generate.py        # /api/generate REST & WebSocket endpoints
│   │   │   ├── parity.py          # /api/solve-parity endpoint
│   │   │   └── health.py          # Health & system status
│   │   ├── core/
│   │   │   ├── model_loader.py    # StepperSync loading, device selection (MPS/CPU)
│   │   │   ├── fallback_model.py  # Deterministic synthetic & rule-based fallback
│   │   │   ├── feature_extract.py # Audio feature extractor (STFT, Mel, flux)
│   │   │   └── parity_solver.py   # Viterbi foot solver bridge
│   │   └── schemas/               # Pydantic request & response models
│   ├── models/                    # Model weight storage
│   ├── scripts/                   # Weight init & download utilities
│   └── tests/                     # Pytest backend tests
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── editor/
│   │   │   ├── engine/            # Core chart data models & serialization
│   │   │   │   ├── msdParser.ts   # EBNF MSD lexer & parser
│   │   │   │   ├── smSerializer.ts# Lossless .sm & .ssc serializer
│   │   │   │   ├── measureUtil.ts # Line minimization algorithm
│   │   │   │   └── timingEngine.ts# Exact bi-directional timing math
│   │   │   ├── audio/             # Web Audio engine, waveform & spectrogram
│   │   │   ├── canvas/            # High-performance Canvas/WebGL note renderer
│   │   │   ├── conditioning/      # 16-D z_tech sliders & AI generation UI
│   │   │   ├── biomechanics/      # Viterbi foot parity tracks & heatmaps
│   │   │   └── ui/                # DAW desktop layout & mobile touch controls
│   └── tests/                     # Frontend unit tests
├── tests/
│   ├── e2e/                       # Playwright E2E test specs
│   └── fixtures/                  # Sample audio & .sm/.ssc simfiles (ITL Online 2026)
├── output/
│   └── screenshots/               # Desktop and mobile visual test screenshots
└── PROJECT.md
```
