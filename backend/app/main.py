"""
backend.app.main
FastAPI application entrypoint for Stepper-Web AI Inference and Biomechanical Backend.
"""

from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.app.core.config import settings
from backend.app.core.model_loader import model_service
from backend.app.api.health import router as health_router
from backend.app.api.generate import router as generate_router, ws_router as generate_ws_router
from backend.app.api.parity import router as parity_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("stepper_backend")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager to initialize model on startup."""
    logger.info("Starting Stepper-Web FastAPI service...")
    try:
        model_service.initialize()
    except Exception as e:
        logger.error(f"Error during model initialization: {e}", exc_info=True)
    yield
    logger.info("Shutting down Stepper-Web FastAPI service.")


def create_app() -> FastAPI:
    """Factory function creating the FastAPI app."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="FastAPI service for Stepper-Sync AI chart generation and Viterbi biomechanical foot parity validation.",
        lifespan=lifespan,
    )

    # CORS configuration for local development and web client integration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routers
    app.include_router(health_router, prefix=settings.API_V1_STR)
    app.include_router(generate_router, prefix=settings.API_V1_STR)
    app.include_router(generate_ws_router, prefix=settings.API_V1_STR)
    app.include_router(parity_router, prefix=settings.API_V1_STR)

    @app.get("/")
    async def root():
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "health": f"{settings.API_V1_STR}/health",
        }

    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
    )
