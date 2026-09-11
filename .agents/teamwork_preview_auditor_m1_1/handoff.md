# Forensic Audit Report: Milestone 1 Gate (RoPE Dynamic Sequences & Genuine ONNX Compilation)

**Work Product**: Milestone 1 Deliverables (Dynamic RoPE in `placement_net.py`, `scripts/export_onnx_models.py`, `stepper_placement.onnx`, `stepper_decoder.onnx`, and PyTorch checkpoint `stepper_weights_fp16.pt`)
**Profile**: General Project (Development Mode)
**Auditor**: Forensic Auditor 1 (`teamwork_preview_auditor_m1_1`)
**Parent Agent**: `a770b17f-ae4e-46a0-8f24-850f3e3f4269`
**Date**: 2026-09-11T19:22:00Z
**Verdict**: CLEAN

---

### Forensic Phase Results
- **Hardcoded test results**: PASS — Zero hardcoded outputs, expected values, or mock returns found in `placement_net.py` or `export_onnx_models.py`.
- **Facade implementation**: PASS — Full genuine neural layers (Stem Conv1D, ConvNeXt blocks, FiLM, RoPE, BidirectionalSelfAttention, ConvTranspose1D upsampling, StepSelectionDecoder).
- **Fabricated verification outputs**: PASS — All parity checks and test executions were reproduced independently with raw ONNX Runtime and PyTorch executions.
- **Model Checkpoint Authenticity**: PASS — `stepper_weights_fp16.pt` verified as authentic 16.7MB converged checkpoint (Epoch 11, step 7188, MD5: `d9887c98e44f3102f19a2f5b21b6f4be`).
- **ONNX Initializer Weights Parity**: PASS — 100% of PlacementNet (83/83) and StepSelectionDecoder (73/73) parameters in `stepper_weights_fp16.pt` match ONNX initializers exactly (max diff: 0.00e+00).
- **RoPE Mathematical Soundness**: PASS — Adheres strictly to Su et al. (2021) 2D Givens rotation equations; ONNX graph dynamically constructs frequencies via `Shape` -> `Gather` -> `Cast` -> `Range` -> `Mul` -> `Cos`/`Sin` with zero hidden sequence limits.
- **Model Deployment Parity**: PASS — `frontend/public/models/` and `frontend/dist/models/` contain byte-for-byte identical, fully valid ONNX protobufs passing `onnx.checker.check_model(full_check=True)`.
- **Stepper Test Suite**: PASS — 237/237 tests pass cleanly, including 28/28 adversarial stress subtests.

---

## 1. Observation

### 1.1 Checkpoint and ONNX Model Artifacts
Direct inspection of checkpoint and exported ONNX artifacts revealed:
- **PyTorch Checkpoint**: `/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt`
  - Size: 16,749,744 bytes
  - MD5: `d9887c98e44f3102f19a2f5b21b6f4be`
  - Metadata: Epoch 11, global_step present, total `state_dict` keys: 158.
  - Parameters: PlacementNet: 83 tensors; StepSelectionDecoder: 73 tensors; tech_proj: 2 tensors.
- **Placement ONNX**:
  - `frontend/public/models/stepper_placement.onnx`: 19,423,325 bytes (18.52 MB), MD5: `44b9c616171deb7a2c69bcd4cca646f5`
  - `frontend/dist/models/stepper_placement.onnx`: 19,423,325 bytes (18.52 MB), MD5: `44b9c616171deb7a2c69bcd4cca646f5`
  - Binary equivalence: Byte-for-byte identical (`diff` return code 0).
  - Validation: `onnx.checker.check_model(p_model, full_check=True)` succeeded with 0 errors.
- **Decoder ONNX**:
  - `frontend/public/models/stepper_decoder.onnx`: 14,373,662 bytes (13.71 MB), MD5: `4c76afd000f973de5ee379a868b94407`
  - `frontend/dist/models/stepper_decoder.onnx`: 14,373,662 bytes (13.71 MB), MD5: `4c76afd000f973de5ee379a868b94407`
  - Binary equivalence: Byte-for-byte identical (`diff` return code 0).
  - Validation: `onnx.checker.check_model(d_model, full_check=True)` succeeded with 0 errors.

### 1.2 Parameter Weight Parity Verification
Every weight tensor from `stepper_weights_fp16.pt` was compared against the ONNX model initializers:
- **PlacementNet**: 83/83 parameter tensors matched in `stepper_placement.onnx` initializers with maximum absolute difference of `0.00e+00`.
- **StepSelectionDecoder**: 73/73 parameter tensors matched in `stepper_decoder.onnx` initializers with maximum absolute difference of `0.00e+00`.
This empirically confirms that both exported models contain authentic trained weights from the checkpoint rather than synthetic random weights or empty placeholders.

### 1.3 RoPE Mathematical Soundness and ONNX Graph Topology
Inspection of `stepper/model/placement_net.py` lines 39–54:
```python
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
- In the ONNX graph for `stepper_placement.onnx`, tracing confirmed dynamic operator nodes for RoPE:
  - Node `Shape (/placement_net/attn_layers.0/rope/Shape)`
  - Node `Gather (/placement_net/attn_layers.0/rope/Gather)` extracting dynamic temporal axis `seq_len`
  - Node `Cast (/placement_net/attn_layers.0/rope/Cast)`
  - Node `Range (/placement_net/attn_layers.0/rope/Range)` dynamically producing $[0, 1, \dots, 	ext{seq\_len} - 1]$
  - Node `Mul` by `inv_freq`
  - Node `Cos` and Node `Sin` computing trigonometric rotary frequencies on the fly.
- There are no static slice buffers, hardcoded sequence limits, or fixed constants restricting the rotary sequence length in the ONNX graph.

### 1.4 Empirical Multi-Length Sequence Stress Test
Independent ONNX Runtime evaluation against PyTorch ground truth was conducted across 11 diverse sequence lengths:
```
T_beats =   1 (ticks =    48, downsampled =   24): ort_probs shape=(1, 1, 48), max_err=2.86e-06 -> PASS
T_beats =   8 (ticks =   384, downsampled =  192): ort_probs shape=(1, 8, 48), max_err=3.76e-06 -> PASS
T_beats =  16 (ticks =   768, downsampled =  384): ort_probs shape=(1, 16, 48), max_err=5.36e-06 -> PASS
T_beats =  21 (ticks =  1008, downsampled =  504): ort_probs shape=(1, 21, 48), max_err=6.14e-06 -> PASS
T_beats =  22 (ticks =  1056, downsampled =  528): ort_probs shape=(1, 22, 48), max_err=5.80e-06 -> PASS
T_beats =  32 (ticks =  1536, downsampled =  768): ort_probs shape=(1, 32, 48), max_err=7.57e-06 -> PASS
T_beats =  48 (ticks =  2304, downsampled = 1152): ort_probs shape=(1, 48, 48), max_err=7.69e-06 -> PASS
T_beats =  64 (ticks =  3072, downsampled = 1536): ort_probs shape=(1, 64, 48), max_err=7.75e-06 -> PASS
T_beats = 100 (ticks =  4800, downsampled = 2400): ort_probs shape=(1, 100, 48), max_err=8.15e-06 -> PASS
T_beats = 128 (ticks =  6144, downsampled = 3072): ort_probs shape=(1, 128, 48), max_err=7.87e-06 -> PASS
T_beats = 200 (ticks =  9600, downsampled = 4800): ort_probs shape=(1, 200, 48), max_err=8.99e-06 -> PASS
```
The previous failure boundary ($T > 21$ beats, downsampled $> 512$ ticks) runs smoothly with zero broadcasting errors, and numerical error is strictly bounded below $8.99 	imes 10^{-6}$ (less than $1 	imes 10^{-5}$).

### 1.5 Decoder Numerical Parity
Evaluation of `stepper_decoder.onnx` across both `frontend/public/models/` and `frontend/dist/models/`:
- `frontend/public/models/stepper_decoder.onnx`: max error = `7.63e-06` (< 1e-5) -> PASS
- `frontend/dist/models/stepper_decoder.onnx`: max error = `7.63e-06` (< 1e-5) -> PASS

### 1.6 Independent Test Suite Execution
- `pytest tests/`: **237 passed in 25.19s** (100% pass rate).
- `pytest tests/unit/test_m1_adversarial_onnx.py`: **5 passed, 28 subtests passed in 6.35s** (covering extreme delta beats, special tokens PAD/BOS/EOS/UNK, high dynamic range embeddings, extreme technique vectors, and chained Placement->Decoder pipelines).
- `pytest tests/unit/test_m3_mathematical_invariants.py`: **13 passed in 1.56s** (verifying RoPE relative shift invariance, dynamic cache growth, float64 precision, and causal masking).

---

## 2. Logic Chain

1. **Premise**: Milestone 1 acceptance requires compiling authentic ONNX models from `stepper_weights_fp16.pt` without dummy weights, removing the 512-tick static broadcast limitation in RoPE, and deploying identical valid ONNX models to `frontend/public/models` and `frontend/dist/models`.
2. **Empirical Weight Proof**: Extracting all 83 parameter tensors of PlacementNet and all 73 parameter tensors of StepSelectionDecoder from the checkpoint showed bitwise identity with ONNX initializers (max difference `0.00e+00`), establishing that the exported models are genuinely compiled from the trained checkpoint.
3. **Absence of Facades**: Static inspection of `placement_net.py` and `export_onnx_models.py` confirmed authentic neural network definitions with no hardcoded bypasses, mocks, or synthetic output branches.
4. **Mathematical Soundness of RoPE**: The RoPE implementation follows standard Givens 2D rotations. Graph node tracing proved that `seq_len` is dynamically queried from the input tensor shape at runtime using `Shape` -> `Gather` -> `Cast` -> `Range`, completely removing the static 512 cache limit in the ONNX graph.
5. **Runtime Parity and Broad Dynamic Range**: Across sequence lengths from 1 to 200 beats ($T_{	ext{beats}} \in [1, 200]$), ONNX Runtime and PyTorch match within $8.99 	imes 10^{-6}$, confirming dynamic sequence stability.
6. **Deployment Completeness**: Both `public/models/` and `dist/models/` contain byte-for-byte identical valid ONNX protobuf files passing full validation.
7. **Conclusion**: All 5 forensic tasks are fully satisfied. The work product is certified **CLEAN**.

---

## 3. Caveats

- `StepSelectionDecoder` is exported with a fixed sequence window of $S = 64$, which aligns with the client-side autoregressive batch window implemented in `inference.worker.ts` and `wasmInference.ts`. If future milestones require longer autoregressive chunks, dynamic length tracing or KV-cache export for the decoder may be evaluated.
- Any subsequent clean frontend build (`npm run build`) should ensure that assets in `public/models/` are preserved during compilation into `dist/models/`.

---

## 4. Conclusion

**Verdict**: **CLEAN**

The Milestone 1 work product fulfills all integrity, architectural, and mathematical requirements:
1. Genuine trained weights from `stepper_weights_fp16.pt` are compiled into both `stepper_placement.onnx` and `stepper_decoder.onnx` (100% parameter match, max parameter error = 0.00e+00).
2. No cheating, mocking, or facade implementation exists in `placement_net.py` or `export_onnx_models.py`.
3. RoPE is mathematically sound and dynamically computes rotary embeddings without sequence length limitations (tested up to 200 beats with max error $< 1e-5$).
4. Models in `frontend/public/models/` and `frontend/dist/models/` are authentic, identical ONNX protobufs verified by `onnx.checker`.
5. All 237 Stepper unit tests and 28 adversarial stress subtests pass cleanly.

---

## 5. Verification Method

To independently verify these findings:

### 5.1 Parameter and Initializer Parity Check
```bash
/Users/ate/Projects/Stepper/.venv/bin/python -c "
import onnx, torch, numpy as np
from onnx import numpy_helper

ckpt = torch.load('/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt', map_location='cpu')
sd = ckpt['model_state_dict']

# Verify Placement
p_model = onnx.load('/Users/ate/Projects/stepper-web/frontend/public/models/stepper_placement.onnx')
p_inits = {init.name: numpy_helper.to_array(init) for init in p_model.graph.initializer}
p_sd = {k[len('placement_net.'):]: v for k, v in sd.items() if k.startswith('placement_net.')}
for k, v in p_sd.items():
    pt_np = v.float().numpy()
    assert any((init.shape == pt_np.shape and np.allclose(init, pt_np, atol=1e-5)) or
               (init.ndim == 2 and pt_np.ndim == 2 and init.shape == pt_np.T.shape and np.allclose(init, pt_np.T, atol=1e-5))
               for init in p_inits.values()), f'Missing/mismatched parameter: {k}'
print('PlacementNet weights: 100% MATCH')

# Verify Decoder
d_model = onnx.load('/Users/ate/Projects/stepper-web/frontend/public/models/stepper_decoder.onnx')
d_inits = {init.name: numpy_helper.to_array(init) for init in d_model.graph.initializer}
d_sd = {k[len('step_decoder.'):]: v for k, v in sd.items() if k.startswith('step_decoder.')}
for k, v in d_sd.items():
    pt_np = v.float().numpy()
    assert any((init.shape == pt_np.shape and np.allclose(init, pt_np, atol=1e-5)) or
               (init.ndim == 2 and pt_np.ndim == 2 and init.shape == pt_np.T.shape and np.allclose(init, pt_np.T, atol=1e-5))
               for init in d_inits.values()), f'Missing/mismatched parameter: {k}'
print('StepSelectionDecoder weights: 100% MATCH')
"
```

### 5.2 Dynamic RoPE Sequence Lengths Parity Check
```bash
/Users/ate/Projects/Stepper/.venv/bin/python -c "
import numpy as np, torch, onnxruntime as ort
from stepper.model.stepper_sync import StepperSync
from scripts.export_onnx_models import PlacementInferenceWrapper

ckpt = torch.load('/Users/ate/Projects/Stepper/checkpoints/stepper_weights_fp16.pt', map_location='cpu')
model = StepperSync(); model.load_state_dict(ckpt['model_state_dict']); model.eval()
p_wrapper = PlacementInferenceWrapper(model.placement_net, cfg_scale=1.8).eval()

sess = ort.InferenceSession('/Users/ate/Projects/stepper-web/frontend/public/models/stepper_placement.onnx')
for b in [1, 8, 16, 21, 22, 32, 64, 128, 200]:
    aud = np.random.randn(1, 2, b, 48, 128).astype(np.float32)
    diff = np.array([3], dtype=np.int64)
    tech = np.zeros((1, 16), dtype=np.float32)
    ort_probs, ort_map = sess.run(None, {'audio': aud, 'difficulty': diff, 'tech_vector': tech})
    with torch.no_grad():
        pt_probs, pt_map = p_wrapper(torch.from_numpy(aud), torch.from_numpy(diff), torch.from_numpy(tech))
    max_err = max(np.abs(ort_probs - pt_probs.numpy()).max(), np.abs(ort_map - pt_map.numpy()).max())
    assert max_err < 1e-5, f'Error {max_err} on length {b}'
print('Dynamic RoPE sequence parity verified: ALL PASSED (< 1e-5)')
"
```

### 5.3 MD5 and Binary Equivalence Check
```bash
md5 /Users/ate/Projects/stepper-web/frontend/public/models/*.onnx /Users/ate/Projects/stepper-web/frontend/dist/models/*.onnx
```
Expected MD5s:
- `stepper_placement.onnx`: `44b9c616171deb7a2c69bcd4cca646f5`
- `stepper_decoder.onnx`: `4c76afd000f973de5ee379a868b94407`

### 5.4 Test Suites Execution
```bash
/Users/ate/Projects/Stepper/.venv/bin/pytest /Users/ate/Projects/Stepper/tests/
/Users/ate/Projects/Stepper/.venv/bin/pytest -v /Users/ate/Projects/Stepper/tests/unit/test_m1_adversarial_onnx.py
```
Expected: 237 passed; 5 passed (28 subtests passed).
