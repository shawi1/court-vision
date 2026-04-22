# Court Vision

Voice-driven basketball play visualizer for coaches. A coach speaks an Out-Of-Timeout (ATO) play; the app transcribes via Whisper, parses the transcript to a structured play schema with Claude, and animates the play on a basketball court (Skia). A scouting panel pulls live NBA data via Brandon Hawi's `nba_stats_mcp` and synthesizes coach-facing reports with Claude.

## Current state (2026-05-15)

**Working end-to-end in LIVE mode:**
- Voice → Whisper transcription → Claude (Opus 4.7) structured-output play schema → animated Skia diagram with tick-based playback and scrubbing.
- Lineup → real current roster from `nba_stats_mcp` (e.g. Jimmy Butler III + Al Horford on the Warriors as of this writing) → real player splits → Claude scouting synthesis with structured sections (Strengths / Weaknesses / Matchups / Bottom Line).
- API keys are set in `backend/.env` (Anthropic + OpenAI). The app's title bar shows **LIVE** badge, scout reports show **STATS: LIVE NBA**.

## v1 scope (locked)

- Cross-platform: iOS (iPhone + iPad), Android, Web — single codebase via Expo + React Native + react-native-web.
- LLM-driven play parsing using structured output (Claude tool-use with JSON schema enforcement).
- v1 demo: coach speaks one ATO → animation + scouting snippet for current lineup.

**Out of v1:** saved playbook/library, full matchup dashboards, live in-game possession tracking, multi-team accounts, defensive coverage simulation, multi-play sequencing.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Expo SDK 54 + React Native 0.81 + `react-native-web` + TypeScript strict |
| Court rendering | `@shopify/react-native-skia` 2.2.x (Skia API on iOS / Android / web via CanvasKit WASM) |
| Mic capture | `expo-av` (native) + MediaRecorder (web), wrapped in `useRecorder` hook |
| Backend | FastAPI + Pydantic + Anthropic SDK + OpenAI SDK, Python 3.13 |
| STT | Whisper (`whisper-1`) via OpenAI API |
| Play parsing | Claude `claude-opus-4-7` with vocabulary system prompt + few-shots + tool-use structured output |
| Scouting | Claude `claude-sonnet-4-6` with structured prompt built from MCP-fetched stats |
| NBA stats | `nba_stats_mcp` (Brandon's repo) imported as a Python library — NOT via the MCP wire protocol |

## Repo structure

```
court-vision/
├── CLAUDE.md, README.md, .gitignore
├── docs/
│   ├── vocabulary.md      135-entry coach glossary (load-bearing — drives schema + LLM prompt)
│   ├── play-schema.md     schema design notes (v0.2)
│   ├── architecture.md    system diagram + rationale
│   └── SESSION_LOG.md     append-only log of autonomous work sessions
├── app/                   Expo + RN + react-native-web + Skia
│   ├── App.tsx
│   ├── index.ts           NB: on web, loads CanvasKit WASM via LoadSkiaWeb before mount
│   ├── app.json, tsconfig.json (path alias @/* → src/*)
│   └── src/
│       ├── types/play.ts                TS mirror of backend Pydantic schema v0.2
│       ├── court/
│       │   ├── coords.ts                NamedLocation → normalized → canvas coords
│       │   ├── CourtBackground.tsx      Skia half-court lines (rim, 3pt arc, lane, FT circle)
│       │   ├── PlayRenderer.tsx         tick-aware player + action overlay rendering
│       │   └── playback.ts              player position interpolation between anchor ticks
│       ├── api/client.ts                fetch wrapper: /healthz /transcribe /parse-play /scout /roster
│       ├── audio/useRecorder.ts         cross-platform mic capture
│       ├── components/
│       │   ├── PlaybackBar.tsx          prev / play-pause / next + tick dots
│       │   └── CountersList.tsx         collapsible alternative-read viewer
│       └── screens/HomeScreen.tsx       3-pane landscape layout
├── backend/               FastAPI + Pydantic + Anthropic
│   ├── pyproject.toml, pytest.ini, .env (gitignored), .env.example
│   └── app/
│       ├── main.py                      app + CORS + routes
│       ├── config.py                    .env loading + mock-mode detection
│       ├── schemas.py                   Pydantic play schema v0.2 (Trigger, Counter)
│       ├── routes/{transcribe,parse_play,scout,roster}.py
│       ├── services/
│       │   ├── anthropic_client.py      structured output via tool-use; mock fallback
│       │   ├── whisper_client.py        OpenAI Whisper; mock fallback
│       │   └── mcp_client.py            nba_stats_mcp.NBAClient — direct import
│       └── prompts/
│           ├── vocabulary_prompt.py     embeds docs/vocabulary.md in system prompt
│           └── few_shots.py             transcript → play JSON pairs
├── scripts/
│   ├── dev.ps1 / dev.sh   one-command: backend + Expo dev server
│   └── build-web.ps1      web export + copies CanvasKit WASM into dist/
└── tests/ (in backend/)   16 backend tests
```

## Schema v0.2

The play schema lives in `backend/app/schemas.py` (Pydantic source-of-truth) and is mirrored in `app/src/types/play.ts`. Key types:

- `PlaySchema { schemaVersion: "0.2", meta: Meta, players: Player[5], initialFormation, actions[], counters[] }`
- `Meta.trigger?: { type: "slap" | "verbalGo" | "verbalSet" | "automatic" | "deny" | "screen", actor?, description? }` — captures BLOB/SLOB cues.
- `Counter { trigger: string, actions: Action[] }` — alternative reads ("if they switch the screen, ...").
- Players are P1..P5 (positional roles, NOT jersey numbers). Coaches design ATOs against roles.
- `NamedLocation` is a closed enum (topOfKey, leftElbow, rightWing, ...) derived from `docs/vocabulary.md`.
- Action discriminated union: `move | screen | cut | pass | dribble | handoff | shot`.

**v0.3 open questions** (in `docs/vocabulary.md` § Open Questions for the schema):
- Per-action read trees vs current top-level `counters` array.
- Explicit ball-position tracking vs inferred from passes.
- Sub-tick simultaneity granularity (startTick / endTick).
- Defensive coverage annotations on actions ("expect drop on PnR").

## Running locally

**Two ports:**
- `:8765` — FastAPI backend
- `:5173` — static `app/dist/` (production-style web bundle) **or** `:8081` if using `expo start --web` for hot-reload dev

### One-shot dev

```powershell
.\scripts\dev.ps1               # both backend + expo start --web
.\scripts\dev.ps1 -BackendOnly  # just the API
.\scripts\dev.ps1 -AppOnly      # just the Expo dev server
```

### Production-style web (faster initial paint, no HMR)

```powershell
.\scripts\build-web.ps1
python -m http.server 5173 --directory app\dist
# Open http://127.0.0.1:5173/
```

**Critical:** `build-web.ps1` must run instead of plain `expo export` because Expo doesn't bundle the CanvasKit WASM. The script does `expo export` then copies `node_modules\canvaskit-wasm\bin\canvaskit.wasm` into `dist\_expo\static\js\web\`. Without this, the browser 404s on the WASM and Skia content never renders.

### Backend (manual)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --port 8765       # mock mode if .env keys missing
```

**Do NOT use `--reload` once `nba_api` is in the import chain** — uvicorn's reloader can crash mid-long-request when stats.nba.com calls are in flight.

## Live mode vs mock mode

The backend's `app/config.py` auto-detects mock vs live from env vars:

- **Mock mode** (default if no keys): canned 5-variant mock plays, mock transcript text, mock scouting summary that echoes the prompt.
- **Live mode**: real Claude / Whisper / nba_api calls. Flips on automatically when `ANTHROPIC_API_KEY` is set in `backend/.env`.

Frontend shows badges based on `/healthz` response: title bar `LIVE` vs `MOCK MODE`, scout report `CLAUDE: LIVE` vs `CLAUDE: MOCK`, `STATS: LIVE NBA` vs `STATS: STUB`.

## API keys (in `backend/.env`)

```
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...           # optional, only for real voice transcription
COURT_VISION_MOCK=0
COURT_VISION_CORS=*
```

- **Anthropic** keys via https://console.anthropic.com/ → API Keys. Opus 4.7 is roughly $15/M input + $75/M output. A typical `/scout` call (~30K input + ~1.5K output) is $0.50-1. Parse-play is ~$0.05/call.
- **OpenAI** keys via https://platform.openai.com/api-keys. Whisper is $0.006/min — basically free.
- `.env` is `.gitignore`d. Don't commit it.

## External dependencies

- **`nba_stats_mcp`** — `github.com/brandonhawi/nba_stats_mcp` (private; Sean has collaborator access). By Brandon Hawi (Sean's brother). Built on FastMCP + Streamable HTTP + OAuth as a claude.ai connector, but Court Vision imports it as a Python library and uses its `NBAClient` directly (skipping OAuth entirely). Installed via `pip install -e ../nba_stats_mcp`. Tool surface includes lookup, live scoreboards, player splits, team rosters / lineups, league standings, head-to-head, contracts, cap projections.

## Quirks / things that bite

- **CanvasKit WASM not bundled by Expo** — must copy after every `expo export`. Use `scripts/build-web.ps1`.
- **`Skia.FontMgr.System()` is async-loaded on web** — never call it at module top-level. Always inside a hook or render call. (See `useSystemFont` in `PlayRenderer.tsx`.)
- **`uvicorn --reload` + `nba_api` = crash** — the reloader can't handle long-running requests once the NBA client is imported. Run dev without `--reload`.
- **`PlayerGameLog.TEAM_ID` is empty in current stats.nba.com responses** — use `CommonPlayerInfo` to resolve a player's current team (see `mcp_client._current_team`).
- **`OverallPlayerDashboard` is a list-of-one** — flatten to `[0]` when reading splits.
- **Windows console default cp1252** can't print middle-dot characters in lineup `GROUP_NAME`. Set `PYTHONIOENCODING=utf-8`.
- **First `/scout` call is slow** (10-30s) — stats.nba.com rate-limited to 1 req/s on cold cache. Subsequent calls are fast (~5s for the full chain).

## Working with this codebase in Claude Code

- Project context lives here (`CLAUDE.md` + `docs/`), not in `~/.claude` memory. `git clone` on a new machine restores everything.
- Plans and in-flight tasks belong in conversation/tasks, not in this repo.
- The 135-entry vocabulary glossary in `docs/vocabulary.md` is load-bearing — the play schema enums and LLM system prompt both derive from it. Update it whenever a coach uses a term we don't handle, and refresh the schema enums in lockstep.
