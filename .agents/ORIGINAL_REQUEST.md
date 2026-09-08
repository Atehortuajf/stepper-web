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
