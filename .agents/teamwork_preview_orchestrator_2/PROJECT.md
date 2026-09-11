# Project: Stepper-Web Stabilization & Tournament Validation

## Architecture
Full-stack, offline-first dance stepchart editor web application with ArrowVortex-grade editing capabilities, client-side Web Audio synchronization, in-browser ONNX Runtime WebAssembly inference, and biomechanical playability analysis.

### System Topology (Client-Side Standalone & Offline Architecture)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Browser Client (React 19 + Vite)                         │
├──────────────────────────────────────┬─────────────────────────────────────────────────┤
│    ArrowVortex Editor & Audio Engine │  In-Browser Inference & Biomechanical Solver    │
│  - Web Audio API (Hardware Clock)    │  - Web Worker (inference.worker.ts)             │
│  - Independent rAF Canvas (120 FPS)  │  - ONNX Runtime WASM SIMD (stepper_placement &  │
│  - Binary search visible note rows   │    stepper_decoder.onnx)                        │
│  - Pre-indexed hold/roll spans       │  - Bresenham Phase Mel-Spectrogram Extraction   │
│  - Lossless .sm / .ssc serializer    │  - Local HMM Viterbi Foot Parity Solver         │
│  - Mobile Touch Pad & Drawer         │  - Diff Overlay with Ghost Arrow Preview        │
└──────────────────────────────────────┴─────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | MSD Parser & Lexer | Full EBNF MSD grammar lexer handling parameter blocks, comments, escapes | M1 | Prior |
| F2 | Lossless .sm & .ssc Serializer | Support for legacy .sm and modern .ssc #NOTEDATA:; with split timing | M1 | Prior |
| F3 | 192-Tick Beat Grid & Subdivisions | Fixed-point 192 rows/measure grid supporting 4th to 192nd subdivisions | M1 | Prior |
| F4 | Canonical StepMania Subdivision Colors | Exact StepMania color hues (4th: Red, 8th: Blue, 12th: Purple, 16th: Yellow, etc.) | M1 | Prior |
| F5 | Note Types & Game Modes | Dance Singles (4-panel) & Doubles (8-panel); Taps, Holds, Rolls, Mines, Lifts, Fakes | M1 | Prior |
| F6 | Interactive Audio Waveform | Multi-level zoom (1x to 64x), playback rates, audio bookmarking | M1 | Prior |
| F7 | Piecewise Timing Engine | Precise mathematical conversion (t_audio <-> beat) with BPMs, stops, warps, delays | M1 | Prior |
| F8 | Stepper-Sync PyTorch Model Loading | Local PyTorch model loader for development environments | M2 | Prior |
| F9 | Instant Onboarding Fallback | Synthetic deterministic checkpoint and procedural generator | M2 | Prior |
| F10 | Audio Feature Extraction Pipeline | STFT, 128 Mel bands, spectral flux, Bresenham phase sampling | M2 | Prior |
| F11 | REST & WebSocket Inference Endpoints | Fast backend endpoints (/api/generate, /api/health, /api/solve-parity) | M2 | Prior |
| F12 | 16-D Technique Conditioning Sliders | Continuous sliders for z_tech vector (crossovers, footswitches, brackets, jacks, etc.) | M3 | Prior |
| F13 | Interactive Chart Generation & Diff Preview | One-click generation for selected measures or entire songs with live diff overlay | M3 | Prior |
| F14 | Viterbi Biomechanical Foot Parity Overlay | Real-time foot solver annotating foot parity (L, R, LR, bracket, heel-toe) | M3 | Prior |
| F15 | Professional DAW / ArrowVortex Desktop UI | Tool-first aesthetic modeled after Ableton Live and ArrowVortex | M4 | Prior |
| F16 | Desktop Keyboard-Driven Editing | Comprehensive ArrowVortex keyboard shortcuts | M4 | Prior |
| F17 | Mobile Responsive Touch Mode | Responsive layout for mobile viewports (375-430px) with directional touch pads | M4 | Prior |
| F18 | Full Mobile Editing Workflow | Complete end-to-end editing on mobile touch screens without hardware keyboard | M4 | Prior |
| F19 | E2E Test Suite (Tiers 1-4) | Comprehensive test suite covering feature tests and boundary cases | Final | Prior |
| F20 | Tier 5 Adversarial Hardening | White-box adversarial testing and Playwright screenshot audit | Final | Prior |
| F21 | Continuous Audio Playback & Web Audio Sync | Eliminate 2.03B-loop DFT freeze; direct rAF clock driver; eliminate React re-render cascade; persistent canvas backing store; O(1) hold indexing; output latency compensation | M5 | DONE |
| F22 | Network Remediation & Offline Operation | Default engineMode to 'wasm'; eliminate all localhost:8000 and ERR_CONNECTION_REFUSED network calls; bypass remote health and parity checks in offline mode; preserve mobile touch, diff overlay, responsive drawer | M6 | R2 Follow-up |
| F23 | In-Browser Web Worker Inference Pipeline | Offload feature extraction and dual-stage ONNX WASM inference to dedicated Web Worker; non-blocking chunked execution; 60/120fps UI preservation | M7 | R3 Follow-up |
| F24 | High-Resolution Tournament Visual Figures | Generate publication-grade comparison figures in output/figures/ and docs/figures/: rhythmic alignment, foot parity ribbons, technique distributions, and 2D pad trajectory | M8 | DONE |
| F25 | Written Qualitative Tournament Evaluation Report | Comprehensive evaluation report in docs/qualitative_evaluation_report.md assessing rhythmic fidelity, density collapse, biomechanical safety, and ITL tournament standard adherence | M8 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M5 | Audio Playback & Synchronization Engine | F21: AudioEngine optimization, direct rAF canvas clock driver, eliminate React re-render cascades, O(1) hold lookup, Web Audio latency compensation | Survey | DONE |
| M6 | Network Remediation & Offline Operation | F22: Set engineMode to 'wasm', eliminate all localhost fetch/WS calls, route parity to local solver, preserve mobile touch/diff/drawers | M5 | READY |
| M7 | In-Browser Web Worker Inference Pipeline | F23: Dedicated Web Worker for clientFeatureExtract + onnxruntime-web, transferable ArrayBuffers, chunked non-blocking inference | M6 | PLANNED |
| M8 | Qualitative Validation & High-Res Figures | F24, F25: Generate high-resolution visual comparison figures in output/figures/ and write comprehensive evaluation report against 16 ITL tournament charts | Survey | DONE |
| M9 | Final E2E Pass, Build & Forensic Audit | F19, F20: Run all Vitest unit tests, Playwright E2E tests, production build, and Forensic Integrity Audit | M5, M6, M7, M8 | PLANNED |

## Interface Contracts

### AudioEngine ↔ StepchartCanvas (Clock Driver)
- `AudioEngine.getCurrentTime(): number` returns high-precision audio playback seconds compensated for output latency.
- `StepchartCanvas` queries `AudioEngine` directly via internal `requestAnimationFrame` loop without triggering React component state updates.
- Throttled time updates (10 Hz) sent to `TransportBar` text displays.

### StepperApiClient ↔ LocalParitySolver & In-Browser Engine
- `stepperApi.setEngineMode('wasm')`:
  - `checkHealth()`: resolves immediately with `{ status: 'healthy', device: 'wasm-local', model_loaded: true }`.
  - `solveParity(req)`: directly calls `solveParityLocally(notes, holds, bpms, meter)` with zero network requests.
  - `generate(req)`: executes via Web Worker in-browser inference pipeline.

### Web Worker Inference Contract (`inference.worker.ts`)
- **Request Message**:
  ```typescript
  {
    type: 'GENERATE',
    waveform: Float32Array, // Transferable
    bpm: number,
    offset: number,
    startBeat: number,
    numBeats: number,
    difficulty: number,
    techVector: number[]
  }
  ```
- **Response Messages**:
  - `{ type: 'PROGRESS', pct: number, stage: 'features' | 'placement' | 'decoder' }`
  - `{ type: 'SUCCESS', placements: NotePlacement[], latencyMs: number }`
  - `{ type: 'ERROR', error: string }`
