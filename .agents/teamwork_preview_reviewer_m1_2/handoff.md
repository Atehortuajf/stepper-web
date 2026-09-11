# Milestone 1 Independent Review & Adversarial Critic Report

**Agent**: Reviewer 2 (`teamwork_preview_reviewer_m1_2`)  
**Role**: reviewer, critic  
**Target Review**: Milestone 1 Gate (RoPE Dynamic Formulation, Genuine ONNX Models Export, Test Suite Pass)  
**Date**: 2026-09-11T19:23:00Z  
**Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 RoPE Rotary Embeddings Implementation
In `/Users/ate/Projects/Stepper/stepper/model/placement_net.py` lines 39–58:
```python
    def forward(self, q: torch.Tensor, k: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        # q, k shape: (B, num_heads, seq_len, head_dim)
        seq_len = q.shape[2]
        if torch.jit.is_tracing() or torch.onnx.is_in_onnx_export():
            t = torch.arange(seq_len, device=q.device, dtype=self.inv_freq.dtype)
            freqs = t.unsqueeze(1) * self.inv_freq.unsqueeze(0)
            cos = torch.cos(freqs).to(q.dtype).unsqueeze(0).unsqueeze(1)
            sin = torch.sin(freqs).to(q.dtype).unsqueeze(0).unsqueeze(1)
        else:
            self._update_cache(seq_len, q.device, q.dtype)
            cos = self._cos_cached[:seq_len].unsqueeze(0).unsqueeze(1)
            sin = self._sin_cached[:seq_len].unsqueeze(0).unsqueeze(1)

        half_dim = self.dim // 2
        q1, q2 = q[..., :half_dim], q[..., half_dim:]
        k1, k2 = k[..., :half_dim], k[..., half_dim:]

        q_rot = torch.cat([q1 * cos - q2 * sin, q1 * sin + q2 * cos], dim=-1)
        k_rot = torch.cat([k1 * cos - k2 * sin, k1 * sin + k2 * cos], dim=-1)
        return q_rot, k_rot
```
- Eager execution uses `self._update_cache(seq_len, ...)` which resizes `self._cos_cached` to `max(seq_len, 512)` when needed.
- Export/tracing branch dynamically evaluates `t = torch.arange(seq_len)` and computes `cos`/`sin` without caching constants into the ONNX graph.
- Mathematical comparison between the eager branch and the tracing branch formulation across test sequence lengths `[1, 10, 192, 512, 528, 1000, 1536, 3072]` yielded exact identity (`0.0` max difference in `q_rot` and `k_rot`).

### 1.2 ONNX Model Artifacts & File Integrity
Inspected files in both locations:
- `/Users/ate/Projects/stepper-web/frontend/public/models/`:
  - `stepper_placement.onnx`: 19,419,957 bytes (18.52 MB), MD5: `44b9c616171deb7a2c69bcd4cca646f5`
  - `stepper_decoder.onnx`: 14,375,982 bytes (13.71 MB), MD5: `4c76afd000f973de5ee379a868b94407`
  - `mel_filterbank.bin`: 263,200 bytes (257 KB), MD5: `b5004d5d659a0311e53165e1b95edfa6`
- `/Users/ate/Projects/stepper-web/frontend/dist/models/`:
  - `stepper_placement.onnx`: 19,419,957 bytes (18.52 MB), MD5: `44b9c616171deb7a2c69bcd4cca646f5`
  - `stepper_decoder.onnx`: 14,375,982 bytes (13.71 MB), MD5: `4c76afd000f973de5ee379a868b94407`
  - `mel_filterbank.bin`: 263,200 bytes (257 KB), MD5: `b5004d5d659a0311e53165e1b95edfa6`
- Bit-for-bit MD5 identity holds between `public/models` and `dist/models`.
- Re-running `npm run build` in `frontend/` cleanly regenerates `dist/models` with preserved MD5 checksums.

### 1.3 Model Signatures & Dynamic Axes
Inspected via `onnx.load()` and `onnx.checker.check_model()`:
- `stepper_placement.onnx`:
  - IR Version: 8, Opset: `ai.onnx:16`, Producer: `pytorch 2.14.0`
  - Inputs:
    - `audio`: type 1 (FLOAT), shape `[1, 2, 't_beats', 48, 128]`
    - `difficulty`: type 7 (INT64), shape `[1]`
    - `tech_vector`: type 1 (FLOAT), shape `[1, 16]`
  - Outputs:
    - `probs`: type 1 (FLOAT), shape `[1, 't_beats', 48]`
    - `acoustic_map`: type 1 (FLOAT), shape `['Addacoustic_map_dim_0', 't_ticks', 256]`
- `stepper_decoder.onnx`:
  - IR Version: 8, Opset: `ai.onnx:16`, Producer: `pytorch 2.14.0`
  - Inputs:
    - `step_tokens`: type 7 (INT64), shape `[1, 64]`
    - `acoustic_embeddings`: type 1 (FLOAT), shape `[1, 64, 256]`
    - `step_delta_beats`: type 1 (FLOAT), shape `[1, 64]`
    - `step_beat_phases`: type 7 (INT64), shape `[1, 64]`
    - `step_measure_phases`: type 7 (INT64), shape `[1, 64]`
    - `difficulty`: type 7 (INT64), shape `[1]`
    - `tech_vector`: type 1 (FLOAT), shape `[1, 16]`
  - Outputs:
    - `step_logits`: type 1 (FLOAT), shape `[1, 64, 96]`

### 1.4 Graph Structure & Residual Constant Audit
- Executed an exhaustive scan of all 893 nodes in `stepper_placement.onnx`.
- Total Constant nodes containing value 512: `0`.
- Trigonometric & Range nodes: 12 nodes (`Range`, `Cos`, `Sin`) mapped to `/placement_net/attn_layers.{0,1}/rope/` and `/placement_net/attn_layers.{0,1}/rope_1/`.
- `Range` inputs take dynamic sequence length computed via `Shape` -> `Gather` -> `Cast` of the input tensor.

### 1.5 Genuine Weight Verification
Compared initializers against `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt`:
- `placement_net.stem.weight` (shape `[256, 256, 7]`): exact numerical match with ONNX initializer.
- `placement_net.placement_head.weight` (shape `[1, 256]`): exact match with transposed ONNX initializer `onnx::MatMul_1168` (shape `[256, 1]`).
- `step_decoder.vocab_embed.weight` (shape `[96, 256]`): exact match with ONNX initializer.
- `step_decoder.out_proj.weight` (shape `[96, 256]`): exact match with transposed ONNX initializer `onnx::MatMul_2143` (shape `[256, 96]`).
- Proves genuine weights from the 50-epoch checkpoint were exported, not dummy, zero, or randomly initialized weights.

### 1.6 Independent Test Suite Execution Results
- **Stepper Test Suite**:
  `/Users/ate/Projects/Stepper/.venv/bin/pytest tests/`
  Result: `237 passed in 31.42s` (0 failures, 0 errors).
- **Adversarial ONNX Suite**:
  `/Users/ate/Projects/Stepper/.venv/bin/pytest tests/unit/test_m1_adversarial_onnx.py -v`
  Result: `5 passed, 28 subtests passed in 8.35s`.
- **Frontend Vitest Suite**:
  `npm test -- --run` in `stepper-web/frontend/`
  Result: `15 passed (15 files), 133 passed (133 tests) in 2.14s`.
- **Frontend Production Build**:
  `npm run build` in `stepper-web/frontend/`
  Result: Clean exit (0 errors, 0 warnings), dist artifacts produced including `dist/models/`.

---

## 2. Logic Chain

1. **Root Cause Analysis**: The prior broadcasting mismatch (`512 by 1536`) occurred because tracing evaluated `self._update_cache(seq_len)`, which allocated a static buffer of length 512. In the traced ONNX computational graph, `_cos_cached` was registered as a fixed-size Constant tensor, unable to resize when runtime sequences exceeded 21.33 beats (512 ticks).
2. **Traced Dynamic Formulation**: Guarding with `if torch.jit.is_tracing() or torch.onnx.is_in_onnx_export():` instructs the tracer to emit dynamic ONNX operations (`Shape` -> `Gather` -> `Range` -> `Mul` -> `Cos`/`Sin`) rather than embedding tensor constants.
3. **Equivalence Invariant**: The mathematical operation $R_m q$ in the dynamic formulation is identical to the cached slice. Independent verification verified `0.0` max absolute error between the two branches in PyTorch.
4. **Broadcast Resolution**: Stress-testing sequence lengths from 1 to 256 beats (48 to 12,288 ticks), prime beat lengths (3, 5, 7, 13, 17, 19, 23, 29, 31, 37, 41, 53, 97), and extreme boundary values confirmed:
   - Zero shape or broadcast errors.
   - Exact numerical parity against PyTorch eager execution (max probability difference $\le 1.49 \times 10^{-6}$, max acoustic embedding difference $\le 8.00 \times 10^{-6}$ for sequences up to 128 beats; $1.16 \times 10^{-5}$ at 256 beats due to standard fp32 accumulation order).
5. **Decoder Fixed Window**: `stepper_decoder.onnx` matches the autoregressive chunking contract ($S=64$) consumed by `inference.worker.ts` lines 219–274, with max logits discrepancy $< 1 \times 10^{-5}$.
6. **Integrity Validation**: Verified no hardcoded test outputs, no mock implementations, and authentic model weights throughout.

---

## 3. Integrity & Adversarial Audit

### Integrity Check: PASS
- **Hardcoded test outputs**: None. Source code in `placement_net.py` and `export_onnx_models.py` contains genuine dynamic calculation.
- **Dummy / facade implementations**: None. Both exported ONNX models are full-scale models (18.52 MB and 13.71 MB) containing genuine trained weights.
- **Bypassed work / shortcuts**: None. Models are verified across full multi-length inputs and integrated into both `public/` and `dist/`.
- **Fabricated verification outputs**: None. All results independently reproduced and recorded above.

### Adversarial Challenges & Stress Testing
- **Challenge 1 (Threshold Boundary 21 vs 22 beats)**:
  - Scenario: Sequences transitioning past the old 512-tick cache boundary ($21 \times 24 = 504$ ticks vs $22 \times 24 = 528$ ticks).
  - Result: 21 beats: probs err `9.59e-08`, map err `5.25e-06`. 22 beats: probs err `3.05e-07`, map err `5.13e-06`. Zero broadcast errors.
- **Challenge 2 (Non-power-of-2 / Prime sequence lengths)**:
  - Scenario: Evaluated 13 prime beat lengths ($b \in \{3, 5, 7, 13, 17, 19, 23, 29, 31, 37, 41, 53, 97\}$).
  - Result: All passed with max probs error $< 1 \times 10^{-5}$ and max map error $< 1 \times 10^{-5}$.
- **Challenge 3 (Extreme Audio & Tech Vector Dynamics)**:
  - Scenario: Tested all zeros, all $+5.0$, all $-5.0$, high variance ($\sigma=10.0$), and null difficulty class (5).
  - Result: Output ranges remained well-bounded, zero NaNs or Infs generated, max difference against PyTorch $< 1 \times 10^{-5}$.
- **Challenge 4 (Decoder Adversarial Inputs)**:
  - Scenario: All PAD/BOS/EOS/UNK tokens, extreme delta beats ($0.0$, $1/192$, $32.0$, $128.0$), phase extremes ($47, 3$), extreme tech ($\pm 5.0$).
  - Result: Numerical stability maintained, logits identical between `public` and `dist`, and matched PyTorch ground truth within $< 1 \times 10^{-5}$.

---

## 4. Caveats

- For extremely long sequences ($T=256$ beats, $L=12,288$ ticks), accumulation differences between PyTorch SDPA and ONNX Runtime point-wise ops reach $1.16 \times 10^{-5}$ in the deep embedding space (`acoustic_map`), while output probabilities remain at $1.49 \times 10^{-6}$. This is expected single-precision floating-point associativity and does not affect note placement.
- `stepper_decoder.onnx` has fixed window $S=64$, which aligns with the current client worker architecture. If future milestones expand the autoregressive context window beyond 64 tokens, the decoder export script will need an updated $S$.

---

## 5. Conclusion

The Milestone 1 work product meets all architectural, functional, and mathematical criteria:
1. Dynamic RoPE in `PlacementNet` fully eliminates static broadcasting limitations, producing identical outputs between PyTorch eager mode and ONNX runtime without any `512` broadcast errors.
2. The ONNX models in `frontend/public/models/` and `frontend/dist/models/` are authentic, verified against the production trained checkpoint, and match expected input/output signatures and dynamic axes.
3. The Stepper unit test suite passes 100% (237/237), the adversarial ONNX test suite passes 100%, and frontend Vitest and build suites pass cleanly.
4. No integrity violations, hardcoded shortcuts, or facade implementations were detected.

**Explicit Verdict**: **APPROVE**

---

## 6. Verification Method

To independently reproduce all observations and verify this assessment:

1. **Run Stepper Unit Tests**:
   ```bash
   /Users/ate/Projects/Stepper/.venv/bin/pytest /Users/ate/Projects/Stepper/tests/
   ```
   *Expected*: `237 passed` in ~30s.

2. **Verify ONNX Bit-for-bit Parity**:
   ```bash
   md5 /Users/ate/Projects/stepper-web/frontend/public/models/* /Users/ate/Projects/stepper-web/frontend/dist/models/*
   ```
   *Expected*:
   - `stepper_placement.onnx`: `44b9c616171deb7a2c69bcd4cca646f5`
   - `stepper_decoder.onnx`: `4c76afd000f973de5ee379a868b94407`
   - `mel_filterbank.bin`: `b5004d5d659a0311e53165e1b95edfa6`

3. **Verify RoPE Dynamic Length Parity (< 1e-5)**:
   ```bash
   /Users/ate/Projects/Stepper/.venv/bin/pytest /Users/ate/Projects/Stepper/tests/unit/test_m1_adversarial_onnx.py -v
   ```
   *Expected*: `5 passed, 28 subtests passed` with zero errors.

4. **Verify Frontend Build & Vitest**:
   ```bash
   cd /Users/ate/Projects/stepper-web/frontend && npm test -- --run && npm run build
   ```
   *Expected*: `133 passed`, build exits with code 0.
