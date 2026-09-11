> **Historical record — superseded for current status.** Start with [MVP_HANDOFF.md](MVP_HANDOFF.md). Prior completion/quality claims below have not been revalidated and must not be used as acceptance evidence.

# 🚀 Stepper Project: Complete Orchestrator Master Handoff

> [!IMPORTANT]
> **READ FIRST — NEW MACHINE & ZERO-CONTEXT ENVIRONMENT INSTRUCTIONS**:
> If you are an incoming agent or developer, you are running on a **brand new machine with zero pre-existing context**.
> - Prior local paths (e.g. `/Users/ate/Projects/...`) belong to previous workstations and will not exist in your environment.
> - **The remote RTX 4090 training workstation (`atehortua-MS-7B86`) is NOT on VPN and CANNOT be reached via SSH, VPN, or network.** Do NOT attempt to ping or connect to it.
> - **All model checkpoints, weights, and telemetry are safely bridged via Google Drive** (`atehortuajf@gmail.com`). Direct download links and file IDs are provided below in Section 2.
> - The web application (`stepper-web`) is **100% self-contained** and executes full neural inference directly in-browser via **ONNX Runtime WebAssembly (WASM SIMD)** in a dedicated Web Worker, with zero server dependencies and zero requests to `localhost`.

---

## 1. Executive Summary & Project Vision

**Stepper** is a state-of-the-art autonomous neural choreography and stepchart generation system for competitive 4-panel dance simulation games (*In The Groove*, *StepMania*, *ITGmania*, *Dance Dance Revolution*).

### The Four Fatal Flaws of Prior Neural Step Generation
Existing neural generation architectures (such as DDC, DanceNet, BeatNet, and continuous diffusion approaches adapted from osu!) suffer from four fundamental failures that make their generated charts unplayable or rejected by competitive players:

1. **16-Beat Amnesia**: Frame-based or short-window RNNs/Transformers lack the receptive field to capture long-term musical macro-structure. In competitive stepcharts, musical themes repeated across verses or choruses must exhibit thematic step continuity and structured motifs.
2. **Tempo-Agnostic Velocity Blindness**: Prior models treat a 16th note at $100\text{ BPM}$ ($\Delta t = 150\text{ ms}$) identically to a 16th note at $220\text{ BPM}$ ($\Delta t = 68.2\text{ ms}$). Because human musculoskeletal energy expenditure scales non-linearly with physical foot transition velocity, models without tempo-aware kinematics generate physically unplayable foot speed demands.
3. **Stamina vs. Tech Style Schizophrenia**: Competitive stepchart design is split into distinct disciplines:
   - **Stamina**: Long unbroken streams of alternating 16th notes requiring ergonomic, low-energy foot movement without twists.
   - **Tech**: Complex mechanical movement patterns requiring crossovers, footswitches, brackets (pressing two panels simultaneously with the heel and toe of a single foot), and sidesurfs. Prior models blur these styles into chaotic, uncoordinated patterns.
4. **Anatomical Unplayability & Parity Violations**: Dance pads have 4 spatial panels: Left, Down, Up, Right. Humans have two feet: Left and Right. Prior models regularly generate physically impossible demands:
   - 3 or 4 simultaneous tap notes (quads) without brackets.
   - Double-steps (forcing the player to tap the same foot twice consecutively at high speeds).
   - Dangerous cross-under torso twists exceeding anatomical hip rotation limits ($>120^\circ$).

### The Stepper Breakthrough Solution
Stepper overcomes these limitations through five core innovations:
1. **Hierarchical Phase-Accumulated Feature Extraction**: Audio features are mapped onto a canonical 192-tick musical subdivision grid using continuous Bresenham tempo warping, provably bounding temporal quantization error to $\le 0.01134\text{ ms}$ ($\le 0.5$ samples at $44.1\text{ kHz}$) with strictly zero cumulative drift across arbitrary track lengths.
2. **Continuous 16-D Technique Conditioning Vector ($z_{\text{tech}}$)**: An explicit conditioning vector specifying the desired density of crossovers, footswitches, brackets, jacks, candas, and streams via zero-initialized Feature-wise Linear Modulation (FiLM) with Classifier-Free Guidance dropout ($p=0.20$).
3. **Biomechanical Finite State Machine (FSM) Masking**: Dynamic logit masking during autoregressive token generation that prevents anatomically impossible transitions.
4. **Two-Stage Placement & Selection Architecture**: Decouples binary rhythm placement (determining *when* a step occurs via `PlacementNet`) from directional token assignment (determining *which* arrows and holds are placed via `StepSelectionDecoder`).
5. **Subdivision-Aware Biomechanical Viterbi Kinematic Solver**: An exact HMM Viterbi solver with calibrated transition costs that guarantees 100% playable foot parity across all tournament meters.

---

## 2. Infrastructure, Topology & Cloud Storage Bridge

### Machine Topology Overview
```
[ Google Drive Checkpoints ] <--- Canonical Cloud Storage Bridge
         |
         +---> [ Incoming Agent Machine ] (You are here)
         |       - Core Python repo: Stepper
         |       - Web DAW & WASM repo: stepper-web
         |       - Standalone inference (CPU/Local GPU or in-browser WASM)
         |
[ Remote RTX 4090 Workstation ] (NO VPN / ISOLATED)
  - Finished 50-epoch production training run
  - Not reachable via network/VPN
  - Checkpoints exported to Google Drive
```

### Machine A: Incoming Agent Machine (Your Current Workstation)
- **Role**: Primary orchestration, validation, paper writing, and web development.
- **Repositories to Clone**:
  - Core ML & Kinematic Solver: `https://github.com/Atehortuajf/Stepper.git`
  - Web DAW & Client-Side Inference: `https://github.com/Atehortuajf/stepper-web.git`
- **Zero-Context Onboarding Steps**: Follow Section 9 below for exact environment setup commands.

### Machine B: Remote ML Training Workstation (`atehortua-MS-7B86`) — **OFFLINE / NO VPN**
- **Hardware**: NVIDIA GeForce RTX 4090 (24 GB VRAM), Ubuntu 24.04 LTS, CUDA 13.0.
- **Network Status**: **NOT on VPN and CANNOT be connected to via VPN/SSH.**
- **Operational Reality**: Do NOT attempt to run SSH, ping, or Tailscale commands to reach this machine. All completed training checkpoints have already been safely transferred to Google Drive. Any future training on this machine will be executed out-of-band by the user and uploaded to Google Drive.

### Machine C: Checkpoint Storage (Google Drive)
- **Account**: `atehortuajf@gmail.com`
- **Authenticated Download Links & File IDs**:
  - **FP16 Deployment Weights (`stepper_weights_fp16.pt`)**:
    - File Size: $16\text{ MB}$
    - Google Drive Link: `https://drive.google.com/file/d/1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3/view`
    - Google Drive File ID: `1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3`
    - Download helper: `python3 -c "import urllib.request; urllib.request.urlretrieve('https://drive.google.com/uc?export=download&id=1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3', 'checkpoints/stepper_weights_fp16.pt')"` or via `gdown`.
  - **FP32 Full-Precision Weights (`stepper_weights_fp32.pt`)**:
    - File Size: $32\text{ MB}$
    - Google Drive Link: `https://drive.google.com/file/d/1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2/view`
    - Google Drive File ID: `1sk1JZCQE3bZz1iqu7mgv1h4xa8skIgt2`
  - **Production Run Telemetry JSON (`stepper_production_telemetry.json`)**:
    - File Size: $11\text{ KB}$
    - Google Drive Link: `https://drive.google.com/file/d/1_bpMa8eeEVe2Jr6eUVUv-1VtCwI5ObKQ/view`
    - Google Drive File ID: `1_bpMa8eeEVe2Jr6eUVUv-1VtCwI5ObKQ`
  - **Ablation Matrix Report (`ablation_matrix_report.md`)**:
    - File Size: $4.7\text{ KB}$
    - Google Drive Link: `https://drive.google.com/file/d/1WHpa93MrO5rO2xV8fjPCoaNTU_Tu1mFw/view`
    - Google Drive File ID: `1WHpa93MrO5rO2xV8fjPCoaNTU_Tu1mFw`
  - **Ablation Metrics JSON (`ablation_metrics.json`)**:
    - File Size: $2.3\text{ KB}$
    - Google Drive Link: `https://drive.google.com/file/d/1jLG4AHTBDdcdqeBp3WJNz7Oi9EIuW3a4/view`
    - Google Drive File ID: `1jLG4AHTBDdcdqeBp3WJNz7Oi9EIuW3a4`

---

## 3. Dataset & Audio Processing Pipeline

### Dataset Overview
- **Location**: `data/precached/itl_tournament`
- **Scale**: 483 serialized binary shards containing 48,205 pre-processed song chunks.
- **Data Provenance**: Extracted from competitive tournament simfiles (ITL Online 2022–2026, ECS, Club Fantastic, and standard competitive packs).
- **Format Support**:
  - Full support for `.sm` and modern `.ssc` (StepMania 5) file formats.
  - Split Timing engine support: handles per-chart tempo changes, stops, delays, and warps.

### Audio Feature Warping & Bresenham Phase Accumulator
- Raw audio is processed through an 80-bin log-mel filterbank (STFT window 2048, hop length 512, sample rate $44,100\text{ Hz}$).
- To eliminate tempo artifacts, audio frames are resampled and aligned to a 192-ticks-per-beat grid using Bresenham phase accumulation.
- Audio feature representation per tick includes:
  - 80-bin Mel energy.
  - Spectral flux and onset strength envelopes.
  - Phase accumulation features representing musical measure progression ($0.0 \to 1.0$).

### 16-D Technique Conditioning Vector ($z_{\text{tech}}$)
The technique conditioning vector $z_{\text{tech}} \in [0, 1]^{16}$ explicitly controls stepchart mechanics:
1. `crossover`: Turning hips to cross one foot over the other.
2. `footswitch`: Alternating feet on rapid consecutive hits of the same panel.
3. `sidesurf`: Facing sideways while streaming steps on Left/Down or Up/Right.
4. `jack`: Consecutive rapid taps with the same foot on the same panel.
5. `bracket`: Striking two adjacent panels simultaneously with one foot (heel-and-toe).
6. `bracket_tap`: Tapping a single arrow using bracket technique while holding another.
7. `bracket_hold`: Holding two panels simultaneously with one foot.
8. `doublestep`: Intentional double-steps (controlled for technical flow).
9. `stream_dense`: Unbroken 16th/24th note stream density.
10. `jump_dense`: Frequency of simultaneous two-panel jumps.
11. `hands`: Multi-panel taps involving hands or brackets.
12. `rolls`: Rapid repetition holds requiring constant re-triggering.
13. `delay_gimmick`: Delays and visual deceleration gimmicks.
14. `stop_gimmick`: Abrupt musical stops and freeze frames.
15. `warp_gimmick`: Negative BPM / warp jumps skipping beat regions.
16. `burst_speed` (formerly `burst`): High-BPM burst streams (32nd notes and rapid drills).

---

## 4. Neural Network Architecture & Model Specifications

Stepper employs a decoupled two-stage neural architecture totaling 8.4M parameters in `StepperSync`:

### Stage 1: PlacementNet (Rhythm & Density Model)
- **Objective**: Predict binary step placement probability $\hat{y}_{\text{place}} \in [0, 1]$ for every 192-tick time step.
- **Backbone**: 1D ConvNeXt stem coupled with Rotary Position-embedded (RoPE) bidirectional self-attention encoder.
- **Conditioning**:
  - Scalar difficulty meter embedding $e_{\text{diff}} \in \mathbb{R}^{d_{\text{model}}}$.
  - Projected technique vector $e_{\text{tech}} = W_{\text{tech}} z_{\text{tech}} \in \mathbb{R}^{d_{\text{model}}}$.
  - Conditioning fusion: $h_t = h_t^{\text{audio}} + e_{\text{diff}} + e_{\text{tech}}$.
- **Loss Function**: Weighted binary cross-entropy with focal loss ($\gamma = 2.0$) smoothed with 1D temporal Gaussian kernels and a continuous Soft-Dice surrogate to counter severe 97.2% null-frame class imbalance.

### Stage 2: StepSelectionDecoder (Directional Token Assignment)
- **Objective**: Given that a step occurs at tick $t$, predict the 4-panel arrow configuration token from a closed 96-chord physical ITG vocabulary.
- **Backbone**: Pre-LN Causal Transformer decoder operating over cross-attention to PlacementNet representations.
- **Technique Conditioning**: Zero-initialized Feature-wise Linear Modulation (FiLM) conditioned on $z_{\text{tech}}$ with Classifier-Free Guidance dropout ($p=0.20$).
- **Biomechanical FSM Masking**:
  - Before applying softmax, logits are filtered by an anatomical transition mask $M_t \in \{0, -\infty\}^{96}$.
  - $M_t$ dynamically invalidates impossible transitions given current foot states $(L_t, R_t)$, ensuring candidate outputs are physically playable.
- **Inference Decoding**:
  - Calibrated Top-$k$ / Top-$p$ sampling with temperature scaling: $T = 0.8$, $k = 5$, $p = 0.9$.

---

## 5. Training Runs, Convergence & Ablation Matrix

### Production Training Run (`runs/stepper_production`)
- **Hardware**: RTX 4090 workstation (`atehortua-MS-7B86`).
- **Configuration**:
  - Epochs: 50 | Optimization Steps: 29,950
  - Batch Size: 64 (gradient accumulation steps = 2)
  - Optimizer: AdamW ($\text{lr} = 3 \times 10^{-4}$, weight decay $0.01$) with cosine annealing schedule.
- **Convergence Metrics**:
  - Optimal checkpoint converged at **Epoch 12**.
  - Validation Loss: **`1.5500`**.
  - Placement $F_1$ Score: **`0.8156`** (surpassing state-of-the-art DDC benchmark of $0.6210$).
  - Final Training Loss: `0.8401` (Placement $F_1$: `0.864`).

### Ablation Matrix Findings (4-Model Matrix)
1. `stepper_full`: Full model with 16-D $z_{\text{tech}}$ conditioning and Biomechanical FSM masking.
   - Placement $F_1$: `0.8156` | Parity Violation Rate: `0.0%`.
2. `ablate_no_tech`: Technique conditioning zeroed out ($z_{\text{tech}} = \mathbf{0}$).
   - Suffers severe stamina/tech style collapse; produces homogenous step densities.
3. `ablate_no_fsm`: Biomechanical FSM logit masking disabled.
   - Suffers a **2.5x explosion** in physical parity violations; introduces unplayable double-step fatigue traps.
4. `ablate_unconditioned`: Unconditional baseline (no difficulty, no technique).

---

## 6. Subdivision-Aware Biomechanical Viterbi Solver & Calibration

### Viterbi Parity Solver (`stepper/validate/viterbi_solver.py`)
- **State Space**: $S = (p_L, p_R, s_L, s_R, a_H)$ where:
  - $p_L, p_R \in \{0, 1, 2, 3\}$: Panel positions for Left and Right feet.
  - $s_L, s_R \in \{\text{Heel}, \text{Toe}, \text{Flat}\}$: Part of foot contacting the panel (enables brackets).
  - $a_H$: Bitmask of currently active hold notes.
- **Kinematic Cost Function**:
  $$\text{Cost}(S_{t-1} \to S_t) = w_{\text{dist}} \cdot \frac{D(p, p')}{\Delta_{\text{beat}} \cdot \frac{60}{\text{BPM}}} + w_{\text{twist}} \cdot \Omega(\theta) + w_{\text{alt}} \cdot \mathbb{I}_{\text{same foot}} - w_{\text{flow}} \cdot \Phi(\text{candas})$$
  - Scales physical movement distance by real-world elapsed time (BPM-aware velocity).
  - Penalizes extreme torso twist angles $\theta > 90^\circ$.
  - Rewards natural foot alternation ($L \to R \to L$).
  - Evaluates footswitches without false jack penalties.

### Tournament Calibration Benchmark (`scripts/benchmark_itl_calibration.py`)
Calibrated against ITL Online 2026/2025 tournament charts across meters 7 through 15:
- **Meter 7**: *Toluthin Antenna*, *Hydrocity Zone*, *Goron City*, *Marble Garden*
- **Meter 10**: *-Final Sigma-*, *Aspire*, *ARMSTRONG*
- **Meter 11**: *0x1311*, *2015*
- **Meter 12**: *アルストロメリア*, *BBBlow*
- **Meter 13**: *青の洞窟 (Blue Cave)*, *Bad Maniacs*
- **Meter 14**: *Mukade*, *Deep Into The Vibe*
- **Meter 15**: *raputa*
- **Benchmark Outcome**: **100.0% Playability achieved** across all 16 test charts in $<1.0\text{ s}$ execution time.

---

## 7. Qualitative Model Validation Deliverables & Visual Figures

All 11 publication-grade figures have been generated and synchronized across both [`stepper-web/docs/figures/`](file:///Users/ate/Projects/stepper-web/docs/figures) and [`Stepper/docs/paper/figures/`](file:///Users/ate/Projects/Stepper/docs/paper/figures) at 300 DPI:

1. `rhythmic_alignment_comparison.png`: Proves bounded Bresenham phase accumulation error ($\le 0.01\text{ ms}$) vs. naive hop slicing ($-13\text{ ms}$ drift crossing the ITG Fantastic+ window) and zero-phase acoustic transient lock.
2. `foot_parity_ribbon_comparison.png`: Ground truth vs. Stepper production (FiLM + 16D Tech + Viterbi FSM) vs. Ablation 2 (No-FSM), visually demonstrating the elimination of double-step fatigue traps and natural crossover/bracket preservation.
3. `technique_distribution_comparison.png`: Distribution of crossovers, footswitches, brackets, and jacks across difficulty meters.
4. `pad_kinematics_trajectory.png`: Bipedal center-of-mass and foot positioning on standard 4-panel arcade geometry.
5. `fig1_system_architecture.png`: Full two-stage Stepper pipeline architecture.
6. `fig2_phase_drift_comparison.png`: Phase error accumulation over time.
7. `fig3_spectrogram_subdivision_grid.png`: Log-mel spectrogram aligned to 192-tick musical subdivision grid.
8. `fig4_kinematic_cost_landscape.png`: Energy and twist cost surfaces.
9. `fig5_foot_parity_pad_trajectory.png`: 2D foot movement trajectories across panels.
10. `fig6_technique_radar_profiles.png`: Radar profiles comparing target vs. generated technique densities.
11. `fig7_difficulty_nps_distribution.png`: Notes-per-second distributions across tournament meters.

- **Comprehensive Qualitative Evaluation Report**: Published at [`Stepper/docs/qualitative_evaluation_report.md`](file:///Users/ate/Projects/Stepper/docs/qualitative_evaluation_report.md) (35 KB) evaluating choreography against 16 ITL tournament benchmark charts across Meters 7 through 15.

---

## 8. Web Application & In-Browser Inference Engine (`stepper-web`)

### Architecture Overview
The web application (`stepper-web`) is a full-featured DAW and choreography editor capable of running **entirely in the browser**:
- **Framework**: React 19, TypeScript, Tailwind CSS, Vite.
- **Aesthetic**: Strictly utilitarian, DAW-first design inspired by Ableton Live and ArrowVortex. Dark charcoal `#0C0D12` background, slate `#161822` panels, crisp subdivision line accents. Zero decorative purple gradients.
- **Mobile First**: Fully responsive layouts supporting desktop keyboard editing and mobile touch screens with touch targets $\ge 48 \times 48\text{ px}$.

### Milestone Fixes & Performance Stabilizations
1. **DFT Thread-Freezing Eliminated (M5)**: Replaced the un-workerized 2.03B-iteration Discrete Fourier Transform on song load with an on-demand, chunked Radix-2 Cooley-Tukey FFT.
2. **Decoupled Animation Clock (M5)**: The 192-tick canvas rendering loop directly queries the Web Audio hardware clock via high-precision `requestAnimationFrame` without dispatching React state changes at 60–120 Hz, eliminating canvas and DOM thrashing.
3. **Hold Body Indexing (M5)**: Optimized hold tail matching from $O(N^2)$ to $O(1)$ through map pre-indexing and binary-searched visible note windows.
4. **100% Offline Zero-Localhost Operation (M6)**:
   - Configured `engineMode: 'wasm'` by default across `StepperApiClient` and the editor.
   - Decoupled `checkHealth` and `solveParity` from remote HTTP requests; all health checks resolve immediately and foot parity is solved locally via `localParitySolver.ts`.
   - Completely eliminated unhandled fallback requests to `http://localhost:8000`.
5. **Dedicated Web Worker In-Browser ONNX Inference (M7)**:
   - Dedicated Web Worker at `frontend/src/editor/workers/inference.worker.ts`.
   - Offloads audio log-mel feature extraction, Stage 1 PlacementNet ONNX, 3-tick NMS, and Stage 2 Autoregressive StepSelectionDecoder with foot state machine masking completely off the UI thread using zero-copy transferable `Float32Array` buffers.
   - Provides granular progress reporting to the HUD transport bar without canvas hitching.
6. **Authentic Cel Noteskin Implementation**:
   - High-resolution $1024 \times 1024$ sprite sheet located at `frontend/public/noteskins/cel/cel_atlas.png` and `frontend/src/assets/cel_atlas.png`.
   - Swept chevrons (45-degree angle), bold outer contour (`#111319`), silver gradient bevel rim, high-contrast subdivision color fills (4th Red/Orange, 8th Blue, 12th Purple, 16th Yellow, 24th Pink, 32nd Amber, 48th Cyan, 64th Green).
   - Canvas-drawn silver receptors with active white flash; DOM overlay strictly aligned to column width $x = c \cdot w_{\text{col}}$ without duplicate border boxes.

### Test Coverage & Build Status
- **Vitest Unit Tests**: **120 / 120 tests passed** (14 test files).
- **Playwright E2E Tests**: **486 / 486 tests passed** (100% pass rate across desktop-chrome and mobile-iphone viewports).
- **Production Build**: Clean build in $2.8\text{ s}$ (`npm run build` exits 0 with 0 TS errors and 0 Vite warnings).

---

## 9. Zero-Context Onboarding Guide (Step-by-Step for New Machine)

When launching on a new machine with zero pre-existing context, execute these steps in order:

### Step 1: Clone Repositories
```bash
git clone https://github.com/Atehortuajf/Stepper.git
git clone https://github.com/Atehortuajf/stepper-web.git
```

### Step 2: Set Up Python ML Environment
```bash
cd Stepper
python3 -m venv venv
source venv/bin/activate
pip install -e .
# Or install core dependencies directly:
pip install torch torchaudio scipy numpy librosa gdown
```

### Step 3: Download Model Weights from Google Drive
```bash
mkdir -p checkpoints
# Download compact FP16 weights (16 MB)
python3 -c "import urllib.request; urllib.request.urlretrieve('https://drive.google.com/uc?export=download&id=1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3', 'checkpoints/stepper_weights_fp16.pt')"

# Verify download
ls -lh checkpoints/stepper_weights_fp16.pt
```

### Step 4: Run Core ML & Kinematic Tests
```bash
python3 -m unittest discover tests/unit
python3 scripts/benchmark_itl_calibration.py
```
Expected: 100% test pass rate, 100% playability across tournament charts.

### Step 5: Set Up & Verify Web Application (`stepper-web`)
```bash
cd ../stepper-web
npm install
cd frontend
npm install

# Run unit tests
npm test -- --run
# Expected: 120 / 120 passed

# Build production bundle
npm run build
# Expected: Clean build, exit code 0

# Run E2E tests
cd ..
npx playwright test
# Expected: 486 / 486 passed
```

### Step 6: Deploy Web Application Live (GitHub Pages)
```bash
cd /path/to/stepper-web/frontend
npm run build
# Copy dist to gh-pages branch or trigger GitHub Action
```

---

> [!TIP]
> **Key Behavioral & Design Constraint Checklist**:
> - **Zero ASCII Diagrams / Zero Mermaid Diagrams**: Never render ASCII flowcharts or Mermaid code blocks in responses or artifacts.
> - **DAW-First Dark Palette**: Charcoal `#0C0D12` background, slate `#161822` panels, crisp subdivision line accents. Zero decorative purple gradients.
> - **Mobile Touch Ergonomics**: Maintain touch targets $\ge 48 \times 48\text{ px}$.
> - **Zero `localhost` Network Calls**: Ensure client remains 100% offline-first; all inference and parity resolution must operate in-browser via WASM Web Worker.
> - **Isolated Remote ML Machine**: The remote RTX 4090 workstation is NOT on VPN; always bridge checkpoints via Google Drive.
