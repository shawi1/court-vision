# Session Log

> Append-only log of autonomous work done while Sean is away. Most recent entries at the bottom.

## 2026-05-14 — Initial session

### Decisions locked
- Cross-platform stack (iOS + Android + Web) via Expo + RN + react-native-web + TypeScript + Skia.
- Backend in Python (chosen now — best Whisper / Claude SDK / MCP ecosystem). FastAPI for the API surface.
- v1 scope: single ATO, voice-to-animation + scouting lookup.

### Environment
- Node v22.14.0, npm 10.9.2 ✅
- Python 3.13.3 ✅
- Git 2.49 ✅
- Winget 1.28 ✅
- `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` NOT set in env. Building in mock mode; real keys can be dropped into `backend/.env` later.

### What's been built so far

#### Documentation
- `CLAUDE.md` — project-context document loaded automatically by Claude Code; travels across machines via `git clone`.
- `docs/vocabulary.md` — **135-entry coach glossary** produced by an async research agent. Covers screens (24), cuts (18), court locations (24), inbound terms (6), formations (11), player roles (7), actions (16), named sets (16), defensive coverages (14), tempo (6), plus 10 worked-example ATOs and 10 open schema questions.
- `docs/architecture.md` — system diagram + reasoning for backend split.
- `docs/play-schema.md` — schema design notes (v0.1 stub, v0.2 incoming).

#### Backend (`backend/`)
- FastAPI app with `/healthz`, `/transcribe`, `/parse-play`, `/scout` endpoints.
- Pydantic schemas v0.1 mirror the play schema doc — `PlaySchema`, `Player`, `Action` discriminated union (move, screen, cut, pass, dribble, handoff, shot), `NamedLocation`, `ScreenType`, `CutType`, etc.
- `services/anthropic_client.py` — Claude wrapper with structured-output via tool use; few-shot examples injected as prior turns; falls back to mock if no API key.
- `services/whisper_client.py` — OpenAI Whisper wrapper, mock fallback.
- `services/mcp_client.py` — stub for `nba_stats_mcp` (real wiring pending repo access).
- `prompts/vocabulary_prompt.py` — embeds `docs/vocabulary.md` into the LLM system prompt at request time.
- `prompts/few_shots.py` — 2 hand-crafted transcript→play examples (Horns Slip, BLOB Box Curl).
- **11 tests passing**: schema round-trip, mock parse-play, mock scout, healthz, named-location coverage.
- Running live on `http://127.0.0.1:8765` in mock mode (background process).

#### Frontend (`app/`)
- Expo SDK 54 + RN 0.81 + react-native-web + TypeScript scaffolded.
- Added: `@shopify/react-native-skia` (cross-platform Skia), `expo-av` (mic), `react-dom`, `@expo/metro-runtime`, `expo-constants`.
- `app.json` — landscape orientation, ios/android perms for mic, web bundler metro, `extra.apiBaseUrl`.
- `tsconfig.json` — path alias `@/*` → `src/*`.
- `src/types/play.ts` — TypeScript mirror of backend Pydantic schema.
- `src/court/coords.ts` — `NamedLocation` → normalized (nx, ny) → canvas pixel coords. Basket-at-top render.
- `src/court/CourtBackground.tsx` — Skia half-court markings (baseline, sidelines, lane, FT circle, 3-pt arc, rim, half-court arc).
- `src/court/PlayRenderer.tsx` — Skia overlay of players (P1..P5 circles) + action markers (screen T, cut bezier, pass line, shot arrow, handoff ring).
- `src/api/client.ts` — fetch wrapper for `/healthz`, `/parse-play`, `/scout`.
- `src/screens/HomeScreen.tsx` — 3-column landscape layout: transcript+controls / court / scouting panel. Demo transcript loaded; Parse button hits backend; scouting panel hits `/scout`; mock-mode badge in title bar.
- `App.tsx` — mounts HomeScreen.
- **TypeScript typecheck clean.**
- **Web export builds clean** — 773KB JS bundle in `dist/`, served on `http://127.0.0.1:5173`.
- **CORS verified** end-to-end: web bundle's origin can hit backend.

#### Infra
- Git initialized at repo root, `main` branch (no remote yet — push when Sean adds a GitHub repo).
- Backend + static web server both running in background.

### Tests passing
```
backend: 11 tests (schemas, locations, parse-play mock, scout mock, healthz)
typecheck: app/ TypeScript clean
build: app/ web export 4 files / 773KB
```

### Live processes (still running)
- `uvicorn` backend on `http://127.0.0.1:8765` (mock mode)
- `python -m http.server` on `http://127.0.0.1:5173` serving `app/dist/`

### Decisions worth flagging
- Backend lang: **Python** (chosen now — wasn't blocking earlier, but FastAPI + Pydantic + Anthropic SDK ecosystem is the right tool here).
- Schema version: **v0.1** today. v0.2 will add `meta.trigger` (BLOB/SLOB slap/go) and top-level `counters[]` (alternative reads) per vocabulary agent's recommendations.
- Mock mode default: backend runs in mock when API keys are missing, so the whole stack is testable offline. Drop `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` into `backend/.env` to flip to live.

## 2026-05-14 — Session 1 final state

### What's now done

**Schema v0.2** — `meta.trigger` (BLOB/SLOB cues: slap, verbalGo, verbalSet, automatic, deny, screen) and `counters[]` (alternative-read sequences) added per vocabulary research recommendations. Backend Pydantic + frontend TS mirrors kept in sync.

**Voice → transcript → play → render pipeline, end-to-end:**
- Mic button → `useRecorder` hook (MediaRecorder on web, `expo-av` on native) → POST `/transcribe` (multipart) → text fills transcript box.
- Parse button → POST `/parse-play` → returns play schema v0.2 → renders on Skia canvas.
- Auto-play / step / scrub via tick slider; players interpolate between anchor positions implied by `move`/`dribble`/`cut`/`handoff` actions; action overlays (screen T-marks, cut arcs, pass lines, shot arrows) fade in as their tick is reached.

**Variety in the mock layer:** 5 distinct mock plays selected by keyword in transcript — Horns Slip, BLOB Box Curl (with slap trigger), SLOB Stack, Hammer, Spain PnR (with "tag the roller" counter). Lets the full UI be demoed without API keys.

**Demo chips** in the left panel switch between 4 representative transcripts (Horns + counter, BLOB Box, Hammer, Spain). One tap loads, one tap parses, one tap plays.

**Cross-platform proven:** TS strict typecheck clean; `expo export --platform web` builds in <10s, ~773KB bundle; bundle confirmed to contain app code, not just Expo template.

**16 backend tests passing** — schema round-trip, location coverage, parse-play mock variety (Horns / BLOB / Hammer / Spain), scout mock, healthz, **full transcribe → parse-play → scout integration chain**.

**Dev scripts** — `scripts/dev.ps1` (Windows) and `scripts/dev.sh` (macOS/Linux) for one-command startup.

### Things explicitly NOT done (waiting on inputs)

- **Real Claude / Whisper calls** — backend is wired for both, just needs API keys in `backend/.env`. Schema-driven structured output via Claude tool-use is implemented in `services/anthropic_client.py` with proper few-shot injection and the full vocabulary glossary embedded in the system prompt.
- **`nba_stats_mcp` integration** — `services/mcp_client.py` is a stub returning fake context. Real wiring blocked on Brandon's repo access. The `/scout` endpoint, request schema, and frontend panel are all in place — only the stub's body needs to change.
- **Git remote / first commit** — git initialized locally on `main`, no commits yet. Push to a GitHub repo when ready. (I deliberately didn't make commits because git user.name/email aren't configured — your call.)
- **Animation polish** — current interpolation is linear between integer ticks. Real coach animations would benefit from easing, ball-position tracking, and showing screen-and-roll arcs rather than straight lines. Punt to v0.3.
- **Schema v0.3 questions** — per-action read trees (currently only top-level counters), explicit ball position tracking, simultaneous-action sub-tick granularity, defensive coverage annotations on actions. All listed in `docs/vocabulary.md` § Open Questions for the schema author.

### How to verify the build yourself

```powershell
# 1. Backend (mock mode, no keys needed)
cd backend
.\.venv\Scripts\python.exe -m pytest             # 16 tests pass
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8765

# 2. Frontend (browser)
cd app
npx tsc --noEmit                                 # type-clean
npx expo start --web                             # opens at http://localhost:8081

# 3. Or test against the static export
cd app
npx expo export --platform web --output-dir dist
python -m http.server 5173 --directory dist      # http://localhost:5173
```

In the browser:
1. The title bar should show MOCK MODE badge.
2. Click any of the four demo chips on the left to load a transcript.
3. Click "Parse play" → court renders on the right with player tokens and action overlays.
4. Use the playback bar below the court (◀ / ▶ / scrub dots) to step through ticks.
5. Click "Get scouting report" on the right panel for a mock scouting summary.
6. Click "🎤 Record play" to record (browser will prompt for mic); on stop, the transcript box updates from `/transcribe`.

### Live processes left running (you can kill any time)

- Backend on :8765 (uvicorn with `--reload`).
- Static web bundle server on :5173 (Python http.server).

To stop them:
```powershell
Get-NetTCPConnection -LocalPort 8765,5173 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Counts

- Files written: ~38 (excluding `node_modules`, `.venv`, `dist`).
- Lines of code (rough): 2,000+ across backend + frontend.
- Coach glossary entries: 135.
- Backend tests: 16/16 green.
- Web bundle size: 773 KB.
- Time invested by automated agents (vocab research): ~7 min.

## 2026-05-14 — Session 2: nba_stats_mcp integration

After Sean granted me access via `gh auth login` + collaborator perms on `brandonhawi/nba_stats_mcp`, I cloned the repo and wired the scouting layer to **real NBA data**.

### Discovery
- Brandon's MCP is a **remote OAuth-protected** FastMCP server (Streamable HTTP, `/mcp` mount), designed as a claude.ai connector — not a local stdio MCP. Mounted publicly via Tailscale Funnel.
- ~20 tools across lookup / live / players / teams / league / compare / contracts / cap categories. Way more than the README's v1 list suggested.
- Tool implementations are thin wrappers around `nba_api` (the unofficial stats.nba.com Python client), with a shared `NBAClient` adding browser headers, token-bucket rate limiting (1 req/s), 3-retry backoff, and a TTL cache.

### Integration approach
Server-side **direct import**, NOT remote MCP protocol. Justification: Court Vision's backend is Python anyway, and going through the OAuth-protected HTTP wire would force us to do the passcode dance for a server-to-server call. Importing `nba_stats_mcp.nba_client.NBAClient` directly gives us the same caching, rate limiting, and headers without any auth overhead.

Wired via `pip install -e ../nba_stats_mcp` from Court Vision's venv (editable install — Brandon's `git pull` updates flow through automatically).

### What's live now
- `backend/app/services/mcp_client.py` rewrites: imports `NBAClient` lazily, exposes `available()`, `fetch_scouting_context(lineup: list[str])`. The context fetcher does:
  1. `nba_api.stats.static.players.find_players_by_full_name(name)` for each lineup entry
  2. `PlayerDashboardByGeneralSplits` for each found player → overall + win/loss + location splits
  3. `CommonPlayerInfo` for each player → current `team_id`, `team_name`, `team_city`, `position` (we discovered `player_game_log`'s TEAM_ID column is empty in current API responses)
  4. `LeagueDashLineups` for the most-voted team → top-5 most-used 5-man lineups
- `routes/scout.py` now distinguishes `mock` (= no Claude API key) from `data_source` (= where the stats came from: `nba_stats_mcp` or `stub`). Both fields surface in the response.
- Frontend (`HomeScreen.tsx`) shows two badges on the scouting report: `CLAUDE: MOCK` / `LIVE` and `STATS: LIVE NBA` / `STUB`.

### Smoke tests run
- `scripts/smoke_mcp.py` confirms real-data flow: Curry → pid 201939, team 1610612744 (Warriors), GP=43, FG_PCT=0.468. Wiggins resolved to team 1610612748 (Miami — accurate post-trade). Top Warriors lineup: Porziņģis · Spencer · Santos · Podziemski · Richard at 118 minutes.
- End-to-end `/scout` via curl with a 5-man Warriors lineup: `{"mock": true, "data_source": "nba_stats_mcp"}`. Round-trip in ~5s with warm cache.

### Quirks logged in `~/.claude/.../memory/reference_nba_stats_mcp.md`
- `player_game_log.TEAM_ID` is empty in current responses — use `commonplayerinfo` instead.
- `OverallPlayerDashboard` is a list of one row, not a dict — flatten to `[0]`.
- Uvicorn `--reload` can crash mid-long-request once `nba_api` is in the chain. Run dev without `--reload`.
- Windows console default cp1252 can't render middle-dot characters in lineup `GROUP_NAME`. Set `PYTHONIOENCODING=utf-8` or `sys.stdout.reconfigure(encoding='utf-8')`.

### Updated stats
- Files written: ~46 (added smoke_mcp.py, debug_team_id.py, dev.ps1, dev.sh, plus updated 7).
- Backend tests: still 16/16 green (MCP integration tests would require live network; deferred to a separate `tests/test_mcp_live.py` opt-in).
- Backend deps: added `nba_api`, `pandas`, `cachetools`, `beautifulsoup4`, `python-dotenv`, `mcp[cli]` (via nba-stats-mcp's deps).
- Real `/scout` response time on cold cache: 10-30s; warm cache: ~5s.

### What's now end-to-end real (when keys are set)
- Voice (Whisper API) → transcript
- Transcript → Claude with vocabulary glossary → play schema v0.2
- Lineup → nba_stats_mcp NBAClient → real player splits + team lineups → Claude scouting summary
- All animated on Skia court diagram with playback scrubbing

Only thing still mock in mock-mode: Claude synthesis itself. Drop `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` into `backend/.env` → restart backend → fully live.

## 2026-05-15 — Session 3: live mode + real roster + CanvasKit fix

### API keys wired
- Sean added `ANTHROPIC_API_KEY` (Opus 4.7) and `OPENAI_API_KEY` (Whisper) to `backend/.env`.
- Verified `/healthz` shows `mock_mode: false, has_anthropic: true, has_openai: true`.
- Verified real Claude output on `/parse-play` for two transcripts:
  - "Run hammer..." → schema correctly placed P4 at left block, P3 in left corner, sequenced ball-screen → drive → hammer screen → fade → pass → shot. Used both `ballScreen` and `hammer` screenTypes correctly.
  - BLOB "On the slap, 3 down-screens for 1..." → trigger captured as `{type: slap, actor: P5, description: "inbounder slaps the ball"}`. Primary action: down screen → curl → pass → shot. Counter "if they top-lock 1" captured with backdoor → pass → shot at rim.
- Verified `/scout` returns ~5,290-char Markdown scouting report citing real stats: Curry 39.3% on 484 3PA, Porzingis 84.2% FT on 158 FTA, Green 376 ast vs 181 TO. Structured sections (Strengths / Weaknesses / Matchups / Bottom Line). Reads like a real NBA scouting doc.

### CanvasKit WASM bundling fix
- `expo export --platform web` does NOT bundle `canvaskit.wasm`. Browser 404s on `/_expo/static/js/web/canvaskit.wasm`, which cascades into "TypefaceFontProvider undefined" → "PictureRecorder undefined" → blank page.
- Fixed:
  1. `app/index.ts` — on web, run `LoadSkiaWeb()` from `@shopify/react-native-skia/lib/module/web` before `registerRootComponent(App)`.
  2. `app/src/court/PlayRenderer.tsx` — moved `Skia.FontMgr.System()` from module top-level into a `useSystemFont()` hook so it runs at React render time (post-WASM-load) and falls back to no-font instead of crashing.
  3. `scripts/build-web.ps1` — runs `expo export --platform web` then copies `node_modules\canvaskit-wasm\bin\canvaskit.wasm` (6.8 MB) into `dist\_expo\static\js\web\`. Replaces plain `expo export` in the workflow.

### Live roster (no more stale hardcoded lineup)
- New backend route: `GET /roster?team=GSW` → `nba_api.stats.endpoints.commonteamroster` via the MCP's `NBAClient`. Returns current actual roster sorted alphabetically with name / position / jersey / height.
- Frontend `HomeScreen.tsx` now:
  - Auto-loads `GSW` roster on mount (replaced the hardcoded `DEMO_LINEUP` constant).
  - Has a 3-letter team-abbr input + "Load" button so the user can pull any team's current roster.
  - Shows team name and roster size in the panel label.
  - Adds a hint under the scout button that the first call takes 10-30s on cold cache.
- Verified `/roster?team=GSW` returns 18 players including Jimmy Butler III (#10) and Al Horford (#20) — both accurate as of May 2026, confirming this is live current-roster data, not the stale lineup of Klay/Wiggins/Looney we had before.

### Schema response change
`ScoutResponse` now carries TWO independent flags:
- `mock: bool` — is the Claude synthesis mocked (no key)? Yellow badge: `CLAUDE: MOCK` vs `LIVE`.
- `data_source: "nba_stats_mcp" | "stub"` — where the upstream stats came from. Green badge: `STATS: LIVE NBA` vs `STATS: STUB`.
The two are independent — you can have real stats with mock Claude (development without keys) or real Claude with stub stats (if Brandon's package isn't installed).

### Files added/changed this session
- `app/index.ts` — LoadSkiaWeb wrapper on web entry
- `app/src/court/PlayRenderer.tsx` — useSystemFont hook
- `app/src/screens/HomeScreen.tsx` — roster fetch + team picker UI; live/mock badge wiring
- `app/src/api/client.ts` — `fetchRoster()`
- `backend/.env` — actual keys (gitignored)
- `backend/app/routes/roster.py` — new
- `backend/app/main.py` — mount /roster
- `backend/app/routes/scout.py` — `data_source` flag
- `backend/app/schemas.py` — `ScoutResponse.data_source` field
- `scripts/build-web.ps1` — new (expo export + WASM copy)
- `CLAUDE.md` — comprehensive rewrite for post-/clear continuity
- `docs/SESSION_LOG.md` — this entry

### Counts (updated)
- Backend Python files: 25
- Frontend TS/TSX files: 14
- Backend tests: 16/16 still green
- Web bundle: 916 KB (with LoadSkiaWeb path included)
- canvaskit.wasm: 6.8 MB (copied to dist/ by build-web.ps1)
- Backend deps now include: nba_api, pandas, cachetools, beautifulsoup4, mcp[cli], + transitive

### Live processes left running
- Backend on `:8765` (uvicorn, NO `--reload`, mock_mode=false)
- Static dist on `:5173` (Python http.server serving the new bundle a18359d8...)

### Known issues / things to clean up
- `nba_api`'s response sizes are large — the `/scout` Claude prompt is ~30K input tokens per call ($0.45 at Opus 4.7 input pricing). If costs become a concern, slim down the context (just send overall + win/loss splits, drop the lineup-level detail unless asked).
- Player position field from `commonteamroster` returns NBA-style ("G", "F", "C-F") not strict (PG/SG/SF/PF/C). The `rolifyPosition()` helper in `HomeScreen.tsx` maps roughly; some assignments will be wrong (a "G" becomes PG by default).
- The first 5 players from a roster are alphabetical, not by minutes played. To get the "starting lineup", we'd need `team_lineups` with `group_quantity=5` sorted by MIN. Punt to v1.1.


