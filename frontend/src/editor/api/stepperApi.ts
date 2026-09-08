/**
 * frontend/src/editor/api/stepperApi.ts
 * Type-safe client for Stepper AI Inference & Parity Solver backend service.
 * Supports /api/generate, /api/ws/generate, /api/solve-parity, and /api/health.
 */

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

export interface SolveParityRequest {
  steps_type?: string;
  notes: NoteInput[];
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
   */
  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Run chart generation on the server.
   */
  async generate(req: GenerateRequest): Promise<GenerateResponse> {
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
   * Run biomechanical foot solver on the server.
   */
  async solveParity(req: SolveParityRequest): Promise<SolveParityResponse> {
    const payload = {
      steps_type: req.steps_type ?? 'dance-single',
      notes: req.notes,
      bpms: req.bpms ?? [{ beat: 0.0, bpm: 120.0 }],
      difficulty_meter: req.difficulty_meter ?? 9,
    };

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
