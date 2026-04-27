"""Environment-driven configuration."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str | None
    openai_api_key: str | None
    mock_mode: bool
    cors_origins: list[str]
    repo_root: Path
    docs_dir: Path

    @property
    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def get_settings() -> Settings:
    _load_dotenv()
    repo_root = Path(__file__).resolve().parent.parent.parent
    docs_dir = repo_root / "docs"
    explicit_mock = os.environ.get("COURT_VISION_MOCK", "").strip() == "1"
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY") or None
    openai_key = os.environ.get("OPENAI_API_KEY") or None
    mock_mode = explicit_mock or (not anthropic_key and not openai_key)
    cors_raw = os.environ.get("COURT_VISION_CORS", "*")
    cors = [o.strip() for o in cors_raw.split(",") if o.strip()] or ["*"]
    return Settings(
        anthropic_api_key=anthropic_key,
        openai_api_key=openai_key,
        mock_mode=mock_mode,
        cors_origins=cors,
        repo_root=repo_root,
        docs_dir=docs_dir,
    )
