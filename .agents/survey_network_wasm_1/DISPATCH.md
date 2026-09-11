# Dispatch Assignment: Survey Network Remediation & In-Browser WASM Inference

- **Role**: Survey Spec Miner (Network Audit & In-Browser WASM Inference)
- **Assigned by**: Project Orchestrator
- **Working Directory**: `/Users/ate/Projects/stepper-web/.agents/survey_network_wasm_1`
- **Authoritative Request**: `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (read this first!)
- **Project Root**: `/Users/ate/Projects/stepper-web`

## Objectives:
1. Read `/Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md` (specifically R2, R3 and follow-up from 2026-09-11T05:34:00Z).
2. Audit all occurrences of `localhost`, `127.0.0.1`, port `8000`, `ws://`, or unhandled network requests across the entire `frontend/src/` codebase:
   - Identify every API call, fetch, or WebSocket connection that attempts to hit an external or local server.
   - Specify how to ensure 100% offline functionality.
3. Investigate the client-side ONNX Runtime WebAssembly (`ort-wasm-simd-threaded.wasm`) and Web Audio feature extraction pipeline:
   - Where are ONNX model files or WASM binaries located or expected?
   - How is feature extraction implemented in client-side TS/WASM?
   - How is "Generate Steps" currently triggered, and how should Web Workers / chunked async execution be structured to prevent UI thread lockup?
4. Verify preservation requirements:
   - Ensure mobile touch controls, dual-bank doubles pad, diff overlay, responsive drawer layout, and keyboard shortcuts remain intact.
5. Write your complete survey and specification findings to `/Users/ate/Projects/stepper-web/.agents/survey_network_wasm_1/handoff.md` and report back.

## 2026-09-11T05:35:40Z
<USER_REQUEST>
You are survey_network_wasm_1 (Survey Spec Miner for Network Audit & In-Browser WASM Inference).
Working Directory: /Users/ate/Projects/stepper-web/.agents/survey_network_wasm_1
Authoritative Request: /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md (read this first!)
Dispatch Assignment: /Users/ate/Projects/stepper-web/.agents/survey_network_wasm_1/DISPATCH.md
Project Root: /Users/ate/Projects/stepper-web

Your task:
1. Read /Users/ate/Projects/stepper-web/ORIGINAL_REQUEST.md (specifically R2, R3 and follow-up from 2026-09-11T05:34:00Z).
2. Audit all occurrences of localhost, 127.0.0.1, port 8000, ws://, or unhandled network requests across the entire frontend/src/ codebase:
   - Identify every API call, fetch, or WebSocket connection that attempts to hit an external or local server.
   - Specify how to ensure 100% offline functionality.
3. Investigate the client-side ONNX Runtime WebAssembly (ort-wasm-simd-threaded.wasm) and Web Audio feature extraction pipeline:
   - Where are ONNX model files or WASM binaries located or expected?
   - How is feature extraction implemented in client-side TS/WASM?
   - How is "Generate Steps" currently triggered, and how should Web Workers / chunked async execution be structured to prevent UI thread lockup?
4. Verify preservation requirements:
   - Ensure mobile touch controls, dual-bank doubles pad, diff overlay, responsive drawer layout, and keyboard shortcuts remain intact.
5. Write your complete survey and specification findings to /Users/ate/Projects/stepper-web/.agents/survey_network_wasm_1/handoff.md and report back via send_message to your caller.
</USER_REQUEST>

