/**
 * frontend/src/editor/workers/inference.worker.ts
 * Dedicated Web Worker for in-browser Stepper AI neural inference.
 * Runs feature extraction, PlacementNet ONNX, and Autoregressive StepSelectionDecoder
 * completely off the main UI thread with transferable ArrayBuffers.
 */

import * as ort from 'onnxruntime-web';
import { ClientAudioFeatureExtractor } from '../audio/clientFeatureExtract';
import {
  CHORD_TO_ID,
  ClientFootStateMachine,
  ID_TO_CHORD,
  VOCAB_SIZE,
} from '../api/fsmMask';
import type { GenerateRequest, GenerateResponse, Placement } from '../api/stepperApi';

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

      placementSession = await ort.InferenceSession.create(placementUrl, sessionOptions);
      decoderSession = await ort.InferenceSession.create(decoderUrl, sessionOptions);
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
 * Procedural rule-based generator for offline preview or fallback.
 */
function generateRuleBasedFallback(
  req: GenerateRequest,
  startTime: number
): GenerateResponse {
  const startBeat = req.start_beat ?? 0.0;
  const numBeats = Math.max(4.0, req.num_beats ?? 16.0);
  const difficultyMeter =
    typeof req.difficulty === 'number' ? req.difficulty : parseInt(req.difficulty, 10) || 9;
  const diffIdx = Math.max(0, Math.min(4, Math.floor((difficultyMeter - 1) / 4)));
  const zTech = req.tech_vector || new Array(16).fill(0);

  const stepInterval = difficultyMeter >= 11 ? 0.25 : difficultyMeter >= 6 ? 0.5 : 1.0;
  const singleTracks = ['1000', '0100', '0010', '0001'];
  let lastTrack = 0;

  const placements: Placement[] = [];
  for (let b = startBeat; b < startBeat + numBeats; b += stepInterval) {
    let chord = '0000';
    const isBracket = zTech[3] > 0.4 && Math.random() < zTech[3] * 0.5;
    const isJack = zTech[9] > 0.4 && Math.random() < zTech[9] * 0.6;
    const isFootswitch = zTech[1] > 0.4 && Math.random() < zTech[1] * 0.5;

    if (isBracket) {
      chord = '1100';
    } else if (isJack || isFootswitch) {
      chord = singleTracks[lastTrack];
    } else {
      lastTrack = (lastTrack + 1 + Math.floor(Math.random() * 3)) % 4;
      chord = singleTracks[lastTrack];
    }

    placements.push({
      beat: Number(b.toFixed(4)),
      arrows: chord,
      chord_idx: CHORD_TO_ID[chord] || 1,
      confidence: 0.95,
    });
  }

  return {
    placements,
    latency_ms: performance.now() - startTime,
    difficulty_id: diffIdx,
    difficulty_str: ['Novice', 'Easy', 'Medium', 'Hard', 'Expert'][diffIdx],
    model_used: 'client-rule',
  };
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
  const numBeats = Math.max(4.0, req.num_beats ?? 16.0);
  const bpm = req.bpm ?? 140.0;
  const offset = req.offset ?? 0.0;
  const difficultyMeter =
    typeof req.difficulty === 'number' ? req.difficulty : parseInt(req.difficulty, 10) || 9;
  const diffIdx = Math.max(0, Math.min(4, Math.floor((difficultyMeter - 1) / 4)));
  const threshold = req.threshold ?? 0.5;
  const temperature = req.temperature ?? 1.0;
  const useFsm = req.use_fsm ?? true;

  // 1. Audio feature extraction (Phase-accumulated Slaney Log-Mel + Spectral Flux)
  self.postMessage({ type: 'progress', id, percent: 15, stage: 'Extracting audio features' });
  const monoWaveform =
    waveform && waveform.length > 0
      ? waveform
      : new Float32Array(Math.floor(((numBeats * 60.0) / bpm + 1.0) * 44100));

  const audioFeatures = featureExtractor!.extract(monoWaveform, numBeats, bpm, offset, startBeat);

  // 2. Stage 1 PlacementNet
  self.postMessage({ type: 'progress', id, percent: 35, stage: 'Running PlacementNet ONNX' });
  const audioTensor = new ort.Tensor('float32', audioFeatures, [1, 2, numBeats, 48, 128]);
  const diffTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(diffIdx)]), [1]);

  const techArr = new Float32Array(16);
  if (req.tech_vector && req.tech_vector.length > 0) {
    for (let i = 0; i < Math.min(16, req.tech_vector.length); i++) {
      techArr[i] = req.tech_vector[i];
    }
  }
  const techTensor = new ort.Tensor('float32', techArr, [1, 16]);

  const pResults = await placementSession!.run({
    audio: audioTensor,
    difficulty: diffTensor,
    tech_vector: techTensor,
  });

  const probsData = pResults.probs.data as Float32Array; // [1, numBeats, 48]
  const acousticMapData = pResults.acoustic_map.data as Float32Array; // [1, totalTicks, 256]
  const totalTicks = numBeats * 48;

  // 3. Peak picking & non-maximum suppression (3-tick window)
  self.postMessage({ type: 'progress', id, percent: 50, stage: 'Peak picking & NMS' });
  const placedTicks: number[] = [];
  for (let t = 0; t < totalTicks; t++) {
    const pVal = probsData[t];
    if (pVal > threshold) {
      const left = t > 0 ? probsData[t - 1] : 0.0;
      const right = t < totalTicks - 1 ? probsData[t + 1] : 0.0;
      if (pVal >= left && pVal >= right) {
        placedTicks.push(t);
      }
    }
  }

  if (placedTicks.length === 0) {
    const latencyMs = performance.now() - startTime;
    self.postMessage({
      type: 'complete',
      id,
      response: {
        placements: [],
        latency_ms: latencyMs,
        difficulty_id: diffIdx,
        difficulty_str: ['Novice', 'Easy', 'Medium', 'Hard', 'Expert'][diffIdx],
        model_used: `worker-${provider}`,
      },
    });
    return;
  }

  // 4. Stage 2 Autoregressive Step Decoding with FSM playability masking
  const maxLen = 64;
  const numPlaced = placedTicks.length;
  const placements: Placement[] = [];
  const fsm = new ClientFootStateMachine(diffIdx);

  for (let chunkStart = 0; chunkStart < numPlaced; chunkStart += maxLen) {
    const chunkEnd = Math.min(numPlaced, chunkStart + maxLen);
    const chunkSize = chunkEnd - chunkStart;

    const tokensBuf = new BigInt64Array(maxLen);
    const hBuf = new Float32Array(maxLen * 256);
    const deltaBuf = new Float32Array(maxLen);
    const phaseBuf = new BigInt64Array(maxLen);
    const measBuf = new BigInt64Array(maxLen);

    let prevBeat = chunkStart > 0 ? placedTicks[chunkStart - 1] / 48.0 : 0.0;

    for (let i = 0; i < chunkSize; i++) {
      const tick = placedTicks[chunkStart + i];
      const beat = tick / 48.0;
      const delta = i === 0 && chunkStart === 0 ? 0.0 : beat - prevBeat;
      prevBeat = beat;

      deltaBuf[i] = delta;
      phaseBuf[i] = BigInt(tick % 48);
      measBuf[i] = BigInt(Math.floor(beat) % 4);

      const mapOffset = tick * 256;
      for (let d = 0; d < 256; d++) {
        hBuf[i * 256 + d] = acousticMapData[mapOffset + d];
      }
    }

    for (let stepIdx = 0; stepIdx < chunkSize; stepIdx++) {
      const globalIdx = chunkStart + stepIdx;
      const tick = placedTicks[globalIdx];
      const beat = tick / 48.0;
      const delta = deltaBuf[stepIdx];

      const pct = 50 + Math.floor((globalIdx / numPlaced) * 45);
      self.postMessage({
        type: 'progress',
        id,
        percent: pct,
        stage: `Choreographing step ${globalIdx + 1}/${numPlaced}`,
      });

      const decoderInputs = {
        step_tokens: new ort.Tensor('int64', tokensBuf, [1, maxLen]),
        acoustic_embeddings: new ort.Tensor('float32', hBuf, [1, maxLen, 256]),
        step_delta_beats: new ort.Tensor('float32', deltaBuf, [1, maxLen]),
        step_beat_phases: new ort.Tensor('int64', phaseBuf, [1, maxLen]),
        step_measure_phases: new ort.Tensor('int64', measBuf, [1, maxLen]),
        difficulty: diffTensor,
        tech_vector: techTensor,
      };

      const dResults = await decoderSession!.run(decoderInputs);
      const stepLogits = dResults.step_logits.data as Float32Array;
      const logitOffset = stepIdx * VOCAB_SIZE;

      const maskedLogits = new Float32Array(VOCAB_SIZE);
      const fsmMask = useFsm ? fsm.computeMask(beat, delta) : new Float32Array(VOCAB_SIZE);

      for (let c = 0; c < VOCAB_SIZE; c++) {
        maskedLogits[c] = stepLogits[logitOffset + c] + fsmMask[c];
      }

      let chosenToken = 1;
      if (temperature <= 0.1) {
        let maxVal = -Infinity;
        for (let c = 1; c < VOCAB_SIZE; c++) {
          if (maskedLogits[c] > maxVal) {
            maxVal = maskedLogits[c];
            chosenToken = c;
          }
        }
      } else {
        let maxLogit = -Infinity;
        for (let c = 1; c < VOCAB_SIZE; c++) {
          if (maskedLogits[c] > maxLogit) maxLogit = maskedLogits[c];
        }

        let sumExp = 0.0;
        const expScores = new Float32Array(VOCAB_SIZE);
        for (let c = 1; c < VOCAB_SIZE; c++) {
          if (maskedLogits[c] > -1000) {
            const e = Math.exp((maskedLogits[c] - maxLogit) / temperature);
            expScores[c] = e;
            sumExp += e;
          }
        }

        if (sumExp > 0) {
          let r = Math.random() * sumExp;
          for (let c = 1; c < VOCAB_SIZE; c++) {
            r -= expScores[c];
            if (r <= 0) {
              chosenToken = c;
              break;
            }
          }
        }
      }

      tokensBuf[stepIdx] = BigInt(chosenToken);
      fsm.updateState(chosenToken, beat, delta);

      const chordStr = ID_TO_CHORD[chosenToken] || '1000';
      placements.push({
        beat: Number((startBeat + beat).toFixed(4)),
        arrows: chordStr,
        chord_idx: chosenToken,
        confidence: 0.95,
      });
    }
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
      difficulty_id: diffIdx,
      difficulty_str: ['Novice', 'Easy', 'Medium', 'Hard', 'Expert'][diffIdx],
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
        const fallback = generateRuleBasedFallback(data.req, startTime);
        self.postMessage({ type: 'complete', id: data.id, response: fallback });
        return;
      }
      await runGeneration(data.id, data.req, data.waveform, startTime);
    } catch (err) {
      console.warn('[Worker] Inference error, falling back to rule engine:', err);
      const fallback = generateRuleBasedFallback(data.req, startTime);
      self.postMessage({ type: 'complete', id: data.id, response: fallback });
    }
  }
};
