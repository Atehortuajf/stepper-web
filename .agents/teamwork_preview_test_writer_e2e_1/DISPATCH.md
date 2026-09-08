# DISPATCH: E2E Test Suite Writer (Dual Track)

**Agent Working Directory**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_test_writer_e2e_1
**Role**: E2E Test Suite Writer
**Original User Request**: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
**Project Architecture & Specifications**: /Users/ate/Projects/stepper-web/PROJECT.md
**Spec Miner Report**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_spec_miner_stepchart_1/report.md
**Environment Explorer Report**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_environment_1/report.md

## Write Ownership
You exclusively own:
- `/Users/ate/Projects/stepper-web/TEST_INFRA.md`
- `/Users/ate/Projects/stepper-web/TEST_READY.md`
- `/Users/ate/Projects/stepper-web/tests/` (all subdirectories: `tests/e2e/`, `tests/fixtures/`, etc.)
- Playwright configuration files at project root (`playwright.config.ts`, etc.)
Do NOT write to `frontend/` or `backend/`.

## Objectives
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` and `/Users/ate/Projects/stepper-web/PROJECT.md`.
2. Create `/Users/ate/Projects/stepper-web/TEST_INFRA.md` following the template in `PROJECT.md` and testing principles:
   - Opaque-box, requirement-driven testing covering every feature F1 through F20.
   - 4-Tier Test Architecture:
     - **Tier 1 - Feature Coverage**: >=5 test cases per feature covering representative inputs in isolation.
     - **Tier 2 - Boundary & Corner Cases**: >=5 boundary/corner cases per feature (empty charts, max-density streams, 192nd subdivisions, extreme BPMs [20 to 1000 BPM], rapid stops/delays, 0-duration warps, negative offset).
     - **Tier 3 - Cross-Feature Combinations**: Pairwise interactions (e.g., stops during holds, warps during BPM changes, AI generation into pre-existing stepcharts, mobile touch on complex measure subdivisions).
     - **Tier 4 - Real-World Application Scenarios**: Realistic user workloads (e.g., loading ITL Online 2026 .sm/.ssc charts, editing notes across singles and doubles, audio synchronization across tempo changes, AI generation with technique conditioning, and export).
3. Set up the test fixtures in `/Users/ate/Projects/stepper-web/tests/fixtures/`:
   - Valid sample `.sm` and `.ssc` simfiles (including ITL Online 2026 style charts with BPM changes, stops, warps, delays, holds, rolls, mines).
   - Sample short WAV audio buffer for testing audio decode and playback synchronization.
4. Implement the test suite:
   - Unit and integration tests for timing, file parsing, and API endpoints.
   - Playwright E2E test scripts in `tests/e2e/` testing desktop (1920x1080) and mobile (390x844) viewports.
   - Configure screenshot capture output to `/Users/ate/Projects/stepper-web/output/screenshots/`.
5. Create a unified test runner script (e.g. `tests/run_e2e_tests.sh` or npm/pytest script) that runs the test suite.
6. When the test infrastructure and test suites are complete, publish `/Users/ate/Projects/stepper-web/TEST_READY.md`.
7. Deliver your report in `handoff.md` and notify the orchestrator.

## 2026-09-08T06:50:34Z
You are the E2E Test Suite Writer for the Stepper-Web Project.
Your working directory is /Users/ate/Projects/stepper-web/.agents/teamwork_preview_test_writer_e2e_1.
Read your dispatch instructions in /Users/ate/Projects/stepper-web/.agents/teamwork_preview_test_writer_e2e_1/DISPATCH.md, the original user request in /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md, and the project scope in /Users/ate/Projects/stepper-web/PROJECT.md.

Write ownership:
You exclusively own:
- /Users/ate/Projects/stepper-web/TEST_INFRA.md
- /Users/ate/Projects/stepper-web/TEST_READY.md
- /Users/ate/Projects/stepper-web/tests/ (all subdirectories: tests/e2e/, tests/fixtures/, etc.)
- Playwright configuration files at project root (playwright.config.ts, etc.)
Do NOT modify frontend/ or backend/.

Objectives:
1. Create /Users/ate/Projects/stepper-web/TEST_INFRA.md following the 4-tier methodology (Tier 1 Feature >=5/feat, Tier 2 Boundary >=5/feat, Tier 3 Pairwise, Tier 4 Real-World workloads including ITL Online 2026 charts).
2. Create realistic test fixtures in tests/fixtures/ (.sm and .ssc files with BPM changes, stops, warps, delays, holds, rolls, mines, and audio test slices).
3. Implement Playwright E2E test suites in tests/e2e/ for desktop (1920x1080) and mobile (390x844) viewports.
4. Configure screenshot capture output to /Users/ate/Projects/stepper-web/output/screenshots/.
5. Implement a test runner script (tests/run_e2e_tests.sh) and verify test syntax.
6. When test infrastructure is complete, publish /Users/ate/Projects/stepper-web/TEST_READY.md.
7. Maintain progress.md with timestamps, deliver handoff.md, and send a message when complete.
