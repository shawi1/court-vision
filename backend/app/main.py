"""Court Vision backend — FastAPI entry point."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import parse_play, roster, scout, transcribe

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Court Vision Backend",
        version="0.1.0",
        description="Voice-to-play parsing + scouting for basketball coaches.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz() -> dict[str, object]:
        return {
            "ok": True,
            "mock_mode": settings.mock_mode,
            "has_anthropic": settings.has_anthropic,
            "has_openai": settings.has_openai,
        }

    app.include_router(transcribe.router)
    app.include_router(parse_play.router)
    app.include_router(scout.router)
    app.include_router(roster.router)

    logger.info(
        "Court Vision backend ready (mock_mode=%s, anthropic=%s, openai=%s)",
        settings.mock_mode, settings.has_anthropic, settings.has_openai,
    )
    return app


app = create_app()
