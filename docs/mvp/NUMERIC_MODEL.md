# Numeric-meter model release — 2026-09-16

The editor bundles the new best corrected-training checkpoint, selected by validation loss at epoch **12** (checkpoint epoch index 11). No training was performed during this web integration.

- Checkpoint SHA-256: `704fa7775b3a0cdee1dba0af08d675fc36e18a2d5d213d56d0ad44188393e6ec`.
- Model ID: `stepper-meter-704fa7775b3a`.
- Portable identity and numerical results: `frontend/public/models/model_metadata.json` (deployed at `models/model_metadata.json`). Includes schema version, checkpoint identity, one-based and zero-based epoch, exporter source checksum, core commit, graph checksums/sizes, CFG scales, and every parity case.

## Public generation contract

REST, WebSocket and browser callers supply `meter: 8`, with optional `category: "Medium"`, `"Hard"` or `"Challenge"`. The meter is a positive integer; missing, zero, fractional, string or category-only inputs are rejected. Medium 8, Hard 8 and Challenge 8 feed identical **int64 `[8]`** tensors to both ONNX graphs. The ONNX input is explicitly named `meter`, so old category-based graphs cannot silently accept the new contract. Null CFG conditioning is `[0]` with the zero technique vector; CFG scales are 1.8 placement and 1.5 decoder.

Category buttons do not change the meter. Accepting a proposal records its captured category/meter with the notes; undo restores all three. SM/SSC serializers export that chart category and numeric meter. Physical FSM hold/release constraints remain active; historical category gates are disabled. The first event's delta is measured from the generation window origin, matching training. The configured placement threshold is used without an implicit adaptive fallback.

Browser initialization checks the deployed manifest against the manifest embedded in the application build, then SHA-256 verifies both downloaded graph files. Graph request URLs include the expected SHA-256 so returning visitors fetch the new weights instead of a previously cached file at the same name. Mismatched or stale artifacts fail initialization. Neural responses identify the checkpoint/model; explicit rule-based output does not claim a neural checkpoint. The Python backend reads the checkpoint model configuration and exposes identity in health/REST/WebSocket responses. It rejects old categorical checkpoints rather than reinterpreting meters as category IDs.

## Reproduce

From the sibling core repository, in an environment with PyTorch, ONNX and ONNX Runtime:

```sh
OMP_NUM_THREADS=2 python scripts/export_onnx_models.py \
  --weights runs/meter-2026-09-16/checkpoints/best_model.pt \
  --output-dir ../stepper-web/frontend/public/models
```

From the web repository:

```sh
cd frontend
npm test
npm run build
cd ..
STEPPER_WEIGHTS_PATH=../Stepper/runs/meter-2026-09-16/checkpoints/best_model.pt \
  PYTHONPATH=../Stepper OMP_NUM_THREADS=2 python -m pytest backend/tests -q
```

The backend environment also needs `backend/requirements.txt`. TestClient requires local socket access. Without an explicit checkpoint, test fixtures construct a labelled synthetic numeric model; latency depends on that fixture's predictions and is not evidence for production performance.

## Verification

- 40 CPU PyTorch/ONNX Runtime comparisons passed at absolute maximum error below `1e-5`: placement lengths 1/8/32/64 beats × conditions 0/1/8/15/25; decoder active histories 1/8/32/64 × those conditions in fixed 64-token browser windows. Decoder comparisons also check the unpadded PyTorch prefix against the padded ONNX prefix.
- Frontend: **213 tests passed**, including real ONNX inference with identical placements for Medium 8, Hard 8 and Challenge 8 under the same sampling draw; manifest/file checksums; physical FSM gates; and proposal metadata/undo regression. Production TypeScript/Vite build passed.
- Backend: **44 tests passed** against the actual best checkpoint, with two upstream deprecation warnings. The additional default synthetic-fixture run passed 43/44: its existing 1.5-second 16-beat latency budget failed at 1.91 seconds; no budget was weakened. Numeric validation, same-meter category independence and explicit legacy-request rejection are covered.
- Public final release: a returning browser session loaded the checksum-versioned models, generated a four-row Hard 8 proposal using worker-WASM (observed 459 ms), accepted it, and undid it back to Challenge 15/sixteen rows. See [deployment proof](numeric-model-live-proof.json).
- Local browser: verified graph loader reached WASM ready; generated a meter-8/Medium demo proposal with four notes; accepting showed Medium 8 and four rows; undo restored Challenge 15 and sixteen rows. Observed worker-WASM latency was 487 ms (one observation, not a benchmark).

The browser decoder retains the established fixed 64-event chunking; Python uses the full prefix. Per-graph numerical parity does not assert identical complete sampled charts across these context strategies, different resamplers or random draws. This release establishes model identity and conditioning correctness, not human chart quality or global playability. Public Pages hosts browser inference only; it does not deploy the Python backend.
