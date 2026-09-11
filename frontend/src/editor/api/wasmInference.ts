/**
 * frontend/src/editor/api/wasmInference.ts
 * In-Browser Neural WASM & WebGPU Inference Engine for Stepper AI.
 * Offloads feature extraction, PlacementNet, and StepSelectionDecoder to a dedicated Web Worker,
 * with chunked event-loop yielding and procedural rule-based fallback.
 */

import * as ort from 'onnxruntime-web';
import { clientFeatureExtractor, resampleMonoWaveform } from '../audio/clientFeatureExtract';
import {
  CHORD_TO_ID,
  ClientFootStateMachine,
  ID_TO_CHORD,
  VOCAB_SIZE,
} from './fsmMask';
import { normalizeDifficulty, pickPlacementPeaks } from './stepperApi';
import type { GenerateRequest, GenerateResponse, Placement } from './stepperApi';

export type WasmModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';
export type WasmExecutionProvider = 'webgpu' | 'wasm';

export interface WasmEngineState {
  status: WasmModelStatus;
  provider: WasmExecutionProvider;
  progressPercent: number;
  errorMessage?: string;
  isWorkerActive?: boolean;
}

interface PendingRequest {
  resolve: (res: GenerateResponse) => void;
  reject: (err: any) => void;
  onProgress?: (percent: number, stage?: string) => void;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function isNodeEnv(): boolean {
  return typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.versions?.node != null;
}

export class WasmInferenceEngine {
  private placementSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;
  private status: WasmModelStatus = 'unloaded';
  private provider: WasmExecutionProvider = 'wasm';
  private progressPercent: number = 0;
  private errorMessage?: string;
  private loadPromise: Promise<boolean> | null = null;

  // Web Worker management
  private worker: Worker | null = null;
  private workerInitialized = false;
  private pendingRequests = new Map<string, PendingRequest>();

  constructor() {
    this.configureOrtEnvironment();
  }

  private configureOrtEnvironment(): void {
    if (typeof window === 'undefined') return;
    if (isNodeEnv()) return;

    // Configure WASM paths relative to absolute base URL
    const cleanBase = typeof window !== 'undefined'
      ? new URL(import.meta.env.BASE_URL || './', window.location.href).href
      : './';
    ort.env.wasm.wasmPaths = cleanBase.endsWith('/') ? `${cleanBase}wasm/` : `${cleanBase}/wasm/`;
    const isIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    ort.env.wasm.numThreads = isIsolated
      ? Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2))
      : 1;
  }

  public getState(): WasmEngineState {
    return {
      status: this.status,
      provider: this.provider,
      progressPercent: this.progressPercent,
      errorMessage: this.errorMessage,
      isWorkerActive: this.worker !== null && this.workerInitialized,
    };
  }

  private getWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return null;
    }
    if (isNodeEnv()) {
      return null;
    }
    try {
      const worker = new Worker(
        new URL('../workers/inference.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'progress') {
          if (data.id && this.pendingRequests.has(data.id)) {
            this.pendingRequests.get(data.id)?.onProgress?.(data.percent, data.stage);
          }
        } else if (data.type === 'complete') {
          if (data.id && this.pendingRequests.has(data.id)) {
            const entry = this.pendingRequests.get(data.id)!;
            this.pendingRequests.delete(data.id);
            entry.resolve(data.response);
          }
        } else if (data.type === 'error') {
          if (data.id && this.pendingRequests.has(data.id)) {
            const entry = this.pendingRequests.get(data.id)!;
            this.pendingRequests.delete(data.id);
            entry.reject(new Error(data.error || 'Worker inference failed'));
          }
        }
      };

      worker.onerror = (err) => {
        console.warn('[WasmEngine] Worker error event:', err);
      };

      this.worker = worker;
      return worker;
    } catch (err) {
      console.warn('[WasmEngine] Could not instantiate Web Worker:', err);
      this.worker = null;
      return null;
    }
  }

  /**
   * Initialize ONNX Runtime Web sessions (in worker if available, else on main thread).
   */
  public async initialize(onProgress?: (percent: number) => void): Promise<boolean> {
    if (this.status === 'ready') {
      return true;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.status = 'loading';
    this.progressPercent = 5;
    onProgress?.(5);

    this.loadPromise = (async () => {
      // 1. Try initializing the Web Worker first
      const worker = this.getWorker();
      if (worker) {
        try {
          const workerReady = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), 10000);
            const listener = (e: MessageEvent) => {
              if (e.data?.type === 'init_result') {
                clearTimeout(timer);
                worker.removeEventListener('message', listener);
                if (e.data.provider) this.provider = e.data.provider;
                resolve(Boolean(e.data.success));
              }
            };
            worker.addEventListener('message', listener);
            const baseUrl = typeof window !== 'undefined'
              ? new URL(import.meta.env.BASE_URL || './', window.location.href).href
              : import.meta.env.BASE_URL || './';
            worker.postMessage({ type: 'init', baseUrl });
          });

          if (workerReady) {
            this.workerInitialized = true;
            this.status = 'ready';
            this.progressPercent = 100;
            onProgress?.(100);
            return true;
          }
        } catch (workerErr) {
          console.warn('[WasmEngine] Worker initialization failed, falling back to local thread:', workerErr);
        }
      }

      // 2. Fallback: Initialize on main thread
      try {
        let placementUrl: string;
        let decoderUrl: string;
        const isNode = isNodeEnv();
        if (isNode && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
          placementUrl = 'public/models/stepper_placement.onnx';
          decoderUrl = 'public/models/stepper_decoder.onnx';
        } else {
          const cleanBase = typeof window !== 'undefined'
            ? new URL(import.meta.env.BASE_URL || './', window.location.href).href
            : './';
          placementUrl = cleanBase.endsWith('/')
            ? `${cleanBase}models/stepper_placement.onnx`
            : `${cleanBase}/models/stepper_placement.onnx`;
          decoderUrl = cleanBase.endsWith('/')
            ? `${cleanBase}models/stepper_decoder.onnx`
            : `${cleanBase}/models/stepper_decoder.onnx`;
        }

        // Check WebGPU availability
        let ep: WasmExecutionProvider = 'wasm';
        if (!isNode && typeof navigator !== 'undefined' && 'gpu' in navigator) {
          try {
            const adapter = await (navigator as any).gpu?.requestAdapter();
            if (adapter) {
              ep = 'webgpu';
            }
          } catch {
            ep = 'wasm';
          }
        }
        this.provider = ep;

        const sessionOptions: ort.InferenceSession.SessionOptions = {
          executionProviders: ep === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
          graphOptimizationLevel: 'all',
        };

        // 1. Fetch & Initialize Placement Model
        this.progressPercent = 20;
        onProgress?.(20);
        this.placementSession = await ort.InferenceSession.create(placementUrl, sessionOptions);

        this.progressPercent = 60;
        onProgress?.(60);

        // 2. Fetch & Initialize Decoder Model
        this.decoderSession = await ort.InferenceSession.create(decoderUrl, sessionOptions);

        this.progressPercent = 100;
        this.status = 'ready';
        onProgress?.(100);
        return true;
      } catch (err) {
        console.error('Failed to load in-browser ONNX models:', err);
        this.status = 'error';
        this.errorMessage = err instanceof Error ? err.message : String(err);
        return false;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Run full dual-stage neural inference (via Web Worker off-thread, or local fallback).
   */
  public async generate(
    req: GenerateRequest,
    waveform?: Float32Array,
    onProgress?: (percent: number, stage?: string) => void
  ): Promise<GenerateResponse> {
    const startTime = performance.now();
    if (req.force_fallback) {
      return this.generateRuleBasedFallback(req, startTime);
    }
    if (!waveform || waveform.length === 0) {
      throw new Error('A decoded audio waveform is required for neural browser inference');
    }

    // 1. If Web Worker is available and supported, delegate generation off the main thread
    const worker = this.getWorker();
    if (worker) {
      try {
        return await this.generateViaWorker(worker, req, waveform, onProgress);
      } catch (workerErr) {
        console.warn('[WasmEngine] Worker generation failed, falling back to main-thread/rule engine:', workerErr);
      }
    }

    // 2. Main thread fallback with chunked event-loop yielding
    const isReady = await this.initialize((pct) => onProgress?.(pct, 'Loading models'));
    if (!isReady || !this.placementSession || !this.decoderSession) {
      if (req.force_fallback) {
        return this.generateRuleBasedFallback(req, startTime);
      }
      throw new Error(this.errorMessage || 'In-browser neural models not loaded or failed to initialize');
    }

    const startBeat = req.start_beat ?? 0.0;
    const numBeats = Math.max(1, Math.round(req.num_beats ?? 16.0));
    const bpm = req.bpm ?? 140.0;
    const offset = req.offset ?? 0.0;
    const diffIdx = normalizeDifficulty(req.difficulty);
    const threshold = req.threshold ?? (diffIdx === 0 ? 0.30 : 0.50);
    const temperature = req.temperature ?? 1.0;
    const useFsm = req.use_fsm ?? true;

    // 1. Extract audio features
    onProgress?.(15, 'Extracting audio features');
    await yieldToMain();
    const suppliedWaveform = waveform;
    const monoWaveform = resampleMonoWaveform(suppliedWaveform, req.waveform_sample_rate ?? 44100);
    const sliceStartSec = req.slice_start_sec ?? req.start_sec ?? (startBeat * (60.0 / bpm) - offset);
    const audioFeatures = clientFeatureExtractor.extract(
      monoWaveform, numBeats, bpm, offset, startBeat, sliceStartSec, req.tick_times_sec
    );

    // 2. Run Stage 1 Placement Model
    onProgress?.(35, 'Running PlacementNet ONNX');
    await yieldToMain();
    const audioTensor = new ort.Tensor('float32', audioFeatures, [1, 2, numBeats, 48, 128]);
    const diffTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(diffIdx)]), [1]);

    const techArr = new Float32Array(16);
    if (req.tech_vector && req.tech_vector.length > 0) {
      for (let i = 0; i < Math.min(16, req.tech_vector.length); i++) {
        techArr[i] = req.tech_vector[i];
      }
    }
    const techTensor = new ort.Tensor('float32', techArr, [1, 16]);

    const pResults = await this.placementSession.run({
      audio: audioTensor,
      difficulty: diffTensor,
      tech_vector: techTensor,
    });

    const probsData = pResults.probs.data as Float32Array;
    const acousticMapData = pResults.acoustic_map.data as Float32Array;
    const totalTicks = numBeats * 48;

    // 3. Peak picking: match the backend's 3-tick local maxima and retain dense events.
    onProgress?.(50, 'Peak picking & NMS');
    await yieldToMain();
    const pickPeaks = (th: number): number[] => {
      return pickPlacementPeaks(probsData.subarray(0, totalTicks), th);
    };

    let placedTicks = pickPeaks(threshold);

    // If no peaks found and threshold was not explicitly specified, adaptively lower threshold
    if (placedTicks.length === 0 && req.threshold === undefined) {
      let maxP = 0.0;
      for (let i = 0; i < totalTicks; i++) {
        if (probsData[i] > maxP) maxP = probsData[i];
      }
      if (maxP >= 0.15) {
        placedTicks = pickPeaks(maxP * 0.75);
      }
    }

    if (placedTicks.length === 0) {
      const latencyMs = performance.now() - startTime;
      onProgress?.(100, 'Complete');
      return {
        placements: [],
        latency_ms: latencyMs,
        difficulty_id: diffIdx,
        difficulty_str: ['Novice', 'Easy', 'Medium', 'Hard', 'Expert'][diffIdx],
        model_used: `wasm-${this.provider}`,
      };
    }

    // 4. Stage 2 Autoregressive Step Decoding with FSM
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

        // Yield to browser event loop every 4 steps to maintain 60/120 FPS
        if (stepIdx % 4 === 0) {
          const pct = 50 + Math.floor((globalIdx / numPlaced) * 45);
          onProgress?.(pct, `Decoding step ${globalIdx + 1}/${numPlaced}`);
          await yieldToMain();
        }

        const decoderInputs = {
          step_tokens: new ort.Tensor('int64', tokensBuf, [1, maxLen]),
          acoustic_embeddings: new ort.Tensor('float32', hBuf, [1, maxLen, 256]),
          step_delta_beats: new ort.Tensor('float32', deltaBuf, [1, maxLen]),
          step_beat_phases: new ort.Tensor('int64', phaseBuf, [1, maxLen]),
          step_measure_phases: new ort.Tensor('int64', measBuf, [1, maxLen]),
          difficulty: diffTensor,
          tech_vector: techTensor,
        };

        const dResults = await this.decoderSession.run(decoderInputs);
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
    onProgress?.(100, 'Generation complete');
    return {
      placements,
      latency_ms: latencyMs,
      difficulty_id: diffIdx,
      difficulty_str: ['Novice', 'Easy', 'Medium', 'Hard', 'Expert'][diffIdx],
      model_used: `wasm-${this.provider}`,
    };
  }

  private generateViaWorker(
    worker: Worker,
    req: GenerateRequest,
    waveform?: Float32Array,
    onProgress?: (percent: number, stage?: string) => void
  ): Promise<GenerateResponse> {
    return new Promise((resolve, reject) => {
      const id = `req_${Math.random().toString(36).substring(2)}_${Date.now()}`;
      this.pendingRequests.set(id, { resolve, reject, onProgress });

      const baseUrl = typeof window !== 'undefined'
        ? new URL(import.meta.env.BASE_URL || './', window.location.href).href
        : import.meta.env.BASE_URL || './';

      if (waveform && waveform.buffer) {
        worker.postMessage(
          { type: 'generate', id, req, waveform, baseUrl },
          [waveform.buffer]
        );
      } else {
        worker.postMessage({ type: 'generate', id, req, baseUrl });
      }
    });
  }

  /**
   * Deterministic client-side rule generator used during offline weights download.
   */
  public generateRuleBasedFallback(
    req: GenerateRequest,
    startTime: number
  ): GenerateResponse {
    const startBeat = req.start_beat ?? 0.0;
    const numBeats = Math.max(1, Math.round(req.num_beats ?? 16.0));
    const difficultyMeter =
      typeof req.difficulty === 'number' ? req.difficulty : parseInt(req.difficulty, 10) || 9;
    const diffIdx = normalizeDifficulty(req.difficulty);
    const zTech = req.tech_vector || new Array(16).fill(0);

    const stepInterval = difficultyMeter >= 11 ? 0.25 : difficultyMeter >= 6 ? 0.5 : 1.0;
    const singleTracks = ['1000', '0100', '0010', '0001'];
    let lastTrack = 0;

    const placements: Placement[] = [];
    for (let b = startBeat; b < startBeat + numBeats; b += stepInterval) {
      let chord = '0000';
      const pseudoRand = ((Math.round(b * 100) * 9301 + 49297) % 233280) / 233280;
      const isBracket = zTech[3] > 0.4 && pseudoRand < zTech[3] * 0.5;
      const isJack = zTech[9] > 0.4 && pseudoRand < zTech[9] * 0.6;
      const isFootswitch = zTech[1] > 0.4 && pseudoRand < zTech[1] * 0.5;

      if (isBracket) {
        chord = '1100';
      } else if (isJack || isFootswitch) {
        chord = singleTracks[lastTrack];
      } else {
        lastTrack = (lastTrack + 1 + Math.floor(pseudoRand * 3)) % 4;
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

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerInitialized = false;
    }
  }
}

// Global singleton instance
export const wasmInferenceEngine = new WasmInferenceEngine();
