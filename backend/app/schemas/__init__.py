"""
backend.app.schemas
Re-export all request and response schemas.
"""

from backend.app.schemas.health import HealthResponse
from backend.app.schemas.generate import (
    GenerateRequest,
    Placement,
    GenerateResponse,
    WSGenerateMessage,
    WSGenerateResponse,
)
from backend.app.schemas.parity import (
    NoteInput,
    BpmInput,
    SolveParityRequest,
    StepFlags,
    AnnotatedStep,
    ParityStats,
    SolveParityResponse,
)

__all__ = [
    "HealthResponse",
    "GenerateRequest",
    "Placement",
    "GenerateResponse",
    "WSGenerateMessage",
    "WSGenerateResponse",
    "NoteInput",
    "BpmInput",
    "SolveParityRequest",
    "StepFlags",
    "AnnotatedStep",
    "ParityStats",
    "SolveParityResponse",
]
