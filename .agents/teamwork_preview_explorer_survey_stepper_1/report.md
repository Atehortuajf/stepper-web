# Stepper Architecture & Model Exploration Report

**Agent:** Stepper Architecture & Model Explorer  
**Working Directory:** `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_explorer_survey_stepper_1`  
**Reference Codebase:** `/Users/ate/Projects/Stepper`  
**Date:** September 2026  

---

## Executive Summary

A comprehensive investigation was conducted on the reference codebase at `/Users/ate/Projects/Stepper` to inform the implementation of the `stepper-web` application (full-stack ArrowVortex-grade editor with Stepper AI inference and biomechanical playability validation).

### Key Discoveries
1. **Model Architecture (`StepperSync`)**: A decoupled, two-stage neural pipeline:
   - **Stage 1 (`PlacementNet`)**: 1D ConvNeXt stem + temporal 2x downsampler + 2x 1D ConvNeXt blocks + FiLM conditioning + 2-layer Bidirectional RoPE Transformer Attention + 2x ConvTranspose1D upsampler. Predicts 48 binary placement logits per beat (`(B, T_beats, 48)`) and emits localized acoustic context maps (`(B, T_ticks, 256)`).
   - **Stage 2 (`StepSelectionDecoder`)**: 4-layer Pre-LN Causal Transformer decoder operating over the 96-chord ITG vocabulary. Fuses right-shifted token embeddings, gathered acoustic representations, multi-scale Fourier sinusoidal delta-beat intervals, 48-slot beat phase, 4-slot measure phase, and difficulty + technique FiLM conditioning with Classifier-Free Guidance (CFG) dropout ($p = 0.20$).
2. **Technique Conditioning Vector ($z_{\text{tech}}$)**: An authoritative 16-dimensional continuous feature vector defined in `stepper/data/tech_tags.py` with canonical indices:
   `[0: crossover, 1: footswitch, 2: doublestep, 3: bracket, 4: bracket_under, 5: bracket_crossover, 6: sideswitch, 7: kickswitch, 8: holdswitch, 9: jack, 10: jump_jack, 11: split_jack, 12: bracket_tap, 13: complex_rhythm, 14: stream_stamina, 15: no_tech]`.
3. **Audio Feature Pipeline (`AudioFeatureExtractor`)**: Operates at **44,100 Hz** mono with a 1024-point periodic Hann STFT and 128 Slaney Mel filterbanks. Crucially, it does **not** use a fixed hop size; it uses **Continuous Bresenham Phase Sampling** locked to 48 ticks/beat (192 ticks per 4/4 measure) with zero cumulative drift over infinite track lengths ($\le 0.01134\text{ ms}$ max phase error). Output tensor shape is `(2, T_beats, 48, 128)`, where Channel 0 is Log-Mel and Channel 1 is half-wave rectified spectral flux.
4. **Difficulty & Meter Scale**:
   - Model conditioning utilizes integer indices `[0, 5]` (`0: Novice, 1: Easy, 2: Medium, 3: Hard, 4: Expert, 5: Unconditional / CFG Null`).
   - Simfile mapping: Beginner (1), Easy (4), Medium (7), Hard (9), Challenge/Expert (12+), scaling seamlessly onto the 1–25+ ITG meter scale.
   - Comprehensive rule-based and monotonic density metrics exist in `stepper/validate/metrics.py`.
5. **Existing Biomechanical & Foot Parity Solvers in `/Users/ate/Projects/Stepper`**:
   - `stepper/validate/viterbi_solver.py`: A complete Hidden Markov Model (HMM) Viterbi foot-placement solver evaluating foot state transitions (`'L'`, `'R'`, `'LR'`), physical pad geometry coordinates, adjacent bracket pairs, footswitching, holdswitches, and jack speeds with explicit cost penalties.
   - `stepper/validate/playability_rules.py`: Deterministic guardrails (Rules V1–V10) verifying physical contact capacities, opposite bracket prohibitions (Theorem 2), hold double-booking, and mine clearances.
   - `stepper/model/fsm_mask.py`: Real-time Foot-State Machine logit masking used during autoregressive generation to forbid unplayable chords at runtime.
6. **Testing & Validation**: All 237 test cases in `/Users/ate/Projects/Stepper` pass cleanly in ~21 seconds.

---

## 1. Stepper-Sync Architecture & Layer Inspection

### 1.1 Top-Level Architecture (`StepperSync` in `stepper/model/stepper_sync.py`)

`StepperSync` coordinates `PlacementNet` (Stage 1) and `StepSelectionDecoder` (Stage 2) in dual execution modes:
- **Parallelized Teacher-Forcing Training Mode**: Forward pass accepts ground-truth audio, difficulty, technique vector, note tokens, delta-beat intervals, and phase indices to calculate Stage 1 Binary Focal + Soft-Dice loss and Stage 2 Masked Cross-Entropy loss.
- **Autoregressive Generation Mode**:
  1. Computes Stage 1 placement logits using Classifier-Free Guidance (CFG):
     $$\text{logits}_{\text{cfg}} = \text{logits}_{\text{null}} + s_{\text{placement}} \cdot (\text{logits}_{\text{cond}} - \text{logits}_{\text{null}})$$
     with default $s_{\text{placement}} = 1.8$.
  2. Applies sigmoid activation ($\sigma$) and thresholding (`threshold=0.5`).
  3. Applies **3-tick window Non-Maximum Suppression (NMS)** peak picking to locate placed ticks $\{t_1, t_2, \dots, t_N\}$.
  4. Slices localized acoustic context embeddings $h_{t_i} \in \mathbb{R}^{256}$ from Stage 1's acoustic map.
  5. Decodes chord tokens autoregressively with Stage 2 CFG ($s_{\text{step}} = 1.5$), temperature scaling, and runtime **Foot-State Machine (FSM) logit masking** to guarantee physical playability.

### 1.2 Stage 1: PlacementNet (`stepper/model/placement_net.py`)

#### Tensor Flow & Dimensions
- **Input Audio**: `(B, 2, T_beats, 48, 128)` float32.
  - Channels = 2 (Channel 0: Log-Mel spectrogram; Channel 1: Spectral flux).
  - Mel bins = 128.
  - Flattened input: `(B, L, 256)` where $L = T_{\text{beats}} \times 48$.
  - Transposed for Conv1D: `(B, 256, L)`.
- **Conditioning Inputs**:
  - `difficulty`: `(B,)` LongTensor in `[0, 5]` (`Embedding(6, 256)`).
  - `tech_vector`: `(B, 16)` FloatTensor (`Linear(16, 256)`).
  - Condition vector: $e_{\text{cond}} = e_{\text{diff}} + e_{\text{tech}} \in \mathbb{R}^{B \times 256}$.

#### Layer Breakdown
1. **Stem**: `Conv1d(in_channels=256, out_channels=256, kernel_size=7, stride=1, padding=3)`.
2. **ConvNeXt Stage 1**: 2 blocks of 1D ConvNeXt:
   - Depthwise Conv: `Conv1d(256, 256, kernel_size=7, padding=3, groups=256)`.
   - LayerNorm over channels (`d=256`).
   - Pointwise expansion MLP: `Linear(256, 1024)` -> `GELU()` -> `Linear(1024, 256)`.
   - LayerScale: learnable diagonal $\gamma$ initialized to $10^{-6}$.
   - Residual connection.
3. **Temporal Downsampling**: `Conv1d(256, 256, kernel_size=4, stride=2, padding=1)` (halves temporal resolution to 24 ticks/beat, length $L / 2$).
4. **ConvNeXt Stage 2**: 2 blocks of 1D ConvNeXt operating at 24 ticks/beat.
5. **FiLM Conditioning**:
   - `film = nn.Linear(256, 512)` (weights and biases zero-initialized).
   - Emits $\gamma, \beta \in \mathbb{R}^{B \times 1 \times 256}$.
   - Modulates downsampled features: $\tilde{x} = (1.0 + \gamma) \odot x + \beta$.
6. **Bidirectional RoPE Self-Attention Encoder**:
   - 2 layers of `BidirectionalSelfAttention`.
   - Multi-Head Attention: $d_{\text{model}} = 256$, $n_{\text{heads}} = 4$, $d_{\text{head}} = 64$.
   - **RoPE (Rotary Position Embeddings)** applied to $Q$ and $K$ heads enforcing relative temporal shift invariance.
   - Feedforward: `Linear(256, 1024)` -> `GELU()` -> `Dropout(0.1)` -> `Linear(1024, 256)`.
   - Pre-LayerNorm residuals.
7. **Temporal Upsampling**: `ConvTranspose1d(256, 256, kernel_size=4, stride=2, padding=1)` restoring exact 48 ticks/beat resolution ($L$).
8. **Output Heads**:
   - Context normalization: `LayerNorm(256)`. Emits `acoustic_map` $h \in \mathbb{R}^{B \times L \times 256}$.
   - Placement head: `Linear(256, 1)` viewed as `(B, T_beats, 48)` binary unnormalized placement logits.

### 1.3 Stage 2: StepSelectionDecoder (`stepper/model/step_decoder.py`)

#### Tensor Flow & Dimensions
- **Input Tokens**: `step_tokens` $\in \mathbb{R}^{B \times N_{\text{steps}}}$ (target chord IDs in `[0, 95]`).
  - Right-shifted with prepended `BOS_ID = 93`.
- **Acoustic Embeddings**: $h_{\text{steps}} \in \mathbb{R}^{B \times N_{\text{steps}} \times 256}$, extracted from Stage 1 `acoustic_map` via `torch.gather`.
- **Rhythm Features**:
  - `step_delta_beats`: FloatTensor `(B, N_steps)` (continuous beat delta between consecutive steps).
  - `step_beat_phases`: LongTensor `(B, N_steps)` in `[0, 47]`.
  - `step_measure_phases`: LongTensor `(B, N_steps)` in `[0, 3]`.

#### Layer Breakdown
1. **Token & Context Embeddings**:
   - `vocab_embed`: `nn.Embedding(96, 256, padding_idx=92)`.
   - `pos_embed`: `nn.Embedding(max_steps=256, 256)`.
   - `audio_proj`: `Linear(256, 256)` + `LayerNorm(256)`.
2. **Multi-Scale Rhythm Conditioning**:
   - `SinusoidalDeltaBeatMLP`: Continuous delta-beat expansion across 16 log-spaced frequencies from $1.0$ to $32.0$:
     $$\text{freqs}_i = \exp\left(\ln(1.0) + \frac{i}{15} (\ln(32.0) - \ln(1.0))\right)$$
     Fourier projection $[\sin(x \cdot \text{freqs} \cdot \pi), \cos(x \cdot \text{freqs} \cdot \pi)] \in \mathbb{R}^{32}$ -> `Linear(32, 64)` -> `GELU()` -> `Linear(64, 64)`.
   - `beat_phase_embed`: `nn.Embedding(48, 64)`.
   - `measure_phase_embed`: `nn.Embedding(4, 32)`.
   - Concatenated rhythm vector ($64 + 64 + 32 = 160$) -> `Linear(160, 256)` + `LayerNorm(256)`.
3. **Combined Representation**:
   $$u = \text{token\_emb} + \text{audio\_emb} + \text{rhythm\_emb} + \text{pos\_emb}$$
4. **Zero-Init FiLM Block with CFG Dropout**:
   - Difficulty Embedding: `diff_embed = nn.Embedding(6, 256)`.
   - Technique Projection: `tech_proj = nn.Linear(16, 256)`.
   - During training, CFG dropout ($p = 0.20$) randomly substitutes null difficulty (index 5) and zeros out `tech_vec`.
   - `film = FiLMBlock(d_cond=256, d_model=256)`:
     $$\tilde{u} = (1.0 + \gamma(e_{\text{cond}})) \odot u + \beta(e_{\text{cond}})$$
5. **Causal Transformer Decoder**:
   - 4 layers of `TransformerEncoderLayer` with Pre-LN (`norm_first=True`).
   - $d_{\text{model}} = 256$, $n_{\text{head}} = 4$, $d_{\text{ffn}} = 1024$, `GELU` activation, `Dropout(0.1)`.
   - Upper-triangular $-\infty$ causal attention mask preventing lookahead.
6. **Output Head**:
   - `out_norm`: `LayerNorm(256)`.
   - `out_proj`: `Linear(256, 96)` emitting chord classification logits over the 96-chord ITG vocabulary.

---

## 2. The 16-Dimensional Technique Conditioning Vector $z_{\text{tech}}$

Defined in `stepper/data/tech_tags.py`, $z_{\text{tech}} \in [0.0, 1.0]^{16}$ allows explicit conditioning on competitive ITG technique patterns.

### 2.1 Complete Taxonomy Table

| Index | Key Name | Shorthand | Tag Aliases | Physical & Choreographic Semantics | Typical Weight |
|:---:|:---|:---:|:---|:---|:---:|
| **0** | `crossover` | **XO** | `XO`, `XOVER`, `CROSSOVER`, `CROSSOVERS` | Turning torso sideways/backwards; opposite foot steps across center (Left to Right panel or Right to Left). | `0.35` (light) / `0.70` / `1.00` (heavy) |
| **1** | `footswitch` | **FS** | `FS`, `FOOTSWITCH`, `FOOTSWITCHES` | Rapidly alternating feet on the exact same panel at $\le 0.50$ beat intervals. | `0.35` / `0.70` / `1.00` |
| **2** | `doublestep` | **DS** | `DS`, `DOUBLESTEP`, `DOUBLESTEPS`, `DOUBLE_STEP` | Stepping on consecutive distinct panels with the same foot without alternating. | `0.35` / `0.70` / `1.00` |
| **3** | `bracket` | **BR** | `BR`, `BRACKET`, `BRACKETS` | Hitting two adjacent corner panels simultaneously with one foot (heel-and-toe). | `0.35` / `0.70` / `1.00` |
| **4** | `bracket_under`| **BU** | `BU`, `CROSSUNDER`, `BRACKET_UNDER` | Crossing under behind the standing leg into an adjacent bracket. | `0.35` / `0.70` / `1.00` |
| **5** | `bracket_crossover`| **BXF** | `BXF`, `B+XF`, `BX`, `BRACKET_CROSSOVER` | Crossing over in front of the standing leg into an adjacent bracket. | `0.35` / `0.70` / `1.00` |
| **6** | `sideswitch` | **SS** | `SS`, `SIDESWITCH`, `SIDESWITCHES` | Facing side-perpendicular to pad while footswitching between Up and Down. | `0.35` / `0.70` / `1.00` |
| **7** | `kickswitch` | **KS** | `KS`, `KICKSWITCH`, `KICKSWITCHES` | Footswitch executed with a rapid kicking motion away from the pad. | `0.35` / `0.70` / `1.00` |
| **8** | `holdswitch` | **HS** | `HS`, `HOLDSWITCH`, `HOLDSWITCHES` | Transferring an ongoing hold freeze from one foot to the other without releasing. | `0.35` / `0.70` / `1.00` |
| **9** | `jack` | **JA** | `JA`, `JACK`, `JACKS` | Consecutive rapid taps on the exact same panel with the same foot. | `0.35` / `0.70` / `1.00` |
| **10** | `jump_jack` | **JU** | `JU`, `JUMPJACK`, `JUMPJACKS` | Consecutive two-arrow jumps repeating on the same panels. | `0.35` / `0.70` / `1.00` |
| **11** | `split_jack` | **SJ** | `SJ`, `SPLITJACK`, `SPLITJACKS` | One foot repeatedly jacks on a panel while the other foot steps on alternating panels. | `0.35` / `0.70` / `1.00` |
| **12** | `bracket_tap` | **BT** | `BT`, `BRACKETTAP` | Quick bracket touch or tapping a single arrow while bracketing another. | `0.35` / `0.70` / `1.00` |
| **13** | `complex_rhythm`| **RH** | `RH`, `RHYTHM`, `RHYTHMS`, `SWING`, `SYNCOPATION`| Syncopation, swing, and non-standard subdivisions (12ths, 24ths, 32nds). | `0.35` / `0.70` / `1.00` |
| **14** | `stream_stamina`| **STR**| `STR`, `STREAM`, `STAMINA` | Uninterrupted runs of 16th notes ($\ge 16$ beats) testing cardiovascular stamina. | `0.35` / `0.70` / `1.00` |
| **15** | `no_tech` | **No Tech**| `NOTECH`, `NO TECH`, `CLEAN` | Strict pure alternation without technical moves; zeroes out tech expectations. | `1.00` (binary active) |

### 2.2 Extraction & Normalization Semantics
- **String Parsing**: Regex `B\+XF[\+\-]?|[A-Za-z]+[\+\-]` scans `#DESCRIPTION` and `#SUBTITLE`.
- **Modifier Scaling**:
  - Unmodified tag (e.g. `FS`, `BR`): `0.70`
  - Suffix `+` (e.g. `FS+`, `XO+`): `1.00` (heavy concentration)
  - Suffix `-` (e.g. `FS-`, `XO-`): `0.35` (light or incidental)
  - If `NO TECH` or `NOTECH` appears: index 15 is set to `1.00` and others default to `0.0`.
- **Model Integration**:
  - In `PlacementNet`: `e_tech = self.tech_proj(tech_vector)` (`Linear(16, 256)`).
  - In `StepSelectionDecoder`: `tech_emb = self.tech_proj(tech_vec)` (`Linear(16, 256)`).
  - Both stages add `e_tech` directly to the difficulty embedding before feeding into FiLM modulation.

---

## 3. Audio Feature Extraction Pipeline (`stepper/data/audio_features.py`)

### 3.1 Parameters & Invariants
- **Sample Rate ($f_s$)**: `44,100 Hz` mono.
- **Window Length / FFT Size ($N_{\text{fft}}$)**: `1024` samples ($\approx 23.22\text{ ms}$).
- **Window Function**: Periodic Hann window (`torch.hann_window(1024, periodic=True)`).
- **Mel Filterbank**:
  - $N_{\text{mels}} = 128$ bands.
  - $f_{\text{min}} = 20.0\text{ Hz}$, $f_{\text{max}} = 16,000.0\text{ Hz}$.
  - Scale: **Slaney-normalized** triangular filterbank (`norm="slaney"`, `mel_scale="slaney"` via `torchaudio.functional.melscale_fbanks`).
- **Dynamic Range Compression**:
  $$S_{\text{log}} = \ln(1.0 + 10^4 \cdot S_{\text{mel}})$$
- **Spectral Flux (Channel 1)**: Positive half-wave rectified onset flux between consecutive temporal frames:
  $$\text{Flux}_k = \text{ReLU}(S_{\text{log}, k} - S_{\text{log}, k-1})$$
  with $\text{Flux}_0 = \mathbf{0}$.

### 3.2 Continuous Bresenham Phase Sampling
Traditional music models use a fixed hop size $H$ (e.g., 512 samples), causing severe phase drift over a 2-to-3 minute song because musical beats do not align with integer audio sample steps.

Project Stepper uses **Continuous Bresenham Phase Sampling**:
1. Grid resolution is fixed to **48 ticks per beat** (192 ticks per 4/4 measure).
2. For tick $k \in \{0, 1, \dots, T_{\text{total\_ticks}} - 1\}$, the musical beat is:
   $$\text{beat}_k = \text{start\_beat} + \frac{k}{48.0}$$
3. Using `TimingEngine.beat_to_seconds(beat_k)` (which accounts for BPM changes, stops, delays, and warps) or $t_{\text{audio}} = \text{beat}_k \cdot \frac{60}{\text{BPM}} - \text{offset}$, the exact continuous audio time $t_{\text{audio}}$ is computed.
4. Target frame center in discrete audio samples:
   $$c_k = \text{round}(t_{\text{audio}} \cdot f_s)$$
5. Slices audio within $[c_k - 512, c_k + 512]$.
6. **Error Bound**: Maximum timing error $|e_k| \le 0.5 \text{ sample} = \frac{0.5}{44,100} \approx 0.01134\text{ ms}$.
7. **Zero Cumulative Drift**: The rounding occurs independently per tick relative to absolute song time.
8. Output tensor shape: `(2, T_beats, 48, 128)`:
   - Channel 0: Log-Mel spectrogram (128 bins).
   - Channel 1: Spectral flux (128 bins).

---

## 4. Difficulty Representation & Metric Scaling

### 4.1 Categorical Model Conditioning
The neural model maps difficulty into 6 discrete embedding tokens (`num_difficulties = 6`):
- `0`: **Novice** (StepMania *Beginner*)
- `1`: **Easy**
- `2`: **Medium** (StepMania *Basic*)
- `3`: **Hard** (StepMania *Difficult*)
- `4`: **Expert** (StepMania *Challenge* / *Edit*)
- `5`: **Unconditional Null** (used during training with $p=0.20$ CFG dropout, and during generation for the unconditioned baseline forward pass).

### 4.2 StepMania / ITG Meter Scale (1–25+)
In StepMania `.sm` and `.ssc` files, difficulty is represented both as a named tier string (`#DIFFICULTY`) and a numerical integer meter (`#METER`):

| Difficulty Tier | Default Meter | Typical Meter Range | Max Rhythm Subdiv | Hand / Quad Allowed? | NPS Ceiling |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Novice / Beginner** | 1 | 1 – 3 | 4th & 8th only | NO (0 jumps, 0 hands, 0 mines) | $\le 2.0$ NPS |
| **Easy** | 4 | 3 – 6 | 8th max | NO hands; jumps $\le 10\%$ (max 15) | $\le 3.5$ NPS |
| **Medium** | 7 | 6 – 9 | 16th (short bursts) | Hands $\le 2$; Quads NO | $\le 6.0$ NPS |
| **Hard** | 9 | 9 – 11 | 16th streams | Yes (standard tech/brackets) | $4.5 - 8.5$ NPS |
| **Expert / Challenge** | 12 | 11 – 25+ | 16th, 24th, 32nd | Yes (advanced brackets, quads, jacks) | $> 8.5$ NPS |

### 4.3 Monotonic Density Scaling (`stepper/validate/metrics.py`)
`validate_difficulty_density_scaling()` enforces monotonicity across all charts within a song:
$$\text{Novice} < \text{Easy} < \text{Medium} < \text{Hard} < \text{Expert}$$
specifically checking that:
1. `total_steps` (step row count) increases monotonically.
2. `total_arrows` (total physical hits) increases monotonically.
3. `average_nps` increases monotonically.
4. `peak_nps` (1.0-second sliding window max notes) increases monotonically.
5. `total_stream_beats` ($\ge 16$ beat 16th runs) increases monotonically.

---

## 5. Checkpoint & State Dict Structure

### 5.1 Training Checkpoint Structure (`Trainer.save_checkpoint`)
Training checkpoints (e.g. `best_model.pt`) contain a dictionary with the following keys:
```python
state = {
    "epoch": int,                          # Current training epoch
    "global_step": int,                    # Global optimizer step counter
    "model_state_dict": OrderedDict[str, Tensor], # Full model parameter weights
    "optimizer_state_dict": dict,          # AdamW parameter groups and momentum buffers
    "scheduler_state_dict": dict,          # CosineAnnealingLR state
    "scaler_state_dict": Optional[dict],   # GradScaler scale & growth tracker (if fp16)
    "best_val_loss": float,                # Best validation loss observed
    "config": dict,                        # Serialized TrainingConfig
    "metrics": dict,                       # Last validation metrics
}
```

### 5.2 Standalone Pretrained Model Weights (Inference Format)
For deployment and fast loading, model weights are saved either as the raw `model_state_dict` or inside a container dict.
- **Recommended File**: `stepper_weights_fp16.pt` (16 MB, half-precision).
- **FP32 File**: `stepper_weights_fp32.pt` (32 MB, single-precision).

### 5.3 Loading Logic in `stepper/cli.py` & Recommended FastAPI Integration
The loader in `stepper/cli.py` demonstrates standard robust weight loading:
```python
import torch
from stepper.model.stepper_sync import StepperSync

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = StepperSync().to(device)

if model_path.is_file():
    ckpt = torch.load(model_path, map_location=device)
    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        model.load_state_dict(ckpt["model_state_dict"])
    elif isinstance(ckpt, dict):
        model.load_state_dict(ckpt)
```
For FP16 checkpoints on CPU or GPU:
```python
# Convert to float32 if running CPU inference, or keep half() on CUDA
if device.type == "cpu":
    model = model.float()
model.eval()
```

---

## 6. Biomechanical Validation & Foot Parity Solvers

The reference codebase in `/Users/ate/Projects/Stepper` contains production-ready, mathematically rigorous biomechanical algorithms.

### 6.1 `ViterbiFootSolver` (`stepper/validate/viterbi_solver.py`)
An implementation of a Hidden Markov Model (HMM) dynamic programming solver over 4-panel dance charts:

#### Pad Coordinates & Geometry
- `Panel 0 (Left)`: $(-1.0, 0.0)$
- `Panel 1 (Down)`: $(0.0, -1.0)$
- `Panel 2 (Up)`: $(0.0, 1.0)$
- `Panel 3 (Right)`: $(1.0, 0.0)$

#### State Representation
Each step is assigned a tuple `(pos_L, pos_R, foot)`:
- `pos_L`: Left foot position: `None`, single panel `0..3`, or adjacent bracket pair `(p1, p2)`.
- `pos_R`: Right foot position: `None`, single panel `0..3`, or adjacent bracket pair `(p1, p2)`.
- `foot`: Which foot executed the active strike: `'L'`, `'R'`, `'LR'`, or `'None'`.

#### Candidate Generation
- **Single Taps**: Options for Left foot hitting target (Right remains at previous location), Right foot hitting target, or footswitch candidate (opposite foot takes over repeated panel).
- **Jumps (2 panels)**: Both feet jumping (`'LR'`), or single-foot bracket tap if $(p_1, p_2) \in \text{VALID\_ADJACENT\_BRACKETS}$.
- **Hands (3 panels)**: One foot brackets an adjacent pair while the other foot strikes the remaining panel.
- **Quads (4 panels)**: Both feet bracket: Left on $(0, 1)$ or $(0, 2)$, Right on $(3, 1)$ or $(3, 2)$.

#### Transition Cost Matrix
1. **Physical Impossibility ($10^9$ cost)**:
   - Left foot on Right (3) AND Right foot on Left (0).
   - Opposite single-foot brackets: $(0, 3)$ or $(1, 2)$.
   - Dropping an active hold without hitting a release.
2. **Holdswitch Transition**: $+0.35$ cost when an active hold is transferred from one foot to the other.
3. **Footswitch Transition**: $+0.35$ cost when same panel is hit by opposite foot at rapid subdivision ($\Delta_{\text{beat}} \le 0.50$).
4. **Double Steps**: $+1.2$ base cost. If $\Delta_{\text{beat}} \le 0.25$ (16th note double step), penalty surges to $+3.5 / \Delta_{\text{beat}}$.
5. **Jacks**: $+0.8$ base cost. If $\Delta_{\text{beat}} \le 0.25$, penalty is $+3.0 / \Delta_{\text{beat}}$. If $\Delta_t < 85\text{ ms}$, exponential penalty $+5.0 \cdot \exp((0.085 - \Delta_t) / 0.02)$.
6. **Crossovers**: $+0.35$ to $+0.50$ cost (encouraged and legal; flagged in telemetry as `'front'` or `'back'`).
7. **Candles**: $+0.40$ cost (Up-Down transitions across an anchored foot; legal and tracked).
8. **Brackets**: $+0.30$ cost if meter $\ge 10$, $+0.60$ cost if meter $< 10$.
9. **Physical Displacement**: $0.12 \times (\text{dist}(L_{\text{prev}}, L_{\text{curr}}) + \text{dist}(R_{\text{prev}}, R_{\text{curr}}))$.

#### Output Telemetry
Returns `ViterbiSolverResult` with:
- `is_physically_playable: bool` (`total_cost < 1e8`).
- `total_cost: float`.
- `placements: List[FootPlacement]` with detailed per-note flags: `foot`, `left_pos`, `right_pos`, `is_crossover`, `crossover_type`, `is_candle`, `is_double_step`, `is_jack`, `is_bracket`, `is_footswitch`, `is_holdswitch`.
- `stats: Dict[str, Any]` with `total_steps`, `alternation_rate`, and counts of all technique maneuvers.

### 6.2 Deterministic Guardrail Playability Rules V1–V10 (`stepper/validate/playability_rules.py`)
- **V1 (Max Simultaneous Contacts)**: Max 2 simultaneous taps without brackets. 3-arrow hands require bracket on tier $\ge 8$. 4-arrow quads require tier $\ge 12$. Tapping while 2 feet are locked in holds is FATAL.
- **V2 (Bracket Reachability / Theorem 2)**: Single foot tasked with opposite jump $(0, 3)$ or $(1, 2)$ is FATAL.
- **V3 (Hold Integrity)**: Tapping an actively held column (double-booking) is FATAL. Ghost release `'3'` with no active hold is FATAL.
- **V4 (Mine Safety Clearance)**: Mine on actively held column is FATAL. Mine with $< 0.25$ beats or $< 80\text{ ms}$ clearance from previous tap is FATAL.
- **V7 (Foot Speed Ceiling)**: Instantaneous jack speed $\ge 25\text{ NPS}$ ($\Delta_t < 40\text{ ms}$) is FATAL. Jack $> 13.33\text{ NPS}$ on tier $\le 9$ is CRITICAL.
- **V8 (Stance Stability)**: Crossed-over hold trap (tapping Column 0 while Column 3 is held, or vice versa) is CRITICAL.
- **V9 (Rest Interval Frequency)**: Novice chart unbroken stream $> 16$ beats without a 4-beat rest is a WARNING.
- **V10 (4-Panel Column Geometry)**: Must have exactly 4 columns.

### 6.3 Runtime Foot-State Machine (`stepper/model/fsm_mask.py`)
A vectorized logit-masking engine that runs at inference time inside `StepperSync.generate()`:
- Masks out special tokens (`PAD`, `BOS`, `EOS`, `UNK`, `0000`).
- Enforces difficulty gating: Novice and Easy forbid hands and quads; Medium forbids quads.
- Tracks active holds: forbids ghost releases and double booking.
- Limits contact capacity: if 2 holds active, 0 taps allowed; if 1 hold active, max 1 tap or adjacent bracket (opposite jumps masked to $-\infty$).
- Applies soft negative penalty ($-5.0$) on hyper-speed jacks ($\Delta_{\text{beat}} < 0.25$ and jack count $\ge 2$).

---

## 7. Canonical 96-Chord ITG Vocabulary (`stepper/data/vocabulary.py`)

Every 4-panel note row is bijectively mapped to an integer in $[0, 95]$:
- `0`: `0000` (Rest)
- `1 - 4`: Single taps (`1000`, `0100`, `0010`, `0001`)
- `5 - 10`: Standard jumps (`1100`, `1010`, `0101`, `0011`, `1001`, `0110`)
- `11 - 14`: 3-arrow bracketed hands (`0111`, `1011`, `1101`, `1110`)
- `15`: 4-arrow quad tap (`1111`)
- `16 - 19`: Single hold heads (`2000`, `0200`, `0020`, `0002`)
- `20 - 23`: Single roll heads (`4000`, `0400`, `0040`, `0004`)
- `24 - 27`: Single releases (`3000`, `0300`, `0030`, `0003`)
- `28 - 31`: Single mines (`M000`, `0M00`, `00M0`, `000M`)
- `32 - 43`: Tap + Hold head combinations
- `44 - 55`: Tap + Release combinations
- `56 - 61`: Double hold freeze jumps (`2200`, `2020`, etc.)
- `62 - 67`: Double releases (`3300`, `3030`, etc.)
- `68 - 79`: Hold head + Release combinations
- `80 - 91`: Tap + Roll head combinations
- `92 - 95`: Control tokens: `92: <PAD>`, `93: <BOS>`, `94: <EOS>`, `95: <UNK>`

---

## 8. Recommendations for `stepper-web` Implementation

Based on the survey of `/Users/ate/Projects/Stepper`, the following architecture is recommended for `stepper-web`:

1. **Inference Backend (`backend/`)**:
   - Create a lightweight FastAPI service that directly imports or vendors `stepper.model`, `stepper.data.audio_features`, `stepper.data.tech_tags`, `stepper.data.vocabulary`, and `stepper.validate.viterbi_solver`.
   - Implement `/api/generate`:
     - Accepts uploaded audio (or cached audio ID), BPM, offset, target difficulty (0–4 or 1–25 meter), and the 16D `z_tech` array.
     - Performs Continuous Bresenham audio extraction.
     - Runs `StepperSync.generate()` with CFG and FSM logit masking.
     - Runs `ViterbiFootSolver.solve()` on generated notes to attach foot parity annotations (`L`, `R`, `LR`), crossover indicators, and bracket flags.
     - Returns note stream, foot parity metadata, and playability metrics in $< 1.5\text{s}$ for a 16-beat chunk.
   - Implement mock inference fallback mode if checkpoint weights (`stepper_weights_fp16.pt`) are not downloaded yet, allowing instant developer onboarding.
2. **Editor Core & Playability UI (`frontend/`)**:
   - **ArrowVortex-Style Audio Canvas**: WebGL or Canvas2D spectrogram and waveform synchronized with variable BPM and stops using the exact piecewise linear timing mathematics from `stepper.timing.engine`.
   - **Rhythmic Beat Grid**: 192 rows/measure (48 ticks/beat) with canonical StepMania quantization colors (4th: Red, 8th: Blue, 12th: Purple, 16th: Yellow, 24th: Pink, 32nd: Orange, 48th: Cyan, 64th: Green, 192nd: Gray).
   - **Technique Conditioning Panel**: 16 continuous sliders for $z_{\text{tech}}$ (`crossover`, `footswitch`, `doublestep`, `bracket`, `jack`, `stream_stamina`, etc.).
   - **Biomechanical Validator Track**: Visual indicators for foot parity (`L` in blue, `R` in red, bracket in orange), transition cost heatmaps, and physical unplayability warnings powered by the Viterbi solver.
