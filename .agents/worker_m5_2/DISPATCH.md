# Dispatch Assignment: Worker M5 Remediation (Iteration 2)

- **Role**: Worker (Audio & Canvas Remediation Implementer)
- **Working Directory**: `/Users/ate/Projects/stepper-web/.agents/worker_m5_2`
- **Authoritative Request**: `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md`
- **Remediation Blueprint**: `/Users/ate/Projects/stepper-web/.agents/explorer_m5_remediation_1/handoff.md` (read this for exact line diffs!)
- **Auditor Report**: `/Users/ate/Projects/stepper-web/.agents/auditor_1/handoff.md`
- **Project Root**: `/Users/ate/Projects/stepper-web`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusively Owned Files:
- `frontend/src/editor/ui/__tests__/stepchartCanvas.test.tsx`
- `frontend/src/editor/ui/StepchartCanvas.tsx`

## Objectives:
Execute the 5 tasks from `explorer_m5_remediation_1/handoff.md`:
1. **W1**: In `frontend/src/editor/ui/__tests__/stepchartCanvas.test.tsx`:
   - Remove unused imports `vi` (line 9) and `React` (line 10).
   - Add boundary test for `findFirstVisibleIndex` past last note.
2. **W2**: In `frontend/src/editor/ui/StepchartCanvas.tsx`:
   - Line 96: Change `let result = 0;` to `let result = rows.length;` in `findFirstVisibleIndex`.
3. **W3**: In `frontend/src/editor/ui/StepchartCanvas.tsx`:
   - Line 247: Add `if (row.beat < minVisibleBeat - 0.5) continue;` as defensive bounds checking.
4. **W4**: In `frontend/src/editor/ui/StepchartCanvas.tsx`:
   - Lines 316 & 336: In the continuous playback rAF effect, replace `drawFrame(currentBeat)` with `drawFrame(propsRef.current.currentBeat)` and remove `currentBeat` from the dependency array `[audioEngine, timingEngine, drawFrame]`.
5. **W5**: Run the builds and tests:
   - `npm run build` in `frontend/` — **MUST EXIT CODE 0 WITH ZERO TS ERRORS/WARNINGS**.
   - `npm test -- --run` in `frontend/` — all tests must pass.
   - `npx playwright test tests/e2e/tier4_real_world.spec.ts` from project root — all tests must pass.
6. Write your complete handoff report to `/Users/ate/Projects/stepper-web/.agents/worker_m5_2/handoff.md` and report back via send_message.

## 2026-09-11T05:56:24Z
You are worker_m5_2 (Worker for Milestone M5 Audio & Canvas Remediation).
Working Directory: /Users/ate/Projects/stepper-web/.agents/worker_m5_2
Authoritative Request: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
Remediation Blueprint: /Users/ate/Projects/stepper-web/.agents/explorer_m5_remediation_1/handoff.md (Contains exact code diffs and lines!)
Auditor Report: /Users/ate/Projects/stepper-web/.agents/auditor_1/handoff.md
Dispatch Assignment: /Users/ate/Projects/stepper-web/.agents/worker_m5_2/DISPATCH.md
Project Root: /Users/ate/Projects/stepper-web

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusively Owned Files:
- frontend/src/editor/ui/__tests__/stepchartCanvas.test.tsx
- frontend/src/editor/ui/StepchartCanvas.tsx

Your task:
Apply the exact 4 changes specified in Section 4 of explorer_m5_remediation_1/handoff.md:
1. In frontend/src/editor/ui/__tests__/stepchartCanvas.test.tsx:
   - Remove unused imports vi (line 9) and React (line 10).
   - Add the boundary test for findFirstVisibleIndex past the last note.
2. In frontend/src/editor/ui/StepchartCanvas.tsx:
   - Change let result = 0; to let result = rows.length; in findFirstVisibleIndex (line 96).
   - Add if (row.beat < minVisibleBeat - 0.5) continue; in drawFrame (line 247).
   - In continuous playback rAF effect (lines 316 & 336), change drawFrame(currentBeat) to drawFrame(propsRef.current.currentBeat) and remove currentBeat from the dependency array [audioEngine, timingEngine, drawFrame].
3. Run verification commands:
   - npm run build in frontend/ — MUST complete with exit code 0 and ZERO errors.
   - npm test -- --run in frontend/ — all tests must pass.
   - npx playwright test tests/e2e/tier4_real_world.spec.ts from project root — all tests must pass.
4. Write your handoff report to /Users/ate/Projects/stepper-web/.agents/worker_m5_2/handoff.md and report back via send_message.
