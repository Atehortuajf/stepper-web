"""
backend.app.schemas.parity
Pydantic schemas for /api/solve-parity endpoint.
"""

from typing import Any, List, Optional, Union
from pydantic import BaseModel, Field


class NoteInput(BaseModel):
    beat: float = Field(..., ge=0.0, description="Musical beat timestamp")
    arrows: str = Field(..., min_length=4, max_length=4, description="4-arrow chord string: '1000', '0200', '0030', etc.")


class BpmInput(BaseModel):
    beat: float = Field(..., ge=0.0, description="Beat marker for tempo change")
    bpm: float = Field(..., gt=0.0, description="Tempo in BPM")


class SolveParityRequest(BaseModel):
    steps_type: str = Field("dance-single", description="Stepchart type ('dance-single' or 'dance-double')")
    notes: List[NoteInput] = Field(..., description="List of note rows ordered chronologically")
    bpms: Optional[List[BpmInput]] = Field(None, description="Piecewise BPM table. Defaults to 120.0 BPM.")
    difficulty_meter: Optional[int] = Field(9, ge=1, le=30, description="Target difficulty meter (affects bracket threshold)")


class StepFlags(BaseModel):
    is_crossover: bool = False
    crossover_type: Optional[str] = None
    is_candle: bool = False
    is_double_step: bool = False
    is_jack: bool = False
    is_bracket: bool = False
    is_footswitch: bool = False
    is_holdswitch: bool = False


class AnnotatedStep(BaseModel):
    beat: float
    arrows: str
    foot: str  # 'L', 'R', 'LR', or 'None'
    cost: float = 0.0
    warning: Optional[str] = None
    left_pos: Optional[Union[int, List[int]]] = None
    right_pos: Optional[Union[int, List[int]]] = None
    flags: StepFlags = Field(default_factory=StepFlags)


class ParityStats(BaseModel):
    total_steps: int
    alternation_rate: float
    crossovers: int
    candles: int
    footswitches: int
    holdswitches: int
    double_steps: int
    jacks: int
    brackets: int


class SolveParityResponse(BaseModel):
    is_playable: bool = Field(..., description="True if no physical impossibility occurs (total_cost < 1e8)")
    total_cost: float = Field(..., description="Total cumulative transition and ergonomic cost")
    foot_sequence: List[str] = Field(..., description="Sequence of assigned feet ('L', 'R', 'LR', etc.)")
    annotated_steps: List[AnnotatedStep] = Field(..., description="Step-by-step biomechanical metadata")
    stats: Optional[ParityStats] = Field(None, description="Aggregate technique and transition statistics")
