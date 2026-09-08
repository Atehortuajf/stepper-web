"""
backend.app.api.parity
POST /api/solve-parity endpoint.
Biomechanical foot parity solver evaluating playability, ergonomic cost, and foot sequences.
"""

from fastapi import APIRouter
from backend.app.schemas.parity import SolveParityRequest, SolveParityResponse
from backend.app.core.parity_solver import solve_parity

router = APIRouter(tags=["parity"])


@router.post("/solve-parity", response_model=SolveParityResponse)
async def solve_parity_endpoint(request: SolveParityRequest) -> SolveParityResponse:
    """
    Computes optimal foot placement sequence ('L', 'R', 'LR') and validates
    biomechanical playability using the Hidden Markov Model ViterbiFootSolver.
    """
    return solve_parity(request)
