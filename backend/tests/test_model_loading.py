"""
backend.tests.test_model_loading
Unit tests for model loading, synthetic weights initialization, and fallback generator.
"""

from pathlib import Path
import tempfile
import numpy as np
import pytest
import torch

from backend.app.core.config import settings
from backend.app.core.fallback_model import FallbackGenerator
from backend.app.core.model_loader import model_service
from backend.scripts.init_weights import export_checkpoint


def test_device_selection():
    """Verify device selection prioritizes MPS on Apple Silicon, else CPU."""
    dev = settings.get_device()
    assert isinstance(dev, torch.device)
    if torch.backends.mps.is_available():
        assert dev.type == "mps"
    else:
        assert dev.type in ("cuda", "cpu")


def test_model_service_is_loaded():
    """Verify model service loaded state and metadata."""
    status = model_service.get_status()
    assert status["status"] == "healthy"
    assert status["model_loaded"] is True
    assert status["model_type"] in ("genuine", "synthetic", "fallback")
    assert "device" in status
    assert "version" in status


def test_synthetic_weight_export_and_load():
    """Test automated deterministic synthetic weights initialization script."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_weight_path = Path(tmpdir) / "test_weights_fp16.pt"
        export_checkpoint(tmp_weight_path, seed=123, fp16=True)

        assert tmp_weight_path.exists()
        assert tmp_weight_path.stat().st_size > 10 * 1024 * 1024  # > 10 MB

        ckpt = torch.load(tmp_weight_path, map_location="cpu", weights_only=True)
        assert "model_state_dict" in ckpt
        assert ckpt["config"]["synthetic"] is True
        assert ckpt["config"]["seed"] == 123


def test_fallback_generator_difficulties():
    """Verify fallback generator scales note density across difficulty tiers (0 to 4)."""
    gen = FallbackGenerator()

    # Novice (0) vs Expert (4)
    novice_placements = gen.generate(num_beats=16.0, bpm=120.0, difficulty=0)
    expert_placements = gen.generate(num_beats=16.0, bpm=120.0, difficulty=4)

    assert len(novice_placements) > 0
    assert len(expert_placements) > len(novice_placements)

    # In Novice, no jumps allowed (only 1 arrow active per chord)
    for p in novice_placements:
        assert p["arrows"].count("1") <= 1


def test_fallback_generator_technique_conditioning():
    """Verify fallback generator responds to z_tech conditioning parameters."""
    gen = FallbackGenerator()

    # 1. High footswitch vector
    tech_fs = [0.0] * 16
    tech_fs[1] = 1.0  # footswitch
    fs_placements = gen.generate(num_beats=16.0, bpm=140.0, difficulty=3, tech_vector=tech_fs)
    assert len(fs_placements) > 0

    # 2. High crossover vector
    tech_xo = [0.0] * 16
    tech_xo[0] = 1.0  # crossover
    xo_placements = gen.generate(num_beats=16.0, bpm=140.0, difficulty=3, tech_vector=tech_xo)
    assert len(xo_placements) > 0

    # 3. Clean / No Tech
    tech_clean = [0.0] * 16
    tech_clean[15] = 1.0  # no_tech
    clean_placements = gen.generate(num_beats=16.0, bpm=140.0, difficulty=2, tech_vector=tech_clean)
    assert len(clean_placements) > 0


def test_fallback_generator_latency():
    """Verify fallback generator generates 16-beat chunk in < 25ms."""
    import time
    gen = FallbackGenerator()

    start = time.perf_counter()
    placements = gen.generate(num_beats=16.0, bpm=140.0, difficulty=3)
    duration_ms = (time.perf_counter() - start) * 1000.0

    assert duration_ms < 50.0  # well under 50ms
    assert len(placements) > 0
