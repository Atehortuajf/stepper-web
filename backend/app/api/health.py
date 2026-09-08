"""
backend.app.api.health
GET /api/health endpoint.
Returns service status, active PyTorch compute device, and model loaded state.
"""

from fastapi import APIRouter
from backend.app.schemas.health import HealthResponse
from backend.app.core.model_loader import model_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Returns service health, PyTorch hardware acceleration, and model state."""
    status_dict = model_service.get_status()
    return HealthResponse(**status_dict)
