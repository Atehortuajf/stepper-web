"""
backend.app.schemas.generate
Pydantic schemas for /api/generate and /api/ws/generate endpoints.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    # Audio input: base64 encoded PCM WAV, raw float32 array, or None (triggers synthetic audio fallback)
    audio_slice: Optional[str] = Field(
        None,
        description="Base64 encoded PCM WAV audio buffer or raw PCM data. If omitted, uses synthetic click-track.",
    )
    # Difficulty: integer (0-4: Novice, Easy, Medium, Hard, Expert; or 1-25+ ITG meter) or string
    difficulty: Union[int, str] = Field(
        3,
        description="Target difficulty tier (0-4 / Novice-Expert) or numerical meter (1-25+).",
    )
    # 16-D continuous technique conditioning vector z_tech in [0.0, 1.0]
    tech_vector: Optional[List[float]] = Field(
        None,
        description="16-dimensional continuous technique conditioning vector [0.0, 1.0]^16.",
    )
    start_beat: float = Field(0.0, ge=0.0, description="Start beat of the generation window")
    num_beats: float = Field(16.0, gt=0.0, le=512.0, description="Number of beats to generate (e.g. 16 for 4 measures)")
    bpm: float = Field(140.0, gt=0.0, description="Tempo in beats per minute")
    offset: float = Field(0.0, description="Audio offset in seconds")
    threshold: Optional[float] = Field(
        0.5,
        ge=0.0,
        le=1.0,
        description="Stage 1 peak detection probability threshold",
    )
    temperature: Optional[float] = Field(
        1.0,
        ge=0.01,
        le=3.0,
        description="Stage 2 autoregressive sampling temperature",
    )
    use_fsm: bool = Field(
        True,
        description="Whether to enforce physical playability via Foot State Machine logit masking",
    )
    force_fallback: bool = Field(
        False,
        description="Force using fast rule-based fallback generator instead of neural model",
    )


class Placement(BaseModel):
    beat: float = Field(..., description="Musical beat timestamp")
    arrows: str = Field(..., description="4-character arrow chord: '1000', '0200', etc.")
    chord_idx: int = Field(..., description="Vocabulary chord index in [0, 95]")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Model confidence score")


class GenerateResponse(BaseModel):
    placements: List[Placement] = Field(..., description="Predicted note placements")
    latency_ms: float = Field(..., description="Total inference latency in milliseconds")
    difficulty_id: int = Field(..., description="Standardized difficulty index (0-4)")
    difficulty_str: str = Field(..., description="Human-readable difficulty tier name")
    model_used: str = Field(..., description="'neural' or 'fallback'")


class WSGenerateMessage(BaseModel):
    """Client message sent over WebSocket /api/ws/generate."""
    action: str = Field("generate", description="'generate' or 'cancel'")
    params: GenerateRequest = Field(..., description="Generation parameters")
    chunk_size_beats: Optional[float] = Field(4.0, description="Measure chunk size to stream back")


class WSGenerateResponse(BaseModel):
    """Server response streamed over WebSocket."""
    type: str = Field(..., description="'progress', 'chunk', 'complete', or 'error'")
    progress: Optional[float] = Field(None, description="Progress fraction [0.0, 1.0]")
    message: Optional[str] = Field(None, description="Status or error message")
    placements: Optional[List[Placement]] = Field(None, description="New placements generated")
    latency_ms: Optional[float] = Field(None, description="Latency in milliseconds")
