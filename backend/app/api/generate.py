"""
backend.app.api.generate
REST and WebSocket chart generation endpoints.
POST /api/generate - Fast AI inference (<1.5s 16-beat chunk)
WS /api/ws/generate - Real-time streaming generation for interactive scrubbing
"""

import json
import time
from typing import Any, Dict, List, Tuple
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
import torch

from backend.app.core.config import settings
from backend.app.core.feature_extract import (
    AudioFeatureExtractor,
    extract_features_from_audio,
)
from backend.app.core.model_loader import model_service
from backend.app.schemas.generate import (
    GenerateRequest,
    GenerateResponse,
    Placement,
    WSGenerateResponse,
)

router = APIRouter(tags=["generate"])
ws_router = APIRouter(tags=["websocket"])

DIFF_MAP_STR: Dict[str, int] = {
    "novice": 0,
    "beginner": 0,
    "easy": 1,
    "basic": 1,
    "medium": 2,
    "difficult": 3,
    "hard": 3,
    "expert": 4,
    "challenge": 4,
    "edit": 4,
}

DIFF_NAMES: Dict[int, str] = {
    0: "Novice",
    1: "Easy",
    2: "Medium",
    3: "Hard",
    4: "Expert",
}


def normalize_difficulty(diff: Any) -> Tuple[int, str]:
    """Converts difficulty input (int or string) to (diff_id [0..4], diff_str)."""
    if isinstance(diff, str):
        cleaned = diff.strip().lower()
        if cleaned in DIFF_MAP_STR:
            diff_id = DIFF_MAP_STR[cleaned]
            return diff_id, DIFF_NAMES[diff_id]
        try:
            val = int(cleaned)
            return normalize_difficulty(val)
        except ValueError:
            return 3, "Hard"

    try:
        val = int(diff)
        if val <= 4:
            d_id = max(0, val)
        elif val <= 6:
            d_id = 1
        elif val <= 8:
            d_id = 2
        elif val <= 11:
            d_id = 3
        else:
            d_id = 4
        return d_id, DIFF_NAMES[d_id]
    except (ValueError, TypeError):
        return 3, "Hard"


@router.post("/generate", response_model=GenerateResponse)
async def generate_chart(request: GenerateRequest) -> GenerateResponse:
    """
    Fast AI / rule-based chart generation endpoint.
    Accepts audio slice, difficulty, and 16-D continuous technique vector z_tech.
    Guarantees latency < 1.5s for a 16-beat chunk.
    """
    start_time = time.perf_counter()

    diff_id, diff_str = normalize_difficulty(request.difficulty)
    total_beats = int(max(1, round(request.num_beats)))

    # Extract audio features (2, total_beats, 48, 128)
    feats = extract_features_from_audio(
        audio_input=request.audio_slice,
        total_beats=total_beats,
        bpm=request.bpm,
        offset=request.offset,
        start_beat=request.start_beat,
    )

    # Run inference
    placements_data, model_used = model_service.generate(
        audio_features=feats,
        difficulty=diff_id,
        tech_vector=request.tech_vector,
        bpm=request.bpm,
        offset=request.offset,
        start_beat=request.start_beat,
        num_beats=float(total_beats),
        threshold=request.threshold or settings.DEFAULT_THRESHOLD,
        temperature=request.temperature or settings.DEFAULT_TEMPERATURE,
        use_fsm=request.use_fsm,
        force_fallback=request.force_fallback,
    )

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    placements = [
        Placement(
            beat=p["beat"],
            arrows=p["arrows"],
            chord_idx=p["chord_idx"],
            confidence=p.get("confidence", 0.95),
        )
        for p in placements_data
    ]

    return GenerateResponse(
        placements=placements,
        latency_ms=round(elapsed_ms, 2),
        difficulty_id=diff_id,
        difficulty_str=diff_str,
        model_used=model_used,
    )


@ws_router.websocket("/ws/generate")
async def websocket_generate(websocket: WebSocket) -> None:
    """
    Real-time streaming generation endpoint for interactive scrubbing and measure-by-measure streaming.
    Clients connect and send JSON generation requests; server streams progressive results.
    """
    await websocket.accept()

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception as e:
                await websocket.send_json(
                    WSGenerateResponse(type="error", message=f"Invalid JSON: {str(e)}").model_dump()
                )
                continue

            # Support both direct params or nested under 'params'
            params_dict = data.get("params", data)
            try:
                req = GenerateRequest(**params_dict)
            except Exception as e:
                await websocket.send_json(
                    WSGenerateResponse(type="error", message=f"Validation error: {str(e)}").model_dump()
                )
                continue

            start_time = time.perf_counter()
            diff_id, diff_str = normalize_difficulty(req.difficulty)
            chunk_size_beats = float(data.get("chunk_size_beats", 4.0))  # Default 1 measure = 4 beats
            total_beats = int(max(1, round(req.num_beats)))

            # 1. Send feature extraction progress
            await websocket.send_json(
                WSGenerateResponse(
                    type="progress",
                    progress=0.1,
                    message="Extracting audio features...",
                ).model_dump()
            )

            feats = extract_features_from_audio(
                audio_input=req.audio_slice,
                total_beats=total_beats,
                bpm=req.bpm,
                offset=req.offset,
                start_beat=req.start_beat,
            )

            await websocket.send_json(
                WSGenerateResponse(
                    type="progress",
                    progress=0.4,
                    message="Running inference...",
                ).model_dump()
            )

            # Generate notes
            placements_data, model_used = model_service.generate(
                audio_features=feats,
                difficulty=diff_id,
                tech_vector=req.tech_vector,
                bpm=req.bpm,
                offset=req.offset,
                start_beat=req.start_beat,
                num_beats=float(total_beats),
                threshold=req.threshold or settings.DEFAULT_THRESHOLD,
                temperature=req.temperature or settings.DEFAULT_TEMPERATURE,
                use_fsm=req.use_fsm,
                force_fallback=req.force_fallback,
            )

            # Stream back in chunks (e.g. measure-by-measure)
            cur_chunk_start = req.start_beat
            cur_chunk_end = cur_chunk_start + chunk_size_beats
            chunk_placements: List[Placement] = []
            chunk_idx = 0
            num_chunks = max(1, int((total_beats + chunk_size_beats - 0.001) // chunk_size_beats))

            for p in placements_data:
                b = p["beat"]
                if b >= cur_chunk_end and chunk_placements:
                    # Emit chunk
                    chunk_idx += 1
                    prog = 0.4 + 0.5 * (chunk_idx / num_chunks)
                    await websocket.send_json(
                        WSGenerateResponse(
                            type="chunk",
                            progress=round(prog, 2),
                            placements=chunk_placements,
                            message=f"Streamed measure {chunk_idx}",
                        ).model_dump()
                    )
                    chunk_placements = []
                    while b >= cur_chunk_end:
                        cur_chunk_start = cur_chunk_end
                        cur_chunk_end = cur_chunk_start + chunk_size_beats

                chunk_placements.append(
                    Placement(
                        beat=p["beat"],
                        arrows=p["arrows"],
                        chord_idx=p["chord_idx"],
                        confidence=p.get("confidence", 0.95),
                    )
                )

            # Send remaining chunk
            if chunk_placements:
                await websocket.send_json(
                    WSGenerateResponse(
                        type="chunk",
                        progress=0.95,
                        placements=chunk_placements,
                        message="Final measure chunk",
                    ).model_dump()
                )

            # Send complete event
            total_elapsed = (time.perf_counter() - start_time) * 1000.0
            all_placements = [
                Placement(
                    beat=p["beat"],
                    arrows=p["arrows"],
                    chord_idx=p["chord_idx"],
                    confidence=p.get("confidence", 0.95),
                )
                for p in placements_data
            ]
            await websocket.send_json(
                WSGenerateResponse(
                    type="complete",
                    progress=1.0,
                    placements=all_placements,
                    latency_ms=round(total_elapsed, 2),
                    message=f"Generation finished using {model_used} model.",
                ).model_dump()
            )

    except WebSocketDisconnect:
        pass
