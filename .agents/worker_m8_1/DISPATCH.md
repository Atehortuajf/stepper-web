# Dispatch Assignment: Milestone M8 — Qualitative Model Validation & Visual Figure Generation

- **Role**: Worker (Qualitative Model Validation & Visual Figure Generation)
- **Working Directory**: `/Users/ate/Projects/stepper-web/.agents/worker_m8_1`
- **Authoritative Request**: `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (read this first!)
- **Survey Findings**: `/Users/ate/Projects/stepper-web/.agents/survey_qualitative_1/handoff.md` (read this for complete data and figure specs!)
- **Ablation Data**: `/Users/ate/Projects/stepper-web/data/precached/itl_tournament/ablation_report.md` and `ablation_metrics.json` (already downloaded from Google Drive)
- **Local Tournament Pack**: `/Users/ate/Library/Application Support/ITGmania/Songs/ITL Online 2026` and fallback fixtures in `/Users/ate/Projects/stepper-web/tests/fixtures/`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Exclusively Owned Files:
- `scripts/generate_comparison_figures.py`
- `output/figures/*`
- `docs/figures/*`
- `docs/qualitative_evaluation_report.md`
- `output/qualitative_evaluation_report.md`

## Objectives:
1. Copy or deploy the 7 publication figures (`fig1` through `fig7`) from `/Users/ate/Projects/Stepper/output/figures/` (or `/Users/ate/Projects/Stepper/docs/paper/figures/`) into both `/Users/ate/Projects/stepper-web/output/figures/` and `/Users/ate/Projects/stepper-web/docs/figures/`.
2. Implement `scripts/generate_comparison_figures.py` using matplotlib/seaborn (300 DPI) to render the 4 comparative figures specified in `survey_qualitative_1/handoff.md`:
   - `rhythmic_alignment_comparison.png`: Waveform, spectral flux with 48-tick grid, Bresenham phase accumulation vs naive truncation drift, and transient-aligned step placements across 16 beats.
   - `foot_parity_ribbon_comparison.png`: Authentic Cel noteskin color-coded notes, Left Foot (#00b0ff), Right Foot (#ff3366), Bracket (#f59e0b) ribbons, comparing Tournament Ground Truth vs Stepper Production Model vs Unmasked (No-FSM) double-step traps.
   - `technique_distribution_comparison.png`: Quantitative distribution of crossovers, footswitches, brackets, and jacks across Low (M7-9), Mid (M10-12), and High (M13-15) tiers.
   - `pad_kinematics_trajectory.png`: 2D arcade pad schematic showing player foot positions, center of mass, and torso angle rotation ($\theta$) under crossovers and brackets.
3. Save all 4 high-resolution figures into both `output/figures/` and `docs/figures/`.
4. Run the benchmark calibration across the 16 ITL tournament benchmark charts (using `/Users/ate/Projects/Stepper/.venv/bin/python3` or system python).
5. Write the comprehensive `docs/qualitative_evaluation_report.md` (and copy to `output/qualitative_evaluation_report.md`) per the 5-section rubric in `survey_qualitative_1/handoff.md`:
   - Executive summary and evaluation scope.
   - 4 Evaluation dimensions: Rhythmic Fidelity, Density Collapse, Biomechanical Safety, and Tournament Standard Adherence.
   - 16-song empirical comparative benchmark table.
   - Failure mode taxonomy (case studies of density collapse, double steps, and off-beat drift).
   - Summary and charting guidelines.
6. Write your handoff report to `/Users/ate/Projects/stepper-web/.agents/worker_m8_1/handoff.md` and report back via send_message.
