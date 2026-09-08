# DISPATCH: Stepper Architecture & Model Explorer

**Agent Working Directory**: /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_stepper_1
**Role**: Stepper Architecture & Model Explorer
**Original User Request**: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md
**Reference Codebase**: /Users/ate/Projects/Stepper

## Objectives
1. Investigate the reference codebase at `/Users/ate/Projects/Stepper`.
2. Inspect `stepper/model/stepper_sync.py`, `stepper/data/tech_tags.py`, and other key modules.
3. Determine:
   - Model architecture, layer dimensions, PyTorch checkpoint structure.
   - Exact audio feature extraction pipeline (sample rate, mel-spectrogram parameters, hop length, n_fft, n_mels).
   - Input tensors and conditioning vectors: exact definitions, order, names, and ranges of the 16-dimensional `z_tech` vector.
   - Difficulty level representation (1-25+ scale, Novice to Expert).
   - Output format: predicted note placements, chord classifications, logits.
   - Check if there are existing Viterbi / foot parity solvers, transition costs, or biomechanical algorithms in `/Users/ate/Projects/Stepper`.
4. Write your comprehensive analysis report to `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_stepper_1/report.md` and write a self-contained `handoff.md`.
5. Send a completion message back to the orchestrator.
