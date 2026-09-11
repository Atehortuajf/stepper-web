# Task Assignment for Explorer 2 (Survey: Audio-Only Tempo Estimation & Grid Sync)

Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/frontend/src/editor/audio/
- /Users/ate/Projects/stepper-web/frontend/src/App.tsx
- /Users/ate/Projects/stepper-web/frontend/src/editor/engine/timingEngine.ts
- Reference audio: /Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ogg

Investigate:
1. How audio loading is handled currently in App.tsx and audio engine. Where the 140.0 BPM fallback occurs.
2. The exact implementation needed for client-side audio-only tempo estimation via onset autocorrelation in `stepper-web/frontend/src/editor/audio/`.
3. How to detect dominant musical BPM (170 BPM for 'Crazy Jackpot.ogg' within ±1.0 BPM). Check how audio buffer decoding, spectral flux / energy onset detection, autocorrelation lag search (e.g. 60-240 BPM range), harmonic/subharmonic disambiguation, and peak picking work.
4. How to align the 48-tick Bresenham phase accumulator with acoustic transients and update `timingEngine.initialBpm` and the transport display.
5. Identify file structure and existing tests in frontend/tests/.

Write your comprehensive findings to `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_2/handoff.md`.

## 2026-09-11T19:10:40Z
<USER_REQUEST>
You are Explorer 2. Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_2/.
Read:
- /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
- /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_2/DISPATCH.md
- /Users/ate/Projects/stepper-web/frontend/src/editor/audio/
- /Users/ate/Projects/stepper-web/frontend/src/App.tsx
- /Users/ate/Projects/stepper-web/frontend/src/editor/engine/timingEngine.ts
- Reference audio: /Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2025 Unlocks/[13] Crazy Jackpot (SX) [xRGTMx]/Crazy Jackpot.ogg

Investigate:
1. How audio loading is handled currently in App.tsx and audio engine. Locate where the 140.0 BPM fallback occurs.
2. The exact implementation needed for client-side audio-only tempo estimation via onset autocorrelation in `stepper-web/frontend/src/editor/audio/`.
3. How to detect dominant musical BPM (170 BPM for 'Crazy Jackpot.ogg' within ±1.0 BPM). Check how audio buffer decoding, spectral flux / energy onset detection, autocorrelation lag search (e.g. 60-240 BPM range), harmonic/subharmonic disambiguation, and peak picking work.
4. How to align the 48-tick Bresenham phase accumulator with acoustic transients and update `timingEngine.initialBpm` and the transport display.
5. Identify file structure and existing tests in frontend/tests/.

Write your findings and actionable implementation plan in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_2/handoff.md and report back via send_message.
</USER_REQUEST>
