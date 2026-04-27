# Court Vision Backend

FastAPI server. Exposes three endpoints:

- `POST /transcribe` — multipart audio → `{ "text": "..." }` (Whisper)
- `POST /parse-play` — `{ "transcript": "..." }` → play schema JSON (Claude, structured output)
- `POST /scout` — `{ "lineup": [...] }` → scouting summary (Claude + `nba_stats_mcp`)

## Setup

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
copy .env.example .env
# fill ANTHROPIC_API_KEY / OPENAI_API_KEY in .env if available
uvicorn app.main:app --reload --port 8000
```

## Mock mode

If `COURT_VISION_MOCK=1` (or API keys aren't set), endpoints return canned responses so the frontend can be developed without keys. Real-mode and mock-mode return the same shape.

## Layout

```
backend/
  app/
    main.py            # FastAPI app + CORS + routes
    config.py          # env settings (pydantic-settings style)
    schemas.py         # Pydantic models = JSON schema for /parse-play structured output
    routes/
      transcribe.py
      parse_play.py
      scout.py
    services/
      anthropic_client.py
      whisper_client.py
      mcp_client.py
    prompts/
      vocabulary_prompt.py  # built from docs/vocabulary.md at startup
      few_shots.py
  tests/
    test_parse_play.py
    test_schemas.py
  pyproject.toml
  .env.example
```
