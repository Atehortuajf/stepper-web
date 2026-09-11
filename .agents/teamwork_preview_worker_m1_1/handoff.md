# Milestone 1 Handoff Report: Dynamic RoPE Sequence Lengths & Genuine ONNX Export

**Agent**: Worker 1 (`teamwork_preview_worker_m1_1`)  
**Role**: implementer, qa, specialist  
**Working Directory**: `/Users/ate/Projects/stepper-web/.agents/teamwork_preview_worker_m1_1`  
**Date**: 2026-09-11T19:18:25Z  

---

## 1. Observation

### 1.1 RoPE Fix in PlacementNet
In `/Users/ate/Projects/Stepper/stepper/model/placement_net.py` lines 39–54, `RoPE.forward` was modified to compute rotary frequencies dynamically when tracing (`if torch.jit.is_tracing() or torch.onnx.is_in_onnx_export():`):
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

### 1.2 Updated Export Script
In `/Users/ate/Projects/Stepper/scripts/export_onnx_models.py`:
- Imported `shutil`.
- Updated default `--weights` argument to `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt`.
- Extended the numerical parity loop to evaluate $T_{\text{beats}} \in [16, 32, 48, 64]$ with strict assertion `< 1e-5`.
- Added automatic mirroring to `/Users/ate/Projects/stepper-web/frontend/dist/models/`.

### 1.3 ONNX Export Execution Output
Executing `/Users/ate/Projects/Stepper/.venv/bin/python scripts/export_onnx_models.py` in `/Users/ate/Projects/Stepper`:
```
Loading weights from: /Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt
StepperSync model loaded successfully.

--- Exporting PlacementNet ---
Exported /Users/ate/Projects/stepper-web/frontend/public/models/stepper_placement.onnx (18.52 MB)

--- Exporting StepSelectionDecoder ---
Exported /Users/ate/Projects/stepper-web/frontend/public/models/stepper_decoder.onnx (13.71 MB)

--- Verifying Numerical Parity with ONNX Runtime ---
Placement (16 beats) probs max error: 1.55e-07, map max error: 6.20e-06
Placement (32 beats) probs max error: 1.81e-07, map max error: 5.36e-06
Placement (48 beats) probs max error: 1.15e-07, map max error: 5.96e-06
Placement (64 beats) probs max error: 1.99e-07, map max error: 6.52e-06
Placement multi-length parity: PASSED (all max errors < 1e-5)
Decoder logits max error: 6.44e-06
Decoder parity: PASSED (max error < 1e-5)
Copied models to /Users/ate/Projects/stepper-web/frontend/dist/models

All ONNX models successfully exported and validated!
```

### 1.4 Model Checkpoint Verification & MD5 Parity
Target checkpoint:
- `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt`: 16,749,744 bytes (Epoch 11, step 7188).

Exported ONNX models:
- `/Users/ate/Projects/stepper-web/frontend/public/models/stepper_placement.onnx` (18.52 MB, MD5: `44b9c616171deb7a2c69bcd4cca646f5`)
- `/Users/ate/Projects/stepper-web/frontend/public/models/stepper_decoder.onnx` (13.71 MB, MD5: `4c76afd000f973de5ee379a868b94407`)
- `/Users/ate/Projects/stepper-web/frontend/dist/models/stepper_placement.onnx` (18.52 MB, MD5: `44b9c616171deb7a2c69bcd4cca646f5`)
- `/Users/ate/Projects/stepper-web/frontend/dist/models/stepper_decoder.onnx` (13.71 MB, MD5: `4c76afd000f973de5ee379a868b94407`)

### 1.5 Numerical Parity Stress Test Across Both Locations
Running independent multi-length verification comparing PyTorch directly against ONNX Runtime across both `public/models` and `dist/models`:
```
=== Validating models in: /Users/ate/Projects/stepper-web/frontend/public/models ===
Beats 16: probs_diff=1.30e-07, map_diff=5.36e-06, max_diff=5.36e-06
Beats 32: probs_diff=2.53e-07, map_diff=7.57e-06, max_diff=7.57e-06
Beats 64: probs_diff=2.24e-07, map_diff=7.75e-06, max_diff=7.75e-06
Decoder: logits_diff=6.44e-06
ALL PARITY CHECKS PASSED (< 1e-5)

=== Validating models in: /Users/ate/Projects/stepper-web/frontend/dist/models ===
Beats 16: probs_diff=1.30e-07, map_diff=5.36e-06, max_diff=5.36e-06
Beats 32: probs_diff=2.53e-07, map_diff=7.57e-06, max_diff=7.57e-06
Beats 64: probs_diff=2.24e-07, map_diff=7.75e-06, max_diff=7.75e-06
Decoder: logits_diff=6.44e-06
ALL PARITY CHECKS PASSED (< 1e-5)
```
Every difference is strictly below $10^{-5}$ ($1e-5$).

### 1.6 Stepper Test Suite Pass Rate
Executing `/Users/ate/Projects/Stepper/.venv/bin/pytest tests/`:
```
============================= 237 passed in 4.52s ==============================
```
100% of the 237 unit tests in `Stepper` passed cleanly with 0 failures and 0 errors.

---

## 2. Logic Chain

1. **Static Cache Issue Resolved**:
   Previously, tracing `PlacementInferenceWrapper` with $T=8$ beats baked a static 512-length constant cache into the graph, causing ONNXRuntime broadcast failures (`512 by 1536`) when $T_{\text{beats}} > 21$.
2. **Dynamic Operations in ONNX Graph**:
   By executing dynamic frequency computation when `torch.jit.is_tracing() or torch.onnx.is_in_onnx_export()` is active:
   `t = torch.arange(seq_len, device=q.device, dtype=self.inv_freq.dtype)`
   `freqs = t.unsqueeze(1) * self.inv_freq.unsqueeze(0)`
   The ONNX exporter generates dynamic graph operators (`Shape` -> `Gather` -> `Range` -> `Mul`), enabling arbitrary sequence lengths at runtime without dimension mismatch.
3. **Preservation of PyTorch Invariants**:
   For native PyTorch execution, `_update_cache` continues to cache frequencies and update `self._seq_len_cached`, ensuring complete backward compatibility with existing tests such as `test_rope_dynamic_cache_growth`.
4. **Authentic Weight Preservation**:
   Loading genuine weights from `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt` (Epoch 11, step 7188) compiles genuine single-precision ONNX models.
5. **Exact Parity Achieved**:
   Across 16, 32, 48, and 64 beats, max numerical error between PyTorch and ONNX Runtime is bounded by $7.75 \times 10^{-6}$ (strictly $< 1 \times 10^{-5}$).

---

## 3. Caveats

- `StepSelectionDecoder` is exported with a fixed sequence window $S=64$, matching client-side batching logic in `inference.worker.ts` and `wasmInference.ts`.
- While the models are exported to both `frontend/public/models/` and `frontend/dist/models/`, any future clean rebuild (`npm run build`) in `frontend/` should preserve `public/` assets copied into `dist/`.

---

## 4. Conclusion

Milestone 1 tasks are completely fulfilled:
1. Dynamic RoPE in `placement_net.py` eliminates the 512-tick static broadcast limitation for arbitrary beat lengths.
2. `export_onnx_models.py` targets genuine checkpoint `stepper_weights_fp16.pt`, verifies 16, 32, 48, 64 beats, and copies models to both `frontend/public/models/` and `frontend/dist/models/`.
3. Genuine ONNX models `stepper_placement.onnx` (18.52 MB) and `stepper_decoder.onnx` (13.71 MB) are deployed and verified.
4. Numerical parity max difference is $< 1e-5$ across all tested lengths (16, 32, 64 beats) and decoder logits.
5. All 237 Stepper unit tests pass cleanly.

---

## 5. Verification Method

### 5.1 Stepper Test Suite
```bash
/Users/ate/Projects/Stepper/.venv/bin/pytest /Users/ate/Projects/Stepper/tests/
```
*Expected result*: `237 passed` in ~5s.

### 5.2 ONNX Multi-Length Parity Test
```bash
/Users/ate/Projects/Stepper/.venv/bin/python -c "
import numpy as np, torch, onnxruntime as ort
from stepper.model.stepper_sync import StepperSync
from scripts.export_onnx_models import PlacementInferenceWrapper, DecoderFixedWrapper

ckpt = torch.load('/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt', map_location='cpu', weights_only=True)
model = StepperSync(); model.load_state_dict(ckpt.get('model_state_dict', ckpt)); model.eval()
p_wrapper = PlacementInferenceWrapper(model.placement_net, cfg_scale=1.8).eval()

for loc in ['frontend/public/models', 'frontend/dist/models']:
    sess = ort.InferenceSession(f'/Users/ate/Projects/stepper-web/{loc}/stepper_placement.onnx')
    for b in [16, 32, 64]:
        aud = np.random.randn(1, 2, b, 48, 128).astype(np.float32)
        p_ort, m_ort = sess.run(None, {'audio': aud, 'difficulty': np.array([3], dtype=np.int64), 'tech_vector': np.zeros((1, 16), dtype=np.float32)})
        with torch.no_grad():
            p_pt, m_pt = p_wrapper(torch.from_numpy(aud), torch.tensor([3], dtype=torch.long), torch.zeros(1, 16))
        max_err = max(np.abs(p_ort - p_pt.numpy()).max(), np.abs(m_ort - m_pt.numpy()).max())
        print(f'{loc} {b} beats max error: {max_err:.2e}')
        assert max_err < 1e-5
print('ALL PARITY CHECKS PASSED (< 1e-5)')
"
```
*Expected result*: Prints errors $< 1e-5$ and exits with code 0.

### 5.3 MD5 Hash Parity
```bash
md5 /Users/ate/Projects/stepper-web/frontend/public/models/*.onnx /Users/ate/Projects/stepper-web/frontend/dist/models/*.onnx
```
*Expected result*:
- `stepper_placement.onnx`: `44b9c616171deb7a2c69bcd4cca646f5`
- `stepper_decoder.onnx`: `4c76afd000f973de5ee379a868b94407`

### 5.4 Invalidation Conditions
- Any ONNXRuntime broadcast error (`512 by X`) on sequences $> 21$ beats.
- Any parity discrepancy between PyTorch and ONNX Runtime $\ge 1e-5$.
- Any failure in the 237 Stepper unit tests.

