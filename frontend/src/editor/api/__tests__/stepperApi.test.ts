/**
 * frontend/src/editor/api/__tests__/stepperApi.test.ts
 * Unit tests for Stepper API client (/api/generate, /api/solve-parity, /api/health, WebSocket).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StepperApiClient, stepperApi } from '../stepperApi';
import type { GenerateRequest, SolveParityRequest } from '../stepperApi';

describe('StepperApiClient', () => {
  let client: StepperApiClient;
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    client = new StepperApiClient('http://localhost:8000');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('manages baseUrl and strips trailing slashes', () => {
    const c = new StepperApiClient('http://localhost:8000///');
    expect(c.getBaseUrl()).toBe('http://localhost:8000');

    c.setBaseUrl('http://127.0.0.1:8000//');
    expect(c.getBaseUrl()).toBe('http://127.0.0.1:8000');
  });

  it('checks backend health via /api/health', async () => {
    const mockHealth = {
      status: 'ok',
      device: 'mps:0',
      mps_available: true,
      model_loaded: true,
      torch_version: '2.14.0',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    });

    const res = await client.checkHealth();
    expect(res).toEqual(mockHealth);
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:8000/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  });

  it('throws error when health check fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(client.checkHealth()).rejects.toThrow('Health check failed with HTTP 503');
  });

  it('calls POST /api/generate with structured generation payload', async () => {
    const mockResponse = {
      placements: [
        { beat: 1.0, arrows: '1000', chord_idx: 1, confidence: 0.95 },
        { beat: 2.0, arrows: '0100', chord_idx: 2, confidence: 0.92 },
      ],
      latency_ms: 185.3,
      difficulty_id: 3,
      difficulty_str: 'Hard',
      model_used: 'neural',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const req: GenerateRequest = {
      difficulty: 12,
      tech_vector: new Array(16).fill(0.5),
      start_beat: 0.0,
      num_beats: 16.0,
      bpm: 140.0,
    };

    const res = await client.generate(req);
    expect(res).toEqual(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:8000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: expect.stringContaining('"bpm":140'),
    });
  });

  it('handles error response from /api/generate', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: async () => 'Invalid tech vector dimensions',
    });

    await expect(client.generate({ difficulty: 3 })).rejects.toThrow(
      'Generation failed with HTTP 422: Invalid tech vector dimensions'
    );
  });

  it('calls POST /api/solve-parity with stepchart notes', async () => {
    const mockParity = {
      is_playable: true,
      total_cost: 0.54,
      foot_sequence: ['L', 'R'],
      annotated_steps: [
        {
          beat: 0.0,
          arrows: '1000',
          foot: 'L',
          cost: 0.2,
          warning: null,
          flags: {
            is_crossover: false,
            is_candle: false,
            is_double_step: false,
            is_jack: false,
            is_bracket: false,
            is_footswitch: false,
            is_holdswitch: false,
          },
        },
      ],
      stats: {
        total_steps: 1,
        alternation_rate: 1.0,
        crossovers: 0,
        candles: 0,
        footswitches: 0,
        holdswitches: 0,
        double_steps: 0,
        jacks: 0,
        brackets: 0,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockParity,
    });

    const req: SolveParityRequest = {
      steps_type: 'dance-single',
      notes: [{ beat: 0.0, arrows: '1000' }],
      bpms: [{ beat: 0.0, bpm: 140.0 }],
      difficulty_meter: 12,
    };

    const res = await client.solveParity(req);
    expect(res).toEqual(mockParity);
    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:8000/api/solve-parity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: expect.stringContaining('"steps_type":"dance-single"'),
    });
  });

  it('connects WebSocket and processes progress, chunk, and complete messages', () => {
    let wsOnOpen: any = null;
    let wsOnMessage: any = null;
    const sentData: string[] = [];

    const mockWsClose = vi.fn();
    class MockWebSocket {
      public readyState = 1;
      public close = mockWsClose;
      public send(d: string) {
        sentData.push(d);
      }
      set onopen(fn: () => void) {
        wsOnOpen = fn;
      }
      set onmessage(fn: (e: { data: string }) => void) {
        wsOnMessage = fn;
      }
      set onerror(_fn: (e: any) => void) {}
    }

    (globalThis as any).WebSocket = MockWebSocket;

    const onProgress = vi.fn();
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const session = client.createWebSocketSession(
      { difficulty: 3, num_beats: 16.0 },
      { onProgress, onChunk, onComplete, onError }
    );

    // Simulate open
    wsOnOpen?.();
    expect(sentData.length).toBe(1);
    expect(sentData[0]).toContain('"action":"generate"');

    // Simulate progress message
    wsOnMessage?.({
      data: JSON.stringify({ type: 'progress', progress: 0.5, message: 'Processing Mel frames' }),
    });
    expect(onProgress).toHaveBeenCalledWith(0.5, 'Processing Mel frames');

    // Simulate chunk message
    wsOnMessage?.({
      data: JSON.stringify({
        type: 'chunk',
        placements: [{ beat: 4.0, arrows: '1000', chord_idx: 1, confidence: 0.9 }],
      }),
    });
    expect(onChunk).toHaveBeenCalled();

    // Simulate complete message
    wsOnMessage?.({
      data: JSON.stringify({
        type: 'complete',
        placements: [{ beat: 4.0, arrows: '1000', chord_idx: 1, confidence: 0.9 }],
        latency_ms: 190.0,
      }),
    });
    expect(onComplete).toHaveBeenCalled();
    expect(mockWsClose).toHaveBeenCalled();

    session.close();
  });

  it('exports singleton instance stepperApi', () => {
    expect(stepperApi).toBeDefined();
    expect(stepperApi).toBeInstanceOf(StepperApiClient);
  });
});
