"""POST /transcribe — multipart audio → text."""
from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from app.schemas import TranscribeResponse
from app.services.whisper_client import transcribe

router = APIRouter()


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_endpoint(audio: UploadFile = File(...)) -> TranscribeResponse:
    text = transcribe(audio.file, filename=audio.filename or "audio.m4a")
    return TranscribeResponse(text=text)
