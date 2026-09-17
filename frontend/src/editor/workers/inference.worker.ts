/**
 * frontend/src/editor/workers/inference.worker.ts
 * Dedicated Web Worker for in-browser Stepper AI neural inference.
 * Runs feature extraction, PlacementNet ONNX, and Autoregressive StepSelectionDecoder
 * completely off the main UI thread with transferable ArrayBuffers.
 */

import * as ort from 'onnxruntime-web';
import { MODEL_METADATA, createVerifiedSession } from '../api/modelContract';
import { ClientAudioFeatureExtractor, resampleMonoWaveform } from '../audio/clientFeatureExtract';
import { generationCondition, pickPlacementPeaks } from '../api/stepperApi';
import {
  ClientFootStateMachine,
  ID_TO_CHORD,
  VOCAB_SIZE,
} from '../api/fsmMask';
import type { GenerateRequest, Placement } from '../api/stepperApi';
import { filterPlacedTicksToSpan, prepareDecoderWindowBuffers } from '../api/cfgAcoustics';
import { sampleChordToken } from '../api/chordSampling';

let placementSession: ort.InferenceSession | null = null;
let decoderSession: ort.InferenceSession | null = null;
let featureExtractor: ClientAudioFeatureExtractor | null = null;
let provider: 'webgpu' | 'wasm' = 'wasm';
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Configure ONNX Runtime Web environment and load models.
 */
async function initEngine(baseUrl?: string): Promise<boolean> {
  if (isInitialized && placementSession && decoderSession && featureExtractor) {
    return true;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const cleanBase = (baseUrl || './').endsWith('/') ? (baseUrl || './') : `${baseUrl || './'}/`;
      const placementUrl = `${cleanBase}models/stepper_placement.onnx`;
      const decoderUrl = `${cleanBase}models/stepper_decoder.onnx`;

      // Configure WASM paths
      ort.env.wasm.wasmPaths = `${cleanBase}wasm/`;
      const isIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
      ort.env.wasm.numThreads = isIsolated
        ? Math.min(4, Math.max(1, self.navigator?.hardwareConcurrency || 2))
        : 1;

      // Detect WebGPU support in worker scope
      let ep: 'webgpu' | 'wasm' = 'wasm';
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          const adapter = await (navigator as any).gpu?.requestAdapter();
          if (adapter) {
            ep = 'webgpu';
          }
        } catch {
          ep = 'wasm';
        }
      }
      provider = ep;

      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: ep === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
        graphOptimizationLevel: 'all',
      };

      placementSession = await createVerifiedSession(placementUrl, 'stepper_placement.onnx', sessionOptions);
      decoderSession = await createVerifiedSession(decoderUrl, 'stepper_decoder.onnx', sessionOptions);
      featureExtractor = new ClientAudioFeatureExtractor();
      isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[Worker] Failed to load ONNX models in worker:', err);
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}


/**
 * Run dual-stage neural inference in the Web Worker.
 */
async function runGeneration(
  id: string,
  req: GenerateRequest,
  waveform: Float32Array | undefined,
  startTime: number
): Promise<void> {
  const startBeat = req.start_beat ?? 0.0;
  const requestedBeats = req.num_beats ?? 16.0;
  const numBeats = Math.max(1, Math.ceil(requestedBeats));
  const bpm = req.bpm ?? 140.0;
  const offset = req.offset ?? 0.0;
  const condition = generationCondition(req);
  const meter = condition.meter;
  const threshold = req.threshold ?? 0.5;
  const temperature = req.temperature ?? 1.0;
  const useFsm = req.use_fsm ?? true;

  // 1. Audio feature extraction (Phase-accumulated Slaney Log-Mel + Spectral Flux)
  self.postMessage({ type: 'progress', id, percent: 15, stage: 'Extracting audio features' });
  if (!waveform || waveform.length === 0) {
    throw new Error('A decoded audio waveform is required for neural browser inference');
  }
  const suppliedWaveform = waveform;
  const monoWaveform = resampleMonoWaveform(suppliedWaveform, req.waveform_sample_rate ?? 44100);
  const sliceStartSec = req.slice_start_sec ?? req.start_sec ?? (startBeat * (60.0 / bpm) - offset);
  const audioFeatures = featureExtractor!.extract(
    monoWaveform, numBeats, bpm, offset, startBeat, sliceStartSec, req.tick_times_sec
  );

  // 2. Stage 1 PlacementNet
  self.postMessage({ type: 'progress', id, percent: 35, stage: 'Running PlacementNet ONNX' });
  const audioTensor = new ort.Tensor('float32', audioFeatures, [1, 2, numBeats, 48, 128]);
  const diffTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(meter)]), [1]);

  const techArr = new Float32Array(16);
  if (req.tech_vector && req.tech_vector.length > 0) {
    for (let i = 0; i < Math.min(16, req.tech_vector.length); i++) {
      techArr[i] = req.tech_vector[i];
    }
  }
  const techTensor = new ort.Tensor('float32', techArr, [1, 16]);

  const pResults = await placementSession!.run({
    audio: audioTensor,
    meter: diffTensor,
    tech_vector: techTensor,
  });

  const probsData = pResults.probs.data as Float32Array; // [1, numBeats, 48]
  const acousticMapData = pResults.acoustic_map.data as Float32Array; // [1, totalTicks, 256]
  const nullAcousticMapData = pResults.null_acoustic_map.data as Float32Array;
  const totalTicks = numBeats * 48;

  // 3. Peak picking: match the backend's 3-tick local maxima and retain dense events.
  self.postMessage({ type: 'progress', id, percent: 50, stage: 'Peak picking & NMS' });
  const pickPeaks = (th: number): number[] => {
    return pickPlacementPeaks(probsData.subarray(0, totalTicks), th);
  };

  const placedTicks = filterPlacedTicksToSpan(pickPeaks(threshold), requestedBeats);

  if (placedTicks.length === 0) {
    const latencyMs = performance.now() - startTime;
    self.postMessage({
      type: 'complete',
      id,
      response: {
        placements: [],
        latency_ms: latencyMs,
        ...condition,
        model_id: MODEL_METADATA.model_id,
        checkpoint_sha256: MODEL_METADATA.checkpoint_sha256,
        model_used: `worker-${provider}`,
      },
    });
    return;
  }

  // 4. Stage 2 Autoregressive Step Decoding with FSM playability masking
  const maxLen = 64;
  const numPlaced = placedTicks.length;
  const placements: Placement[] = [];
  const chosenTokens: number[] = [];
  const fsm = new ClientFootStateMachine(null);

  for (let globalIdx = 0; globalIdx < numPlaced; globalIdx++) {
    const tick = placedTicks[globalIdx];
    const beat = tick / 48.0;
    const window = prepareDecoderWindowBuffers(
      acousticMapData,
      nullAcousticMapData,
      placedTicks,
      chosenTokens,
      globalIdx,
      maxLen,
    );

    const pct = 50 + Math.floor((globalIdx / numPlaced) * 45);
    self.postMessage({
      type: 'progress',
      id,
      percent: pct,
      stage: `Choreographing step ${globalIdx + 1}/${numPlaced}`,
    });

    const decoderInputs = {
      step_tokens: new ort.Tensor('int64', window.tokens, [1, maxLen]),
      acoustic_embeddings: new ort.Tensor('float32', window.conditioned, [1, maxLen, 256]),
      null_acoustic_embeddings: new ort.Tensor('float32', window.nullConditioned, [1, maxLen, 256]),
      step_delta_beats: new ort.Tensor('float32', window.deltaBeats, [1, maxLen]),
      step_beat_phases: new ort.Tensor('int64', window.beatPhases, [1, maxLen]),
      step_measure_phases: new ort.Tensor('int64', window.measurePhases, [1, maxLen]),
      meter: diffTensor,
      tech_vector: techTensor,
    };

    const dResults = await decoderSession!.run(decoderInputs);
    const stepLogits = dResults.step_logits.data as Float32Array;
    const logitOffset = window.activeIndex * VOCAB_SIZE;

    const maskedLogits = new Float32Array(VOCAB_SIZE);
    const remainingEvents = numPlaced - globalIdx - 1;
    const delta = window.deltaBeats[window.activeIndex];
    const fsmMask = useFsm
      ? fsm.computeMask(beat, delta, remainingEvents)
      : new Float32Array(VOCAB_SIZE);

    for (let c = 0; c < VOCAB_SIZE; c++) {
      maskedLogits[c] = fsmMask[c] <= -1e8
          ? -Infinity
          : stepLogits[logitOffset + c] + fsmMask[c];
    }

    const chosenToken = sampleChordToken(maskedLogits, temperature);
    chosenTokens.push(chosenToken);
    fsm.updateState(chosenToken, beat, delta);

    const chordStr = ID_TO_CHORD[chosenToken] || '1000';
    placements.push({
      beat: Number((startBeat + beat).toFixed(4)),
      arrows: chordStr,
      chord_idx: chosenToken,
      confidence: 0.95,
    });
  }

  const latencyMs = performance.now() - startTime;
  self.postMessage({
    type: 'progress',
    id,
    percent: 100,
    stage: 'Generation complete',
  });
  self.postMessage({
    type: 'complete',
    id,
    response: {
      placements,
      latency_ms: latencyMs,
      ...condition,
      model_id: MODEL_METADATA.model_id,
      checkpoint_sha256: MODEL_METADATA.checkpoint_sha256,
      model_used: `worker-${provider}`,
    },
  });
}

// Worker message listener
self.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'init') {
    const success = await initEngine(data.baseUrl);
    self.postMessage({
      type: 'init_result',
      success,
      provider,
    });
  } else if (data.type === 'generate') {
    const startTime = performance.now();
    try {
      const ready = await initEngine(data.baseUrl);
      if (!ready || !placementSession || !decoderSession || !featureExtractor) {
        self.postMessage({
          type: 'error',
          id: data.id,
          error: 'In-browser neural models not ready or failed to initialize',
        });
        return;
      }
      await runGeneration(data.id, data.req, data.waveform, startTime);
    } catch (err) {
      console.error('[Worker] Inference error:', err);
      self.postMessage({
        type: 'error',
        id: data.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
