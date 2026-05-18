import React from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { HomeScreen } from "@/screens/HomeScreen";
import { ScoutingScreen } from "@/screens/ScoutingScreen";
import { apiBaseUrl, health, type HealthResponse } from "@/api/client";

type Screen = "designer" | "scouting";

const TITLE_BAR_H = 56;

export default function App() {
  const [screen, setScreen] = React.useState<Screen>("designer");
  const [healthInfo, setHealthInfo] = React.useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    health()
      .then(setHealthInfo)
      .catch((e) => setHealthError(e?.message ?? "Backend unreachable"));
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.titleBar, { height: TITLE_BAR_H }]}>
        <Text style={styles.title}>Court Vision</Text>
        <View style={styles.tabs}>
          <Tab label="Play Designer" active={screen === "designer"} onPress={() => setScreen("designer")} />
          <Tab label="Scouting" active={screen === "scouting"} onPress={() => setScreen("scouting")} />
        </View>
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

      {/* Keep both screens mounted so their internal state (parsed play,
          loaded roster, last scouting report) persists across tab switches.
          Just hide the inactive one. */}
      <View style={[styles.screen, { display: screen === "designer" ? "flex" : "none" }]}>
        <HomeScreen headerH={TITLE_BAR_H} />
      </View>
      <View style={[styles.screen, { display: screen === "scouting" ? "flex" : "none" }]}>
        <ScoutingScreen />
      </View>
    </SafeAreaView>
  );
}

interface TabProps { label: string; active: boolean; onPress: () => void; }
function Tab({ label, active, onPress }: TabProps) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
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
  tabs: { flexDirection: "row", gap: 4 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
  },
  tabActive: { backgroundColor: "#1d3848" },
  tabText: { color: "#7d99ad", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "white" },
  statusRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  statusGood: { color: "#2ecc71", fontWeight: "700" },
  statusWarn: { color: "#ffcc00", fontWeight: "700" },
  statusBad: { color: "#e74c3c", fontWeight: "700" },
  statusDim: { color: "#7d99ad", fontSize: 12 },
  screen: { flex: 1 },
});
