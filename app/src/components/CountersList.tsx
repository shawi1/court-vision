/**
 * Renders the play's counters (alternative reads) as a compact list of trigger lines
 * with action counts. Clicking a counter expands it to show the action sequence.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Counter } from "@/types/play";

interface Props {
  counters?: Counter[];
}

export function CountersList({ counters }: Props) {
  const list = counters ?? [];
  const [expanded, setExpanded] = React.useState<number | null>(null);
  if (list.length === 0) {
    return <Text style={styles.empty}>No counters captured.</Text>;
  }
  return (
    <View>
      {list.map((c, i) => (
        <View key={i} style={styles.row}>
          <Pressable onPress={() => setExpanded(expanded === i ? null : i)}>
            <Text style={styles.trigger}>
              {expanded === i ? "▼" : "▶"} {c.trigger}
            </Text>
          </Pressable>
          {expanded === i && (
            <View style={styles.actions}>
              {c.actions.map((a, j) => (
                <Text key={j} style={styles.action}>
                  · tick {a.tick}: {describeAction(a)}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function describeAction(a: any): string {
  switch (a.t) {
    case "move":    return `${a.actor} → ${a.to}`;
    case "dribble": return `${a.actor} dribbles → ${a.to}`;
    case "cut":     return `${a.actor} ${a.cutType} ${a.from} → ${a.to}`;
    case "screen":  return `${a.screener} ${a.screenType} for ${a.screenee} @ ${a.location}`;
    case "pass":    return `${a.from} → ${a.to}`;
    case "handoff": return `${a.from} → ${a.to} (${a.handoffType}) @ ${a.location}`;
    case "shot":    return `${a.actor} shot from ${a.from}`;
    default:        return JSON.stringify(a);
  }
}

const styles = StyleSheet.create({
  row: { paddingVertical: 4 },
  trigger: { color: "#ffcc00", fontWeight: "600", fontSize: 12 },
  actions: { marginLeft: 14, marginTop: 4 },
  action: { color: "#cbd6dd", fontSize: 11, paddingVertical: 1 },
  empty: { color: "#7d99ad", fontSize: 12, fontStyle: "italic" },
});
