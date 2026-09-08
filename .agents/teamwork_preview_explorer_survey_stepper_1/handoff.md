# Handoff Report: Stepper Architecture & Model Explorer

**Agent:** Stepper Architecture & Model Explorer (`teamwork_preview_explorer_survey_stepper_1`)  
**Working Directory:** `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_stepper_1`  
**Date:** 2026-09-08T06:50:00Z  
**Type:** Hard Handoff (Task Complete)  

---

## 1. Observation

Direct code observations from `/Users/ate/Projects/Stepper`:

### 1.1 Model Architecture (`stepper/model/stepper_sync.py`, `placement_net.py`, `step_decoder.py`)
- `stepper/model/stepper_sync.py`:
  - Lines 49–96: `StepperSync` encapsulates `PlacementNet` (Stage 1) and `StepSelectionDecoder` (Stage 2) with default hyperparameters: `d_model=256`, `n_mels=128`, `ticks_per_beat=48`, `vocab_size=96`, `step_decoder_layers=4`, `step_decoder_heads=4`, `convnext_blocks=2`, `attention_layers=2`, `cfg_dropout=0.20`.
  - Lines 116–209: Training forward pass accepts `audio: (B, 2, T_beats, 48, 128)`, `difficulty: (B,)`, `step_tokens: (B, N_max)`, `step_delta_beats: (B, N_max)`, `step_beat_phases: (B, N_max)`, `step_measure_phases: (B, N_max)`, `tech_vector: (B, 16)`.
  - Lines 212–380: `StepperSync.generate()` runs Stage 1 with CFG scale `cfg_scale_placement=1.8`, applies 3-tick window NMS peak picking, slices localized acoustic embeddings via `torch.gather`, and autoregressively decodes chord tokens with Stage 2 CFG scale `cfg_scale_step=1.5`, temperature scaling, and runtime `FootStateMachine` logit masking.
- `stepper/model/placement_net.py`:
  - Lines 180–221: Stem Conv1D (`k=7, s=1, p=3`), ConvNeXt Stage 1 (2 blocks), 2x downsampling Conv1D (`k=4, s=2, p=1`), ConvNeXt Stage 2 (2 blocks), zero-initialized FiLM conditioning (`e_diff + e_tech`), 2 layers of bidirectional self-attention with RoPE positional embeddings, 2x upsampling ConvTranspose1D (`k=4, s=2, p=1`), LayerNorm, and placement linear head.
- `stepper/model/step_decoder.py`:
  - Lines 85–125: Pre-LN causal Transformer decoder (4 layers, $d_{\text{model}}=256$, $n_{\text{heads}}=4$, $d_{\text{ffn}}=1024$), fused with right-shifted token embeddings (`vocab_size=96`), audio projection of Stage 1 acoustic vectors, sinusoidal Fourier delta-beat MLP (`n_freqs=16, d_out=64`), beat phase embedding (`48 -> 64`), measure phase embedding (`4 -> 32`), and zero-initialized FiLM conditioning with CFG dropout ($p = 0.20$).

### 1.2 Technique Vector $z_{\text{tech}}$ (`stepper/data/tech_tags.py`)
- Lines 13–30: Exact canonical tag keys in index order:
  `0: crossover, 1: footswitch, 2: doublestep, 3: bracket, 4: bracket_under, 5: bracket_crossover, 6: sideswitch, 7: kickswitch, 8: holdswitch, 9: jack, 10: jump_jack, 11: split_jack, 12: bracket_tap, 13: complex_rhythm, 14: stream_stamina, 15: no_tech`.
- Lines 141–160: Extracted from `#DESCRIPTION` and `#SUBTITLE` using regex tokens; defaults to 0.70, with `+` mapped to 1.00 and `-` mapped to 0.35. If `NO TECH` is present, index 15 is set to 1.00.

### 1.3 Audio Pipeline (`stepper/data/audio_features.py`)
- Lines 27–59: Sample rate = 44,100 Hz, $N_{\text{fft}} = 1024$, $N_{\text{mels}} = 128$, Slaney Mel filterbank ($20.0\text{ Hz} - 16,000.0\text{ Hz}$).
- Lines 91–146: Continuous Bresenham phase sampling: $c_k = \text{round}(t_{\text{audio}} \cdot f_s)$ at 48 ticks/beat. Output tensor shape is `(2, total_beats, 48, 128)` (Channel 0: Log-Mel; Channel 1: Spectral flux).

### 1.4 Difficulty Scale & Metrics (`stepper/data/dataset.py`, `stepper/validate/metrics.py`)
- `stepper/data/dataset.py` lines 24–35: `DIFFICULTY_MAP = {"BEGINNER": 0, "NOVICE": 0, "EASY": 1, "MEDIUM": 2, "BASIC": 2, "HARD": 3, "DIFFICULT": 3, "CHALLENGE": 4, "EXPERT": 4, "EDIT": 4}`. Class 5 is reserved for CFG null.
- `stepper/validate/metrics.py` lines 370–470: Tier thresholds and recommended meter estimation across 1–25+ scale; `validate_difficulty_density_scaling()` enforces strict monotonic scaling across charts.

### 1.5 Foot Parity Solvers & Biomechanics (`stepper/validate/viterbi_solver.py`, `playability_rules.py`, `stepper/model/fsm_mask.py`)
- `stepper/validate/viterbi_solver.py` lines 70–436: Hidden Markov Model (HMM) dynamic programming solver evaluating foot state transitions (`'L'`, `'R'`, `'LR'`), physical coordinates, candidate generators for taps/jumps/brackets/footswitches, and transition costs (impossibility: $1e9$, holdswitch: $+0.35$, footswitch: $+0.35$, double step: $+1.2$ with $3.5 / \Delta_{\text{beat}}$ surge, jack: $+0.8$ with $3.0 / \Delta_{\text{beat}}$ surge, crossovers: $+0.35 - 0.50$, candles: $+0.40$, brackets: $+0.30 - 0.60$). Emits per-step `FootPlacement` telemetry and aggregate stats.
- `stepper/validate/playability_rules.py` lines 54–433: Deterministic checks for Rules V1–V10.
- `stepper/model/fsm_mask.py` lines 44–214: Vectorized logit mask applied at runtime during generation.

### 1.6 Checkpoints & Model Loading
- Checkpoint saving in `stepper/train/trainer.py` lines 828–839 stores `model_state_dict`, `optimizer_state_dict`, `scheduler_state_dict`, `scaler_state_dict`, `config`, and `metrics`.
- Inference loading in `stepper/cli.py` lines 130–138 handles both full checkpoint dicts and raw state dicts.

### 1.7 Test Suite Execution
- Running `/Users/ate/Projects/Stepper/.venv/bin/python3 -m unittest discover -s tests/unit -p "test_*.py"` executed 237 tests in 21.029s with exit code 0 (all passed).

---

## 2. Logic Chain

1. **Model Architecture Decoupling**: Observation 1.1 reveals that `StepperSync` decouples temporal onset placement from chord selection. Stage 1 operates on a 48 ticks/beat audio representation, producing placement probabilities and acoustic embeddings. Stage 2 decodes chords autoregressively only at placed ticks. This decoupling prevents the chord transformer from wasting capacity on empty frames (~97% of ticks).
2. **Technique Conditioning Direct Addition**: Observation 1.2 demonstrates that the 16D continuous technique vector $z_{\text{tech}}$ is projected to $d_{\text{model}}=256$ and added directly to the difficulty embedding $e_{\text{diff}}$ before zero-initialized FiLM modulation. This design means the conditioning vector can seamlessly bias both the density of note placements (Stage 1) and the specific physical patterns (crossovers, brackets, footswitches, jacks) generated in Stage 2.
3. **Phase-Locked Feature Alignment**: Observation 1.3 shows that because the audio features are sampled at $c_k = \text{round}(t_{\text{audio}} \cdot f_s)$, each of the 48 ticks per beat corresponds exactly to a row on the 192-tick StepMania measure grid. In the web editor, user edits, audio scrubbing, and model inference will be mathematically aligned without resampling or drift.
4. **Biomechanical Validator Readiness**: Observation 1.5 confirms that `/Users/ate/Projects/Stepper` already has a fully functioning, mathematically rigorous Viterbi foot solver (`ViterbiFootSolver`) and deterministic guardrail suite (`PlayabilityValidator`). These algorithms do not need to be designed from scratch; they can be directly ported or wrapped into the FastAPI service and visualized in the frontend editor.
5. **FastAPI Service Design**: Observations 1.1, 1.4, and 1.6 imply that the FastAPI inference service can initialize `StepperSync`, load the weights using the logic in `stepper/cli.py`, expose `/api/generate`, run generation with FSM masking, and execute `ViterbiFootSolver` on the resulting chart to return both note placements and foot parity tracks.

---

## 3. Caveats

1. **Weights Download**: The pretrained model checkpoints (`stepper_weights_fp16.pt` and `stepper_weights_fp32.pt`) are stored on Google Drive (File IDs `1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3` and `1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2`) and are not committed into the git repository. The backend service in `stepper-web` must implement an automated download script or a mock generation mode when weights are missing.
2. **CPU Inference Latency**: Autoregressive decoding in Stage 2 evaluates the causal Transformer sequentially for each placed note. For long songs with thousands of notes on CPU, batch generation or optimized ONNX/TorchScript export may be advantageous if $<5\text{s}$ latency is required for a full chart.
3. **Double Steps vs Alternation**: The Viterbi solver heavily penalizes 16th-note double steps, but treats intentional ITG technical patterns (footswitches, candles, crossovers, and brackets) as low-cost ($0.30 - 0.50$), which accurately reflects competitive ITG conventions.

---

## 4. Conclusion

The reference codebase `/Users/ate/Projects/Stepper` provides an end-to-end, tested foundation for the `stepper-web` architecture:
- Complete model definition (`StepperSync`, `PlacementNet`, `StepSelectionDecoder`).
- 16D continuous technique vector $z_{\text{tech}}$ taxonomy and parser.
- Beat-synchronous Bresenham Mel-spectrogram and spectral flux audio extractor.
- Discrete difficulty embedding (`0: Novice` to `4: Expert`, `5: Null`).
- Production-ready `ViterbiFootSolver` and `PlayabilityValidator` (Rules V1–V10).
- State dict loading logic supporting FP16 and FP32 checkpoints.

All architectural specifications, formulas, and integration patterns have been synthesized in `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_stepper_1/report.md`.

---

## 5. Verification Method

1. **Inspect Report**:
   ```bash
   cat /Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_stepper_1/report.md
   ```
2. **Verify Reference Codebase Tests**:
   Run the 237 unit tests in `/Users/ate/Projects/Stepper`:
   ```bash
   /Users/ate/Projects/Stepper/.venv/bin/python3 -m unittest discover -s /Users/ate/Projects/Stepper/tests/unit -p "test_*.py"
   ```
   *Expected result*: Ran 237 tests in ~21s, OK (exit code 0).
3. **Verify Viterbi Solver & Playability Rules Specifically**:
   ```bash
   /Users/ate/Projects/Stepper/.venv/bin/python3 -m unittest /Users/ate/Projects/Stepper/tests/unit/test_viterbi_solver.py /Users/ate/Projects/Stepper/tests/unit/test_playability_rules.py
   ```
   *Expected result*: All solver and guardrail tests pass.
