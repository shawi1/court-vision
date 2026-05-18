/**
 * Tiny playback bar — Prev / Play-pause / Next + a tick readout.
 * Discrete-tick stepping; auto-play advances at ~700ms per tick (interpolated
 * inside the renderer so movement looks smooth).
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  maxTick: number;
  /** Float, 0..maxTick+0.0 */
  currentTime: number;
  onChange: (t: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
}

const STEP = 1;

export function PlaybackBar({ maxTick, currentTime, onChange, playing, onTogglePlay }: Props) {
  const stepBack = () => onChange(Math.max(0, Math.floor(currentTime - STEP) ));
  const stepFwd = () => onChange(Math.min(maxTick, Math.floor(currentTime + STEP)));
  return (
    <View style={styles.row}>
      <Pressable style={styles.btn} onPress={stepBack}><Text style={styles.btnText}>◀</Text></Pressable>
      <Pressable style={[styles.btn, styles.play]} onPress={onTogglePlay}>
        <Text style={styles.btnText}>{playing ? "❚❚" : "▶"}</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={stepFwd}><Text style={styles.btnText}>▶</Text></Pressable>
      <View style={styles.track}>
        {Array.from({ length: maxTick + 1 }).map((_, i) => (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={[styles.dot, currentTime >= i && styles.dotOn]}
          />
        ))}
      </View>
      <Text style={styles.tick}>tick {Math.min(maxTick, Math.floor(currentTime))} / {maxTick}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  btn: {
    backgroundColor: "#1d3848",
    borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    minWidth: 38, alignItems: "center", justifyContent: "center",
  },
  play: { backgroundColor: "#ff6f3c" },
  btnText: { color: "white", fontWeight: "700" },
  track: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1d3848" },
  dotOn: { backgroundColor: "#ff6f3c" },
  tick: { color: "#9bb6c6", fontSize: 12, marginLeft: 8 },
});
