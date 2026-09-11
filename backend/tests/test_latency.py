"""
backend.tests.test_latency
Latency benchmark tests for POST /api/generate.
Enforces:
- 16-beat chunk inference latency < 1.50s (1500 ms)
- Full chart (64-beat) inference latency < 5.00s (5000 ms)
"""

import time
from fastapi.testclient import TestClient


def test_latency_16_beat_chunk_benchmark(client: TestClient, sample_wav_base64: str):
    """
    Latency benchmark: POST /api/generate must complete in strictly < 1.5 seconds (1500 ms)
    for a 16-beat chunk (4 measures).
    """
    payload = {
        "start_beat": 0.0,
        "num_beats": 16.0,
        "bpm": 140.0,
        "difficulty": 3,
        "tech_vector": [0.0] * 16,
        "audio_slice": sample_wav_base64,
    }

    # Warm-up call
    client.post("/api/generate", json=payload)

    # Timed benchmark run
    start = time.perf_counter()
    res = client.post("/api/generate", json=payload)
    elapsed_sec = time.perf_counter() - start

    assert res.status_code == 200
    data = res.json()
    server_latency_ms = data["latency_ms"]

    print(f"\n[BENCHMARK] 16-beat chunk: Wall-clock = {elapsed_sec*1000.0:.2f} ms, Server = {server_latency_ms:.2f} ms")
    assert elapsed_sec < 1.50, f"Latency benchmark exceeded! Expected < 1.5s, got {elapsed_sec:.3f}s"
    assert server_latency_ms < 1500.0, f"Server latency exceeded! Expected < 1500ms, got {server_latency_ms:.1f}ms"


def test_latency_full_chart_benchmark(client: TestClient, sample_wav_base64: str):
    """
    Latency benchmark: POST /api/generate must complete in strictly < 5.0 seconds (5000 ms)
    for a full chart chunk (64 beats = 16 measures).
    """
    payload = {
        "start_beat": 0.0,
        "num_beats": 64.0,
        "bpm": 140.0,
        "difficulty": 3,
        "tech_vector": [0.0] * 16,
        "audio_slice": sample_wav_base64,
    }

    start = time.perf_counter()
    res = client.post("/api/generate", json=payload)
    elapsed_sec = time.perf_counter() - start

    assert res.status_code == 200
    data = res.json()
    server_latency_ms = data["latency_ms"]

    print(f"\n[BENCHMARK] 64-beat full chart: Wall-clock = {elapsed_sec*1000.0:.2f} ms, Server = {server_latency_ms:.2f} ms")
    assert elapsed_sec < 5.00, f"Full chart benchmark exceeded! Expected < 5.0s, got {elapsed_sec:.3f}s"
    assert server_latency_ms < 5000.0, f"Server latency exceeded! Expected < 5000ms, got {server_latency_ms:.1f}ms"


def test_latency_fallback_mode_speed(client: TestClient):
    """
    Fallback generator mode must respond instantaneously (< 200 ms wall-clock).
    """
    payload = {
        "start_beat": 0.0,
        "num_beats": 16.0,
        "bpm": 140.0,
        "difficulty": 4,
        "force_fallback": True,
    }

    start = time.perf_counter()
    res = client.post("/api/generate", json=payload)
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    assert res.status_code == 200
    data = res.json()
    assert data["model_used"] == "fallback"
    assert elapsed_ms < 200.0, f"Fallback mode too slow: {elapsed_ms:.2f} ms"
