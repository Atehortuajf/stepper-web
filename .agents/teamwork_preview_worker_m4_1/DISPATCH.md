# DISPATCH: Milestone M4 Worker — Professional DAW & Mobile Touch UI

**Agent Working Directory**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m4_1
**Role**: Milestone M4 Worker
**Original User Request**: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
**Project Architecture & Specifications**: /Users/ate/Projects/stepper-web/PROJECT.md
**Spec Miner Report**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/report.md
**M1 Worker Handoff**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/handoff.md
**M3 Worker Handoff**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m3_1/handoff.md

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You exclusively own:
- `/Users/ate/Projects/stepper-web/frontend/` (specifically `frontend/src/editor/ui/`, `frontend/src/editor/shortcuts/`, `frontend/src/App.tsx`, and related tests)
Do NOT modify `backend/` or `tests/`.

## Objectives (Milestone M4: Features F15, F16, F17, F18)
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` and `/Users/ate/Projects/stepper-web/PROJECT.md`.
2. Implement Professional DAW & ArrowVortex Desktop UI (F15):
   - Strict tool-first aesthetic modeled after Ableton Live and ArrowVortex (slate/dark zinc backgrounds, high-contrast borders, zero purple glows, zero fluffy cards, zero decorative animations).
   - Dense information hierarchy: top transport bar (tempo, time signature, offset, current beat/time, subdivision indicator), left metadata & conditioning sidebar (collapsible), center 192-tick stepchart canvas with receptors, right inspector/parity panel, bottom audio scrubber strip.
3. Implement Complete Desktop Keyboard-Driven Editing (F16):
   - ArrowVortex keybindings:
     - `1..4`: Place taps on Left, Down, Up, Right (singles) or `1..8` (doubles).
     - `Shift + 1..4`: Place mines ('M').
     - `Alt + 1..4`: Place lifts ('L').
     - `Ctrl + 1..4`: Place fakes ('F').
     - Hold placement: sustain notes over selected beat intervals or hold key while stepping.
     - `Up` / `Down`: Step cursor forward/backward by current subdivision snap.
     - `Left` / `Right`: Change subdivision snap (4th -> 8th -> 12th -> 16th -> 24th -> 32nd -> 48th -> 64th -> 96th -> 192nd).
     - `PageUp` / `PageDown`: Jump by measure (4 beats).
     - `Home` / `End`: Jump to beginning / end of chart.
     - `Space`: Toggle play/pause with audio synchronization.
     - `Delete` / `Backspace`: Remove notes at current beat.
     - `Shift + T`: Open BPM & Timing adjustment dialog.
     - `Ctrl/Cmd + S` or Export button: Export and trigger download of `.ssc` / `.sm` simfile.
4. Implement Mobile Responsive Touch Mode (F17 & F18):
   - Responsive layout adapting to mobile viewports (375px to 430px, e.g. iPhone SE, iPhone 14/15/16).
   - On-screen directional touch pads with touch targets $\ge 48 \times 48\text{ px}$:
     - 4 tactile directional buttons (Left, Down, Up, Right) for singles.
     - P1 / P2 bank toggle switch for doubles (8 panels).
   - Segmented note type selector strip: `[TAP] [HOLD] [ROLL] [MINE] [LIFT] [FAKE] [DEL]`.
   - Mobile scrub bar with real-time waveform scrub and measure jump buttons.
   - Slide-up adaptive drawer for Stepper AI conditioning sliders and biomechanical parity analysis.
   - Complete mobile editing workflow: user can load an audio/chart, adjust BPM, place notes with touch pads, open drawer to run AI generation, commit diff, and export `.ssc` file completely on touch screens without a physical keyboard.
5. Create comprehensive tests in `frontend/src/editor/ui/__tests__/`:
   - Test keyboard navigation, note placement, subdivision snap changing, and shortcut triggers.
   - Test mobile touch pad interaction, note selector modes, and drawer toggles.
   - Test mobile export and full touch workflow.
6. Verify production build, unit tests, and linting (`npm test`, `npm run build`, `npm run lint`).
7. Deliver your report in `handoff.md` and notify the orchestrator.

## 2026-09-08T07:13:18Z
You are the Milestone M4 Worker: Professional DAW & Mobile Touch UI.
Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m4_1.
Read your dispatch instructions in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m4_1/DISPATCH.md, the original user request in /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md, and the project scope in /Users/ate/Projects/stepper-web/PROJECT.md.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write ownership:
You exclusively own:
- /Users/ate/Projects/stepper-web/frontend/ (specifically frontend/src/editor/ui/, frontend/src/editor/shortcuts/, frontend/src/App.tsx, and related frontend tests)
Do NOT modify backend/ or tests/.

Objectives (Features F15, F16, F17, F18):
1. Implement Utilitarian Professional DAW & ArrowVortex Desktop Layout (F15):
   - Strict tool-first aesthetic modeled after Ableton Live and ArrowVortex (slate/dark zinc backgrounds, high-contrast borders, zero purple glows, zero fluffy cards, zero decorative animations).
   - High-contrast, dense information hierarchy: top transport bar (tempo, time signature, offset, current beat/time, subdivision indicator), left metadata & conditioning sidebar, center 192-tick stepchart canvas with receptors, right inspector/parity panel, bottom audio scrubber strip.
2. Implement Desktop Keyboard-Driven Editing (F16):
   - Comprehensive ArrowVortex keyboard shortcuts in frontend/src/editor/shortcuts/keyboardShortcuts.ts:
     - 1..4 (singles taps) / 1..8 (doubles taps).
     - Shift + 1..4 (mines 'M'), Alt + 1..4 (lifts 'L'), Ctrl + 1..4 (fakes 'F').
     - Up / Down: step cursor by current subdivision snap.
     - Left / Right: cycle subdivision snap (4th, 8th, 12th, 16th, 24th, 32nd, 48th, 64th, 96th, 192nd).
     - PageUp / PageDown: jump by measure.
     - Home / End: jump to start/end.
     - Space: toggle play/pause with synchronized audio/beat cursor.
     - Delete / Backspace: remove notes at cursor.
     - Shift + T: open BPM/timing dialog.
     - Ctrl/Cmd + S / Export button: export and download .ssc / .sm.
3. Implement Mobile Responsive Touch Mode (F17):
   - Responsive layout adapting to mobile viewports (375px to 430px, e.g. iPhone SE 375px, iPhone 14/15/16 390-430px).
   - High-contrast touch targets >= 48x48 px.
   - On-screen directional touch pads (Left, Down, Up, Right, and P1/P2 bank toggle for doubles).
   - Segmented note type selector strip: [TAP] [HOLD] [ROLL] [MINE] [LIFT] [FAKE] [DEL].
   - Mobile scrub bar with real-time waveform scrub and measure jump buttons.
   - Slide-up adaptive drawer for Stepper AI conditioning sliders and biomechanical parity analysis.
4. Implement Full Mobile Editing Workflow (F18):
   - Complete editing workflow on touch screens without hardware keyboard (load audio/chart, set BPM, place/edit notes, open drawer to run AI generation, commit diff, and export .ssc).
5. Add unit and component tests in frontend/src/editor/ui/__tests__/:
   - Test keyboard navigation, note placement, subdivision changes, and export.
   - Test mobile touch pads, note selector modes, adaptive drawer, and mobile editing workflow.
6. Verify production build, unit tests, and linting (npm test, npm run build, npm run lint).
7. Maintain progress.md with timestamps, deliver handoff.md, and notify the orchestrator.

