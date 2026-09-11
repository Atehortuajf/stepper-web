/**
 * frontend/src/editor/api/stepperApi.ts
 * Type-safe client for Stepper AI Inference & Parity Solver backend service.
 * Supports /api/generate, /api/ws/generate, /api/solve-parity, and /api/health.
 */

import { solveParityLocally } from '../biomechanics/localParitySolver';
import type { NoteRow, HoldNote } from '../engine/types';

export interface GenerateRequest {
  audio_slice?: string | null;
  difficulty: number | string;
  tech_vector?: number[] | null;
  start_beat?: number;
  num_beats?: number;
  bpm?: number;
  offset?: number;
  threshold?: number;
  temperature?: number;
  use_fsm?: boolean;
  force_fallback?: boolean;
}

export interface Placement {
  beat: number;
  arrows: string;
  chord_idx: number;
  confidence: number;
}

export interface GenerateResponse {
  placements: Placement[];
  latency_ms: number;
  difficulty_id: number;
  difficulty_str: string;
  model_used: string;
}

export interface WSGenerateMessage {
  action: 'generate' | 'cancel';
  params: GenerateRequest;
  chunk_size_beats?: number;
}

export interface WSGenerateResponse {
  type: 'progress' | 'chunk' | 'complete' | 'error';
  progress?: number;
  message?: string;
  placements?: Placement[];
  latency_ms?: number;
}

export interface NoteInput {
  beat: number;
  arrows: string;
}

export interface BpmInput {
  beat: number;
  bpm: number;
}

export interface HoldInput {
  track: number;
  start_beat: number;
  end_beat: number;
  is_roll?: boolean;
}

export interface SolveParityRequest {
  steps_type?: string;
  notes: NoteInput[];
  holds?: HoldInput[];
  bpms?: BpmInput[];
  difficulty_meter?: number;
}

export interface StepFlags {
  is_crossover: boolean;
  crossover_type?: 'front' | 'back' | null;
  is_candle: boolean;
  is_double_step: boolean;
  is_jack: boolean;
  is_bracket: boolean;
  is_footswitch: boolean;
  is_holdswitch: boolean;
}

export interface AnnotatedStep {
  beat: number;
  arrows: string;
  foot: string; // 'L', 'R', 'LR', 'None'
  cost: number;
  warning?: string | null;
  left_pos?: number | number[] | null;
  right_pos?: number | number[] | null;
  flags: StepFlags;
}

export interface ParityStats {
  total_steps: number;
  alternation_rate: number;
  crossovers: number;
  candles: number;
  footswitches: number;
  holdswitches: number;
  double_steps: number;
  jacks: number;
  brackets: number;
}

export interface SolveParityResponse {
  is_playable: boolean;
  total_cost: number;
  foot_sequence: string[];
  annotated_steps: AnnotatedStep[];
  stats?: ParityStats;
}

export interface HealthResponse {
  status: string;
  device?: string;
  mps_available?: boolean;
  model_loaded?: boolean;
  weights_path?: string;
  torch_version?: string;
}

export class StepperApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/+$/, '');
    } else if (typeof window !== 'undefined' && window.location && window.location.port === '5173') {
      // In Vite dev server, backend is typically on 8000
      this.baseUrl = 'http://localhost:8000';
    } else {
      this.baseUrl = 'http://localhost:8000';
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  /**
   * Check backend health and model loading status.
   * When in 'wasm' mode, resolves immediately with wasm-local status without calling fetch().
   */
  async checkHealth(): Promise<HealthResponse> {
    if (this.engineMode === 'wasm' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return {
        status: 'healthy',
        device: 'wasm-local',
        model_loaded: true,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        if (this.engineMode === 'auto') {
          return {
            status: 'healthy',
            device: 'wasm-local',
            model_loaded: true,
          };
        }
        throw new Error(`Health check failed with HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    } catch (err) {
      if (this.engineMode === 'auto') {
        return {
          status: 'healthy',
          device: 'wasm-local',
          model_loaded: true,
        };
      }
      throw err;
    }
  }

  private engineMode: 'wasm' | 'backend' | 'auto' = 'wasm';

  public getEngineMode(): 'wasm' | 'backend' | 'auto' {
    return this.engineMode;
  }

  public setEngineMode(mode: 'wasm' | 'backend' | 'auto'): void {
    this.engineMode = mode;
  }

  /**
   * Run chart generation via in-browser WASM or remote backend.
   */
  async generate(
    req: GenerateRequest,
    waveform?: Float32Array,
    onProgress?: (percent: number, stage?: string) => void
  ): Promise<GenerateResponse> {
    if (this.engineMode === 'wasm' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const { wasmInferenceEngine } = await import('./wasmInference');
      return wasmInferenceEngine.generate(req, waveform, onProgress);
    }

    if (this.engineMode === 'backend') {
      return this.generateViaBackend(req);
    }

    // Auto mode: Try in-browser WASM first, fallback to backend or rule
    try {
      const { wasmInferenceEngine } = await import('./wasmInference');
      return await wasmInferenceEngine.generate(req, waveform, onProgress);
    } catch {
      try {
        return await this.generateViaBackend(req);
      } catch {
        const { wasmInferenceEngine } = await import('./wasmInference');
        return wasmInferenceEngine.generateRuleBasedFallback(req, performance.now());
      }
    }
  }

  private async generateViaBackend(req: GenerateRequest): Promise<GenerateResponse> {
    const payload = {
      audio_slice: req.audio_slice ?? null,
      difficulty: req.difficulty,
      tech_vector: req.tech_vector ?? null,
      start_beat: req.start_beat ?? 0.0,
      num_beats: req.num_beats ?? 16.0,
      bpm: req.bpm ?? 140.0,
      offset: req.offset ?? 0.0,
      threshold: req.threshold ?? 0.5,
      temperature: req.temperature ?? 1.0,
      use_fsm: req.use_fsm ?? true,
      force_fallback: req.force_fallback ?? false,
    };

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Generation failed with HTTP ${res.status}: ${errorText || res.statusText}`);
    }

    return res.json();
  }

  /**
   * Run biomechanical foot solver on the server or locally in WASM mode.
   * When in 'wasm' mode, calls solveParityLocally with zero network requests.
   */
  async solveParity(req: SolveParityRequest): Promise<SolveParityResponse> {
    if (this.engineMode === 'wasm' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const noteRows: NoteRow[] = (req.notes || []).map((n) => ({
        beat: n.beat,
        row: Math.round(n.beat * 48),
        arrows: n.arrows,
      }));
      const holds: HoldNote[] = (req.holds || []).map((h) => ({
        track: h.track,
        startBeat: h.start_beat,
        endBeat: h.end_beat,
        startRow: Math.round(h.start_beat * 48),
        endRow: Math.round(h.end_beat * 48),
        isRoll: h.is_roll ?? false,
      }));
      const bpms = req.bpms && req.bpms.length > 0 ? req.bpms : [{ beat: 0.0, bpm: 120.0 }];
      const meter = req.difficulty_meter ?? 9;
      const localRes = solveParityLocally(noteRows, holds, bpms, meter);
      return {
        is_playable: localRes.is_playable,
        total_cost: localRes.total_cost,
        foot_sequence: localRes.foot_sequence,
        annotated_steps: localRes.steps.map((s) => ({
          beat: s.beat,
          arrows: s.arrows,
          foot: s.foot,
          cost: s.cost,
          warning: s.warning,
          left_pos: s.left_pos,
          right_pos: s.right_pos,
          flags: s.flags,
        })),
        stats: localRes.stats,
      };
    }

    const payload = {
      steps_type: req.steps_type ?? 'dance-single',
      notes: req.notes,
      bpms: req.bpms ?? [{ beat: 0.0, bpm: 120.0 }],
      difficulty_meter: req.difficulty_meter ?? 9,
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/solve-parity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Parity solve failed with HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      return res.json();
    } catch (err) {
      if (this.engineMode === 'auto') {
        const noteRows: NoteRow[] = (req.notes || []).map((n) => ({
          beat: n.beat,
          row: Math.round(n.beat * 48),
          arrows: n.arrows,
        }));
        const holds = (req.holds || []).map((h) => ({
          track: h.track,
          startBeat: h.start_beat,
          endBeat: h.end_beat,
          startRow: Math.round(h.start_beat * 48),
          endRow: Math.round(h.end_beat * 48),
          isRoll: h.is_roll ?? false,
        }));
        const bpms = req.bpms && req.bpms.length > 0 ? req.bpms : [{ beat: 0.0, bpm: 120.0 }];
        const meter = req.difficulty_meter ?? 9;
        const localRes = solveParityLocally(noteRows, holds, bpms, meter);
        return {
          is_playable: localRes.is_playable,
          total_cost: localRes.total_cost,
          foot_sequence: localRes.foot_sequence,
          annotated_steps: localRes.steps.map((s) => ({
            beat: s.beat,
            arrows: s.arrows,
            foot: s.foot,
            cost: s.cost,
            warning: s.warning,
            left_pos: s.left_pos,
            right_pos: s.right_pos,
            flags: s.flags,
          })),
          stats: localRes.stats,
        };
      }
      throw err;
    }
  }

  /**
   * Open WebSocket for streaming generation.
   */
  createWebSocketSession(
    req: GenerateRequest,
    callbacks: {
      onProgress?: (progress: number, message?: string) => void;
      onChunk?: (placements: Placement[]) => void;
      onComplete?: (placements: Placement[], latencyMs?: number) => void;
      onError?: (err: Error) => void;
    }
  ): { cancel: () => void; close: () => void } {
    if (this.engineMode === 'wasm' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      let cancelled = false;
      callbacks.onProgress?.(10, 'Initializing local inference...');
      import('./wasmInference').then(({ wasmInferenceEngine }) => {
        if (cancelled) return;
        wasmInferenceEngine
          .generate(req, undefined, (pct, stage) => {
            if (cancelled) return;
            callbacks.onProgress?.(pct, stage);
          })
          .then((res) => {
            if (cancelled) return;
            callbacks.onChunk?.(res.placements);
            callbacks.onProgress?.(100, 'Complete');
            callbacks.onComplete?.(res.placements, res.latency_ms);
          })
          .catch((err) => {
            if (cancelled) return;
            callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
          });
      });
      return {
        cancel: () => {
          cancelled = true;
        },
        close: () => {
          cancelled = true;
        },
      };
    }

    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/ws/generate';
    const ws = new WebSocket(wsUrl);

    let cancelled = false;

    ws.onopen = () => {
      if (cancelled) {
        ws.close();
        return;
      }
      const msg: WSGenerateMessage = {
        action: 'generate',
        params: req,
        chunk_size_beats: 4.0,
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (event) => {
      try {
        const data: WSGenerateResponse = JSON.parse(event.data);
        if (data.type === 'progress') {
          callbacks.onProgress?.(data.progress ?? 0, data.message);
        } else if (data.type === 'chunk') {
          if (data.placements) {
            callbacks.onChunk?.(data.placements);
          }
        } else if (data.type === 'complete') {
          callbacks.onComplete?.(data.placements ?? [], data.latency_ms);
          ws.close();
        } else if (data.type === 'error') {
          callbacks.onError?.(new Error(data.message || 'WebSocket generation error'));
          ws.close();
        }
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    ws.onerror = (e) => {
      callbacks.onError?.(new Error(`WebSocket connection error: ${String(e)}`));
    };

    return {
      cancel: () => {
        cancelled = true;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'cancel', params: req }));
          ws.close();
        }
      },
      close: () => {
        ws.close();
      },
    };
  }
}

export const stepperApi = new StepperApiClient();
