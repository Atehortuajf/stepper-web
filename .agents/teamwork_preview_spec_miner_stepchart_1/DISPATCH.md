# DISPATCH: Stepchart & Editor Spec Miner

**Agent Working Directory**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1
**Role**: Stepchart & Editor Spec Miner
**Original User Request**: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md

## Objectives
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md`.
2. Mine and document the complete technical specifications for ArrowVortex and StepMania file formats, timing engines, and editor interactions:
   - Complete `.sm` and `.ssc` file format specifications: header tags (#TITLE, #ARTIST, #MUSIC, #OFFSET, #SAMPLESTART, #SAMPLELENGTH, #BPMS, #STOPS, #DELAYS, #WARPS, #TIMESIGNATURES, #TICKCOUNTS, #COMBOS, #SPEEDS, #SCROLLS, #FAKES, #LABELS, #NOTES, etc.), note data syntax (measure subdivisions, lines per measure: 4, 8, 12, 16, 24, 32, 48, 64, 96, 192).
   - Supported game modes: Dance Singles (4 panels: Left, Down, Up, Right) and Doubles (8 panels).
   - Supported note types: Taps ('1'), Holds ('2' body, '3' tail), Rolls ('4' body, '3' tail), Mines ('M'), Lifts ('L'), Fakes ('F').
   - Canonical StepMania color hues for subdivisions (4th, 8th, 12th, 16th, 24th, 32nd, 48th, 64th, 96th, 192nd).
   - Audio and timing synchronization formulas: precise mathematical mapping between audio elapsed time (seconds) and musical beat time taking into account initial #OFFSET, variable #BPMS segments, #STOPS (pauses in seconds), #DELAYS (stops on beat), and #WARPS (skipping beats).
   - Desktop keyboard shortcuts & controls (ArrowVortex conventions: numpad navigation, arrow keys, space to play/pause, note type shortcuts, subdivision switching).
   - Mobile touch interactions (responsive viewports 375px-430px, on-screen directional touch pads, scrub bars, drawer controls).
3. Write your findings to `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/report.md` and write a self-contained `handoff.md`.
4. Send a completion message back to the orchestrator.

## 2026-09-08T06:45:39Z
You are the Stepchart & Editor Spec Miner.
Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1.
Read your dispatch instructions in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/DISPATCH.md and the original user request in /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md.

Extract and formalize precise specifications for:
1. .sm and .ssc file format specifications: All header tags (#TITLE, #ARTIST, #MUSIC, #OFFSET, #BPMS, #STOPS, #DELAYS, #WARPS, #TIMESIGNATURES, #NOTES, etc.), measure syntax, subdivision representations (4th, 8th, 12th, 16th, 24th, 32nd, 48th, 64th, 96th, 192nd).
2. Dance Singles (4 panels) and Doubles (8 panels) layout and note types: Taps ('1'), Holds ('2'/'3'), Rolls ('4'/'3'), Mines ('M'), Lifts ('L'), Fakes ('F').
3. Canonical StepMania color hues for each subdivision.
4. Precise mathematical timing equations: conversion between audio seconds and musical beat subdivisions with variable BPMs, stops (pauses), delays, and warps.
5. Desktop editing interactions and keyboard shortcuts (ArrowVortex conventions: numpad, arrow keys, space, note type keys).
6. Mobile touch interaction model (375px-430px viewports, on-screen directional touch pads, scrub bars, drawer controls).

Produce a detailed specification report in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/report.md.
Maintain progress.md with timestamps.
Deliver your final handoff in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/handoff.md and send a completion message to the parent orchestrator.

