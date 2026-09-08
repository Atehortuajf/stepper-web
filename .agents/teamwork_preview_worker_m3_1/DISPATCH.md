# DISPATCH: Milestone M3 Worker — Interactive Conditioning & Biomechanical Parity

**Agent Working Directory**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m3_1
**Role**: Milestone M3 Worker
**Original User Request**: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
**Project Architecture & Specifications**: /Users/ate/Projects/stepper-web/PROJECT.md
**Reference Codebase**: /Users/ate/Projects/Stepper
**M1 Worker Handoff**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1/handoff.md
**M2 Worker Handoff**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m2_1/handoff.md

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You exclusively own:
- `/Users/ate/Projects/stepper-web/frontend/` (all files within `frontend/`)
Do NOT modify `backend/` or `tests/`.

## Objectives (Milestone M3: Features F12, F13, F14)
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` and `/Users/ate/Projects/stepper-web/PROJECT.md`.
2. Implement Stepper AI technique conditioning in `frontend/src/editor/conditioning/`:
   - `TechConditioningPanel.tsx`: Continuous sliders `[0.0, 1.0]` for all 16 canonical technique vector dimensions from `stepper/data/tech_tags.py`:
     1. `crossover`, 2. `footswitch`, 3. `doublestep`, 4. `bracket`, 5. `bracket_under`, 6. `bracket_crossover`, 7. `sideswitch`, 8. `kickswitch`, 9. `holdswitch`, 10. `jack`, 11. `jump_jack`, 12. `split_jack`, 13. `bracket_tap`, 14. `complex_rhythm`, 15. `stream_stamina`, 16. `no_tech`.
   - Provide standard technique presets (e.g. "Pure Stream", "Footswitch/Tech", "Brackets & Doubles", "Jackhammer", "Reset / Balanced").
   - Difficulty level selector (Novice, Easy, Medium, Hard, Expert, and meter 1-25+).
3. Implement interactive chart generation and diff preview:
   - `frontend/src/editor/api/stepperApi.ts`: Client for backend REST (`/api/generate`, `/api/solve-parity`, `/api/health`) and WebSocket (`/api/ws/generate`).
   - `DiffOverlay.tsx`: Interactive generation controls allowing one-click generation for selected measures (e.g. measures 0-4, 4-8) or entire songs.
   - Proposed notes preview rendered side-by-side or overlaid in contrasting color (e.g. green/amber ghost arrows) with live "Accept / Commit" and "Discard" actions before committing changes to the chart data model.
4. Implement biomechanical validator overlay in `frontend/src/editor/biomechanics/`:
   - `ParityTrack.tsx` and Canvas overlay: Visual foot parity ribbon along the note grid displaying Left foot (`#00b0ff`), Right foot (`#ff3366`), Brackets, and Heel-Toe designations for each placed note.
   - Transition cost heatmaps: visual indicator of physical strain / movement distance between consecutive steps.
   - Unplayability warning banners and indicators: flagging double-steps (same foot on consecutive different arrows), impossible crossovers, and unplayable multi-arrow combinations, computed via the backend Viterbi solver (`/api/solve-parity`).
5. Integrate these components into the main application in `frontend/src/App.tsx`.
6. Add unit and component tests in `frontend/src/editor/conditioning/__tests__/` and `frontend/src/editor/biomechanics/__tests__/`:
   - Test technique slider state modulation and preset application.
   - Test diff preview state transitions (generate -> preview -> commit/discard).
   - Test foot parity rendering and unplayability warning detection.
7. Run build and tests (`npm test`, `npm run build`, `npm run lint`) and document passing results.
8. Deliver your report in `handoff.md` and notify the orchestrator.

## 2026-09-08T07:02:27Z
You are the Milestone M3 Worker: Interactive Conditioning & Biomechanical Parity.
Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m3_1.
Read your dispatch instructions in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m3_1/DISPATCH.md, the original user request in /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md, and the project scope in /Users/ate/Projects/stepper-web/PROJECT.md.
Reference codebase: /Users/ate/Projects/Stepper.

Objectives (Features F12, F13, F14):
1. Implement 16-D Technique Conditioning in frontend/src/editor/conditioning/:
   - Continuous sliders [0.0, 1.0] for all 16 canonical features from stepper/data/tech_tags.py (crossover, footswitch, doublestep, bracket, bracket_under, bracket_crossover, sideswitch, kickswitch, holdswitch, jack, jump_jack, split_jack, bracket_tap, complex_rhythm, stream_stamina, no_tech).
   - Presets for common chart styles ("Pure Stream", "Footswitch/Tech", "Brackets & Doubles", "Jackhammer", "Reset / Balanced").
   - Difficulty level selector (Novice to Expert, 1-25+ meter).
2. Implement Interactive Chart Generation & Diff Preview:
   - Backend client in frontend/src/editor/api/stepperApi.ts for /api/generate and /api/solve-parity.
   - Interactive generation UI with measure range selection (e.g. measures 0-4 or full chart) and live preview diff overlay before committing.
   - Diff overlay with Accept / Commit and Discard controls.
3. Implement Biomechanical Foot Parity Overlay in frontend/src/editor/biomechanics/:
   - Foot parity ribbon along the note grid displaying Left foot (#00b0ff), Right foot (#ff3366), Brackets, and Heel-Toe labels.
   - Transition cost heatmaps and physical unplayability warnings (flagging double-steps, impossible crossovers, and unplayable combinations via /api/solve-parity).
4. Integrate these components into the desktop DAW layout in frontend/src/App.tsx.
5. Create comprehensive unit tests in frontend/src/editor/conditioning/__tests__/ and frontend/src/editor/biomechanics/__tests__/.
6. Run build and tests (npm test, npm run build, npm run lint) and document passing results.
7. Maintain progress.md with timestamps, deliver handoff.md, and notify the orchestrator.
