# Browser/backend inference consistency handoff

## Implemented

- Browser and Python feature extraction use the trained front-end constants: 44.1 kHz, 1024-point FFT, 128 Slaney Mel bands, and 20–16,000 Hz frequency bounds.
- Browser waveform input carries its decoded sample rate and is linearly resampled to 44.1 kHz before feature extraction. Tensor shapes remain `(1, 2, beats, 48, 128)` in the browser and `(2, beats, 48, 128)` before backend batching.
- Both extractors accept exactly one absolute song time for every half-open 1/48-beat tick. This supports BPM changes, stops, delays, and warps using the editor's real timing map. Invalid tick counts fail explicitly.
- Audio slices carry the absolute time represented by sample zero. The App sends the actual floored/clamped sample origin (`startSample / sampleRate`), so negative-time zero padding and nonzero slices remain aligned.
- Python PCM decoding scales integer samples before stereo mixing. This fixes integer stereo being interpreted at raw integer amplitude.
- Browser meter/name difficulty normalization now matches the backend mapping. Browser main-thread and worker peak selection match the backend model's three-tick local-maximum rule and no longer discard valid dense events with a six-tick refractory period.
- Missing or invalid backend audio now raises a 422 error unless `force_fallback` explicitly enables synthetic demo audio. Browser neural inference likewise requires a decoded waveform; explicit rule fallback does not.
- REST maps invalid audio/timing input to 422 and unavailable neural inference to 503. WebSocket generation emits an error message for either condition and remains available for another request.

## Verification

- Browser DSP/API tests include a full 12,288-value cross-runtime tensor comparison.
- Full frontend suite: 19 files, 202 tests passed, including the 13-test M6/M7 empirical suite.
- Python DSP tests: 9 tests passed using the repository audit environment and local Stepper dependency.
- For the deterministic full-tensor fixture, browser versus PyTorch mean absolute error is `0.00005444` and maximum absolute error is `0.01984133`. The fixture uses a nonzero slice origin and variable per-tick times; a separate 1 kHz signal selects Mel band 33 in both implementations.
- TypeScript and Vite production build passed.
- Full backend suite: 35 tests passed in 1.66 seconds with `OMP_NUM_THREADS=2` outside the filesystem sandbox. FastAPI `TestClient` requires a local event-loop socket, which explains the earlier apparent hang under sandbox restrictions.

## Contract for callers

- `num_beats` is rounded to a positive whole number consistently with the fixed model tensor dimension.
- `tick_times_sec` length must equal `num_beats * 48`; it excludes the range endpoint.
- `slice_start_sec` is the time of the first supplied sample, after clamping and sample-index flooring.
- `waveform_sample_rate` is required for browser waveforms decoded at rates other than 44.1 kHz.

## Remaining limits

- Linear browser resampling is deterministic and alignment-correct but has lower stop-band quality than the backend's torchaudio resampler. It preserves the existing model input contract without adding a large browser DSP dependency.
- Full numeric tensor equality is not asserted across JavaScript and PyTorch FFT implementations; the shared real-signal Mel-band fixture catches configuration and frequency-axis drift.
- Model checkpoint provenance, empty neural output behavior, and truthful `model_used` reporting are handled separately in `backend/app/core/model_loader.py`.
