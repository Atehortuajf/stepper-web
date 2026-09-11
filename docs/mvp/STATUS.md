# MVP implementation status

Checkpoint: 2026-09-11. Branch: `mvp/p0-stabilization-2026-09-11`. Pushing this branch does not deploy the public site.

## Accepted checkpoints

- `779724c`: metadata, escaping, explicit/inherited chart timing and time-signature export preservation. Independent engine suite: 50 tests passed.
- `0984c79`: document/chart-scoped history; audio attachment preserves imported charts; initial timing edits preserve later events; proposals bound to original revision/range; hold-safe region replacement; portable M2 audio fixture and mobile Open. Independent editor checks: 29 transaction/App/conditioning tests plus 21 M2 tests passed; production build passed.

## Final accepted increments

- `98d6cdd`: shared browser/Python mel bounds, explicit sample rate and slice origin, authored tick timestamps, integer-stereo normalization, consistent difficulty/peak selection, explicit bad-input/model errors and truthful model provenance. Backend defaults to localhost.
- `40307af`: cross-runtime feature tensor comparison and tests for the new explicit API behavior.
- `b8a0437`: reusable third-party SM/SSC parser smoke scripts.
- `6296bb1`: atomic hold endpoint edits; unsafe paste rejected; exact full-song display and refreshed waveform duration; attached audio source and per-chart MUSIC mismatch checks; unsaved-close guard; global timing invalidates all pending chart proposals; heuristic results labelled Rules passed/Review needed.

## Final verification

Code checkpoint `6296bb1`; sibling core code checkpoint `fa7e6ea`.

- `npm test`: **207 tests passed** across 19 files; no skipped tests in this configured environment.
- `npm run build`: TypeScript and Vite production build passed.
- Backend full suite: **35 passed in 1.80s**, two upstream deprecation warnings. Command from web root: `PYTHONPATH=../Stepper OMP_NUM_THREADS=2 ../audit-venv/bin/python -m pytest backend/tests -q`.
- Full DSP tensor fixture: 12,288 elements, mean absolute error 0.00005444095, max 0.01984133; limits 0.002 and 0.05. See inference handoff for scope/resampling differences.
- `simfile==2.1.1` strict parser independently accepted generated SM and SSC; see independent-export-smoke.md for exact commands.
- Browser with real bundled ONNX: timing edit/undo restored BPM/offset; two-chart import then audio attach retained authored rows; generated a proposal, accepted it, and undo restored four authored rows. One observed worker generation was 274.7ms, not a benchmark. Final source/duration/range check displayed fixture.wav, 4-second waveform and 0.00–8.38 beats with authored BPM change.
- Sibling core full suite: 268 passed; real synthetic-data ingestion and all-shard audit passed without training.

TestClient stalled under the filesystem/socket sandbox but ran normally outside it. This was not a model-initialization failure. For fresh-machine setup, use README.md; no hardcoded previous-machine audio fixture is required. Set `STEPPER_TEST_PYTHON` for the optional full cross-runtime comparison.

## Remaining limits

The engineering P0 pass is complete; all agents are idle. Existing model weights predate corrected training in the core repository. Rule/solver output is heuristic and does not prove human playability. Third-party parsing is distinct from full game playback testing. Undo history is intentionally cleared before a global timing edit to avoid stale chart snapshots reverting newer shared timing; autosave/crash recovery is not implemented. Browser linear resampling differs in filtering quality from Python's resampler. Large full-song generation may need chunking/performance work.

The core claim ledger and optional overnight runbook define remaining research work. Corrected corpus rights/deduplication, new training and held-out evaluation, baseline comparisons, and final author review remain necessary before research claims. Public hosting and backend exposure are separate release steps; no deployment was performed here.

Observed verification runtime: Node 22.14.0, npm 11.5.2, Python 3.12.14, torch 2.14.0+cpu, torchaudio 2.11.0+cpu, NumPy 2.5.3. Use dependency-supported versions on a fresh machine; these are observations, not a training environment lock.
