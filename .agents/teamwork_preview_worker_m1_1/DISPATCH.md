# DISPATCH: Milestone M1 Worker — Core Stepchart Editor Engine & Audio/Timing

**Agent Working Directory**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1
**Role**: Milestone M1 Worker
**Original User Request**: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
**Project Architecture & Specifications**: /Users/ate/Projects/stepper-web/PROJECT.md
**Spec Miner Report**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/report.md
**Environment Explorer Report**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_environment_1/report.md

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You exclusively own:
- `/Users/ate/Projects/stepper-web/frontend/` (all files and directories within `frontend/`)
Do NOT modify `backend/` or `tests/`.

## Objectives (Milestone M1: Features F1–F7)
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` and `/Users/ate/Projects/stepper-web/PROJECT.md`.
2. Initialize the frontend project in `frontend/` using Vite + React + TypeScript + Tailwind CSS.
3. Implement the core stepchart editor engine in `frontend/src/editor/engine/`:
   - `msdParser.ts`: Full EBNF MSD grammar parser handling all header tags (#TITLE, #ARTIST, #MUSIC, #OFFSET, #BPMS, #STOPS, #DELAYS, #WARPS, #TIMESIGNATURES, #NOTES, etc.), escape sequences (`\:`, `\;`, `\#`, `\\`), comments (`//`), and split timing.
   - `smSerializer.ts`: Lossless `.sm` and `.ssc` serializer with correct formatting and syntax.
   - `measureUtil.ts`: 192-tick grid note representation and line minimization algorithm (`getSmallestNoteTypeForMeasure` optimizing measure line counts to 4, 8, 12, 16, 24, 32, 48, 64, 96, or 192).
   - `subdivisions.ts`: Canonical StepMania color hues for subdivisions (4th `#ff2a55`, 8th `#00a2ff`, 12th `#9e3cff`, 16th `#ffd000`, 24th `#ff54be`, 32nd `#ff7b00`, 48th `#00e5ff`, 64th `#00e676`, 96th `#b0bec5`, 192nd `#78909c`).
   - `timingEngine.ts`: Exact piecewise bi-directional timing conversion ($t_{\text{audio}} \leftrightarrow \text{beat}$) with initial `#OFFSET`, `#BPMS`, `#STOPS`, `#DELAYS`, `#WARPS`, and `#TIMESIGNATURES`, preserving stop freeze intervals.
   - `types.ts`: Strongly typed interfaces for Dance Singles (4-panel) and Doubles (8-panel), note types (Taps '1', Holds '2'/'3', Rolls '4'/'3', Mines 'M', Lifts 'L', Fakes 'F').
4. Implement the interactive audio waveform and spectrogram engine in `frontend/src/editor/audio/`:
   - Web Audio API integration for client-side decoding (WAV, MP3, OGG) with real-time audio playback.
   - HTML5 Canvas high-resolution audio waveform and spectrogram display with smooth scrubbing, zoom levels (1x to 64x), playback rates (0.25x to 2.0x), and audio bookmarking.
   - Synchronization mechanism ensuring the visual beat cursor remains locked to the audio waveform during playback across songs with variable BPM changes and stops.
5. Create frontend unit tests in `frontend/src/editor/engine/__tests__/` (or `frontend/tests/`):
   - Test lossless round-trip parsing and serialization of .sm and .ssc files.
   - Test timing engine conversion fidelity ($t_{\text{audio}} \leftrightarrow \text{beat}$) with variable BPMs, stops, and warps.
   - Test subdivision quantization and color assignment.
6. Run the build command (`npm run build` or `npm test`) and document passing results.
7. Deliver your report in `handoff.md` and notify the orchestrator.

## 2026-09-08T06:50:34Z
You are the Milestone M1 Worker: Core Stepchart Editor Engine & Audio/Timing.
Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1.
Read your dispatch instructions in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/DISPATCH.md, the original user request in /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md, and the project scope in /Users/ate/Projects/stepper-web/PROJECT.md.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write ownership:
You exclusively own:
- /Users/ate/Projects/stepper-web/frontend/ (all files within frontend/)
Do NOT modify backend/ or tests/.

Objectives (Features F1-F7):
1. Initialize the frontend project in frontend/ with Vite + React 19 + TypeScript + Tailwind CSS.
2. Implement core engine in frontend/src/editor/engine/:
   - msdParser.ts: Full EBNF MSD lexer & parser with escape character support and split timing.
   - smSerializer.ts: Lossless .sm and .ssc serializer.
   - measureUtil.ts: 192-tick grid math and line minimization algorithm (getSmallestNoteTypeForMeasure).
   - subdivisions.ts: Canonical StepMania color hues (4th through 192nd).
   - timingEngine.ts: Exact bi-directional piecewise timing math (beat <-> seconds) under BPM changes, stops, delays, warps, time signatures, preserving stop freeze intervals.
   - types.ts: Strongly-typed Simfile, Chart, NoteRow, TimingData models for Singles (4-panel) and Doubles (8-panel).
3. Implement audio waveform & spectrogram engine in frontend/src/editor/audio/:
   - Web Audio API decoder (MP3, OGG, WAV).
   - HTML5 Canvas high-performance waveform and spectrogram display with smooth scrubbing, zoom (1x to 64x), playback rates (0.25x to 2.0x), and audio bookmarking.
   - Synchronization ensuring the visual beat cursor remains locked to the audio waveform during playback across songs with variable BPM changes and stops.
4. Implement unit tests in frontend/src/editor/engine/__tests__/ verifying lossless round-trip parsing/serializing, timing math, and subdivision color assignment.
5. Run build and test commands (npm run build, npm test) and verify they pass.
6. Maintain progress.md with timestamps, deliver handoff.md with documented build/test results, and notify orchestrator.
