# GitHub Pages deployment — 2026-09-16

## Current verified null-acoustic release

The current public release at **https://atehortuajf.github.io/stepper-web/** was built from source commit `ce1a4d8104ce44a05d041218aef35f598c84525e` and published as Pages commit `d9cf25ff6c85bddef650d8228f3481e087486e82`. The [`pages-build-deployment` run](https://github.com/Atehortuajf/stepper-web/actions/runs/35069494343) completed successfully.

The downloaded public `deployment.json` identifies that source commit, model ID `stepper-meter-704fa7775b3a-null-acoustic`, schema 3 and checkpoint SHA256 `704fa7775b3a0cdee1dba0af08d675fc36e18a2d5d213d56d0ad44188393e6ec`. Public model metadata is byte-identical to `frontend/public/models/model_metadata.json` and declares separate conditioned/null acoustic features for decoder CFG. Both public ONNX files are byte-identical to the local release artifacts and the Pages commit:

- Placement: `43b0477c6bc55033dd86ebe39efc14f680f597afc38dba899c555e0c3965ec7a`, 19,686,948 bytes.
- Decoder: `7d9424dc4cdb012f6741868251157e620d64fea31a8197afe61db5080215fc4e`, 14,639,653 bytes.

The compact machine-readable proof is [null-acoustic-live-proof.json](null-acoustic-live-proof.json). It supplements rather than replaces [numeric-model-live-proof.json](numeric-model-live-proof.json), which remains the historical proof for the preceding same-day release and browser smoke. This verification establishes deployed artifact identity; browser behavior and generation quality are separate checks.

## Earlier same-day numeric-model release

The corrected numeric-meter best epoch-12 checkpoint is live at **https://atehortuajf.github.io/stepper-web/**.

- Application source: `7b608f8be4461ca8b07dc693941491749bf9436d` on `mvp/p0-stabilization-2026-09-11`.
- Pages commit: `342b8e28e8e19362b97a444a8efa3fef18b6b327` on `gh-pages`.
- Successful publishing run: https://github.com/Atehortuajf/stepper-web/actions/runs/35064801853.
- Checkpoint: `704fa7775b3a0cdee1dba0af08d675fc36e18a2d5d213d56d0ad44188393e6ec`.
- Model manifest: https://atehortuajf.github.io/stepper-web/models/model_metadata.json.
- Live deployment record: https://atehortuajf.github.io/stepper-web/deployment.json.
- Public file download/hash proof: [numeric-model-live-proof.json](numeric-model-live-proof.json).

Fresh production output was synchronized into an isolated Pages worktree and pushed as a normal fast-forward commit. The follow-up versions graph download URLs by expected checksum, so users returning with old graph files in their browser cache obtain the correct new files. Both graph bytes and the deployed manifest are verified against the identity embedded in the application build.

The build and 213 frontend tests passed. The backend suite passed 44 tests with the selected checkpoint. Forty PyTorch/ONNX Runtime cases, including null conditioning and padded/unpadded decoder prefix comparisons, passed below `1e-5`. An additional synthetic-checkpoint fixture run passed 43/44 with the existing latency-budget failure documented in [NUMERIC_MODEL.md](NUMERIC_MODEL.md); this is separate from production-checkpoint validation.

A returning public browser session loaded the final release, reached WASM ready, and generated a four-row Hard 8 proposal in an observed 459 ms. Accepting showed Hard 8 and four rows; undo restored the original Challenge 15 and sixteen rows. This is one smoke observation, not a performance benchmark.

The public deployment JSON reports the exact application source above, the public HTML references the matching new entry bundle, and both downloaded ONNX checksums match the release manifest. This is a browser-only GitHub Pages deployment; the optional Python backend was updated and tested locally but is not exposed as a service.

## Earlier deployment record

### GitHub Pages deployment — 2026-09-11

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
