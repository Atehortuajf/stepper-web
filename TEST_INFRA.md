> **Historical record — superseded for current status.** Start with [MVP_HANDOFF.md](MVP_HANDOFF.md). Prior completion/quality claims below have not been revalidated and must not be used as acceptance evidence.

# Test Infrastructure Specification: Stepper-Web
**ArrowVortex-Grade Dance Stepchart Editor & AI Inference Platform**  
**Document Version:** 1.0.0  
**Author:** E2E Test Suite Writer (`teamwork_preview_test_writer_e2e_1`)  
**Status:** Authoritative Test Architecture & Specification  

---

## 1. Test Philosophy & Principles

### 1.1 Opaque-Box & Requirement-Driven Testing
All tests in this suite are derived strictly from authoritative specifications:
- `ORIGINAL_REQUEST.md`: User requirements R1 (Editor Engine), R2 (Stepper AI Backend), R3 (Conditioning & Biomechanics), and R4 (DAW Aesthetic & Mobile Compatibility).
- `PROJECT.md`: Architectural blueprints, interface contracts, and the 20-feature inventory (F1–F20).
- `teamwork_preview_spec_miner_stepchart_1/report.md`: Formal MSD grammar, StepMania 5.1 / ITGmania file formats (`.sm`, `.ssc`), 192-tick grid math, canonical subdivision color palettes, and ArrowVortex keyboard maps.
- `teamwork_preview_survey_stepper_1/report.md`: StepperSync PyTorch neural architecture, 16-D technique taxonomy ($z_{\text{tech}}$), Viterbi foot parity solver, and continuous Bresenham phase sampling.

Tests evaluate observable outputs, DOM state transitions, canvas rendering updates, network API payloads, and serialized simfile data models without coupling to transient internal component state.

### 1.2 The 4-Tier Test Architecture (+ Tier 5 Adversarial Visual Hardening)
The test suite implements a five-tier hierarchy:
1. **Tier 1 — Feature Coverage (Isolated Equivalence Partitioning):**  
   Every feature F1 through F20 is tested with $\ge 5$ distinct test cases exercising normal/representative inputs in isolation.
2. **Tier 2 — Boundary & Corner Cases (Stress & Boundary Value Analysis):**  
   Every feature F1 through F20 is subjected to $\ge 5$ stress, limit, and edge cases (extreme BPMs 20–1000, 0-duration warps, rapid consecutive stops, 192nd micro-subdivisions, negative offsets, corrupt/escaped tags, orphan hold tails, multi-touch collisions).
3. **Tier 3 — Cross-Feature Combinations (Pairwise Interaction Testing):**  
   $\ge 25$ test cases evaluating multi-module interactions (e.g., stops during sustained holds, warps during tempo transitions, AI generation into existing stepcharts, mobile touch on non-standard measure subdivisions).
4. **Tier 4 — Real-World Application Scenarios (End-to-End Workflows):**  
   $\ge 6$ comprehensive multi-step scenarios simulating realistic rhythm gaming workflows (including loading ITL Online 2026 competition charts, audio-synchronized playback, mobile-only chart creation, and lossless round-trip serialization).
5. **Tier 5 — Adversarial Visual Hardening & Screenshot Regression:**  
   Automated Playwright visual inspection capturing high-DPI screenshots across desktop (`1920x1080`) and mobile (`390x844`) viewports to verify zero layout overlapping, WCAG 2.5.5 touch target sizing ($\ge 48\times 48$ px), and DAW utilitarian aesthetics.

---

## 2. Feature Coverage Matrix (F1 through F20)

| Feature ID | Feature Name | Tier 1 (Isolated) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Real-World) |
|---|---|:---:|:---:|:---:|:---:|
| **F1** | MSD Parser & Lexer | 5 | 5 | 2 | 2 |
| **F2** | Lossless .sm & .ssc Serializer | 5 | 5 | 3 | 2 |
| **F3** | 192-Tick Beat Grid & Subdivisions | 5 | 5 | 2 | 2 |
| **F4** | Canonical StepMania Subdivision Colors | 5 | 5 | 2 | 2 |
| **F5** | Note Types & Game Modes (Singles/Doubles) | 5 | 5 | 3 | 2 |
| **F6** | Interactive Audio Waveform & Spectrogram | 5 | 5 | 2 | 2 |
| **F7** | Piecewise Timing Engine | 5 | 5 | 3 | 2 |
| **F8** | Stepper-Sync PyTorch Model Loading | 5 | 5 | 2 | 1 |
| **F9** | Instant Onboarding & Fallback Mode | 5 | 5 | 2 | 1 |
| **F10** | Audio Feature Extraction Pipeline | 5 | 5 | 2 | 1 |
| **F11** | REST & WebSocket Inference Endpoints | 5 | 5 | 2 | 2 |
| **F12** | 16-D Technique Conditioning Sliders | 5 | 5 | 2 | 2 |
| **F13** | Interactive Chart Generation & Diff Preview | 5 | 5 | 3 | 2 |
| **F14** | Viterbi Biomechanical Foot Parity Overlay | 5 | 5 | 3 | 2 |
| **F15** | Professional DAW / ArrowVortex Desktop UI | 5 | 5 | 2 | 2 |
| **F16** | Desktop Keyboard-Driven Editing | 5 | 5 | 2 | 2 |
| **F17** | Mobile Responsive Touch Mode | 5 | 5 | 2 | 2 |
| **F18** | Full Mobile Editing Workflow | 5 | 5 | 2 | 2 |
| **F19** | E2E Test Suite (Tiers 1-4) | 5 | 5 | 2 | 2 |
| **F20** | Tier 5 Adversarial Coverage Hardening | 5 | 5 | 2 | 2 |
| **TOTAL** | **20 Features** | **100 Cases** | **100 Cases** | **45 Pairings** | **35 Steps** |

---

## 3. Tier 1: Feature Coverage Specifications ($\ge 5$ per Feature, 100 Cases)

### F1. MSD Parser & Lexer
- **T1-F1-01:** Tokenize single-parameter tag (`#TITLE:Super Metronome;`). Verify key `#TITLE` and parameter `Super Metronome`.
- **T1-F1-02:** Tokenize multi-parameter tag with colons (`#NOTEDATA:;`, `#STEPSTYPE:dance-single;`, `#DIFFICULTY:Challenge;`).
- **T1-F1-03:** Strip single-line comments (`// This is a comment\n#ARTIST:Composer;`). Verify comment omitted and artist is `Composer`.
- **T1-F1-04:** Handle whitespace and newlines inside parameter bodies (`#NOTES:\n 1000\n 0100\n;`).
- **T1-F1-05:** Parse comma-delimited parameter lists (`#BPMS:0.000=140.000,32.000=175.000;`) into structured tuple pairs.

### F2. Lossless .sm & .ssc Serializer
- **T1-F2-01:** Serialize SongModel to legacy `.sm` format containing mandatory global tags (`#TITLE:`, `#ARTIST:`, `#MUSIC:`, `#OFFSET:`, `#BPMS:`, `#NOTES:`).
- **T1-F2-02:** Serialize modern `.ssc` format with leading `#VERSION:0.83;` and `#NOTEDATA:;` blocks.
- **T1-F2-03:** Apply measure line minimization (`get_smallest_note_type_for_measure`): 4 quarter notes emit exactly 4 lines per measure.
- **T1-F2-04:** Minimize measures containing 8th notes to 8 lines, 16th notes to 16 lines.
- **T1-F2-05:** Round-trip test: parse `tests/fixtures/basic_dance_single.ssc`, serialize to string, parse serialized string; assert data models are deeply equal.

### F3. 192-Tick Beat Grid & Subdivisions
- **T1-F3-01:** Map beat 0.000 to measure 0, tick 0 (absolute row 0).
- **T1-F3-02:** Map beat 1.000 to measure 0, tick 48 (absolute row 48, 4th note).
- **T1-F3-03:** Map beat 4.000 to measure 1, tick 0 (absolute row 192, start of measure 1).
- **T1-F3-04:** Calculate row coordinates for triplet subdivisions (12th note at tick 16, 24th note at tick 8, 48th note at tick 4).
- **T1-F3-05:** Calculate row coordinates for binary subdivisions (8th note at tick 24, 16th note at tick 12, 32nd note at tick 6, 64th note at tick 3, 192nd at tick 1).

### F4. Canonical StepMania Subdivision Colors
- **T1-F4-01:** 4th note quantization (tick 0) resolves to Red `#ff2a55`.
- **T1-F4-02:** 8th note quantization (tick 24) resolves to Blue `#00a2ff`.
- **T1-F4-03:** 12th note quantization (tick 16) resolves to Purple `#9e3cff`.
- **T1-F4-04:** 16th note quantization (tick 12) resolves to Yellow `#ffd000`.
- **T1-F4-05:** Higher subdivisions resolve to canonical colors: 24th (`#ff54be`), 32nd (`#ff7b00`), 48th (`#00e5ff`), 64th (`#00e676`), 96th (`#b0bec5`), 192nd (`#78909c`).

### F5. Note Types & Game Modes
- **T1-F5-01:** Place Tap Note (`'1'`) on column 0 (Left arrow) in `dance-single` mode. Verify note model update.
- **T1-F5-02:** Place Hold Note: head `'2'` at row 0, tail `'3'` at row 48 on column 1. Verify hold span validation.
- **T1-F5-03:** Place Roll Note: head `'4'` at row 0, tail `'3'` at row 96 on column 2. Verify roll type attributes.
- **T1-F5-04:** Place Mine Note (`'M'`), Lift Note (`'L'`), and Fake Note (`'F'`) on column 3. Verify distinctive rendering markers.
- **T1-F5-05:** Switch game mode from `dance-single` (4 columns) to `dance-double` (8 columns). Verify 8 independent tracks render across Player 1 and Player 2.

### F6. Interactive Audio Waveform & Spectrogram
- **T1-F6-01:** Decode test audio slice (`sample_click_track.wav`) into Web Audio `AudioBuffer`. Verify channel count and duration.
- **T1-F6-02:** Render audio waveform canvas with peak amplitudes scaled to track height.
- **T1-F6-03:** Zoom waveform canvas: verify scaling across 1x, 4x, 16x, and 64x without visual artifacts.
- **T1-F6-04:** Scrub timeline: dragging the scrub cursor updates active audio playback time and beat position synchronously.
- **T1-F6-05:** Adjust playback rate: verify audio engine supports 0.25x, 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, and 2.0x playback rates.

### F7. Piecewise Timing Engine
- **T1-F7-01:** Constant tempo conversion: at 120 BPM with 0 offset, beat 4.0 converts to exactly 2.000 seconds; 2.000 seconds converts to beat 4.0.
- **T1-F7-02:** Audio offset shift: with `#OFFSET:-0.500000`, beat 0 occurs at $t_{\text{audio}} = 0.500$ seconds.
- **T1-F7-03:** Tempo change: `#BPMS:0.000=120.000,4.000=240.000`. Beat 6.0 converts to $2.0 + (2 \times 60 / 240) = 2.500$ seconds.
- **T1-F7-04:** Stop pause: `#STOPS:4.000=1.000`. Beat 4.0 arrives at 2.0s; pause elapses from 2.0s to 3.0s; beat 5.0 arrives at 3.5s.
- **T1-F7-05:** Delay pause: `#DELAYS:4.000=0.500`. Pre-pause occurs before beat 4 note crossing; verify timeline inflection.

### F8. Stepper-Sync PyTorch Model Loading
- **T1-F8-01:** Query backend `/api/health` status; verify response indicates model loader initialized and reports host hardware (Apple Silicon MPS or CPU).
- **T1-F8-02:** Instantiate `StepperSync` neural model; assert parameter count matches reference (~8.34M parameters).
- **T1-F8-03:** Verify Stage 1 `PlacementNet` forward pass tensor shapes with audio tensor `(1, 2, 16, 48, 128)` and output `(1, 16, 48)`.
- **T1-F8-04:** Verify Stage 2 `StepSelectionDecoder` forward pass with chord vocabulary tokens in `[0, 95]`.
- **T1-F8-05:** Verify device fallback logic cleanly defaults to CPU if GPU/MPS is unavailable without throwing unhandled exceptions.

### F9. Instant Onboarding & Fallback Mode
- **T1-F9-01:** Execute backend service in mock/fallback mode without external weight files; verify service boots in $<2.0$ seconds.
- **T1-F9-02:** Verify deterministic synthetic weight initialization (`init_model_weights.py`) produces valid `stepper_weights_fp16.pt`.
- **T1-F9-03:** Request `/api/generate` in procedural fallback mode; verify non-empty, physically valid step placement response.
- **T1-F9-04:** Verify rule-based heuristic generator respects difficulty meter (higher difficulty yields higher step density).
- **T1-F9-05:** Verify mock generator respects technique conditioning (e.g. footswitch preference generates alternating single taps).

### F10. Audio Feature Extraction Pipeline
- **T1-F10-01:** Ingest 44.1 kHz mono audio buffer; compute 1024-point periodic Hann STFT.
- **T1-F10-02:** Apply 128 Slaney Mel filterbanks; verify Mel spectrogram channel shape.
- **T1-F10-03:** Compute positive half-wave rectified spectral flux; verify energy onset peaks at click track transients.
- **T1-F10-04:** Execute continuous Bresenham phase sampling at 48 ticks/beat; assert cumulative phase error $\le 0.012$ ms over 100 measures.
- **T1-F10-05:** Concatenate Mel and Flux channels into `(2, T_beats, 48, 128)` feature tensor with zero NaN/Inf values.

### F11. REST & WebSocket Inference Endpoints
- **T1-F11-01:** Send valid POST `/api/generate` request with 16-beat audio slice and default tech vector; assert HTTP 200 and latency $<1500$ ms.
- **T1-F11-02:** Verify `/api/generate` response schema contains `placements` array with `beat`, `arrows`, `chord_idx`, and `confidence`.
- **T1-F11-03:** Send POST `/api/solve-parity` with valid single-step sequence; assert HTTP 200 and valid foot annotations (`'L'`, `'R'`).
- **T1-F11-04:** Verify `/api/solve-parity` returns `is_playable: true` and non-negative `total_cost`.
- **T1-F11-05:** Connect to WebSocket generation endpoint; stream audio chunks and receive progressive placement events.

### F12. 16-D Technique Conditioning Sliders
- **T1-F12-01:** Open technique conditioning drawer in UI; verify presence of all 16 continuous sliders ($z_{\text{tech}}$).
- **T1-F12-02:** Modulate `crossover` slider from 0.0 to 1.0; verify slider state updates and reflects in generation request payload.
- **T1-F12-03:** Modulate `bracket` and `bracket_tap` sliders; verify payload vectors reflect non-zero values.
- **T1-F12-04:** Select pre-configured ITL technique preset (e.g. "Stamina Stream" or "Technical Brackets"); verify corresponding sliders reposition.
- **T1-F12-05:** Reset technique vector to default neutral state; verify all sliders revert to base positions.

### F13. Interactive Chart Generation & Diff Preview
- **T1-F13-01:** Select a 4-measure region in the editor; click "Generate Selection". Verify generation progress indicator displays.
- **T1-F13-02:** Receive generated steps; verify visual Diff Overlay displays proposed notes in contrasting color (e.g. cyan/gold).
- **T1-F13-03:** Click "Accept Diff / Commit"; verify proposed notes are merged into the active stepchart data model.
- **T1-F13-04:** Click "Reject Diff / Discard"; verify chart returns to original unmodified state.
- **T1-F13-05:** Trigger full-song generation; verify completion within $<5.0$ seconds and proper measure placement alignment.

### F14. Viterbi Biomechanical Foot Parity Overlay
- **T1-F14-01:** Place alternating 8th-note stream `[1000, 0100, 0010, 0001]`; verify parity solver tags steps as `L`, `D(R)`, `U(L)`, `R`.
- **T1-F14-02:** Verify foot parity ribbon displays canonical colors: Left Foot `#00b0ff` (Blue) and Right Foot `#ff3366` (Red).
- **T1-F14-03:** Place double jump `[1100]` (Left + Down); verify solver marks as Left foot bracket or two-foot stance.
- **T1-F14-04:** Place physical unplayability pattern (e.g. 4-arrow simultaneous quad `[1111]`); verify unplayability warning badge appears in UI.
- **T1-F14-05:** Inspect transition cost heatmap overlay; verify elevated cost values over high-frequency jacks or double steps.

### F15. Professional DAW / ArrowVortex Desktop UI
- **T1-F15-01:** Verify dark utilitarian color scheme (`#0C0D12` canvas background, `#1F2434` panels, high-contrast text).
- **T1-F15-02:** Assert absence of superfluous decorative animations, purple glow gradients, or oversized rounded cards.
- **T1-F15-03:** Verify Top HUD displays song title, artist, active BPM, elapsed audio time, and current beat/measure.
- **T1-F15-04:** Verify persistent status bar displays active subdivision snap, playback rate, and zoom level.
- **T1-F15-05:** Verify note grid receptors remain pinned at designated height while notes scroll smoothly.

### F16. Desktop Keyboard-Driven Editing
- **T1-F16-01:** Press `Space` key; verify audio playback toggles between Play and Pause.
- **T1-F16-02:** Press `Up Arrow` / `Down Arrow`; verify cursor moves forward / backward by active snap step.
- **T1-F16-03:** Press `Left Arrow` / `Right Arrow`; verify active quantization cycles finer / coarser (4th $\leftrightarrow$ 8th $\leftrightarrow$ 16th).
- **T1-F16-04:** Press number keys `1, 2, 3, 4`; verify tap notes placed on Left, Down, Up, Right columns at cursor row.
- **T1-F16-05:** Press `Delete` or `Backspace`; verify note under cursor is cleared. Press `Ctrl+Z` to undo and `Ctrl+Y` to redo.

### F17. Mobile Responsive Touch Mode
- **T1-F17-01:** Load editor under mobile viewport (`390x844`); verify layout adapts without horizontal scrollbar (`scrollWidth == clientWidth`).
- **T1-F17-02:** Verify on-screen 4-panel directional touch pad renders at screen bottom with minimum target size $\ge 48\times 48$ px.
- **T1-F17-03:** Tap on-screen Left arrow touch pad; verify tap note `'1'` placed at current cursor position.
- **T1-F17-04:** Tap on-screen note type selector (`TAP`, `HOLD`, `ROLL`, `MINE`, `LIFT`, `FAKE`, `DEL`); verify active tool updates.
- **T1-F17-05:** Swipe up on bottom handle to expose adaptive drawer containing AI conditioning sliders and timing tools.

### F18. Full Mobile Editing Workflow
- **T1-F18-01:** On mobile viewport, tap "Load Simfile" and select fixture; verify chart loads and renders in canvas stage.
- **T1-F18-02:** Scrub mobile waveform strip; verify beat position advances.
- **T1-F18-03:** Select `HOLD` tool; tap Down pad at beat 1.0, scroll to beat 2.0, tap Down pad; verify hold note created.
- **T1-F18-04:** Open mobile AI drawer, adjust `stream_stamina` slider, tap "Generate Measures 4-8", tap "Commit". Verify steps inserted.
- **T1-F18-05:** Tap mobile "Export .ssc" button; verify exported simfile downloads with valid `#VERSION:0.83;` and note data.

### F19. E2E Test Suite (Tiers 1-4)
- **T1-F19-01:** Run E2E test runner script (`tests/run_e2e_tests.sh`); assert exit code 0 and all test suites detected.
- **T1-F19-02:** Verify test runner reports individual pass counts for Tier 1, Tier 2, Tier 3, and Tier 4.
- **T1-F19-03:** Verify test assertions validate both DOM elements and canvas rendering output.
- **T1-F19-04:** Verify Playwright test suite executes under headless mode without requiring physical display hardware.
- **T1-F19-05:** Verify test runner cleanly shuts down background mock servers and browser contexts upon completion.

### F20. Tier 5 Adversarial Coverage Hardening
- **T1-F20-01:** Execute visual screenshot test for desktop (`1920x1080`); verify high-DPI screenshot saved to `output/screenshots/desktop_editor_overview.png`.
- **T1-F20-02:** Execute visual screenshot test for mobile (`390x844`); verify high-DPI screenshot saved to `output/screenshots/mobile_editor_touch_pad.png`.
- **T1-F20-03:** Assert screenshot file size $>10$ KB and image dimensions match configured viewport exactly.
- **T1-F20-04:** Programmatically verify zero overlapping bounding boxes between primary interactive buttons in mobile view.
- **T1-F20-05:** Assert high contrast ratio ($\ge 4.5:1$) between note arrow canvas glyphs and dark background `#0C0D12`.

---

## 4. Tier 2: Boundary & Corner Cases ($\ge 5$ per Feature, 100 Cases)

### F1. MSD Parser & Lexer Boundaries
- **T2-F1-01 (Unescaped `#` on Newline):** Line begins with unescaped `#` before preceding tag is closed with `;`. Verify lexer closes previous tag implicitly with warning and starts new tag.
- **T2-F1-02 (Escaped Delimiters):** Tag value contains escaped colons, semicolons, and octothorpes (`#TITLE:Song \: The \#1 \; Special;`). Verify parsed title string preserves escaped characters without premature termination.
- **T2-F1-03 (Empty Parameter Body):** Tag with zero-length parameter (`#SUBTITLE:;` or `#CDTITLE:;`). Verify parsed parameter is empty string `""` without crashing.
- **T2-F1-04 (Extreme Parameter Length):** Measure data parameter exceeding 100,000 characters. Verify lexer parses entire buffer without stack overflow.
- **T2-F1-05 (Malformed UTF-8 / BOM):** Simfile with UTF-8 Byte Order Mark (`0xEF, 0xBB, 0xBF`) at byte 0. Verify BOM stripped cleanly.

### F2. Lossless .sm & .ssc Serializer Boundaries
- **T2-F2-01 (Empty Measure):** Measure containing zero notes across all rows. Minimizer must output exactly 4 lines of `0000` ($N = 4$).
- **T2-F2-02 (Micro-Tick Non-Standard Row):** Measure containing a single note at row 5 (non-standard 192nd micro-tick). Minimizer must emit full 192 lines to preserve placement without quantization loss.
- **T2-F2-03 (Single-Measure Chart):** Chart containing exactly 1 measure of notes terminated by `;`. Verify serializer outputs valid format without trailing comma.
- **T2-F2-04 (100+ Measure Simfile):** Chart containing 150 measures with varied subdivisions (4th, 8th, 16th, 24th, 32nd, 48th, 64th). Verify line count matches minimal necessary resolution per measure.
- **T2-F2-05 (Split Timing Serialization):** Chart with custom `#BPMS:`, `#STOPS:`, and `#OFFSET:` distinct from song header. Verify per-chart timing serialized inside `#NOTEDATA:;` block.

### F3. 192-Tick Beat Grid Boundaries
- **T3-F3-01 (Boundary Row 0):** Beat $0.0$ translates to absolute row $0$, tick $0$.
- **T3-F3-02 (Boundary Row 191):** Beat $3.979167$ translates to measure 0, tick 191 (last tick before next measure).
- **T3-F3-03 (Negative Beat Navigation):** Beat $-1.000$ (pre-song run-in) translates to absolute row $-48$.
- **T3-F3-04 (High Beat Value):** Beat $1000.000$ translates to measure 250, row 48000 without integer overflow.
- **T3-F3-05 (Consecutive 192nd Notes):** Notes placed on rows $0, 1, 2, 3$ (192nd stream). Verify grid collision logic maintains distinct note instances.

### F4. Canonical Subdivision Colors Boundaries
- **T2-F4-01 (Floating-Point Beat Imprecision):** Beat `1.0000000001` (micro-float noise). Quantizer rounds to tick 48, assigning canonical 4th Red `#ff2a55`.
- **T2-F4-02 (Extreme Subdivisions 96th & 192nd):** Beat $0.041667$ (tick 2) resolves to 96th `#b0bec5`; beat $0.020833$ (tick 1) resolves to 192nd `#78909c`.
- **T2-F4-03 (Off-Grid Arbitrary Beat):** Arbitrary irrational beat (e.g. $\pi / 4$). Quantizer snaps to nearest tick and colors accordingly without undefined color values.
- **T2-F4-04 (Measure Boundary Tick 0):** Tick 0 of measure 12 resolves to Red `#ff2a55`.
- **T2-F4-05 (Negative Beat Quantization):** Beat $-0.5$ (tick 24 of pre-measure) correctly resolves to Blue `#00a2ff`.

### F5. Note Types & Game Modes Boundaries
- **T2-F5-01 (Orphan Hold Tail):** Chart note stream contains `'3'` without preceding `'2'` or `'4'`. Parser must safely discard orphan tail without throwing error.
- **T2-F5-02 (Unclosed Hold Head at End of Chart):** Hold head `'2'` at final row without closing `'3'`. Parser clamps hold tail to last row + 48 ticks.
- **T2-F5-03 (0-Length Hold):** Head `'2'` and tail `'3'` on same row. Parser converts into single tap note `'1'`.
- **T2-F5-04 (Intermediate Tap During Hold):** Note stream contains `'1'` on column 0 while hold on column 0 is active. Parser rejects or resolves collision.
- **T2-F5-05 (Doubles 8-Panel Simultaneous Step):** Chord across columns 0, 3, 4, 7 (quad jump across P1 and P2). Verify 8-character string formatted correctly (`10011001`).

### F6. Waveform & Spectrogram Boundaries
- **T2-F6-01 (Zero-Duration Audio):** Load empty audio buffer (0 samples). Verify waveform displays empty placeholder without crashing.
- **T2-F6-02 (Maximum Zoom 64x):** Zoom to 64x; verify sample-level rendering without browser canvas context crash.
- **T2-F6-03 (Minimum Zoom 1x):** Zoom out to 1x; verify entire 5-minute song waveform fits within canvas viewport.
- **T2-F6-04 (Rapid Scrubbing Stress):** Send 50 rapid scrub position updates in 100 ms; verify UI remains responsive and audio cursor updates smoothly.
- **T2-F6-05 (Extreme Playback Rates):** Toggle between 0.25x (ultra-slow) and 2.0x (double speed); verify Web Audio node pitch/playback adjustment.

### F7. Piecewise Timing Engine Boundaries
- **T2-F7-01 (Extreme BPM Minimum):** Set `#BPMS:0.000=20.000;`. Verify beat-to-seconds conversion remains stable ($3.0$ seconds per beat).
- **T2-F7-02 (Extreme BPM Maximum):** Set `#BPMS:0.000=1000.000;`. Verify beat-to-seconds conversion remains stable ($0.06$ seconds per beat).
- **T2-F7-03 (Zero-Duration Stop / Warp):** Stop with duration 0.0 seconds (`#STOPS:4.000=0.000;`). Verify timeline has 0-length plateau.
- **T2-F7-04 (Negative Offset Extremes):** `#OFFSET:-5.000000;` (beat 0 occurs 5 seconds into audio) and `#OFFSET:2.000000;` (beat 0 occurs before audio starts).
- **T2-F7-05 (Negative Stop Normalization):** `#STOPS:4.000=-1.000;`. Normalizer converts negative stop into a warp of length $1.0 \times \text{BPM} / 60.0$ beats.

### F8. Stepper-Sync Model Loading Boundaries
- **T2-F8-01 (Missing Checkpoint Fallback):** Request model load when checkpoint path does not exist; verify seamless fallback to procedural/synthetic mode.
- **T2-F8-02 (Corrupt Checkpoint File):** Checkpoint file contains random non-PyTorch bytes; verify loader catches error, logs diagnostic, and activates fallback mode.
- **T2-F8-03 (Zero-Length Batch):** Forward pass with batch size 0; verify graceful empty tensor return.
- **T2-F8-04 (Extreme Audio Length):** Ingest 128-beat audio slice; verify memory management does not exceed host allocation.
- **T2-F8-05 (Out-of-Range Difficulty):** Pass difficulty index `99` (exceeding standard range); verify clamping to maximum index (5).

### F9. Instant Onboarding & Fallback Boundaries
- **T2-F9-01 (Offline Execution):** Disconnect network access; verify fallback generator functions with zero external HTTP dependencies.
- **T2-F9-02 (Rapid Seed Alternation):** Call synthetic generator with seeds 0 through 10; verify distinct but deterministic step outputs.
- **T2-F9-03 (Zero Technique Conditioning):** Pass all-zero technique vector `[0.0, ..., 0.0]`; verify fallback mode produces balanced baseline chart.
- **T2-F9-04 (Maximal Technique Conditioning):** Pass all-one technique vector `[1.0, ..., 1.0]`; verify generator handles conflicting constraints without crashing.
- **T2-F9-05 (Sub-Millisecond Response Benchmark):** In mock mode, assert generation latency $<50$ ms for unit test execution.

### F10. Audio Feature Extraction Boundaries
- **T2-F10-01 (DC-Only / Pure Silence Audio):** Audio buffer contains all zeros; verify Mel spectrogram and flux contain finite values (no NaN or -Inf).
- **T2-F10-02 (Full-Scale Square Wave / Clipping):** Audio buffer clipped at $\pm 1.0$; verify STFT handles spectral spillover gracefully.
- **T2-F10-03 (Non-Standard Sample Rate):** Audio file at 22,050 Hz or 48,000 Hz; verify resampling to canonical 44,100 Hz before feature extraction.
- **T2-F10-04 (Ultra-Short Audio Slice):** Audio buffer shorter than 1024-sample FFT window; verify zero-padding to minimum window length.
- **T2-F10-05 (Infinite Duration Drift Check):** Extract features across 300 measures; assert clock drift between Bresenham ticks and sample indices remains strictly 0 samples.

### F11. REST & WebSocket Endpoints Boundaries
- **T2-F11-01 (Malformed JSON Payload):** Send malformed JSON to `/api/generate`; assert HTTP 422 Unprocessable Entity with diagnostic validation error.
- **T2-F11-02 (Empty Audio Slice):** Send empty string for audio slice; assert HTTP 400 Bad Request.
- **T2-F11-03 (Concurrent Requests):** Fire 10 simultaneous POST `/api/generate` requests; verify all return HTTP 200 without deadlock.
- **T2-F11-04 (WebSocket Unexpected Disconnect):** Disconnect client mid-generation; verify server cleans up resources without zombie threads.
- **T2-F11-05 (Huge Step Sequence Parity Request):** Send 5,000 steps to `/api/solve-parity`; verify solver finishes within $<2.0$ seconds.

### F12. 16-D Technique Sliders Boundaries
- **T2-F12-01 (Slider Value Clamping):** Send values $<0.0$ or $>1.0$; verify UI and backend clamp values to $[0.0, 1.0]$.
- **T2-F12-02 (All Sliders at Maximum):** Set all 16 sliders to 1.0; verify UI displays dense technique indicator.
- **T2-F12-03 (All Sliders at Minimum):** Set all 16 sliders to 0.0; verify neutral chart mode.
- **T2-F12-04 (Single Technique Isolation):** Set `footswitch = 1.0`, all others 0.0; verify resulting pattern contains high footswitch ratio.
- **T2-F12-05 (Rapid Slider Dragging):** Rapidly drag slider back and forth 50 times; verify debounced updates prevent UI freezing.

### F13. Chart Generation & Diff Preview Boundaries
- **T2-F13-01 (Generation into Blank Measures):** Generate steps into empty measure span; verify preview renders clean insertions.
- **T2-F13-02 (Generation Replacing Existing Holds):** Generate steps over region with active hold notes; verify diff clearly highlights replaced holds.
- **T2-F13-03 (Zero-Beat Selection):** Click generate with start_beat == end_beat; verify UI shows informative warning and does not call API.
- **T2-F13-04 (Diff Overlay Rejection):** Generate 16 measures, reject diff; verify exact hash match of chart data before and after.
- **T2-F13-05 (Partial Commit):** Select subset of generated measures to commit; verify unselected measures remain unchanged.

### F14. Viterbi Foot Parity Boundaries
- **T2-F14-01 (Physical Quad Step / 4 Panels):** Note `1111` (all 4 panels). Solver marks unplayable and assigns maximum penalty cost.
- **T2-F14-02 (Consecutive High-Speed Jacks):** Same arrow pressed 8 times in 16th notes. Solver flags high jack cost and warns of physical fatigue.
- **T2-F14-03 (Opposite Bracket / Left+Right on Same Foot):** Solver forbids single foot hitting Left and Right simultaneously.
- **T2-F14-04 (Double Hold Cross):** Two sustained holds while third tap is required; solver verifies third tap uses free foot or flags unplayable.
- **T2-F14-05 (Candle Pattern Foot Alternation):** Left -> Up -> Right -> Up stream. Solver computes optimal L-R-L-R sequence minimizing torso rotation.

### F15. Desktop UI Boundaries
- **T2-F15-01 (Ultra-Wide Viewport 3840x2160 4K):** Verify canvas scales cleanly without blurring or misaligned receptor positions.
- **T2-F15-02 (Narrow Desktop Window 1024x768):** Verify DAW layout compresses sidebars gracefully without clipping receptors.
- **T2-F15-03 (Zero Audio Loaded State):** Open editor without audio file; verify grid allows note placement with manual tempo.
- **T2-F15-04 (Theme Integrity Check):** Inspect computed CSS; assert 0 instances of `#8b5cf6` (purple glow) or decorative box-shadows.
- **T2-F15-05 (Receptor Pinning Stability):** Scroll timeline from beat 0 to beat 500; verify receptor Y-position remains strictly constant.

### F16. Desktop Keyboard Boundaries
- **T2-F16-01 (Simultaneous Keypress / Jump):** Press `1` and `4` keys simultaneously; verify jump chord placed on Left and Right columns at current row.
- **T2-F16-02 (Rapid Arrow Key Navigation):** Hold down `Up Arrow` for 2 seconds; verify smooth cursor scrolling without UI freezing.
- **T2-F16-03 (Shortcut Key in Text Input):** Focus song title input field; type numbers `1, 2, 3`; verify text is entered into field without placing notes on chart.
- **T2-F16-04 (Undo Stack Depth 50+):** Perform 50 note edits; press `Ctrl+Z` 50 times; verify chart reverts to initial empty state.
- **T2-F16-05 (Numpad vs Number Row Parity):** Verify Numpad `1, 2, 3, 4` and Number Row `1, 2, 3, 4` execute identical note placement actions.

### F17. Mobile Touch Mode Boundaries
- **T2-F17-01 (Compact Viewport 375px / iPhone SE):** Verify all 4 directional touch pads maintain width $\ge 78$ px and height $\ge 64$ px without text wrapping.
- **T2-F17-02 (Large Mobile Viewport 430px / iPhone Pro Max):** Verify touch pads expand proportionately without excess margin gaps.
- **T2-F17-03 (Simultaneous Dual-Touch / Mobile Jump):** Touch Left and Right pads simultaneously on touch screen; verify both tap notes inserted at current beat.
- **T2-F17-04 (Drawer Drag Cancellation):** Drag drawer partially up and release; verify smooth spring-back animation to nearest detent.
- **T2-F17-05 (Zero Horizontal Scroll Invariant):** Measure `document.documentElement.scrollWidth` under mobile viewport; assert strictly equal to `window.innerWidth`.

### F18. Full Mobile Workflow Boundaries
- **T2-F18-01 (Complete Mobile Chart Creation from Blank):** Create new chart, place 16 measures of notes, run AI generation, export `.ssc` solely via touch events.
- **T2-F18-02 (Mobile Note Deletion):** Select `DEL` tool; tap pad on note row; verify note removed.
- **T2-F18-03 (Mobile Quantization Switching):** Tap mobile snap button; cycle from 1/4 to 1/8 to 1/16 to 1/32; verify grid snap updates.
- **T2-F18-04 (Mobile Audio Scrub and Place):** Scrub audio to 15.2s, pause, tap Up arrow; verify note placed at exact calculated beat.
- **T2-F18-05 (Mobile File Export Verification):** Tap export; verify generated blob matches valid `.ssc` syntax with zero NaN fields.

### F19. E2E Test Suite Boundaries
- **T2-F19-01 (Zero-Timeout Execution):** Run test suite with fast network and instant fallback; assert entire suite executes in $<60$ seconds.
- **T2-F19-02 (Headless vs Headed Parity):** Execute tests in both headless and headed modes; verify identical pass results.
- **T2-F19-03 (Port Conflict Handling):** Launch test runner when default port is occupied; verify runner handles port allocation or reports clean error.
- **T2-F19-04 (Parallel Test Isolation):** Execute tests across 2 parallel workers; verify no cross-test fixture pollution.
- **T2-F19-05 (Clean Teardown on SIGINT):** Send interrupt signal during test execution; verify background servers terminate without leaving orphaned processes.

### F20. Adversarial Coverage Hardening Boundaries
- **T2-F20-01 (DOM Element Collision Detection):** Adversarial script checks every interactive element pair in mobile view; assert 0 overlapping bounding client rects.
- **T2-F20-02 (Touch Target Size Verification):** Iterate over all clickable/tappable elements; assert $\min(\text{width}, \text{height}) \ge 48$ px.
- **T2-F20-03 (Screenshot File Non-Zero Size):** Assert every captured screenshot file in `output/screenshots/` has size $\ge 20$ KB.
- **T2-F20-04 (Canvas High-DPI Rendering):** Assert canvas internal resolution matches device pixel ratio ($2\times$ on Retina / modern mobile).
- **T2-F20-05 (Contrast Ratio Strict Enforcement):** Sample pixel RGB values on receptors and notes against background; assert contrast ratio $\ge 7:1$.

---

## 5. Tier 3: Cross-Feature Combinations ($\ge 25$ Pairwise Tests)

| Case ID | Feature Pair | Interaction Scenario | Expected Outcome |
|---|---|---|---|
| **T3-01** | F5 × F7 | Sustained Hold note crosses an active Stop event (`#STOPS:4.000=1.000;`). | Hold body continues rendering across the stop; audio pauses while hold remains active on receptor. |
| **T3-02** | F7 × F7 | Warp event occurs simultaneously with a BPM change (`#BPMS:16.000=300.000`, `#WARPS:16.000=4.000`). | Warp skips 4 beats in 0s; new tempo of 300 BPM takes effect immediately upon warp conclusion. |
| **T3-03** | F5 × F14 | Mine Note placed immediately after a Hold tail on same column. | Foot solver validates foot release from hold before mine crossing; 0 unplayability penalty. |
| **T3-04** | F12 × F13 | AI generation triggered with high `crossover` slider into pre-existing straight stream. | Generated notes transition smoothly into crossover patterns; diff preview highlights crossover placements. |
| **T3-05** | F2 × F5 | Export `dance-double` chart to legacy `.sm` format. | Serializer creates 8-panel `#NOTES:` block with 6 parameters and comma-separated measures. |
| **T3-06** | F3 × F4 | Notes placed on 12th, 16th, and 24th subdivisions in the same measure. | Canvas renders distinct canonical hues: Purple (`#9e3cff`), Yellow (`#ffd000`), Pink (`#ff54be`). |
| **T3-07** | F6 × F7 | Audio scrubbing through variable tempo section with stops. | Audio scrub position updates beat cursor accurately; cursor freezes during stop plateau. |
| **T3-08** | F11 × F14 | Call `/api/generate` then pipe placements directly to `/api/solve-parity`. | Pipeline completes in $<1.5$s; steps returned are confirmed physically playable with foot tags. |
| **T3-09** | F16 × F17 | Switch between desktop keyboard editing and mobile touch mode dynamically. | State persists across layout switches; notes placed via keyboard are visible and editable via touch pads. |
| **T3-09b**| F1 × F2 | Parse `.ssc` with malformed tag comments, minimize measures, and serialize to `.ssc`. | Lossless recovery: comments preserved/stripped cleanly, measures minimized, valid `.ssc` output. |
| **T3-10** | F5 × F16 | Create Roll note using desktop backtick shortcut (`` ` ``) on active Hold note. | Hold head `'2'` converts to roll head `'4'`; canvas updates to striped pulsing body. |
| **T3-11** | F7 × F10 | Audio feature extraction on audio file with negative `#OFFSET`. | Feature extractor shifts start frame by exact offset; beats align with audio transients. |
| **T3-12** | F13 × F16 | Generate AI diff, then use keyboard shortcuts (`Ctrl+Z`, `Space`, `Enter`) during preview. | Space previews audio with proposed notes; Enter commits diff; Ctrl+Z undos committed diff. |
| **T3-13** | F5 × F18 | Edit 8-panel Doubles chart on mobile viewport using Dual-Bank pad switcher. | User switches between P1 and P2 banks via 1-tap toggle; places notes on columns 0-7 without layout reflow. |
| **T3-14** | F6 × F16 | Zoom waveform to 32x while adjusting playback rate to 0.5x during active playback. | Audio plays at half speed while waveform scrolls smoothly at high zoom; beat cursor locked to beat 0. |
| **T3-15** | F7 × F14 | Foot parity solver evaluates step stream containing rapid stops and delays. | Solver computes step intervals based on true physical elapsed time rather than raw beat numbers. |
| **T3-16** | F2 × F7 | Simfile with per-chart split timing (`#BPMS:`, `#STOPS:` in `#NOTEDATA:;`). | Serializer writes split timing inside chart block; global timing in song header remains intact. |
| **T3-17** | F3 × F18 | Mobile snap selector set to 1/24 (triplet); touch pad inserts notes on 24th grid rows. | Minimizer outputs 24 lines for the measure; canvas displays Pink notes (`#ff54be`). |
| **T3-18** | F8 × F11 | Launch backend with synthetic weights; call `/api/generate` with Expert difficulty (meter 16). | Backend emits dense 16th stream with placement confidence $>0.80$ in $<1200$ ms. |
| **T3-19** | F4 × F15 | High contrast theme check on all 10 subdivision colors against `#0C0D12` background. | Every canonical color achieves WCAG contrast ratio $>4.5:1$. |
| **T3-20** | F5 × F13 | AI generation with `bracket` slider $>0.8$ into Singles mode. | Generator places bracket-compatible simultaneous steps (e.g. Up+Left) with high probability. |
| **T3-21** | F6 × F18 | Mobile waveform drag combined with directional touch pad tapping. | Scrub to beat 8.0, tap Down arrow, scrub to beat 12.0, tap Up arrow; notes placed at respective beats. |
| **T3-22** | F7 × F11 | Generate AI steps for a measure located immediately after a 2-second stop. | Generator correctly synchronizes audio feature slice with timing engine timestamps. |
| **T3-23** | F14 × F16 | Place notes using keyboard shortcuts while observing biomechanical parity ribbon. | Ribbon updates in real time ($<16$ ms) on every keypress without noticeable UI latency. |
| **T3-24** | F2 × F18 | Full mobile workflow: edit chart, open drawer, tap "Export .ssc", re-import exported file. | Re-imported chart data model matches in-memory chart model with 0 missing notes. |
| **T3-25** | F1 × F14 | Load ITL Online 2026 fixture with technical gimmicks; run Viterbi parity analysis. | Solver generates complete foot sequence, flags technical footswitches/brackets, 0 crashes. |

---

## 6. Tier 4: Real-World Application Scenarios (Realistic Workloads)

### Scenario 1: ITL Online 2026 Speed Stream Chart End-to-End Workflow
- **Fixture:** `tests/fixtures/itl_2026_speed_stream.ssc` (180 BPM, 16th stream, crossovers, footswitches, jacks).
- **Workflow:**
  1. User opens editor and loads `itl_2026_speed_stream.ssc` along with `sample_click_track.wav`.
  2. Inspects global song metadata (`#TITLE:ITL 2026 Speed Stream`, `#ARTIST:Technique Master`, `#BPMS:0.000=180.000`).
  3. Verifies canvas renders 16th-note stream with Yellow arrows (`#ffd000`).
  4. Activates Biomechanical Parity Overlay: verifies Viterbi solver tags continuous alternating foot stream (`L, R, L, R`), identifies footswitches, and flags 0 unplayable transitions.
  5. Navigates to measure 8; edits steps using keyboard shortcuts (converts tap into hold note, adds mine on off-beat).
  6. Exports modified chart to `.ssc`; asserts exported file contains updated hold and mine notes while preserving all other metadata.

### Scenario 2: ITL Online 2026 Gimmick Chaos Chart (Warp/Stop/Delay/Subdivision) Workflow
- **Fixture:** `tests/fixtures/itl_2026_gimmick_chaos.ssc` (variable BPMs 140–280, stops, delays, 0-duration warps, 24th/32nd/192nd subdivisions, fake notes, lift notes).
- **Workflow:**
  1. User loads `itl_2026_gimmick_chaos.ssc`.
  2. Verifies Piecewise Timing Engine compiles timing events in correct precedence (Warp conclusion $\to$ BPM change $\to$ Delay $\to$ Marker $\to$ Stop $\to$ Warp start).
  3. Starts audio playback; verifies visual beat cursor stays strictly locked to audio waveform across the 1.0-second stop at beat 16.0 and the 4-beat warp at beat 32.0.
  4. Verifies Fake notes (`'F'`) render as semi-transparent decoys and Lift notes (`'L'`) render as inverted hollow arrows.
  5. Calibrates audio offset by $-20$ ms using timing wizard; verifies timing engine shifts timestamps accordingly.
  6. Lossless round-trip test: serializes chart, re-parses, and asserts timing data arrays match to within $10^{-6}$ precision.

### Scenario 3: Complete Mobile Touch Editing & AI Conditioning Workflow (390x844)
- **Viewport:** `390x844` (iPhone 14/15/16).
- **Workflow:**
  1. User loads Stepper-Web on mobile device.
  2. Creates new Dance Single chart at 140 BPM with 4 measures of audio.
  3. Uses on-screen directional touch pads (`Left`, `Down`, `Up`, `Right`) to input a basic 4th-note rhythm in measures 0–1.
  4. Swipes up adaptive drawer; accesses Stepper AI Conditioning panel.
  5. Selects "Stamina Stream" preset; adjusts `crossover = 0.6` and `stream_stamina = 0.8`.
  6. Taps "Generate Measures 2-4"; inspects live Diff Preview overlay.
  7. Taps "Accept Diff"; verifies generated stream inserted with canonical 16th-note yellow coloring.
  8. Taps mobile "Export Simfile"; verifies `.ssc` downloads cleanly. Zero keyboard interaction required.

### Scenario 4: ArrowVortex Desktop Keyboard-Driven Editing & Metronome Playback (1920x1080)
- **Viewport:** `1920x1080` (Standard Full HD Desktop).
- **Workflow:**
  1. User opens editor in desktop mode; loads audio track.
  2. Uses Arrow keys and Space bar to navigate and audition beats.
  3. Uses `Left / Right Arrow` keys to cycle quantization snap (4th $\to$ 8th $\to$ 16th $\to$ 24th $\to$ 32nd).
  4. Enters note patterns using number keys `1, 2, 3, 4`.
  5. Tests selection workflow: presses `Tab` to set start anchor, scrolls 2 measures, presses `Tab` to set end anchor.
  6. Presses `Ctrl+C` to copy, moves cursor forward 2 measures, presses `Ctrl+V` to paste.
  7. Presses `M` to horizontally mirror pasted pattern (Left $\leftrightarrow$ Right, Down $\leftrightarrow$ Up).
  8. Toggles Metronome assist tick (`F4`); plays through pattern verifying audible synchronization.

### Scenario 5: Singles to Doubles 8-Panel Transposition & Biomechanical Validation
- **Workflow:**
  1. User loads existing 4-panel `dance-single` chart.
  2. Uses chart manager to add a new `dance-double` (8-panel) chart to the simfile.
  3. Pastes singles note pattern into Player 1 pad (columns 0–3).
  4. Navigates to measure 4; switches to dual-pad mode and enters notes across Player 2 pad (columns 4–7).
  5. Runs Biomechanical Foot Solver on 8-panel chart; verifies solver tracks weight transfers across the center boundary (P1 Right to P2 Left).
  6. Verifies solver flags excessive spread (e.g. P1 Left and P2 Right simultaneous step requiring $1.8$ meter leg span).
  7. Exports `.ssc` simfile containing both `dance-single` and `dance-double` charts.

### Scenario 6: Lossless Round-Trip Serialization & Audio Synchronization Stress Workflow
- **Workflow:**
  1. Automated runner ingests all sample fixtures in `tests/fixtures/` (`.sm` and `.ssc`).
  2. For each fixture:
     a. Parses file into `Simfile` AST.
     b. Converts all notes to absolute tick rows.
     c. Computes audio timestamps for every note via `TimingEngine.beatToSeconds`.
     d. Serializes `Simfile` AST back to string format using measure line minimization.
     e. Parses serialized string into second AST.
     f. Asserts: `AST_1.charts.length == AST_2.charts.length`, note row counts match exactly, metadata matches, and recomputed timestamps are identical ($|\Delta t| < 10^{-6}$ s).

---

## 7. Tier 5: Adversarial Coverage Hardening & Screenshot Catalog

### 7.1 Screenshot Capture Targets (`output/screenshots/`)

| Screenshot Filename | Viewport | Target State / Component | Assertions |
|---|---|---|---|
| `desktop_editor_overview.png` | 1920x1080 | Full desktop DAW interface with grid, receptors, HUD, and waveform | High-contrast utilitarian theme, 0 decorative glow, receptors pinned. |
| `desktop_waveform_zoom.png` | 1920x1080 | High-zoom (32x) waveform display with spectrogram strip | Zero clipping, clear amplitude peaks, audio scrub cursor visible. |
| `desktop_ai_conditioning_drawer.png` | 1920x1080 | Stepper AI Conditioning panel open with 16 continuous sliders | All 16 sliders rendered, preset chips visible, parameter labels clear. |
| `desktop_biomechanical_parity.png` | 1920x1080 | Canvas beat grid showing foot parity ribbon and heatmap overlay | Left foot `#00b0ff` and Right foot `#ff3366` clearly visible. |
| `desktop_diff_preview.png` | 1920x1080 | Measure diff preview showing proposed AI steps overlaid on chart | Contrasting color overlay for proposed steps, Accept/Reject buttons. |
| `mobile_editor_touch_pad.png` | 390x844 | Mobile editor showing vertical stage and 4-panel directional touch pad | Touch pads $\ge 48\times 48$ px, 0 horizontal scroll, stage visible. |
| `mobile_note_selector.png` | 390x844 | Mobile note type selector strip (Tap, Hold, Roll, Mine, Lift, Fake) | All 7 tools accessible, active tool highlighted. |
| `mobile_adaptive_drawer.png` | 390x844 | Slide-up drawer exposed displaying mobile AI conditioning sliders | Touch sliders usable on mobile, canvas partially dimmed/docked. |
| `mobile_doubles_dual_bank.png` | 390x844 | Mobile Doubles mode showing P1/P2 bank toggle switch | Ergonomic 4-button bank switch, active bank indicated. |

### 7.2 Adversarial Invariant Checks
1. **Zero Element Overlap:** Every interactive element on mobile has a non-intersecting bounding box with adjacent controls.
2. **WCAG 2.5.5 Touch Targets:** Every touch target on mobile is $\ge 48\times 48$ CSS pixels.
3. **Zero Horizontal Overflow:** `document.documentElement.scrollWidth === window.innerWidth` across 375px, 390px, and 430px viewports.
4. **Color Contrast:** All text and receptor glyphs maintain $\ge 4.5:1$ contrast against their parent background.
5. **No Visual Clipping:** Key text labels (BPM, measure, song title) are never truncated with ellipsis under supported viewports.

---

## 8. Test Execution & Runner Infrastructure

### 8.1 Unified Test Runner Script (`tests/run_e2e_tests.sh`)
The test runner executes with the following options:
```bash
# Run all E2E test tiers and capture screenshots
./tests/run_e2e_tests.sh

# Run specific tier
./tests/run_e2e_tests.sh --tier 1
./tests/run_e2e_tests.sh --tier 2
./tests/run_e2e_tests.sh --tier 3
./tests/run_e2e_tests.sh --tier 4
./tests/run_e2e_tests.sh --tier 5

# Run desktop or mobile only
./tests/run_e2e_tests.sh --project desktop
./tests/run_e2e_tests.sh --project mobile

# Verify fixtures and syntax without browser launch
./tests/run_e2e_tests.sh --lint-only
```

### 8.2 Pass/Fail Criteria
- **Pass:** 100% of tests pass (exit code 0), 0 unhandled exceptions, all 9 screenshots generated in `output/screenshots/`, and lossless round-trip checks pass with 0 byte loss.
- **Fail:** Any test failure, timeout, unhandled rejection, or missing screenshot results in non-zero exit code.
