/**
 * Court Vision play designer screen.
 *
 * Layout (landscape):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Transcript /     │   Court canvas    │ Counters / reads  │
 *   │ Parse / demos    │   + playback bar  │                   │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Scouting lives in its own screen — see ScoutingScreen.
 */
import React from "react";
import { flushSync } from "react-dom";
import {
  ActivityIndicator, Pressable, StyleSheet, Text,
  TextInput, View, useWindowDimensions,
} from "react-native";

import { CountersList } from "@/components/CountersList";
import { PlaybackBar } from "@/components/PlaybackBar";
import { PlayRenderer } from "@/court/PlayRenderer";
import { maxTick as maxTickOf } from "@/court/playback";
import { parsePlay, transcribeAudio } from "@/api/client";
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

const MS_PER_TICK = 700;

interface Props {
  /** Pixel height of the title bar rendered above this screen. */
  headerH: number;
}

export function HomeScreen({ headerH }: Props) {
  const { width, height } = useWindowDimensions();

  const [transcript, setTranscript] = React.useState(DEMO_TRANSCRIPTS[0].text);
  const [play, setPlay] = React.useState<PlaySchema | null>(null);
  const [parseLoading, setParseLoading] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const [currentTime, setCurrentTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  const recorder = useRecorder();
  const [transcribing, setTranscribing] = React.useState(false);

  // Auto-advance playback. Actions animate over [tick, tick+1], so we run the
  // clock to maxTick + 1 to let the last action finish. RAF + flushSync are
  // both required: async setState during RAF without flushSync lands one frame
  // late and the Skia canvas appears frozen even though state advances.
  React.useEffect(() => {
    if (!playing || !play) return;
    const endT = maxTickOf(play) + 1;
    let rafId = 0;
    let lastFrameMs: number | null = null;
    const tick = (nowMs: number) => {
      if (lastFrameMs === null) lastFrameMs = nowMs;
      const dt = nowMs - lastFrameMs;
      lastFrameMs = nowMs;
      let done = false;
      flushSync(() => {
        setCurrentTime((t) => {
          const next = t + dt / MS_PER_TICK;
          if (next >= endT) {
            done = true;
            return endT;
          }
          return next;
        });
      });
      if (done) {
        setPlaying(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
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

  // Layout
  const leftPanelW = Math.max(280, Math.min(360, width * 0.22));
  const rightPanelW = Math.max(240, Math.min(300, width * 0.18));
  const courtAvailW = width - leftPanelW - rightPanelW;
  const courtAvailH = height - headerH - 80;
  const aspect = 50 / 47;
  let canvasW = courtAvailW - 24;
  let canvasH = courtAvailH - 24;
  if (canvasW / canvasH > aspect) canvasW = canvasH * aspect;
  else canvasH = canvasW / aspect;

  const playMaxTick = play ? maxTickOf(play) : 0;

  return (
    <View style={styles.body}>
      {/* Left: controls */}
      <View style={[styles.panel, { width: leftPanelW }]}>
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
                if (currentTime >= playMaxTick) setCurrentTime(0);
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

      {/* Right: counters / reads */}
      <View style={[styles.panel, styles.panelRight, { width: rightPanelW }]}>
        <Text style={styles.panelTitle}>Counters / reads</Text>
        {play ? <CountersList counters={play.counters} /> : <Text style={styles.dim}>Parse a play first.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: "row" },
  panel: {
    padding: 14,
    borderRightWidth: 1, borderRightColor: "#1d3848",
    backgroundColor: "#102634",
  },
  panelRight: { borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: "#1d3848" },
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
});
