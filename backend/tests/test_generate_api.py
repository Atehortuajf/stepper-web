"""
backend.tests.test_generate_api
Integration tests for /api/health, /api/generate, and /api/ws/generate.
"""

from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    """Test GET /api/health returns 200 OK and valid status."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "device" in data
    assert "mps_available" in data
    assert data["model_loaded"] is True
    assert data["version"] == "0.1.0"


def test_generate_endpoint_requires_audio_by_default(client: TestClient):
    """Neural generation must reject a request with no real audio."""
    payload = {
        "start_beat": 0.0,
        "num_beats": 16.0,
        "bpm": 140.0,
        "difficulty": 3,
    }
    res = client.post("/api/generate", json=payload)
    assert res.status_code == 422
    assert "audio_input is required" in res.json()["detail"]


def test_generate_endpoint_with_audio_slice(client: TestClient, sample_wav_base64: str):
    """Test POST /api/generate accepting base64 PCM WAV audio slice."""
    payload = {
        "audio_slice": sample_wav_base64,
        "start_beat": 0.0,
        "num_beats": 8.0,
        "bpm": 120.0,
        "difficulty": 2,
    }
    res = client.post("/api/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["placements"], list)
    assert data["difficulty_id"] == 2
    assert data["difficulty_str"] == "Medium"


def test_generate_endpoint_string_difficulty(client: TestClient):
    """Test POST /api/generate with string difficulty tiers."""
    for diff_name, expected_id in [("Beginner", 0), ("Easy", 1), ("Medium", 2), ("Hard", 3), ("Challenge", 4)]:
        payload = {
            "start_beat": 0.0,
            "num_beats": 8.0,
            "bpm": 130.0,
            "difficulty": diff_name,
            "force_fallback": True,
        }
        res = client.post("/api/generate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["difficulty_id"] == expected_id


def test_generate_endpoint_tech_conditioning(client: TestClient):
    """Test POST /api/generate with 16-D continuous technique conditioning vector."""
    tech_vec = [0.0] * 16
    tech_vec[0] = 0.7  # Crossover
    tech_vec[14] = 1.0  # Stream Stamina

    payload = {
        "start_beat": 0.0,
        "num_beats": 16.0,
        "bpm": 145.0,
        "difficulty": 4,
        "tech_vector": tech_vec,
        "force_fallback": True,
    }
    res = client.post("/api/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["placements"]) > 0
    assert data["model_used"] == "fallback"


def test_generate_endpoint_force_fallback(client: TestClient):
    """Test POST /api/generate with force_fallback flag."""
    payload = {
        "start_beat": 0.0,
        "num_beats": 16.0,
        "bpm": 140.0,
        "difficulty": 3,
        "force_fallback": True,
    }
    res = client.post("/api/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["model_used"] == "fallback"
    assert data["latency_ms"] < 200.0


def test_websocket_streaming_generate(client: TestClient):
    """Test WS /api/ws/generate real-time streaming endpoint."""
    with client.websocket_connect("/api/ws/generate") as ws:
        ws.send_json({
            "params": {
                "start_beat": 0.0,
                "num_beats": 16.0,
                "bpm": 140.0,
                "difficulty": 3,
                "force_fallback": True,
            },
            "chunk_size_beats": 4.0,
        })

        messages = []
        while True:
            msg = ws.receive_json()
            messages.append(msg)
            if msg.get("type") in ("complete", "error"):
                break

        # Must have progress, chunk, and complete messages
        types = [m["type"] for m in messages]
        assert "progress" in types
        assert "chunk" in types
        assert "complete" in types

        complete_msg = messages[-1]
        assert complete_msg["type"] == "complete"
        assert len(complete_msg["placements"]) > 0
        assert complete_msg["progress"] == 1.0
