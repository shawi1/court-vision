# Court Vision — Architecture (v1)

```
Cross-platform client (iOS / Android / Web, Expo + RN)
  ├── Mic capture (expo-av on native, MediaRecorder on web) ──► audio blob
  ├── Court renderer (Skia) ◄── play schema (JSON)
  └── Scouting panel        ◄── scouting JSON

         ▲                    ▲
         │ HTTPS              │
         ▼                    │
Backend (Python likely; language TBD)
  ├── POST /transcribe       → Whisper (OpenAI API or whisper.cpp)
  ├── POST /parse-play       → Claude API
  │                            ├── system prompt = vocabulary glossary
  │                            ├── few-shot examples (transcript → play JSON)
  │                            └── structured-output JSON schema
  └── POST /scout            → Claude API with nba_stats_mcp attached
                               → tool calls into the MCP → stats summary
```

## Why a backend at all in v1

- Holds API keys (Anthropic, OpenAI/Whisper) so they aren't bundled into the mobile app.
- Hosts the MCP process and proxies its tool surface.
- Single place for the vocabulary system prompt + few-shots — swap providers without redeploying the app.
- Lets us add server-side play caching/persistence later without app changes.

## Why structured output (not free-form text)

The renderer needs deterministic input: player IDs, named court locations, ordered actions with timing. We treat Claude's response as data, not prose, so the renderer is a pure function of the schema. This also makes the pipeline testable: feed a corpus of transcript fixtures, assert on the JSON output.

## Why Skia for rendering

`@shopify/react-native-skia` gives one high-performance 2D API across iOS, Android, and web. The same court-drawing code runs everywhere. Plain RN `<View>` + HTML Canvas would force divergent rendering paths.

## What v1 does NOT do

- No saved play library / playbook.
- No multi-play sequencing.
- No live possession tracking.
- No team/auth model.
- No defensive coverage simulation.
- No tactic suggestion ("you should run X here").
