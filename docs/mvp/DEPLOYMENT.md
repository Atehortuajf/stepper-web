# GitHub Pages deployment — 2026-09-11

The owner explicitly requested publication after the P0 engineering pass.

- URL: https://atehortuajf.github.io/stepper-web/
- Source: `b76736bdf814c2da767c220a8d1f4c09b7718a6d` on `mvp/p0-stabilization-2026-09-11`.
- Pages commit: `e8e62c3defe9010da25d232afb1c6622370f138d` on `gh-pages`.
- Publishing run: https://github.com/Atehortuajf/stepper-web/actions/runs/34652086822
- Rebuilt with `npm run build`; TypeScript and Vite passed.
- Published only the fresh `frontend/dist` contents, `.nojekyll`, and `deployment.json`. Removed stale duplicate build trees and old benchmark reports from the deployed branch; their history remains in git.

## What this deployment means

The current editor fixes are live and available for user testing. Browser inference uses the same historical ONNX weights; no retraining or backend deployment is included. Earlier event-label, timing-data, and null-conditioning training defects are corrected in source, not retroactively in those weights. Treat generated charts as experimental suggestions, especially hold/release behavior and technique control. Editing and workflow testing need not wait for retraining; research quality claims do.

## Repeat or roll back

Build the intended source revision, use an isolated checkout of the current `gh-pages` branch, synchronize the build output, record its source commit in `deployment.json`, and push a normal fast-forward deployment commit. Wait for the Pages job and verify the public app/model loader. To roll back, restore a known deployment tree in a new commit; do not rewrite shared history.

## Public verification

The Pages run completed successfully and the Pages API reports commit `e8e62c3` as built. The public `deployment.json` returned the expected source commit. A fresh browser visit loaded the updated editor and initialized WASM inference. Generating the default demo region completed with a worker-WASM diff preview (one observed 425.9 ms inference time, not a benchmark); discarding it restored the original demo chart. This checks deployment/runtime behavior, not music-chart quality. No training was started.
