# Handoff Report: Stepchart & Editor Specification Miner
**Agent Working Directory:** `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1`  
**Parent Orchestrator ID:** `d6a1364c-5a26-4dee-8451-ea3606814a3a`  
**Handoff Type:** Hard (Task Complete)  
**Date:** 2026-09-08T06:49:00Z  

---

## 1. Observation

Directly observed files, structures, algorithms, and primary reference source implementations:
1. **MSD Grammar & Timing Specifications:**
   - Source: `/Users/ate/Projects/Stepper/docs/timing_specification.md` (lines 20–140, 143–192, 194–262).
   - EBNF Lexical Grammar:
     ```ebnf
     MSD_File       ::= { ParameterBlock | Comment | Whitespace } ;
     ParameterBlock ::= '#' TagName { ':' ParameterValue } ';' ;
     TagName        ::= { Character - ( ':' | ';' | '#' | '/' | '\' | Whitespace ) }+ ;
     ParameterValue ::= { EscapedChar | NormalChar | Comment }* ;
     EscapedChar    ::= '\' ( ':' | ';' | '#' | '\' ) ;
     Comment        ::= '//' { Character - ( '\n' | '\r' ) }* Newline ;
     ```
   - Legacy `.sm` defines 6-parameter `#NOTES:` structure (`<StepsType>:<Description>:<Difficulty>:<Meter>:<RadarValues>:<NoteData>;`) with global-only timing.
   - Modern `.ssc` defines `#VERSION:0.83;` and modular `#NOTEDATA:;` blocks with per-chart split timing (`#OFFSET:`, `#BPMS:`, `#STOPS:`, `#DELAYS:`, `#WARPS:`, etc.).
2. **Fixed-Point Grid & Measure Minimization:**
   - Source: `/Users/ate/Projects/Stepper/stepper/export/measure_util.py` (lines 22–39, 55–96).
   - Canonical quantizations: `ROWS_PER_BEAT = 48`, `ROWS_PER_MEASURE = 192`.
   - Valid line counts per measure: $N \in \{4, 8, 12, 16, 24, 32, 48, 64, 96, 192\}$.
   - Algorithm `get_smallest_note_type_for_measure`: finds maximal stride $S \in \{48, 24, 16, 12, 8, 6, 4, 3, 2, 1\}$ such that all active ticks $t \pmod S == 0$, emitting line count $N = 192 / S$.
3. **Strongly-Typed Note Semantics & Layout:**
   - Source: StepMania `NoteTypes.h` and `/Users/ate/Projects/Stepper/stepper/data/chart_parser.py` (lines 18–57, 178–257).
   - `VALID_NOTE_CHARS = "01234MLFK"`: `'0'` (Empty), `'1'` (Tap), `'2'` (Hold Head), `'3'` (Hold/Roll Tail), `'4'` (Roll Head), `'M'` (Mine), `'L'` (Lift), `'F'` (Fake), `'K'` (Keysound).
   - Singles layout: 4 columns (`Left, Down, Up, Right`).
   - Doubles layout: 8 columns (`P1-L, P1-D, P1-U, P1-R, P2-L, P2-D, P2-U, P2-R`).
4. **Canonical Subdivision Color Hues:**
   - Source: StepMania noteskin standard and `/Users/ate/Projects/Stepper/stepper/preview/preview_generator.py` (lines 17–38, 280–295).
   - 4th (Red `#ff2a55`), 8th (Blue `#00a2ff`), 12th (Purple `#9e3cff`), 16th (Yellow `#ffd000`), 24th (Pink `#ff54be`), 32nd (Orange `#ff7b00`), 48th (Cyan `#00e5ff`), 64th (Green `#00e676`), 96th (Light Gray `#b0bec5`), 192nd (Dark Gray `#78909c`).
5. **Exact Bi-directional Timing Mathematics:**
   - Source: `/Users/ate/Projects/Stepper/stepper/timing/engine.py` (lines 28–378).
   - Fundamental offset: $t_{\text{unoffset}} = t_{\text{audio}} + \text{OFFSET}$, $t_{\text{audio}} = t_{\text{unoffset}} - \text{OFFSET}$, beat 0 occurs at $t_{\text{audio}} = -\text{OFFSET}$.
   - Piecewise integration over BPM segments with pause plateaus (stops post-marker, delays pre-marker) and zero-duration warps.
   - Inverse mapping preserves freeze: during stop plateaus $[t_s, t_s + D_s]$, beat is clamped to $b_{\text{stop}}$.
   - Legacy normalization: Negative stops convert to warps ($|\text{duration}| \times \text{BPM} / 60.0$), pre-beat 0 stops shift offset.
6. **ArrowVortex Desktop Editing Conventions:**
   - Primary documentation: `Space` (play/pause), `Up/Down` (step snap), `PageUp/PageDown` (measure jump), `Left/Right` (change snap), `1..4` (singles taps), `1..8` (doubles taps), `Hold + Scroll` (hold placement), ``` ` ``` (backtick to convert hold to roll), `Shift + 1..4` (mines), `Alt + 1..4` (lifts), `Ctrl + 1..4` (fakes), `Shift + T` (BPM dialog), `Shift + S` (sync wizard).
7. **Mobile Touch Model Requirements:**
   - Viewports 375px to 430px (iPhone SE, iPhone 14/15/16).
   - Minimum 48x48 px touch targets.
   - On-screen directional touch pads with haptic feedback, segmented note toolbars (`[TAP] [HOLD] [ROLL] [MINE] [LIFT] [FAKE] [DEL]`), scrub bars with real-time waveform scrub, and slide-up adaptive drawers for AI conditioning and biomechanical analysis.

---

## 2. Logic Chain

1. **Step 1 — Format Completeness:** From Observation 1, StepMania parsing and writing requires handling both legacy `.sm` (monolithic `#NOTES:`, song-level timing) and modern `.ssc` (modular `#NOTEDATA:;` with split timing). The MSD parser must implement escape rules and implicit tag termination on newline `#` to avoid corrupting malformed simfiles.
2. **Step 2 — Mathematical Fidelity:** From Observation 2 & 5, musical time in StepMania is quantized to a 192-tick grid ($48 \text{ ticks/beat}$ in 4/4 time). Audio playback time and musical beat positions cannot be linearly interpolated across tempo changes or stops; they require a dual piecewise segment table (`TimeSegment` for $t_{\text{audio}} \to \text{beat}$, and `BeatSegment` for $\text{beat} \to t_{\text{audio}}$). This ensures the cursor remains locked to the waveform during stop pauses.
3. **Step 3 — Round-Trip Invariants:** From Observation 2 & 3, lossless round-trip serialization requires measure line minimization (`get_smallest_note_type_for_measure`) so measures are output with minimal lines $N \in \{4, 8, 12, 16, 24, 32, 48, 64, 96, 192\}$ rather than 192 lines, and hold heads `'2'`/`'4'` are strictly paired with release tails `'3'`.
4. **Step 4 — Interaction Ergonomics:** From Observation 6 & 7, desktop editing must provide familiar ArrowVortex muscle memory (numpad/number row, arrows, spacebar, selection shortcuts). For mobile touch screens (375px–430px), where physical keyboards are absent, all primary editing operations must be accessible via high-contrast on-screen directional touch pads and segmented mode selectors without covering the scrolling step receptors.

---

## 3. Caveats

1. **Unsupported Obscure Game Modes:** This specification covers `dance-single` (4 panels) and `dance-double` (8 panels). Legacy modes such as `dance-solo` (6 panels), `pump-single` (5 panels), or `kb7-single` (7 keys) follow the same MSD grid logic but have different column counts and sensor geometries; they are out of current scope.
2. **Platform Vibration API Support:** Mobile haptic feedback via `navigator.vibrate` is standard on Android Chrome/Firefox, but iOS Safari restricts vibration unless triggered by specific user gestures or installed as a PWA. The mobile UI must gracefully degrade without errors if vibration is unsupported.
3. **Non-Standard Time Signatures:** While the 192-tick grid natively supports $4/4$ and common subdivisions, complex compound time signatures (e.g. $7/8$ or $5/4$) modify `ROWS_PER_MEASURE = 48 \times \text{numerator} \times (4 / \text{denominator})`. The parser must read `#TIMESIGNATURES:` to dynamically calculate measure row boundaries.

---

## 4. Conclusion

The specification report in `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/report.md` provides an exhaustive, authoritative reference for:
- MSD lexer grammar, complete `.sm` and `.ssc` header tags, and split timing structures.
- Fixed-point 192-tick grid subdivisions and measure line minimization algorithm.
- Dance Singles (4-panel) and Doubles (8-panel) layouts and all 9 note types (`0, 1, 2, 3, 4, M, L, F, K`).
- Canonical StepMania color hues (4th through 192nd) with hex codes and algorithmic quantization determination.
- Exact piecewise bi-directional timing conversion mathematics, event precedence hierarchy, and legacy edge cases.
- ArrowVortex desktop keyboard shortcuts and workflow conventions.
- Mobile touch interaction architecture optimized for 375px–430px viewports with tactile pads, segmented toolbars, scrub bars, and adaptive drawers.

This specification is ready to be consumed directly by downstream frontend and backend implementation agents.

---

## 5. Verification Method

To independently verify the completeness, correctness, and fidelity of these specifications:
1. **Inspect Report Content:**
   ```bash
   cat /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/report.md
   ```
2. **Verify Against Reference Implementations:**
   - Compare timing formulas with `stepper/timing/engine.py` and run tests:
     ```bash
     cd /Users/ate/Projects/Stepper && pytest tests/unit/test_timing_engine.py tests/unit/test_chart_parser.py tests/unit/test_syntax_checker.py
     ```
   - Verify measure line minimization output matches `stepper/export/measure_util.py`.
3. **Invalidation Conditions:**
   - Any failure of bi-directional timing round-trips ($\text{beat} \to \text{seconds} \to \text{beat}$) with variable BPMs and stops.
   - Missing header tags or note type definitions required for ITL Online 2026 `.sm`/`.ssc` compatibility.
