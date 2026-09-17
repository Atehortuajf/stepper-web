# Stepper editor MVP: start here

## Current checkpoint — September 17 generation validity

Read [the generation-validity release](docs/mvp/GENERATION_VALIDITY_2026-09-17.md) first. Closed-hold decoding, exact fractional ranges, rolling browser chord history, strict preview topology validation and a multi-hold Viterbi false-positive fix are verified with 227 frontend, 51 backend and 325 sibling-core tests plus actual browser generate/accept/undo. Weights and ONNX graphs are unchanged; no retraining is needed for these fixes. The new 48-window validation structural probe has zero topology errors; frozen paper evidence remains historical and unchanged.

Live source `1afffaad829d78112b5121478a5035a0022a2687`; Pages `f256290f8372b2208ec4b4f43d308146efb075e8`; publishing run `35270090471` succeeded. See [deployment record](docs/mvp/DEPLOYMENT.md) and [public artifact proof](docs/mvp/generation-validity-live-proof.json). Use the same source branches named below. Symbolic correctness and heuristic checker success do not establish chord quality or human playability.

## Historical checkpoint — September 16 overnight

This section supersedes the September11 engineering history below. Web source branch: `mvp/p0-stabilization-2026-09-11`; sibling core source branch: `train/corrected-2026-09-16`. The September 16 public release was source `ce1a4d8104ce44a05d041218aef35f598c84525e` at Pages commit `d9cf25ff6c85bddef650d8228f3481e087486e82`; the [publishing run](https://github.com/Atehortuajf/stepper-web/actions/runs/35069494343) succeeded, and [the release proof](docs/mvp/null-acoustic-live-proof.json) verifies public metadata and both ONNX graphs against local artifacts.

The editor retains the numeric-meter epoch12 weights, checkpoint SHA256 `704fa7775b3a0cdee1dba0af08d675fc36e18a2d5d213d56d0ad44188393e6ec`. Its corrected inference graphs expose separate conditioned/null acoustic features for decoder guidance, consistent with the training null path. Graph model ID `stepper-meter-704fa7775b3a-null-acoustic`, metadata schema3. Deploy runtime, both graphs and metadata together; old/new graph interfaces cannot be mixed.

Verification: frontend214 tests, production build,40 CPU PyTorch/ONNX parity cases below2e-5, and local actual-browser generation→accept→undo passed. The browser initialized worker-WASM without errors; accepting a demo proposal changed16 rows to1 and undo restored16. This is workflow verification, not music-generation quality.

See `docs/mvp/DEPLOYMENT.md` for the exact live release; source pushes do not deploy Pages automatically. Main model assessment, frozen test protocol and overnight experiment records remain in the core repository. Owner questions are in core `docs/mvp/OWNER_REVIEW_2026-09-16.md`. No author/submission decisions should be inferred from deployment status.

## Historical September11 engineering record

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
