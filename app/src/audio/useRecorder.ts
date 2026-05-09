/**
 * Cross-platform audio recorder hook.
 *
 * Native (iOS / Android): uses `expo-av`'s Audio.Recording API.
 * Web: falls back to MediaRecorder + getUserMedia (since `expo-av` recording on web
 * is flaky in some browsers).
 *
 * Returns { state, start, stop } where stop() resolves to the recorded source
 * suitable for `transcribeAudio()` in the API client.
 */
import React from "react";
import { Platform } from "react-native";

export type RecorderState = "idle" | "recording" | "processing";

export type RecordedSource =
  | { kind: "blob"; blob: Blob }
  | { kind: "uri"; uri: string; type: string; name: string };

interface Recorder {
  state: RecorderState;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<RecordedSource | null>;
}

export function useRecorder(): Recorder {
  const [state, setState] = React.useState<RecorderState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const nativeRecRef = React.useRef<any>(null);
  const mediaRecRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);

  const start = React.useCallback(async () => {
    setError(null);
    try {
      if (Platform.OS === "web") {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("MediaRecorder is not available in this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mediaRecRef.current = mr;
        mr.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.start();
        setState("recording");
      } else {
        const { Audio } = await import("expo-av");
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) throw new Error("Microphone permission denied");
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        nativeRecRef.current = rec;
        setState("recording");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to start recording");
      setState("idle");
    }
  }, []);

  const stop = React.useCallback(async (): Promise<RecordedSource | null> => {
    setState("processing");
    try {
      if (Platform.OS === "web") {
        const mr = mediaRecRef.current;
        if (!mr) { setState("idle"); return null; }
        const promise = new Promise<Blob>((resolve) => {
          mr.onstop = () => resolve(new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" }));
        });
        mr.stop();
        const blob = await promise;
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        mediaRecRef.current = null;
        setState("idle");
        return { kind: "blob", blob };
      } else {
        const rec = nativeRecRef.current;
        if (!rec) { setState("idle"); return null; }
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        nativeRecRef.current = null;
        const { Audio } = await import("expo-av");
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        setState("idle");
        if (!uri) return null;
        return { kind: "uri", uri, type: "audio/m4a", name: "audio.m4a" };
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to stop recording");
      setState("idle");
      return null;
    }
  }, []);

  return { state, error, start, stop };
}
