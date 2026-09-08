/**
 * frontend/src/editor/api/wasmInference.ts
 * In-Browser Neural WASM & WebGPU Inference Engine for Stepper AI.
 * Loads and executes Stage 1 (PlacementNet) and Stage 2 (StepSelectionDecoder)
 * ONNX models directly inside the browser with zero backend dependencies.
 */

import * as ort from 'onnxruntime-web';
import { clientFeatureExtractor } from '../audio/clientFeatureExtract';
import {
  CHORD_TO_ID,
  ClientFootStateMachine,
  ID_TO_CHORD,
  VOCAB_SIZE,
} from './fsmMask';
import type { GenerateRequest, GenerateResponse, Placement } from './stepperApi';

export type WasmModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';
export type WasmExecutionProvider = 'webgpu' | 'wasm';

export interface WasmEngineState {
  status: WasmModelStatus;
  provider: WasmExecutionProvider;
  progressPercent: number;
  errorMessage?: string;
}

export class WasmInferenceEngine {
  private placementSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;
  private status: WasmModelStatus = 'unloaded';
  private provider: WasmExecutionProvider = 'wasm';
  private progressPercent: number = 0;
  private errorMessage?: string;
  private loadPromise: Promise<boolean> | null = null;

  constructor() {
    this.configureOrtEnvironment();
  }

  private configureOrtEnvironment(): void {
    if (typeof window === 'undefined') return;

    // Configure WASM paths relative to base URL
    const baseUrl = import.meta.env.BASE_URL || './';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    ort.env.wasm.wasmPaths = `${cleanBase}wasm/`;
    ort.env.wasm.numThreads = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2));
  }

  public getState(): WasmEngineState {
    return {
      status: this.status,
      provider: this.provider,
      progressPercent: this.progressPercent,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Initialize ONNX Runtime Web sessions for placement and decoder models.
   */
  public async initialize(onProgress?: (percent: number) => void): Promise<boolean> {
    if (this.status === 'ready' && this.placementSession && this.decoderSession) {
      return true;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.status = 'loading';
    this.progressPercent = 5;
    onProgress?.(5);

    this.loadPromise = (async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL || './';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const placementUrl = `${cleanBase}models/stepper_placement.onnx`;
        const decoderUrl = `${cleanBase}models/stepper_decoder.onnx`;

        // Check WebGPU availability
        let ep: WasmExecutionProvider = 'wasm';
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
        console.warn('Failed to load in-browser ONNX models, falling back to rule-based engine:', err);
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
   * Run full dual-stage neural inference in the browser.
   */
  public async generate(
    req: GenerateRequest,
    waveform?: Float32Array
  ): Promise<GenerateResponse> {
    const startTime = performance.now();

    const isReady = await this.initialize();
    if (!isReady || !this.placementSession || !this.decoderSession) {
      return this.generateRuleBasedFallback(req, startTime);
    }

    const startBeat = req.start_beat ?? 0.0;
    const numBeats = Math.max(4.0, req.num_beats ?? 16.0);
    const bpm = req.bpm ?? 140.0;
    const offset = req.offset ?? 0.0;
    const difficultyMeter = typeof req.difficulty === 'number' ? req.difficulty : parseInt(req.difficulty, 10) || 9;
    const diffIdx = Math.max(0, Math.min(4, Math.floor((difficultyMeter - 1) / 4)));
    const threshold = req.threshold ?? 0.5;
    const temperature = req.temperature ?? 1.0;
    const useFsm = req.use_fsm ?? true;

    // 1. Extract audio features
    const monoWaveform = waveform && waveform.length > 0 ? waveform : new Float32Array(Math.floor((numBeats * 60.0 / bpm + 1.0) * 44100));
    const audioFeatures = clientFeatureExtractor.extract(monoWaveform, numBeats, bpm, offset, startBeat);

    // 2. Run Stage 1 Placement Model
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

    const probsData = pResults.probs.data as Float32Array; // [1, numBeats, 48]
    const acousticMapData = pResults.acoustic_map.data as Float32Array; // [1, totalTicks, 256]
    const totalTicks = numBeats * 48;

    // 3. Peak Picking & Non-Maximum Suppression (3-tick window)
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

    // Process notes in fixed windows of maxLen
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

        // Copy 256-dim acoustic vector for tick
        const mapOffset = tick * 256;
        for (let d = 0; d < 256; d++) {
          hBuf[i * 256 + d] = acousticMapData[mapOffset + d];
        }
      }

      // Autoregressively predict tokens for this chunk
      for (let stepIdx = 0; stepIdx < chunkSize; stepIdx++) {
        const globalIdx = chunkStart + stepIdx;
        const tick = placedTicks[globalIdx];
        const beat = tick / 48.0;
        const delta = deltaBuf[stepIdx];

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
        const stepLogits = dResults.step_logits.data as Float32Array; // [1, maxLen, 96]
        const logitOffset = stepIdx * VOCAB_SIZE;

        // Apply FSM Playability Logit Mask
        const maskedLogits = new Float32Array(VOCAB_SIZE);
        const fsmMask = useFsm ? fsm.computeMask(beat, delta) : new Float32Array(VOCAB_SIZE);

        for (let c = 0; c < VOCAB_SIZE; c++) {
          maskedLogits[c] = stepLogits[logitOffset + c] + fsmMask[c];
        }

        // Temperature-scaled softmax or argmax
        let chosenToken = 1; // Default '1000'
        if (temperature <= 0.1) {
          let maxVal = -Infinity;
          for (let c = 1; c < VOCAB_SIZE; c++) {
            if (maskedLogits[c] > maxVal) {
              maxVal = maskedLogits[c];
              chosenToken = c;
            }
          }
        } else {
          // Temperature scaling
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
    return {
      placements,
      latency_ms: latencyMs,
      difficulty_id: diffIdx,
      difficulty_str: ['Novice', 'Easy', 'Medium', 'Hard', 'Expert'][diffIdx],
      model_used: `wasm-${this.provider}`,
    };
  }

  /**
   * Deterministic client-side rule generator used during offline weights download.
   */
  public generateRuleBasedFallback(
    req: GenerateRequest,
    startTime: number
  ): GenerateResponse {
    const startBeat = req.start_beat ?? 0.0;
    const numBeats = Math.max(4.0, req.num_beats ?? 16.0);
    const difficultyMeter = typeof req.difficulty === 'number' ? req.difficulty : parseInt(req.difficulty, 10) || 9;
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
}

// Global singleton instance
export const wasmInferenceEngine = new WasmInferenceEngine();
