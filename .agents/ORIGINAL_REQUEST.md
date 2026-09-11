# Original User Request

## Initial Request — 2026-09-08T06:44:00Z

Build a full-stack, mobile-compatible dance stepchart editor web application with ArrowVortex-grade editing capabilities, integrated Stepper AI inference conditioning, and biomechanical playability analysis.

Working directory: /Users/ate/Projects/stepper-web
Integrity mode: development

## Reference Resources
- Core Model & Architecture: /Users/ate/Projects/Stepper
- Pretrained Model Weights (Google Drive):
  - FP16 (16 MB, Recommended): File ID 1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3
  - FP32 (32 MB): File ID 1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2
  - Download command: gdown 1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3 -O backend/models/stepper_weights_fp16.pt
- Architecture Reference: stepper/model/stepper_sync.py and technique vector taxonomy in stepper/data/tech_tags.py.

---

## Requirements

### R1. ArrowVortex-Grade Stepchart Editor Engine
Implement a high-performance web-based rhythm game editor providing:
- High-resolution interactive audio waveform and spectrogram display with smooth scrubbing, multi-level zoom (1x to 64x), playback rates (0.25x to 2.0x), and audio bookmarking.
- Rhythmic beat grid supporting standard musical subdivisions (4th, 8th, 12th, 16th, 24th, 32nd, 48th, 64th, 96th, 192nd) with canonical StepMania color-coding.
- Note placement across Dance Singles (4 panels: Left, Down, Up, Right) and Doubles (8 panels), supporting taps, holds, rolls, mines, lifts, and fakes.
- Complete timing manipulation: variable BPM changes, stops, delays, warps, time signatures, and offset adjustment with real-time audio synchronization.
- Full .sm and .ssc file parsing, editing, and lossless round-trip serialization.

### R2. Stepper AI Inference Backend Service
A lightweight, fast Python/FastAPI service:
- Loads the trained Stepper-Sync model checkpoint (stepper_weights_fp16.pt or fp32) on CPU or CUDA GPU.
- Exposes REST and WebSocket endpoints accepting audio buffers/features, target difficulty level (1--25+ meter scale / Novice to Expert), and the 16-dimensional continuous technique conditioning vector z_tech.
- Returns predicted note placements, chord classifications, and confidence logits.
- Provides an automated setup/download script or fallback mock mode for instant developer onboarding without manual weight setup.

### R3. Interactive Stepper Conditioning & Biomechanical Validator UI
- Technique conditioning controls exposing continuous sliders for the 16-dimensional z_tech vector (footswitches, brackets, crossovers, jacks, sideswitches, stream density).
- Interactive chart generation: one-click generation for selected measures or entire songs with live preview and diff overlay before committing changes.
- Biomechanical validator overlay: visual foot parity tracks (Left foot, Right foot, Bracket, Heel-Toe), transition cost heatmaps, and physical unplayability warnings powered by the Viterbi solver.

### R4. Utilitarian, Non-"Vibe Code" Professional UI & Mobile Compatibility
- Interface styling must strictly adhere to a clean, focused, tool-first aesthetic modeled after professional digital audio workstations (Ableton Live, REAPER) and ArrowVortex — devoid of purple glow gradients, fluffy cards, or superfluous decorative animations.
- High-contrast, dense information hierarchy designed for rapid keyboard-driven desktop editing (numpad/arrow key mapping, shortcuts for note types and subdivisions).
- Touch-optimized responsive mode for mobile viewports (375px to 430px) with on-screen directional touch pads, scrub bars, and adaptive drawer controls.
- Visual screenshot capture and inspection must be integrated into the test workflow to verify and iterate on UI aesthetics.

---

## Acceptance Criteria

### Editor Core & Audio Fidelity
- [ ] Lossless round-trip test: parsing an existing .sm/.ssc file, serializing it, and re-parsing produces an identical data model and note stream.
- [ ] Visual beat cursor remains locked to the audio waveform during playback across songs with variable BPM changes and stops.
- [ ] All standard musical subdivisions (4th through 192nd) render with correct canonical StepMania color hues.

### AI Inference & Conditioning
- [ ] Backend endpoint /api/generate responds in < 1.5s for a 16-beat chunk and < 5s for a full chart.
- [ ] Modulating z_tech sliders demonstrably alters generated step patterns (e.g., high footswitch ratio generates alternating steps on single tracks).
- [ ] Real-time foot solver annotates foot parity and flags anatomically invalid transitions.

### Visual Polish & Mobile Responsiveness
- [ ] Visual test captures screenshots on both desktop (1920x1080) and mobile (390x844) viewports confirming dense, utilitarian layout with zero overlapping elements or visual clipping.
- [ ] Full editing workflow (load audio, set BPM, place notes, run AI generation, export .ssc) functions cleanly on mobile touch screens without requiring a hardware keyboard.

---

## Verification Plan

### Programmatic Tests
- Backend API tests: pytest verifying model loading, inference endpoints, input validation, and latency benchmarks.
- File parser tests: Round-trip verification against ITL Online 2026 .sm and .ssc files.
- Timing engine tests: Conversion fidelity tests between audio seconds and beat subdivisions under complex tempo changes and stops.

### Automated End-to-End & Screenshot Verification
- Playwright / Headless browser tests:
  - Automates loading a song, editing notes, triggering AI generation, and exporting the chart.
  - Captures high-resolution screenshots of desktop and mobile views into output/screenshots/ for visual inspection and regression testing.

## Follow-up — 2026-09-11T05:34:00Z

Stabilize the `stepper-web` application to eliminate playback freezing and erroneous localhost network requests while preserving the complete feature set (mobile touch controls, diff overlay, responsive drawer layout). Ensure smooth audio-visual synchronization, verify client-side ONNX WASM in-browser inference, and generate high-resolution qualitative figures validating the trained model's choreography and technique outputs against ITL tournament benchmarks.

Working directory: `/Users/ate/Projects/stepper-web`
Integrity mode: development

## Checkpoint & Training Artifacts (Google Drive)
Fetch training weights and telemetry from Google Drive as needed for inference, figure generation, and validation:
- **Clean FP16 Weights (16 MB)**: `https://drive.google.com/file/d/1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3/view` (ID: `1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3`)
  - Download helper: `python3 -c "import urllib.request; urllib.request.urlretrieve('https://drive.google.com/uc?export=download&id=1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3', 'checkpoints/stepper_weights_fp16.pt')"` or via `gdown`.
- **Clean FP32 Weights (32 MB)**: `https://drive.google.com/file/d/1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2/view` (ID: `1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2`)
- **Production Run Telemetry JSON (11 KB)**: `https://drive.google.com/file/d/1_bpMa8eeEVe2Jr6eUVUv-1VtCwI5ObKQ/view` (ID: `1_bpMa8eeEVe2Jr6eUVUv-1VtCwI5ObKQ`)
- **Ablation Matrix Report (4.7 KB)**: `https://drive.google.com/file/d/1WHpa93MrO5rO2xV8fjPCoaNTU_Tu1mFw/view` (ID: `1WHpa93MrO5rO2xV8fjPCoaNTU_Tu1mFw`)
- **Ablation Metrics JSON (2.3 KB)**: `https://drive.google.com/file/d/1jLG4AHTBDdcdqeBp3WJNz7Oi9EIuW3a4/view` (ID: `1jLG4AHTBDdcdqeBp3WJNz7Oi9EIuW3a4`)

## Requirements

### R1. Audio Playback & Synchronization Engine
Fix audio loading, decoding, and playback so that loading song audio and a `.ssc` / `.sm` file plays back smoothly from start to finish with zero thread-locking, freezing, or frame stutter. Playhead progress and 192-tick canvas scrolling must remain strictly locked to the Web Audio clock.

### R2. Network Remediation & Offline Operation
Audit and eliminate all hardcoded or errant `localhost` network calls across the client. The application must function reliably offline, using client-side Web Audio feature extraction and in-browser ONNX Runtime WebAssembly (`ort-wasm-simd-threaded.wasm`) without throwing unhandled network or console exceptions. Preserve all existing features (responsive drawers, mobile touch controls, diff overlays) while auditing code hygiene and component stability.

### R3. In-Browser Inference Pipeline Stabilization
Ensure that clicking "Generate Steps" or applying AI conditioning in the UI executes cleanly in-browser without freezing the UI thread (utilizing Web Workers or chunked asynchronous processing).

### R4. Qualitative Model Validation & Visual Figure Generation
Using the trained production model weights, perform qualitative evaluation on representative ITL tournament charts across low (Meter 7–9), mid (Meter 10–12), and high (Meter 13–15) difficulties. Generate high-resolution visual comparison figures showing rhythmic alignment, foot parity ribbon, and technique distribution (crossovers, jacks, brackets) to assess real-world human playability.

## Acceptance Criteria

### Playback & Thread Health
- [ ] Loading a song audio file and `.ssc` simfile plays continuously through the entire track without freezing, frame drops, or audio buffer under-runs.
- [ ] Browser console logs show zero unhandled exceptions and zero failed requests to `localhost` during song loading, playback scrubbing, and note editing.

### Feature Preservation & Test Pass Rate
- [ ] All existing features (mobile touch controls, dual-bank doubles pad, diff overlay, adaptive drawer) remain fully functional and pass the complete Vitest and Playwright test suites.
- [ ] Production build (`npm run build`) completes cleanly without TypeScript errors or warnings.

### In-Browser Inference
- [ ] In-browser ONNX WASM generation produces valid step placements and token assignments directly on the canvas without locking the user interface.

### Qualitative Validation Artifacts
- [ ] High-resolution visual figures generated and saved to `docs/figures/` (or `output/figures/`) displaying generated stepcharts across multiple difficulty meters with annotated foot parity and technique tags.
- [ ] Written qualitative evaluation report documenting whether the model's choreography matches human tournament standards or exhibits artifacts (density collapse, double-step traps, off-beat drift).

## Follow-up — 2026-09-11T19:08:52Z

Deploy the authentic 50-epoch Stepper neural model into `stepper-web`, fix the ONNX dynamic sequence RoPE export, implement client-side tempo estimation for audio-only uploads, and eliminate the unconstrained `Math.random()` fallback to achieve 100% human-playable choreography.

Working directory: `/Users/ate/Projects/stepper-web`
Integrity mode: development

## Checkpoint & Ground Truth Artifacts
- **Genuine Trained FP16 Checkpoint**: `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt` (Epoch 11, step 7188, converged from RTX 4090 workstation, 16.7MB)
- **Genuine Trained FP32 Checkpoint**: `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp32.pt` (33.4MB)
- **Reference Test Track ("Crazy Jackpot")**:
  - Audio: `/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ogg`
  - Simfile: `/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ssc` (170 BPM)

## Requirements

### R1. Fix RoPE Dynamic Sequence Dimension in PlacementNet & Export Genuine ONNX Models
- In `/Users/ate/Projects/Stepper/stepper/model/placement_net.py`, update `RoPE` so rotary frequency embeddings are computed dynamically based on the input sequence length rather than using a static 512-length cache that triggers ONNX broadcasting mismatch errors (`512 by 1536`) when generating sequences longer than 21 beats.
- Run `/Users/ate/Projects/Stepper/scripts/export_onnx_models.py` targeting `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt` to compile genuine `stepper_placement.onnx` and `stepper_decoder.onnx` into `/Users/ate/Projects/stepper-web/frontend/public/models/` and `/Users/ate/Projects/stepper-web/frontend/dist/models/`.
- Validate numerical parity between PyTorch and exported ONNX models across arbitrary sequence lengths (e.g. 16, 32, and 64 beats).

### R2. Client-Side Audio-Only Tempo Estimation & Grid Sync
- In `stepper-web/frontend/src/editor/audio/` and `App.tsx`, replace the hardcoded `140.0 BPM` fallback on audio-only upload with client-side onset autocorrelation tempo estimation.
- When an audio file (such as `Crazy Jackpot.ogg`) is uploaded alone without a simfile, automatically detect the dominant musical BPM (170 BPM) within $\pm 1.0\text{ BPM}$, update `timingEngine.initialBpm` and the transport display, and ensure the 48-tick Bresenham phase accumulator aligns with acoustic transients.

### R3. Remediation of Inference Pipeline & Removal of Silent Random Fallback
- In `stepper-web/frontend/src/App.tsx`, eliminate the silent `Math.random()` catch-block fallback that generates unplayable random arrow tracks upon inference errors.
- Ensure that `wasmInference.ts` and `inference.worker.ts` handle genuine model logits, calibrate peak picking (with user-adjustable or dynamic threshold), and return clear user-facing error indicators if inference fails rather than generating chaotic noise.
- Ensure the biomechanical FSM mask in `fsmMask.ts` functions correctly with genuine model logits to guarantee zero physical impossibility violations.

### R4. End-to-End Verification on "Crazy Jackpot" & Build Health
- Verify that uploading `Crazy Jackpot.ogg` + `Crazy Jackpot.ssc` (170 BPM, Meter 13) and generating steps produces a 100% playable chart verified by `stepper/validate/viterbi_solver.py` (and the client-side `localParitySolver.ts`).
- Verify that `npm run build` and existing test suites pass cleanly.

## Acceptance Criteria

### Model Parity & ONNX Export Health
- [ ] Exported ONNX models (`stepper_placement.onnx`, `stepper_decoder.onnx`) are generated from genuine converged weights (not synthetic dummy weights).
- [ ] ONNX inference executes cleanly without broadcast errors for sequences of 16, 32, 48, and 64 beats.
- [ ] PlacementNet produces realistic transient probabilities locking to acoustic beats with genuine confidence peaks ($>0.50$).

### Audio-Only Tempo Detection
- [ ] Uploading `Crazy Jackpot.ogg` alone detects 170 BPM (or within $\pm 1.0$ BPM) without defaulting to 140 BPM.
- [ ] Step generation on audio-only upload produces valid, on-beat notes.

### Playability & Kinematic Standards
- [ ] Steps generated on "Crazy Jackpot" achieve 100% tournament playability in the Viterbi solver with 0 unplayable transitions.
- [ ] Silent `Math.random()` fallback in `App.tsx` is eliminated.
- [ ] Full production build (`npm run build`) in `frontend/` completes with 0 errors.

