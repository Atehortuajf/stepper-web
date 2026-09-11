"""
backend.app.core.config
Core configuration and environment settings.
"""

import os
from pathlib import Path
from typing import Optional
import torch

# Base paths
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BACKEND_DIR / "models"


class Settings:
    PROJECT_NAME: str = "Stepper-Web AI Inference Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"

    # Server options
    HOST: str = os.getenv("STEPPER_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("STEPPER_PORT", "8000"))

    # Audio feature extraction parameters
    SAMPLE_RATE: int = 44100
    N_FFT: int = 1024
    N_MELS: int = 128
    F_MIN: float = 20.0
    F_MAX: float = 16000.0
    TICKS_PER_BEAT: int = 48
    COMPRESSION_FACTOR: float = 10000.0

    # Model parameters
    VOCAB_SIZE: int = 96
    D_MODEL: int = 256
    DECODER_LAYERS: int = 4
    DECODER_HEADS: int = 4

    # Inference defaults
    DEFAULT_THRESHOLD: float = 0.5
    DEFAULT_CFG_PLACEMENT: float = 1.8
    DEFAULT_CFG_STEP: float = 1.5
    DEFAULT_TEMPERATURE: float = 1.0

    # Device selection
    DEVICE_OVERRIDE: Optional[str] = os.getenv("STEPPER_DEVICE", None)

    # Weights paths
    DEFAULT_WEIGHTS_FP16: Path = MODELS_DIR / "stepper_weights_fp16.pt"
    DEFAULT_WEIGHTS_FP32: Path = MODELS_DIR / "stepper_weights_fp32.pt"
    CUSTOM_WEIGHTS_PATH: Optional[str] = os.getenv("STEPPER_WEIGHTS_PATH", None)

    @classmethod
    def get_device(cls) -> torch.device:
        """
        Determines the optimal compute device.
        Prioritizes user override, then Apple Silicon MPS, then CUDA, then CPU.
        """
        if cls.DEVICE_OVERRIDE:
            dev_str = cls.DEVICE_OVERRIDE.lower()
            if dev_str.startswith("mps") and torch.backends.mps.is_available():
                return torch.device("mps")
            elif dev_str.startswith("cuda") and torch.cuda.is_available():
                return torch.device("cuda")
            elif dev_str == "cpu":
                return torch.device("cpu")

        if torch.backends.mps.is_available():
            return torch.device("mps")
        elif torch.cuda.is_available():
            return torch.device("cuda")
        return torch.device("cpu")


settings = Settings()
