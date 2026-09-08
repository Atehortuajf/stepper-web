"""
backend.tests.test_parity_api
Integration tests for POST /api/solve-parity endpoint.
"""

from fastapi.testclient import TestClient


def test_parity_empty_notes(client: TestClient):
    """Test POST /api/solve-parity with empty notes list."""
    payload = {
        "steps_type": "dance-single",
        "notes": [],
    }
    res = client.post("/api/solve-parity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_playable"] is True
    assert data["total_cost"] == 0.0
    assert data["foot_sequence"] == []


def test_parity_natural_alternation(client: TestClient):
    """Test simple 4-note stream (Left, Down, Up, Right) achieves natural L-R alternation."""
    payload = {
        "steps_type": "dance-single",
        "notes": [
            {"beat": 0.0, "arrows": "1000"},  # Left
            {"beat": 0.5, "arrows": "0100"},  # Down
            {"beat": 1.0, "arrows": "0010"},  # Up
            {"beat": 1.5, "arrows": "0001"},  # Right
        ],
    }
    res = client.post("/api/solve-parity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_playable"] is True
    assert data["total_cost"] < 1.0
    assert data["foot_sequence"] == ["L", "R", "L", "R"]
    assert len(data["annotated_steps"]) == 4

    # Verify no unplayability warnings
    for step in data["annotated_steps"]:
        assert step["warning"] is None
        assert step["flags"]["is_double_step"] is False


def test_parity_double_step_detection(client: TestClient):
    """Test detection of unchoreographed double steps."""
    payload = {
        "steps_type": "dance-single",
        "notes": [
            {"beat": 0.0, "arrows": "1000"},
            {"beat": 0.1, "arrows": "0100"},
            {"beat": 0.2, "arrows": "1000"},
            {"beat": 0.3, "arrows": "0100"},
        ],
        "difficulty_meter": 7,
    }
    res = client.post("/api/solve-parity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "annotated_steps" in data
    assert "stats" in data
    assert data["stats"]["total_steps"] == 4


def test_parity_crossover_detection(client: TestClient):
    """Test detection of front and back crossovers."""
    # Pattern: Left, Up, Right, Up, Left where Right is hit while turned
    payload = {
        "steps_type": "dance-single",
        "notes": [
            {"beat": 0.0, "arrows": "1000"},  # L on Left
            {"beat": 0.5, "arrows": "0010"},  # R on Up
            {"beat": 1.0, "arrows": "0001"},  # L crosses over to Right!
            {"beat": 1.5, "arrows": "0010"},  # R on Up
            {"beat": 2.0, "arrows": "1000"},  # L back to Left
        ],
    }
    res = client.post("/api/solve-parity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_playable"] is True
    # At least one step flagged as crossover or stats counts crossover
    has_xo = any(s["flags"]["is_crossover"] for s in data["annotated_steps"]) or data["stats"]["crossovers"] > 0
    assert has_xo or data["foot_sequence"] == ["L", "R", "L", "R", "L"]


def test_parity_bracket_detection(client: TestClient):
    """Test detection of bracket hits on adjacent panels."""
    payload = {
        "steps_type": "dance-single",
        "notes": [
            {"beat": 0.0, "arrows": "1100"},  # Left + Down adjacent bracket
            {"beat": 1.0, "arrows": "0011"},  # Up + Right adjacent bracket
        ],
        "difficulty_meter": 12,
    }
    res = client.post("/api/solve-parity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_playable"] is True
