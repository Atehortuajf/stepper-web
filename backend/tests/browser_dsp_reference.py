"""Emit a deterministic Python feature tensor for the browser parity test."""

import base64
import json

import torch

from backend.app.core.feature_extract import AudioFeatureExtractor


SAMPLE_RATE = 44100
NUM_SAMPLES = SAMPLE_RATE
SLICE_START_SEC = 0.25


def main() -> None:
    waveform = torch.tensor(
        [((index * 17) % 101) / 50.0 - 1.0 for index in range(NUM_SAMPLES)],
        dtype=torch.float32,
    )
    tick_times = [
        SLICE_START_SEC + (index / 96.0 if index < 24 else 0.25 + (index - 24) / 144.0)
        for index in range(48)
    ]
    tensor = AudioFeatureExtractor().extract_from_waveform(
        waveform,
        total_beats=1,
        slice_start_sec=SLICE_START_SEC,
        tick_times_sec=tick_times,
    ).contiguous()
    print(json.dumps({
        "shape": list(tensor.shape),
        "float32_base64": base64.b64encode(tensor.numpy().tobytes()).decode("ascii"),
    }))


if __name__ == "__main__":
    main()
