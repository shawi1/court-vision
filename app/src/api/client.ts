/**
 * Thin fetch wrapper around the Court Vision backend.
 * Base URL comes from app.json `expo.extra.apiBaseUrl`.
 */
import Constants from "expo-constants";

import type { PlaySchema } from "@/types/play";

const BASE_URL: string =
  (Constants.expoConfig?.extra as any)?.apiBaseUrl ?? "http://127.0.0.1:8765";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function jsonPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json() as Promise<T>;
}

export interface ParsePlayResponse {
  play: PlaySchema;
  transcript: string;
  notes?: string | null;
}

export function parsePlay(transcript: string, hint?: string): Promise<ParsePlayResponse> {
  return jsonPost<ParsePlayResponse>("/parse-play", { transcript, hint });
}

export interface ScoutPlayer { name: string; role?: "PG" | "SG" | "SF" | "PF" | "C" }
export interface ScoutResponse {
  summary: string;
  bullets: string[];
  /** True if Claude synthesis was mocked (no API key). */
  mock: boolean;
  /** Where the underlying stats came from: 'nba_stats_mcp' (real) or 'stub'. */
  data_source?: "nba_stats_mcp" | "stub";
}

export function scout(
  lineup: ScoutPlayer[],
  opponent_lineup?: ScoutPlayer[],
  question?: string,
): Promise<ScoutResponse> {
  return jsonPost<ScoutResponse>("/scout", { lineup, opponent_lineup, question });
}

export interface HealthResponse {
  ok: boolean;
  mock_mode: boolean;
  has_anthropic: boolean;
  has_openai: boolean;
}
export async function health(): Promise<HealthResponse> {
  const r = await fetch(`${BASE_URL}/healthz`);
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

export interface TranscribeResponse { text: string }

/**
 * Send a recorded audio file/blob to /transcribe and get back the transcript.
 *
 * `source` is either a Blob (web) or a `{ uri, name?, type? }` (native).
 * We construct a multipart FormData accordingly.
 */
export async function transcribeAudio(
  source: Blob | { uri: string; name?: string; type?: string },
): Promise<TranscribeResponse> {
  const fd = new FormData();
  if (source instanceof Blob) {
    fd.append("audio", source, "audio.webm");
  } else {
    // React Native FormData accepts { uri, name, type } as a file source
    fd.append("audio", {
      uri: source.uri,
      name: source.name ?? "audio.m4a",
      type: source.type ?? "audio/m4a",
    } as unknown as Blob);
  }
  const r = await fetch(`${BASE_URL}/transcribe`, { method: "POST", body: fd });
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

export interface RosterPlayer {
  name: string;
  position?: string | null;
  jersey?: string | null;
  height?: string | null;
}
export interface RosterResponse {
  team: string;
  team_id?: number | null;
  full_name?: string | null;
  players: RosterPlayer[];
  /** Starters from the team's most recent game. Empty array if unavailable. */
  starters: RosterPlayer[];
  source: "nba_stats_mcp" | "stub";
}
export async function fetchRoster(team: string): Promise<RosterResponse> {
  const r = await fetch(`${BASE_URL}/roster?team=${encodeURIComponent(team)}`);
  if (!r.ok) throw new ApiError(r.status, await r.text());
  return r.json();
}

export const apiBaseUrl = BASE_URL;
