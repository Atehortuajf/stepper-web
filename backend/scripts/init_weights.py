#!/usr/bin/env python3
"""
backend.scripts.init_weights
Deterministic synthetic weights initialization and export script for StepperSync.
Allows instant onboarding and CI test passes without manual weight downloads.
"""

import argparse
import hashlib
import os
from pathlib import Path
import sys
import torch
import torch.nn as nn

# Ensure project paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
STEPPER_REF_PATH = Path("/Users/ate/Projects/Stepper")
if STEPPER_REF_PATH.exists() and str(STEPPER_REF_PATH) not in sys.path:
    sys.path.insert(0, str(STEPPER_REF_PATH))

from stepper.model.stepper_sync import StepperSync


def init_weights_deterministic(model: nn.Module, seed: int = 42) -> None:
    """
    Initializes all layers of StepperSync with deterministic weights.
    Calibrates the placement head so that baseline onset probability
    produces natural step density (~15-30 steps / 16 beats) with fast autoregressive decoding (<0.4s).
    """
    torch.manual_seed(seed)

    for name, param in model.named_parameters():
        if "weight" in name and param.dim() >= 2:
            nn.init.kaiming_normal_(param, mode="fan_out", nonlinearity="relu")
        elif "bias" in name:
            nn.init.zeros_(param)

    # Calibrate Stage 1 Placement Net Head & FiLM
    if hasattr(model, "placement_net"):
        pnet = model.placement_net
        if hasattr(pnet, "placement_head"):
            nn.init.normal_(pnet.placement_head.weight, mean=0.0, std=0.025)
            nn.init.constant_(pnet.placement_head.bias, -0.638)
        if hasattr(pnet, "film"):
            nn.init.zeros_(pnet.film.weight)
            nn.init.zeros_(pnet.film.bias)

    # Calibrate Stage 2 Step Decoder Output Projection
    if hasattr(model, "step_decoder") and hasattr(model.step_decoder, "out_proj"):
        # Favor single taps (tokens 1 to 4) over rare complex chords
        with torch.no_grad():
            model.step_decoder.out_proj.bias.fill_(-2.0)
            model.step_decoder.out_proj.bias[1:5] = 2.0   # Single taps: Left, Down, Up, Right
            model.step_decoder.out_proj.bias[5:11] = 0.5  # Standard jumps


def export_checkpoint(
    output_path: Path,
    seed: int = 42,
    fp16: bool = True,
) -> Path:
    """Instantiate StepperSync, initialize weights deterministically, and save."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"[init_weights] Instantiating StepperSync model (seed={seed})...")
    model = StepperSync()

    init_weights_deterministic(model, seed=seed)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"[init_weights] Total parameters: {total_params:,}")

    save_model = model.half() if fp16 else model.float()

    checkpoint = {
        "epoch": 0,
        "global_step": 0,
        "model_state_dict": save_model.state_dict(),
        "config": {
            "d_model": 256,
            "vocab_size": 96,
            "ticks_per_beat": 48,
            "synthetic": True,
            "seed": seed,
            "fp16": fp16,
        },
    }

    torch.save(checkpoint, str(output_path))
    file_size_mb = output_path.stat().st_size / (1024 * 1024)

    with open(output_path, "rb") as f:
        file_sha256 = hashlib.sha256(f.read()).hexdigest()

    print(f"[init_weights] Exported {'FP16' if fp16 else 'FP32'} weights to: {output_path}")
    print(f"[init_weights] File size: {file_size_mb:.2f} MB")
    print(f"[init_weights] SHA256: {file_sha256}")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize and export StepperSync synthetic weights.")
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=str(BACKEND_DIR / "models" / "stepper_weights_fp16.pt"),
        help="Path to output .pt checkpoint file",
    )
    parser.add_argument(
        "--seed",
        "-s",
        type=int,
        default=42,
        help="Deterministic random seed",
    )
    parser.add_argument(
        "--fp32",
        action="store_true",
        help="Save single precision FP32 weights instead of half-precision FP16",
    )
    args = parser.parse_args()

    out_path = Path(args.output)
    export_checkpoint(out_path, seed=args.seed, fp16=not args.fp32)


if __name__ == "__main__":
    main()
