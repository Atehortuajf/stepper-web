"""
backend.app.core.model_loader
Model loading, device selection, and dual-mode inference service.
Supports Apple Silicon MPS, CUDA, CPU fallback, checkpoint loading,
explicitly labelled synthetic checkpoints, and opt-in rule-based generation.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import torch

from backend.app.core.config import settings
from backend.app.core.fallback_model import FallbackGenerator

# Install the sibling Stepper package in the backend environment.
from stepper.model.stepper_sync import StepperSync
from stepper.data.vocabulary import CHORD_TO_ID

logger = logging.getLogger("stepper_backend.model_loader")


class ModelService:
    """
    Singleton service managing model lifecycle, device placement,
    weight checkpoint loading, and inference dispatch.
    """

    def __init__(self) -> None:
        self.device: torch.device = settings.get_device()
        self.model: Optional[StepperSync] = None
        self.fallback_generator: FallbackGenerator = FallbackGenerator()
        self.model_type: str = "fallback"  # 'genuine', 'synthetic', 'fallback'
        self.is_loaded: bool = False
        self.weights_path: Optional[str] = None

    def initialize(
        self,
        weights_path: Optional[Union[str, Path]] = None,
        force_device: Optional[Union[str, torch.device]] = None,
    ) -> bool:
        """
        Initializes the model on the target device.
        Attempts to load weights from weights_path, custom env path,
        or default locations. Missing weights leave neural generation unavailable.
        """
        if force_device is not None:
            self.device = torch.device(force_device)
        else:
            self.device = settings.get_device()

        logger.info(f"Initializing StepperSync model service on device: {self.device}")

        # Locate weights
        target_path: Optional[Path] = None
        if weights_path:
            p = Path(weights_path)
            if p.exists() and p.is_file():
                target_path = p
        elif settings.CUSTOM_WEIGHTS_PATH:
            p = Path(settings.CUSTOM_WEIGHTS_PATH)
            if p.exists() and p.is_file():
                target_path = p
        elif settings.DEFAULT_WEIGHTS_FP16.exists() and settings.DEFAULT_WEIGHTS_FP16.is_file():
            target_path = settings.DEFAULT_WEIGHTS_FP16
        elif settings.DEFAULT_WEIGHTS_FP32.exists() and settings.DEFAULT_WEIGHTS_FP32.is_file():
            target_path = settings.DEFAULT_WEIGHTS_FP32

        try:
            if target_path is None:
                raise FileNotFoundError("No checkpoint found; configure STEPPER_WEIGHTS_PATH or explicitly request rule-based generation")
            model = StepperSync()

            if target_path is not None:
                logger.info(f"Loading checkpoint from: {target_path}")
                # Load checkpoint
                ckpt = torch.load(target_path, map_location="cpu", weights_only=True)
                state_dict = ckpt.get("model_state_dict", ckpt)

                # Determine if synthetic from checkpoint config
                is_synth = False
                if isinstance(ckpt, dict) and "config" in ckpt:
                    is_synth = ckpt["config"].get("synthetic", False)

                model.load_state_dict(state_dict)

                if is_synth:
                    self.model_type = "synthetic"
                else:
                    self.model_type = "genuine"

                self.weights_path = str(target_path)
            # Convert to float32 if on CPU or if needed
            if self.device.type == "cpu":
                model = model.float()
            elif self.device.type == "mps":
                # PyTorch MPS handles both float32 and float16 well
                model = model.float()

            model = model.to(self.device).eval()
            self.model = model
            self.is_loaded = True
            logger.info(f"StepperSync model successfully loaded ({self.model_type}) on {self.device}.")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize neural model: {e}. Neural generation is unavailable.", exc_info=True)
            self.model = None
            self.is_loaded = False
            self.model_type = "unavailable"
            self.weights_path = None
            return False

    def get_status(self) -> Dict[str, Any]:
        """Returns metadata for the /api/health endpoint."""
        dev_str = str(self.device)
        return {
            "status": "healthy" if self.is_loaded else "degraded",
            "device": dev_str,
            "mps_available": torch.backends.mps.is_available(),
            "cuda_available": torch.cuda.is_available(),
            "model_loaded": self.is_loaded,
            "model_type": self.model_type,
            "weights_path": self.weights_path,
            "version": settings.VERSION,
        }

    def generate(
        self,
        audio_features: torch.Tensor,
        difficulty: int,
        tech_vector: Optional[Union[List[float], torch.Tensor]] = None,
        bpm: float = 140.0,
        offset: float = 0.0,
        start_beat: float = 0.0,
        num_beats: float = 16.0,
        threshold: float = settings.DEFAULT_THRESHOLD,
        temperature: float = settings.DEFAULT_TEMPERATURE,
        use_fsm: bool = True,
        force_fallback: bool = False,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Executes chart generation using either StepperSync neural inference
        or the rule-based FallbackGenerator.

        Returns:
            placements: List of dicts [{'beat': float, 'arrows': str, 'chord_idx': int, 'confidence': float}]
            model_used: 'neural', 'synthetic', or explicitly requested 'fallback'
        """
        # Ensure difficulty in 0..4
        diff_idx = max(0, min(4, int(difficulty)))

        if not force_fallback:
            if self.model is None or not self.is_loaded:
                raise RuntimeError("Neural model unavailable; load a checkpoint or explicitly select rule-based generation")
            try:
                # Prepare audio feature tensor: shape (1, 2, total_beats, 48, 128)
                feats = audio_features.to(device=self.device, dtype=torch.float32)
                if feats.dim() == 4:
                    feats = feats.unsqueeze(0)

                # Prepare tech vector
                t_vec: Optional[torch.Tensor] = None
                if tech_vector is not None:
                    if isinstance(tech_vector, torch.Tensor):
                        t_vec = tech_vector.to(device=self.device, dtype=torch.float32)
                    else:
                        t_vec = torch.tensor(tech_vector, device=self.device, dtype=torch.float32)
                    if t_vec.dim() == 1:
                        t_vec = t_vec.unsqueeze(0)

                with torch.no_grad():
                    chart_result = self.model.generate(
                        audio=feats,
                        difficulty=diff_idx,
                        tech_vector=t_vec,
                        bpm=bpm,
                        offset=offset,
                        threshold=threshold,
                        temperature=temperature,
                        use_fsm_mask=use_fsm,
                    )

                placements: List[Dict[str, Any]] = []
                for beat_val, chord_str in chart_result.notes:
                    actual_beat = round(start_beat + beat_val, 4)
                    chord_idx = CHORD_TO_ID.get(chord_str, 1)
                    placements.append({
                        "beat": actual_beat,
                        "arrows": chord_str,
                        "chord_idx": chord_idx,
                        "confidence": 0.95,
                    })
                # Zero predictions is a valid result, not permission to invent notes.
                return placements, "synthetic" if self.model_type == "synthetic" else "neural"

            except Exception as e:
                logger.warning("Neural generation failed: %s", e)
                raise RuntimeError("Neural generation failed; no rule-based notes were substituted") from e

        # Fallback rule-based generator
        flux_tensor = None
        if audio_features is not None and audio_features.dim() >= 3:
            # Channel 1 is spectral flux
            flux_tensor = audio_features[1] if audio_features.dim() == 4 else audio_features[0, 1]

        placements = self.fallback_generator.generate(
            num_beats=num_beats,
            start_beat=start_beat,
            bpm=bpm,
            difficulty=diff_idx,
            tech_vector=tech_vector,
            audio_flux=flux_tensor,
            threshold=threshold,
        )
        return placements, "fallback"


# Global singleton instance
model_service = ModelService()
