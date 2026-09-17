# Generation validity release — September 17, 2026

The existing epoch-12 model now decodes with explicit hold closure and preserves its recent chord history across the browser's 64-event decoder windows. The checkpoint, ONNX graphs and schema-3 model identity are unchanged. These are inference/editor fixes; chord coherence and human playability still require separate assessment.

## Changes and reasons

- The FSM previously tracked active holds without requiring an empty state at the end. It now reserves enough remaining predicted events to close every hold/roll, and the final event must leave no held panels. No synthetic tail or extra placement tick is appended. Mines on a held panel are also excluded.
- Browser inference previously reset chord history at each 64-event boundary. Worker and main-thread runtimes now use a rolling causal window of recent generated chords with aligned conditioned/null audio features and timing. Unit tests cover steps 63, 64 and 65.
- Fractional generation ranges now retain their exact exclusive end. Only audio feature coverage rounds up; placement ticks are clipped before decoding and hold budgeting. Previously trimming a rounded-up result could remove a release.
- Sampling now draws only from finite legal candidates and reports a failure when none exists. A default Left token or a zero-probability masked candidate is never used as an emergency fallback.
- The editor validates the proposed merged chart before showing a preview, and validates again on acceptance. Taps/mines under an active hold, zero-duration holds, overlapping heads, orphan tails and unclosed holds are rejected.
- Browser parity had a false negative for an adjacent two-panel held bracket plus a tap by the other foot. Multi-held rows now use the general candidate generator. The same fixture passes the core Viterbi solver.
- Optional backend parity rejects malformed hold topology with HTTP 422 instead of inventing missing releases at the last row.

## Verification

- Frontend: **227 tests passed**, production build passed. Changed-file lint exited successfully with four existing App React warnings; the full vendor-inclusive lint history is unchanged.
- Optional backend: **51 tests passed** using the actual selected checkpoint on CPU, including REST/WebSocket fractional span preservation, parity topology rejection, and compatibility with imported lift/fake/keysound symbols. The solver accepts those imported symbols but does not model their mechanics.
- Sibling core: **325 tests passed**, including the selected checkpoint and graph parity checks.
- Actual production-build browser smoke: worker-WASM generation → accept → undo passed both for the default 16-beat demo selection (16 → 1 → 16 rows) and full demo audio at threshold 0.25 (222.33 displayed beats; 16 → 5 → 16 rows). No console warnings/errors. These small synthetic-demo outputs verify the workflow, not dense generation quality or the 64-event boundary; that boundary is covered by deterministic tests.
- The core validation-only structural probe used the original fixed 48-window validation selection and unchanged weights: **1,773 events, 90 hold/roll heads, 90 releases, zero topology errors**. It is a regression probe, not a new held-out quality estimate. All 48 generated windows also passed the core Viterbi solver using their own meters and BPM schedules. This is heuristic feasibility, not player validation. The private core repository contains the full outputs and source/checkpoint/selection hashes; no private examples are copied here.

## Limits and handoff

Symbolic validity does not establish good chord choices or comfortable movement. Viterbi remains a diagnostic, not a universal guarantee or hard acceptance gate. The core V8 heuristic has known false positives on feasible hold-plus-tap patterns and was intentionally not promoted to a gate. The editor still refuses region replacements that would break existing boundary-spanning holds.

Original paper results and frozen test artifacts remain unchanged and refer to their recorded source/policy. The default generation policy has changed; future comparisons must explicitly distinguish it from those historical raw results. This release does not train or select a new model.

For recovery, use this repository's `mvp/p0-stabilization-2026-09-11` branch with core `train/corrected-2026-09-16`. Reproduce frontend checks with `npm test` and `npm run build` in `frontend`; backend checks require the sibling core package and selected checkpoint. See [deployment record](DEPLOYMENT.md) for the separately verified public artifact identity. Source-branch pushes alone do not publish Pages.

Backend verification uses `STEPPER_WEIGHTS_PATH=../Stepper/runs/meter-2026-09-16/checkpoints/best_model.pt STEPPER_DEVICE=cpu OMP_NUM_THREADS=2 PYTHONPATH=../Stepper ../audit-venv/bin/python -m pytest backend/tests -q` from the web root. Without the weights variable, the tests use a randomly initialized fixture; that separate run recorded 50 passes and one pre-existing latency-budget failure. The release-checkpoint run passed all 51 tests in 5.69 seconds.
