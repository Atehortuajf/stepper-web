# Stepper editor MVP: start here

Updated 2026-09-11. Current branch in both Stepper and stepper-web: **mvp/p0-stabilization-2026-09-11**.

This file supersedes historical HANDOFF/TEST_READY completion claims. The goal is a usable editor that preserves charts, plus honest inference behavior. The scoped P0 engineering pass is complete. The final checkpoint below and docs/mvp/STATUS.md distinguish verified fixes from remaining research and release work.

## Completed team work

Three GPT-5.6 Sol agents implemented core data/conditioning, editor transactions, and export/inference fixes under the parent coordinator's integration review. All are now idle. No unfinished local code is required for continuation; use the pushed branch.

The coordinator reviewed and committed the shared checkouts. Future parallel work should likewise use disjoint ownership or isolated worktrees. See docs/mvp/STATUS.md and specialty handoffs for accepted increments and limitations.

## Resume

1. Fetch and check out this branch in both repos. Read both MVP_HANDOFF files and current STATUS records.
2. Check git status and recent commits before changing anything. Do not reset unfinished work.
3. In frontend, install the lockfile with npm ci; run npm test and npm run build. Use a supported modern Node runtime. The audit's Node 22.14 environment emitted engine warnings; prefer the dependency-supported Node version.
4. Test the real React application. Historical tiered Playwright tests serve a separate mock editor and do not establish real editor correctness.
5. Preserve readable failure results and fixture requirements; no inflated PASS counts.
6. Commit and push small verified increments to this branch; update STATUS with commands, results, risks, and next step.

The current machine uses a disposable node_modules symlink into an audit environment. It is ignored and not committed; install normally elsewhere. Backend use requires the sibling Stepper package and its own Python dependencies. Browser inference is the default path.

## MVP acceptance

- Opening audio after a simfile preserves all charts and timing.
- Undo/redo never substitutes a chart from another document/chart.
- Changing only offset preserves tempo/time-signature events and split timing.
- Generation failure or stale response cannot become a destructive replacement.
- Notes exactly at a replacement interval's exclusive end survive.
- Export preserves supported metadata, holds, timing, and unmodified extra tags.
- Derived holds agree with notes after edits.
- Model input preprocessing is consistent or unsupported inputs are clearly blocked.

No claim of guaranteed human playability, state-of-the-art generation, or validated mobile/offline support should be made from the historical documents. User audio stays local in browser mode; optional backend mode must be identified separately.

The original web snapshot was a17d2493d36f3a7232bb1c888d8b3e1c9b04e420. The complete audit and private training provenance are maintained in the private Stepper repo. Do not copy private training artifacts into this public repository.

Pushing the branch does not deploy GitHub Pages. Record a separate verified deployment if one is performed.

## Final checkpoint

The scoped P0 engineering pass is complete; all implementation agents are idle. See docs/mvp/STATUS.md. Validated code: core `fa7e6ea`, web `6296bb1`. Final checks: 268 core, 207 frontend and 35 backend tests, production build, real browser and third-party export smoke. No training or deployment was performed. The paper still needs corrected training and held-out evaluation; the core runbook prepares that deferred work.
