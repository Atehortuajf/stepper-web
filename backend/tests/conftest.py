"""
backend.tests.conftest
Pytest fixtures and configuration for backend tests.
"""

import base64
import io
import math
import numpy as np
import pytest
import scipy.io.wavfile as wavfile
from fastapi.testclient import TestClient

from pathlib import Path
import sys

# Ensure stepper-web root is on sys.path
_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.core.model_loader import model_service


@pytest.fixture(scope="session", autouse=True)
def initialize_model():
    """Ensure the model service is initialized before tests run."""
    model_service.initialize()


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_wav_bytes() -> bytes:
    """Generates a 3-second 44.1 kHz mono 16-bit PCM WAV file buffer."""
    sr = 44100
    duration = 3.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False, dtype=np.float32)
    # 440 Hz sine wave + beat pulses at 120 BPM (0.5s interval)
    audio = 0.3 * np.sin(2.0 * np.pi * 440.0 * t)
    beat_interval = int(sr * 0.5)
    for i in range(0, len(t), beat_interval):
        end = min(i + int(sr * 0.02), len(t))
        audio[i:end] += 0.5 * np.sin(2.0 * np.pi * 1000.0 * (t[i:end] - t[i]))

    audio = np.clip(audio, -1.0, 1.0)
    audio_int16 = (audio * 32767.0).astype(np.int16)

    buf = io.BytesIO()
    wavfile.write(buf, sr, audio_int16)
    return buf.getvalue()


@pytest.fixture
def sample_wav_base64(sample_wav_bytes: bytes) -> str:
    """Returns sample WAV as base64 string."""
    return base64.b64encode(sample_wav_bytes).decode("ascii")


@pytest.fixture
def sample_stereo_wav_bytes() -> bytes:
    """Generates a 2-second 48 kHz stereo 32-bit float PCM WAV file buffer."""
    sr = 48000
    duration = 2.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False, dtype=np.float32)
    left = 0.2 * np.sin(2.0 * np.pi * 330.0 * t)
    right = 0.2 * np.sin(2.0 * np.pi * 440.0 * t)
    stereo = np.stack([left, right], axis=1).astype(np.float32)

    buf = io.BytesIO()
    wavfile.write(buf, sr, stereo)
    return buf.getvalue()
