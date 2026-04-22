# Court Vision

A voice-driven basketball play visualizer for coaches.

A coach records a verbal description of an out-of-timeout (ATO) play. The app transcribes the speech, parses it with an LLM into a structured play description, and renders an animated diagram on a basketball court. A separate scouting panel pulls in-depth NBA statistics for the current lineup.

## Status

v1 in progress. See `CLAUDE.md` for scope and decisions, `docs/` for the canonical vocabulary glossary, play schema, and architecture.

## Stack

Expo + React Native + `react-native-web` (iOS / Android / web from one codebase), TypeScript, Skia for court rendering, Whisper + Claude for the voice-to-play pipeline. Cross-platform scouting via `nba_stats_mcp`.
