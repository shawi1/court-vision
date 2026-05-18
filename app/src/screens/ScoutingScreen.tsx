/**
 * Scouting screen: pick a team, edit/inspect the lineup, get a coach-facing
 * scouting report from Claude (Sonnet) backed by live NBA stats from
 * nba_stats_mcp.
 *
 * Layout (landscape):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Team selector + lineup │  Scouting report (full bleed)   │
 *   └──────────────────────────────────────────────────────────┘
 */
import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, useWindowDimensions,
} from "react-native";

import {
  fetchRoster, scout,
  type RosterResponse, type ScoutPlayer, type ScoutResponse,
} from "@/api/client";

const FALLBACK_LINEUP: ScoutPlayer[] = [
  { name: "Stephen Curry", role: "PG" },
  { name: "Brandin Podziemski", role: "SG" },
  { name: "Jonathan Kuminga", role: "SF" },
  { name: "Draymond Green", role: "PF" },
  { name: "Kristaps Porzingis", role: "C" },
];

const DEFAULT_TEAM = "GSW";

export function ScoutingScreen() {
  const { width } = useWindowDimensions();
  const sidePanelW = Math.max(300, Math.min(380, width * 0.26));

  const [teamAbbr, setTeamAbbr] = React.useState(DEFAULT_TEAM);
  const [roster, setRoster] = React.useState<RosterResponse | null>(null);
  const [rosterLoading, setRosterLoading] = React.useState(false);
  const [rosterError, setRosterError] = React.useState<string | null>(null);
  const [lineup, setLineup] = React.useState<ScoutPlayer[]>(FALLBACK_LINEUP);

  const [scoutReport, setScoutReport] = React.useState<ScoutResponse | null>(null);
  const [scoutLoading, setScoutLoading] = React.useState(false);
  const [scoutError, setScoutError] = React.useState<string | null>(null);

  const loadRoster = React.useCallback(async (abbr: string) => {
    setRosterLoading(true);
    setRosterError(null);
    try {
      const r = await fetchRoster(abbr);
      setRoster(r);
      // Prefer the actual starters from the team's most recent game. Fall back
      // to first-five-alphabetical if the boxscore lookup failed (e.g. preseason
      // or the team hasn't played yet).
      const source = r.starters.length === 5 ? r.starters : r.players.slice(0, 5);
      const top5: ScoutPlayer[] = source.map((p) => ({
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

  React.useEffect(() => { loadRoster(DEFAULT_TEAM); }, [loadRoster]);

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

  return (
    <View style={styles.body}>
      {/* Left: team selector + lineup + run button */}
      <View style={[styles.panel, { width: sidePanelW }]}>
        <Text style={styles.panelTitle}>Team</Text>
        <View style={styles.row}>
          <TextInput
            value={teamAbbr}
            onChangeText={(t) => setTeamAbbr(t.toUpperCase())}
            maxLength={3}
            autoCapitalize="characters"
            style={styles.teamInput}
            placeholder="GSW"
          />
          <Pressable
            style={[styles.buttonSecondary, rosterLoading && styles.buttonDisabled]}
            onPress={() => loadRoster(teamAbbr)}
            disabled={rosterLoading}
          >
            {rosterLoading ? <ActivityIndicator color="#9bb6c6" /> : <Text style={styles.buttonSecondaryText}>Load roster</Text>}
          </Pressable>
        </View>
        {rosterError && <Text style={styles.errorText}>{rosterError}</Text>}

        <View style={styles.spacer} />
        <Text style={styles.label}>
          Lineup{roster ? ` — ${roster.full_name}` : ""}
        </Text>
        <View style={styles.lineupBox}>
          {lineup.map((p, i) => (
            <View key={`${p.name}-${i}`} style={styles.lineupRow}>
              <Text style={styles.lineupRole}>{p.role ?? "—"}</Text>
              <Text style={styles.lineupName}>{p.name}</Text>
            </View>
          ))}
        </View>
        {roster && roster.players.length > 5 && (
          <Text style={styles.dim}>
            {roster.players.length} on roster. Lineup editing comes in a later pass.
          </Text>
        )}

        <View style={styles.spacer} />
        <Pressable
          style={[styles.button, scoutLoading && styles.buttonDisabled]}
          onPress={runScout}
          disabled={scoutLoading}
        >
          {scoutLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get scouting report</Text>}
        </Pressable>
        {scoutLoading && (
          <Text style={styles.dim}>
            First call can take 10–30s — nba_api is rate-limited to 1 req/s on cold cache.
          </Text>
        )}
        {scoutError && <Text style={styles.errorText}>{scoutError}</Text>}
      </View>

      {/* Right: scouting report */}
      <View style={styles.reportWrap}>
        {scoutReport ? (
          <ScrollView contentContainerStyle={styles.reportInner}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>
                Scouting report
                {roster ? ` — ${roster.full_name}` : ""}
              </Text>
              <View style={styles.badgeRow}>
                {scoutReport.mock && <Text style={styles.mockBadge}>CLAUDE: MOCK</Text>}
                {scoutReport.data_source === "nba_stats_mcp" && (
                  <Text style={styles.realDataBadge}>STATS: LIVE NBA</Text>
                )}
                {scoutReport.data_source === "stub" && (
                  <Text style={styles.mockBadge}>STATS: STUB</Text>
                )}
              </View>
            </View>
            <Text style={styles.reportBody}>{scoutReport.summary}</Text>
          </ScrollView>
        ) : (
          <View style={styles.reportPlaceholder}>
            <Text style={styles.placeholderText}>Press "Get scouting report" to generate.</Text>
            <Text style={styles.placeholderHint}>
              Pulls real season splits for the loaded lineup from nba_stats_mcp,
              then asks Claude to synthesize strengths, weaknesses, matchups, and a bottom line.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

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

const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: "row" },
  panel: {
    padding: 16,
    borderRightWidth: 1, borderRightColor: "#1d3848",
    backgroundColor: "#102634",
  },
  panelTitle: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  label: { color: "#9bb6c6", fontSize: 12, marginTop: 6, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  dim: { color: "#7d99ad", fontSize: 12, marginTop: 6 },
  spacer: { height: 16 },

  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  teamInput: {
    minHeight: 40,
    flex: 1,
    backgroundColor: "#0a1f2b",
    color: "white",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1d3848",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  button: {
    backgroundColor: "#ff6f3c",
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "white", fontWeight: "700" },
  buttonSecondary: {
    backgroundColor: "transparent", borderColor: "#1d3848", borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  buttonSecondaryText: { color: "#9bb6c6", fontWeight: "600" },
  errorText: { color: "#e74c3c", marginTop: 8, fontSize: 12 },

  lineupBox: { backgroundColor: "#0a1f2b", padding: 10, borderRadius: 8 },
  lineupRow: { flexDirection: "row", paddingVertical: 4 },
  lineupRole: { color: "#ff6f3c", width: 36, fontWeight: "700" },
  lineupName: { color: "white", flex: 1 },

  reportWrap: { flex: 1, padding: 24 },
  reportInner: { paddingBottom: 32 },
  reportHeader: { marginBottom: 16, gap: 8 },
  reportTitle: { color: "white", fontSize: 22, fontWeight: "700" },
  badgeRow: { flexDirection: "row", gap: 6 },
  reportBody: { color: "white", fontSize: 14, lineHeight: 22 },

  reportPlaceholder: {
    flex: 1, backgroundColor: "#0e2c3d", borderRadius: 12,
    alignItems: "center", justifyContent: "center", padding: 32,
    borderWidth: 1, borderColor: "#1d3848", borderStyle: "dashed",
  },
  placeholderText: { color: "white", fontSize: 16, marginBottom: 8, textAlign: "center" },
  placeholderHint: { color: "#7d99ad", fontSize: 13, textAlign: "center", maxWidth: 480, lineHeight: 20 },

  mockBadge: { color: "#ffcc00", fontWeight: "700", fontSize: 10, backgroundColor: "#3a2a00", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  realDataBadge: { color: "#2ecc71", fontWeight: "700", fontSize: 10, backgroundColor: "#0e2a17", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
});
