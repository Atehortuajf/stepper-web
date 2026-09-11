# Stepper editor

A browser editor for four-panel StepMania charts, with local ONNX generation and an optional Python backend. Start with [MVP_HANDOFF.md](MVP_HANDOFF.md) and [current verification status](docs/mvp/STATUS.md).

The active stabilization branch is `mvp/p0-stabilization-2026-09-11`. The public Pages site does not automatically reflect this branch.

## Run the editor

From this repository:

```sh
cd frontend
npm ci
npm run dev
```

Open the address printed by the dev server. Import an SM/SSC chart and its audio, edit or request a generated region, review the proposal, and export SSC to preserve chart-specific timing. The browser uses bundled historical ONNX weights; these have not been retrained with the corrected core labels. Rule checks are heuristic and do not guarantee human playability.

## Verify

```sh
cd frontend
npm test
npm run build
```

For the cross-runtime DSP comparison, set `STEPPER_TEST_PYTHON` to a Python executable with the backend dependencies. The optional test reports a skip if no such environment is configured. See [inference notes](docs/mvp/inference-handoff.md) and [independent export smoke](docs/mvp/independent-export-smoke.md) for additional checks.

## Optional local backend

Install the sibling [Stepper core](https://github.com/Atehortuajf/Stepper) in the same Python environment, then from the web repository:

```sh
python -m pip install -e ../Stepper
python -m pip install -r backend/requirements.txt
python -m backend.app.main
```

The default listener is localhost. Use `STEPPER_WEIGHTS_PATH` for a chosen checkpoint. Missing weights or failed neural inference produce errors; empty predictions stay empty. Rule-based generation requires explicit `force_fallback`. Synthetic checkpoints are labelled as such. Neural requests need valid audio and a consistent timing contract.

```sh
OMP_NUM_THREADS=2 python -m pytest backend/tests -q
```

This backend is a local development component; public service deployment needs separate authentication, request limits and operational work.

## Continue the project

Both repositories contain current status, focused handoff notes and reproducible checks. Old orchestration documents and simulated figures are historical context, not release evidence. The core repository contains the research claim ledger and corrected-data runbook. No new training, study or public deployment was performed during this engineering pass.
