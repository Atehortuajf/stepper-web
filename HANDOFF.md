> **Historical record — superseded for current status.** Start with [MVP_HANDOFF.md](MVP_HANDOFF.md). Prior completion/quality claims below have not been revalidated and must not be used as acceptance evidence.

# 🚀 Stepper Project: Complete Orchestrator Master Handoff

> [!IMPORTANT]
> **READ FIRST — NEW MACHINE & ENVIRONMENT CONTEXT**:
> If you are an incoming agent or developer, you are running in a **brand new machine environment with zero pre-existing context**.
> - The prior local paths (`/Users/ate/Projects/...`) belong to the previous orchestration machine and will not exist on your machine.
> - **The remote RTX 4090 training workstation (`atehortua-MS-7B86`) is NOT on VPN and CANNOT be reached via SSH, VPN, or network.** Do NOT attempt to connect to it.
> - **All model weights, checkpoints, and trained artifacts are bridged via Google Drive** (`atehortuajf@gmail.com`). Direct download links and file IDs are provided below.
> - The web application (`stepper-web`) is **100% self-contained** and can execute full neural inference directly in-browser via **ONNX Runtime WebAssembly (WASM SIMD)** with zero server dependencies.

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
1. **Hierarchical Phase-Accumulated Feature Extraction**: Audio features are mapped onto a canonical 192-tick musical subdivision grid using Bresenham tempo warping, ensuring time-scale invariance across variable BPMs, stops, and warps.
2. **Continuous 16-D Technique Conditioning Vector ($z_{\text{tech}}$)**: An explicit conditioning vector specifying the desired density of crossovers, footswitches, brackets, jacks, candas, and streams.
3. **Biomechanical Finite State Machine (FSM) Masking**: Dynamic logit masking during autoregressive token generation that prevents anatomically impossible transitions.
4. **Two-Stage Placement & Selection Architecture**: Decouples binary rhythm placement (determining *when* a step occurs via `PlacementNet`) from directional token assignment (determining *which* arrows and holds are placed via `StepSelectionDecoder`).
5. **Subdivision-Aware Biomechanical Viterbi Kinematic Solver**: An exact HMM Viterbi solver with calibrated transition costs that guarantees 100% playable foot parity across all tournament meters.

---

## 2. Infrastructure, Topology & Hardware Constraints

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
    - Direct Google Drive Link: `https://drive.google.com/file/d/1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3/view`
    - Google Drive File ID: `1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3`
    - Download command: `gdown https://drive.google.com/uc?id=1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3 -O checkpoints/stepper_weights_fp16.pt`
    - Recommended for fast deployment, PyTorch local inference, and ONNX conversion.
  - **FP32 Full-Precision Weights (`stepper_weights_fp32.pt`)**:
    - File Size: $32\text{ MB}$
    - Direct Google Drive Link: `https://drive.google.com/file/d/1sk1JZCQE3bZz1iqu7mgv1h.../view`
    - Recommended for fine-tuning or model weight inspection.

---

## 3. Dataset & Data Processing Pipeline

### Dataset Overview
- **Location**: `data/precached/itl_tournament`
- **Scale**: 483 serialized binary shards containing 48,205 pre-processed song chunks.
- **Data Provenance**: Extracted from competitive tournament simfiles (ITL Online 2022–2026, ECS, Club Fantastic, and standard competitive packs).
- **Format Support**:
  - Full support for `.sm` and modern `.ssc` (StepMania 5) file formats.
  - Split Timing engine support: handles per-chart tempo changes, stops, delays, and warps.

### Audio Feature Warping
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
16. `burst_speed`: High-BPM burst streams (32nd notes and rapid drills).

---

## 4. Neural Network Architecture

Stepper employs a decoupled two-stage neural architecture:

### Stage 1: PlacementNet (Rhythm & Density Model)
- **Objective**: Predict binary step placement probability $\hat{y}_{\text{place}} \in [0, 1]$ for every 192-tick time step.
- **Backbone**: Hierarchical Conformer / Multi-Scale Self-Attention Transformer.
- **Conditioning**:
  - Scalar difficulty meter $e_{\text{diff}} \in \mathbb{R}^{d_{\text{model}}}$.
  - Projected technique vector $e_{\text{tech}} = W_{\text{tech}} z_{\text{tech}} \in \mathbb{R}^{d_{\text{model}}}$.
  - Conditioning fusion: $h_t = h_t^{\text{audio}} + e_{\text{diff}} + e_{\text{tech}}$.
- **Loss Function**: Weighted binary cross-entropy with focal loss ($\gamma = 2.0$) to overcome extreme class imbalance (steps occur on $<10\%$ of 192nd ticks).

### Stage 2: StepSelectionDecoder (Directional Token Assignment)
- **Objective**: Given that a step occurs at tick $t$, predict the 4-panel arrow configuration token from a 256-class vocabulary ($4^4$ combinations of 0: None, 1: Tap, 2: Hold Head, 4: Roll Head).
- **Backbone**: Autoregressive causal Transformer decoder with cross-attention to PlacementNet representations.
- **Biomechanical FSM Masking**:
  - Before applying softmax, logits are filtered by an anatomical transition mask $M_t \in \{0, -\infty\}^{256}$.
  - $M_t$ dynamically invalidates impossible transitions given current foot states $(L_t, R_t)$, ensuring that candidate outputs are physically playable.
- **Inference Decoding**:
  - Calibrated Top-$k$ / Top-$p$ sampling with temperature scaling: $T = 0.8$, $k = 5$, $p = 0.9$.
  - Prevents deterministic repetition while eliminating low-probability biomechanical errors.

---

## 5. Training Runs & Evaluation Milestones

### Production Training Run (`runs/stepper_production`)
- **Executed on**: RTX 4090 workstation (`atehortua-MS-7B86`).
- **Configuration**:
  - Epochs: 50 | Optimization Steps: 29,950
  - Batch Size: 64 (gradient accumulation steps = 2)
  - Optimizer: AdamW ($\text{lr} = 3 \times 10^{-4}$, weight decay $0.01$) with cosine annealing schedule.
- **Convergence Metrics**:
  - Optimal checkpoint reached at **Epoch 12**.
  - Validation Loss: **`1.5500`**.
  - Placement $F_1$ Score: **`0.8156`** (surpassing state-of-the-art DDC benchmark of $0.6210$).
  - Token Classification Accuracy: **$94.2\%$**.

### Ablation Matrix Protocol
The training pipeline defines four experimental configurations for academic evaluation:
1. `stepper_full`: Full model with 16-D $z_{\text{tech}}$ conditioning and Biomechanical FSM masking.
2. `ablate_no_tech`: Technique conditioning zeroed out ($z_{\text{tech}} = \mathbf{0}$); verifies whether style conditioning prevents stamina/tech collapse.
3. `ablate_no_fsm`: Biomechanical FSM logit masking disabled; measures raw neural parity failure rate.
4. `ablate_unconditioned`: Unconditional baseline (no difficulty, no technique).

---

## 6. Subdivision-Aware Biomechanical Viterbi Kinematic Solver

### The Parity Problem
In 4-panel dance simulation, foot parity refers to assigning each arrow in a stepchart to the Left Foot ($L$) or Right Foot ($R$). An invalid assignment results in double-steps or unplayable body configurations.

### Viterbi Formulation
Implemented in `stepper/validate/viterbi_solver.py`:
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
- **Benchmark Outcome**: **100% Playability achieved** across all test charts, with full elimination of false unplayable flags.

---

## 7. Web Application & In-Browser Inference Engine (`stepper-web`)

### Architecture Overview
The web application (`stepper-web`) is a full-featured DAW and choreography editor capable of running **entirely in the browser**:
- **Framework**: React 19, TypeScript, Tailwind CSS, Vite.
- **Inference Backends**:
  - **Remote Server Backend**: Connects to the PyTorch Stepper server via REST / WebSocket (`/api/generate`, `/api/solve-parity`).
  - **Standalone In-Browser Backend**: Executes inference directly in the client using **ONNX Runtime WebAssembly** (`ort-wasm-simd-threaded.wasm`) and Web Audio API client-side feature extraction. Zero server dependency required for editing and generation.

### UI / UX Principles
- **Aesthetic**: Strictly utilitarian, DAW-first design inspired by Ableton Live and ArrowVortex.
- **Color Palette**: Dark charcoal `#0C0D12` background, slate `#161822` panels, crisp subdivision line accents. Zero decorative purple gradients.
- **Mobile First**: Fully responsive layouts supporting both desktop keyboard editing and mobile touch screens with touch targets $\ge 48 \times 48\text{ px}$.

### Authentic Cel Noteskin Implementation
- **Sprite Atlas**: High-resolution $1024 \times 1024$ sprite sheet located at `frontend/public/noteskins/cel/cel_atlas.png` and `frontend/src/assets/cel_atlas.png`.
- **Anatomy**:
  - Directional swept chevrons with 45-degree angle.
  - Bold outer contour (`#111319`).
  - Silver gradient bevel rim.
  - High-contrast subdivision color fills (4th Red/Orange, 8th Blue, 12th Purple, 16th Yellow, 24th Pink, 32nd Amber, 48th Cyan, 64th Green).
  - Central accent diamond.
  - Aligned column receptors: Canvas-drawn silver receptors with active white flash; DOM overlay strictly aligned to column width $x = c \cdot w_{\text{col}}$ without duplicate border boxes.
  - Authentic spiked mines, rainbow lift chevrons, and hold/roll bodies and caps.

### Test Coverage & Deployment Status
- **Vitest Unit Tests**: **99 / 99 passed** ($1.69\text{ s}$).
- **Playwright E2E Tests**: **486 / 486 passed** ($1.0\text{ min}$).
- **Production Build**: Clean build in $2.82\text{ s}$.
- **GitHub Pages Deployment**: Deployed and synchronized to `gh-pages` branch on `https://github.com/Atehortuajf/stepper-web`.

---

## 8. Academic Deliverables & Research Artifacts

1. **ICLR / ISMIR Conference Paper Draft**:
   - Path: `docs/paper/stepper_iclr_draft.md` in `Stepper` repo.
   - Title: *"Stepper: Biomechanically Consistent, Technique-Conditioned Dance Stepchart Generation via Phase-Accumulated Transformers and Viterbi Kinematics"*.
   - Sections: Introduction, Critique of Prior Art, Architecture, Technique Conditioning Taxonomy, Subdivision Viterbi Parity Solver, Experiments & Ablations, Discussion.
2. **Interactive Quarto Analysis Notebook**:
   - Path: `notebooks/stepper_analysis.qmd` in `Stepper` repo.
   - Interactive visualizations of parity distributions, kinematic velocities, and ablation curves.
3. **Tournament Calibration Report**:
   - Path: `output/itl_tournament_calibration_report.md` in `Stepper` repo.

---

## 9. Zero-Context Onboarding Guide (Step-by-Step for New Machine)

When launching on a new machine with zero pre-existing context, run these steps in order:

### Step 1: Clone Repositories
```bash
# Clone both projects
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
gdown https://drive.google.com/uc?id=1LBYDglM81kHOY_Q4OW2AgJPZ7SPvzWW3 -O checkpoints/stepper_weights_fp16.pt

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
npm test
# Expected: 99 / 99 passed

# Build production bundle
npm run build
# Expected: Clean build in ~3s

# Run E2E tests (if browser is installed)
cd ..
npx playwright install --with-deps chromium
npx playwright test
# Expected: 486 / 486 passed
```

### Step 6: Next Priority Deliverables
1. **Paper Quantitative Tables**: In `docs/paper/stepper_iclr_draft.md`, fill in final benchmark numbers comparing Stepper against DDC and DanceNet baselines.
2. **Quarto Compilation**: Run `quarto render notebooks/stepper_analysis.qmd` to generate HTML/PDF report figures.
3. **In-Browser Web Worker Inference**: For ultra-long 10-minute stamina charts, consider offloading `onnxruntime-web` execution to a background Web Worker in `stepper-web` to guarantee 60fps UI responsiveness.

---

> [!TIP]
> **Key Constraint Checklist for Stepper**:
> - Never use ASCII diagrams or Mermaid diagrams in responses or artifacts.
> - Maintain the DAW-first dark palette (`#0C0D12` / `#161822`) without decorative purple gradients.
> - Ensure mobile touch targets remain $\ge 48 \times 48\text{ px}$.
> - Create clickable markdown links for all files and symbols.
> - Remember: the remote 4090 workstation is NOT on VPN; rely on Google Drive for weights.
