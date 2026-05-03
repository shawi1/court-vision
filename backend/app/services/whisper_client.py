"""
Whisper transcription. Uses OpenAI's hosted Whisper if OPENAI_API_KEY is set;
otherwise returns a mock transcript so the frontend can be developed without a key.
"""
from __future__ import annotations

import logging
from typing import IO

from app.config import get_settings

logger = logging.getLogger(__name__)


def transcribe(audio_stream: IO[bytes], filename: str = "audio.m4a") -> str:
    settings = get_settings()
    if settings.mock_mode or not settings.has_openai:
        return _mock_transcript(filename)

    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, audio_stream),
    )
    return response.text


def _mock_transcript(filename: str) -> str:
    logger.info("transcribe: returning MOCK transcript (no OpenAI key or mock mode)")
    return (
        "Alright, Horns set. 1 brings it up, 4 and 5 set up at the elbows, "
        "2 in the left corner, 3 in the right. 1 dribbles to the right wing, "
        "5 sets a ball screen and slips to the rim, 1 hits him on the slip "
        "for the dunk."
    )
