/**
 * Court Vision home screen.
 *
 * Layout (landscape):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Title bar (mock-mode badge, backend status)              │
 *   ├──────────────────┬───────────────────┬───────────────────┤
 *   │ Transcript /     │   Court canvas    │ Scouting panel    │
 *   │ Parse / demos    │   + playback bar  │ (lineup + report) │
 *   │                  │   + counters      │                   │
 *   └──────────────────┴───────────────────┴───────────────────┘
 */
import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, useWindowDimensions,
} from "react-native";

import { CountersList } from "@/components/CountersList";
import { PlaybackBar } from "@/components/PlaybackBar";
import { PlayRenderer } from "@/court/PlayRenderer";
import { maxTick as maxTickOf } from "@/court/playback";
import {
  apiBaseUrl, fetchRoster, health, parsePlay, scout, transcribeAudio,
  type HealthResponse, type RosterResponse, type ScoutPlayer, type ScoutResponse,
} from "@/api/client";
import { useRecorder } from "@/audio/useRecorder";
import type { PlaySchema } from "@/types/play";

const DEMO_TRANSCRIPTS: { label: string; text: string }[] = [
  {
    label: "Horns Slip + counter",
    text:
      "Alright, Horns. 1 brings it up, 4 and 5 set up at the elbows, 2 in the left " +
      "corner, 3 in the right. 1 dribbles to the right wing, 5 sets a ball screen " +
      "and slips to the rim. 1 hits 5 on the slip. If they switch the screen, " +
      "5 re-screens for 1 going middle.",
  },
  {
    label: "BLOB Box Curl",
    text:
      "BLOB, box set. 5 is the inbounder. 1 in the left corner, 2 right corner, " +
      "3 left elbow, 4 right elbow. On the slap, 3 down-screens for 1, 1 curls to " +
      "the wing for the shot. 4 sets a back screen for 5 stepping in after.",
  },
  {
    label: "Hammer",
    text:
      "Spread floor. 5 ball-screens for 1 at the top, 1 attacks baseline strong " +
      "side. 4 sets a hammer screen weak side for 3 in the corner, kick it out " +
      "for the corner three.",
  },
  {
    label: "Spain PnR",
    text:
      "Spain action. 5 sets a ball screen for 1, 3 back-picks 5's man from the " +
      "wing, pops to the top of the key for three.",
  },
];

// Initial fallback lineup if /roster isn't available (MCP not installed, etc.).
// The real roster is loaded from /roster?team=... on mount.
const FALLBACK_LINEUP: ScoutPlayer[] = [
  { name: "Stephen Curry", role: "PG" },
  { name: "Brandin Podziemski", role: "SG" },
  { name: "Jonathan Kuminga", role: "SF" },
  { name: "Draymond Green", role: "PF" },
  { name: "Kristaps Porzingis", role: "C" },
];

const DEFAULT_TEAM = "GSW";

const PLAYBACK_INTERVAL_MS = 700;

export function HomeScreen() {
  const { width, height } = useWindowDimensions();

  const [transcript, setTranscript] = React.useState(DEMO_TRANSCRIPTS[0].text);
  const [play, setPlay] = React.useState<PlaySchema | null>(null);
  const [parseLoading, setParseLoading] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const [currentTime, setCurrentTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  const [scoutReport, setScoutReport] = React.useState<ScoutResponse | null>(null);
  const [scoutLoading, setScoutLoading] = React.useState(false);
  const [scoutError, setScoutError] = React.useState<string | null>(null);

  const [healthInfo, setHealthInfo] = React.useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = React.useState<string | null>(null);

  const recorder = useRecorder();
  const [transcribing, setTranscribing] = React.useState(false);

  // Lineup loaded from /roster, with manual team selection.
  const [teamAbbr, setTeamAbbr] = React.useState(DEFAULT_TEAM);
  const [roster, setRoster] = React.useState<RosterResponse | null>(null);
  const [rosterLoading, setRosterLoading] = React.useState(false);
  const [rosterError, setRosterError] = React.useState<string | null>(null);
  const [lineup, setLineup] = React.useState<ScoutPlayer[]>(FALLBACK_LINEUP);

  const loadRoster = React.useCallback(async (abbr: string) => {
    setRosterLoading(true);
    setRosterError(null);
    try {
      const r = await fetchRoster(abbr);
      setRoster(r);
      // Pick the first 5 players as the default lineup. User can rotate through
      // by clicking the lineup rows. (Sorting by minutes would need an extra
      // call; alphabetical is what /roster currently returns.)
      const top5: ScoutPlayer[] = r.players.slice(0, 5).map((p) => ({
        name: p.name,
        role: rolifyPosition(p.position),
      }));
      if (top5.length === 5) setLineup(top5);
    } catch (e: any) {
      setRosterError(e?.message ?? "roster load failed");
    } finally {
      setRosterLoading(false);
    }
  }, []);

  // Auto-load default team's roster on first mount.
  React.useEffect(() => { loadRoster(DEFAULT_TEAM); }, [loadRoster]);

  React.useEffect(() => {
    health()
      .then(setHealthInfo)
      .catch((e) => setHealthError(e?.message ?? "Backend unreachable"));
  }, []);

  // Auto-advance playback. Actions animate over [tick, tick+1], so we run the
  // clock to maxTick + 1 to let the last action finish.
  React.useEffect(() => {
    if (!playing || !play) return;
    const endT = maxTickOf(play) + 1;
    const id = setInterval(() => {
      setCurrentTime((t) => {
        const next = +(t + 0.25).toFixed(2);
        if (next > endT) {
          setPlaying(false);
          return endT;
        }
        return next;
      });
    }, PLAYBACK_INTERVAL_MS / 4);
    return () => clearInterval(id);
  }, [playing, play]);

  const runParse = React.useCallback(async () => {
    setParseLoading(true);
    setParseError(null);
    try {
      const r = await parsePlay(transcript);
      setPlay(r.play);
      setCurrentTime(0);
      setPlaying(false);
    } catch (e: any) {
      setParseError(e?.message ?? "Parse failed");
    } finally {
      setParseLoading(false);
    }
  }, [transcript]);

  const toggleMic = React.useCallback(async () => {
    if (recorder.state === "recording") {
      const src = await recorder.stop();
      if (!src) return;
      setTranscribing(true);
      try {
        const audioArg = src.kind === "blob"
          ? src.blob
          : { uri: src.uri, name: src.name, type: src.type };
        const r = await transcribeAudio(audioArg);
        setTranscript(r.text);
      } catch (e: any) {
        setParseError(`Transcribe failed: ${e?.message ?? e}`);
      } finally {
        setTranscribing(false);
      }
    } else {
      await recorder.start();
    }
  }, [recorder]);

  const runScout = React.useCallback(async () => {
    setScoutLoading(true);
    setScoutError(null);
    try {
      const r = await scout(lineup);
      setScoutReport(r);
    } catch (e: any) {
      setScoutError(e?.message ?? "Scout failed");
    } finally {
      setScoutLoading(false);
    }
  }, [lineup]);

  // Layout
  const titleH = 56;
  const sidePanelW = Math.max(280, Math.min(360, width * 0.22));
  const courtAvailW = width - sidePanelW * 2;
  const courtAvailH = height - titleH - 80; // reserve space for playback bar
  const aspect = 50 / 47;
  let canvasW = courtAvailW - 24;
  let canvasH = courtAvailH - 24;
  if (canvasW / canvasH > aspect) canvasW = canvasH * aspect;
  else canvasH = canvasW / aspect;

  const playMaxTick = play ? maxTickOf(play) : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.titleBar, { height: titleH }]}>
        <Text style={styles.title}>Court Vision</Text>
        <View style={styles.statusRow}>
          {healthError && <Text style={styles.statusBad}>backend: {healthError}</Text>}
          {healthInfo && (
            <>
              <Text style={healthInfo.mock_mode ? styles.statusWarn : styles.statusGood}>
                {healthInfo.mock_mode ? "MOCK MODE" : "LIVE"}
              </Text>
              <Text style={styles.statusDim}>{apiBaseUrl}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.body}>
        {/* Left: controls */}
        <View style={[styles.panel, { width: sidePanelW }]}>
          <Text style={styles.panelTitle}>Voice → Play</Text>

          <Text style={styles.label}>Demo transcripts</Text>
          <View style={styles.chipRow}>
            {DEMO_TRANSCRIPTS.map((d) => (
              <Pressable key={d.label} style={styles.chip}
                onPress={() => { setTranscript(d.text); setPlay(null); }}>
                <Text style={styles.chipText}>{d.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Transcript</Text>
          <TextInput
            multiline
            value={transcript}
            onChangeText={setTranscript}
            style={styles.transcriptBox}
            placeholder="Speak or paste a play description..."
          />
          <View style={styles.row}>
            <Pressable
              style={[styles.button, parseLoading && styles.buttonDisabled]}
              onPress={runParse}
              disabled={parseLoading}
            >
              {parseLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Parse play</Text>}
            </Pressable>
          </View>
          {parseError && <Text style={styles.errorText}>{parseError}</Text>}

          <View style={styles.spacer} />
          <Text style={styles.label}>Mic capture</Text>
          <Pressable
            style={[
              styles.button,
              recorder.state === "recording" && styles.micRecording,
              transcribing && styles.buttonDisabled,
            ]}
            onPress={toggleMic}
            disabled={transcribing}
          >
            {transcribing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {recorder.state === "recording" ? "● Stop recording" : "🎤 Record play"}
              </Text>
            )}
          </Pressable>
          {recorder.error && <Text style={styles.errorText}>{recorder.error}</Text>}
          <Text style={styles.dim}>
            Without an `OPENAI_API_KEY`, the backend returns a mock transcript on stop.
          </Text>
        </View>

        {/* Middle: court */}
        <View style={styles.courtWrap}>
          {play ? (
            <>
              <PlayRenderer play={play} width={canvasW} height={canvasH} currentTime={currentTime} />
              <PlaybackBar
                maxTick={playMaxTick}
                currentTime={currentTime}
                onChange={setCurrentTime}
                playing={playing}
                onTogglePlay={() => {
                  if (currentTime >= playMaxTick + 1) setCurrentTime(0);
                  setPlaying((p) => !p);
                }}
              />
              <View style={styles.playMeta}>
                <Text style={styles.playMetaText}>
                  {play.meta.name ?? "(unnamed)"} — {play.meta.situation} · {play.initialFormation}
                </Text>
                {play.meta.trigger && (
                  <Text style={styles.triggerText}>
                    Trigger: {play.meta.trigger.type}
                    {play.meta.trigger.actor ? ` by ${play.meta.trigger.actor}` : ""}
                  </Text>
                )}
              </View>
            </>
          ) : (
            <View style={[styles.placeholder, { width: canvasW, height: canvasH }]}>
              <Text style={styles.placeholderText}>Press "Parse play" to render the diagram.</Text>
              <Text style={styles.placeholderHint}>
                Try the chips on the left to switch demos: Horns Slip, BLOB Box, Hammer, Spain.
              </Text>
            </View>
          )}
        </View>

        {/* Right: scouting + counters */}
        <View style={[styles.panel, { width: sidePanelW }]}>
          <Text style={styles.panelTitle}>Counters / reads</Text>
          {play ? <CountersList counters={play.counters} /> : <Text style={styles.dim}>Parse a play first.</Text>}

          <View style={styles.spacer} />
          <Text style={styles.panelTitle}>Scouting</Text>
          <Text style={styles.label}>Team (3-letter abbr)</Text>
          <View style={styles.row}>
            <TextInput
              value={teamAbbr}
              onChangeText={(t) => setTeamAbbr(t.toUpperCase())}
              maxLength={3}
              autoCapitalize="characters"
              style={[styles.transcriptBox, { minHeight: 36, flex: 1 }]}
              placeholder="GSW"
            />
            <Pressable
              style={[styles.buttonSecondary, rosterLoading && styles.buttonDisabled]}
              onPress={() => loadRoster(teamAbbr)}
              disabled={rosterLoading}
            >
              {rosterLoading ? <ActivityIndicator color="#9bb6c6" /> : <Text style={styles.buttonSecondaryText}>Load</Text>}
            </Pressable>
          </View>
          {rosterError && <Text style={styles.errorText}>{rosterError}</Text>}
          <Text style={styles.label}>
            Lineup{roster ? ` (${roster.full_name}, ${roster.players.length} on roster)` : ""}
          </Text>
          <View style={styles.lineupBox}>
            {lineup.map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.lineupRow}>
                <Text style={styles.lineupRole}>{p.role ?? "—"}</Text>
                <Text style={styles.lineupName}>{p.name}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={[styles.button, scoutLoading && styles.buttonDisabled]}
            onPress={runScout}
            disabled={scoutLoading}
          >
            {scoutLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get scouting report</Text>}
          </Pressable>
          {scoutLoading && (
            <Text style={styles.dim}>
              First call can take 10-30s — nba_api is rate-limited to 1 req/s on cold cache.
            </Text>
          )}
          {scoutError && <Text style={styles.errorText}>{scoutError}</Text>}
          {scoutReport && (
            <ScrollView style={styles.scoutReportBox}>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                {scoutReport.mock && <Text style={styles.mockBadge}>CLAUDE: MOCK</Text>}
                {scoutReport.data_source === "nba_stats_mcp" && (
                  <Text style={styles.realDataBadge}>STATS: LIVE NBA</Text>
                )}
                {scoutReport.data_source === "stub" && (
                  <Text style={styles.mockBadge}>STATS: STUB</Text>
                )}
              </View>
              <Text style={styles.scoutText}>{scoutReport.summary}</Text>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1f2b" },
  titleBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, backgroundColor: "#0a1f2b",
    borderBottomWidth: 1, borderBottomColor: "#1d3848",
  },
  title: { color: "white", fontSize: 22, fontWeight: "700" },
  statusRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  statusGood: { color: "#2ecc71", fontWeight: "700" },
  statusWarn: { color: "#ffcc00", fontWeight: "700" },
  statusBad: { color: "#e74c3c", fontWeight: "700" },
  statusDim: { color: "#7d99ad", fontSize: 12 },

  body: { flex: 1, flexDirection: "row" },
  panel: {
    padding: 14,
    borderRightWidth: 1, borderRightColor: "#1d3848",
    backgroundColor: "#102634",
  },
  panelTitle: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  label: { color: "#9bb6c6", fontSize: 12, marginTop: 6, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  dim: { color: "#7d99ad", fontSize: 12 },
  spacer: { height: 18 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: "#1d3848", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: { color: "#cbd6dd", fontSize: 11 },

  transcriptBox: {
    minHeight: 120,
    backgroundColor: "#0a1f2b",
    color: "white",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1d3848",
    fontSize: 13,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  button: {
    backgroundColor: "#ff6f3c",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, flex: 1, alignItems: "center", justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "white", fontWeight: "700" },
  buttonSecondary: {
    backgroundColor: "transparent", borderColor: "#1d3848", borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    alignItems: "center", justifyContent: "center", minWidth: 60,
  },
  buttonSecondaryText: { color: "#9bb6c6", fontWeight: "600" },
  micRecording: { backgroundColor: "#c0392b" },
  errorText: { color: "#e74c3c", marginTop: 8, fontSize: 12 },

  courtWrap: { flex: 1, alignItems: "center", justifyContent: "flex-start", padding: 12 },
  placeholder: {
    backgroundColor: "#0e2c3d", borderRadius: 12,
    alignItems: "center", justifyContent: "center", padding: 24,
    borderWidth: 1, borderColor: "#1d3848", borderStyle: "dashed",
  },
  placeholderText: { color: "white", fontSize: 16, marginBottom: 8 },
  placeholderHint: { color: "#7d99ad", fontSize: 12, textAlign: "center" },
  playMeta: { marginTop: 4, alignItems: "center" },
  playMetaText: { color: "white", fontWeight: "600", fontSize: 13 },
  triggerText: { color: "#e67e22", fontSize: 12, marginTop: 2 },

  lineupBox: { backgroundColor: "#0a1f2b", padding: 8, borderRadius: 8, marginBottom: 10 },
  lineupRow: { flexDirection: "row", paddingVertical: 4 },
  lineupRole: { color: "#ff6f3c", width: 32, fontWeight: "700" },
  lineupName: { color: "white" },

  scoutReportBox: { marginTop: 12, padding: 10, backgroundColor: "#0a1f2b", borderRadius: 8, maxHeight: 220 },
  scoutText: { color: "white", fontSize: 12, lineHeight: 18 },
  mockBadge: { color: "#ffcc00", fontWeight: "700", fontSize: 10, backgroundColor: "#3a2a00", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  realDataBadge: { color: "#2ecc71", fontWeight: "700", fontSize: 10, backgroundColor: "#0e2a17", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
});

function rolifyPosition(pos: string | null | undefined): ScoutPlayer["role"] {
  if (!pos) return undefined;
  const p = pos.toUpperCase();
  if (p.includes("PG") || p === "G") return "PG";
  if (p.includes("SG")) return "SG";
  if (p.includes("SF") || p === "F") return "SF";
  if (p.includes("PF")) return "PF";
  if (p.includes("C")) return "C";
  return undefined;
}
