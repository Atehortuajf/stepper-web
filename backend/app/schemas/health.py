"""
backend.app.schemas.health
Pydantic schema for /api/health endpoint.
"""

from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field("healthy", description="Service health status")
    device: str = Field(..., description="Active PyTorch compute device (mps:0, cuda:0, cpu)")
    mps_available: bool = Field(..., description="Whether Apple Silicon Metal Performance Shaders is available")
    cuda_available: bool = Field(..., description="Whether CUDA is available")
    model_loaded: bool = Field(..., description="Whether the StepperSync model is ready for inference")
    model_type: str = Field(..., description="Type of model loaded: 'genuine', 'synthetic', or 'fallback'")
    weights_path: Optional[str] = Field(None, description="Path to checkpoint weights file")
    version: str = Field("0.1.0", description="Backend API service version")
