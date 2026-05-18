/**
 * Tick-aware play renderer.
 *
 * Props:
 *   play          — PlaySchema
 *   width, height — canvas pixels
 *   currentTime   — float, current playback time in ticks
 *                   (use null/undefined to show everything at once)
 *
 * Player tokens are positioned via `playerPosAtTime` (interpolated between the
 * anchor positions implied by the play's actions). Action overlays appear as
 * their tick is reached.
 */
import React from "react";
import {
  Canvas, Circle, Group, Path, Skia, Text as SkiaText, matchFont, Line, vec,
} from "@shopify/react-native-skia";
import { Platform } from "react-native";

import { CourtBackground } from "@/court/CourtBackground";
import { locationToNorm, normToCanvas } from "@/court/coords";
import {
  actionVisibilityAtTime, playerPosAtTime,
} from "@/court/playback";
import type { Action, PlaySchema, PlayerId } from "@/types/play";

const PLAYER_RADIUS_FRAC = 0.034;
const PLAYER_COLOR = "#1f5d8c";
const PLAYER_INBOUNDER_COLOR = "#e67e22";
const SCREEN_COLOR = "#ff6f3c";
const CUT_COLOR = "#2ecc71";
const PASS_COLOR = "#ffcc00";
const SHOT_COLOR = "#c0392b";
const MOVE_COLOR = "#7f8c8d";
const DRIBBLE_COLOR = "#9b59b6";

const FONT_STYLE = {
  fontFamily: Platform.select({ ios: "Helvetica", android: "sans-serif", default: "sans-serif" }),
  fontSize: 14,
  fontStyle: "normal" as const,
  fontWeight: "bold" as const,
};

/**
 * Resolve a Skia font at render time, NOT module-load time.
 * On web, CanvasKit WASM is loaded async (see `index.ts` LoadSkiaWeb); calling
 * `Skia.FontMgr.System()` at module top-level explodes before WASM is ready.
 */
function useSystemFont() {
  return React.useMemo(() => {
    try {
      const mgr = Skia.FontMgr.System();
      return matchFont(FONT_STYLE, mgr) ?? null;
    } catch {
      return null;
    }
  }, []);
}

interface Props {
  play: PlaySchema;
  width: number;
  height: number;
  /** Float tick; null shows everything (static view). */
  currentTime?: number | null;
  padding?: number;
}

export function PlayRenderer({
  play, width, height, currentTime = null, padding = 24,
}: Props) {
  const radius = (width - padding * 2) * PLAYER_RADIUS_FRAC;
  const font = useSystemFont();

  // Effective time: use a value past the last tick if currentTime is null (= show all)
  const lastTick = play.actions.reduce((m, a) => Math.max(m, a.tick), 0);
  const t = currentTime ?? lastTick + 99;

  return (
    <Canvas style={{ width, height }}>
      <CourtBackground width={width} height={height} padding={padding} />

      {play.actions.map((a, i) => {
        const vis = actionVisibilityAtTime(a, t);
        if (!vis.visible) return null;
        return (
          <ActionOverlay
            key={i}
            action={a}
            play={play}
            t={t}
            width={width}
            height={height}
            padding={padding}
            opacity={vis.opacity}
          />
        );
      })}

      {play.players.map((p) => {
        const norm = playerPosAtTime(play, p.id, t);
        const { x, y } = normToCanvas(norm, width, height, padding);
        const text = p.role;
        const label = font ? font.measureText(text) : { width: 18, height: 14 };
        return (
          <Group key={p.id}>
            <Circle cx={x} cy={y} r={radius} color={p.isInbounder ? PLAYER_INBOUNDER_COLOR : PLAYER_COLOR} />
            <Circle cx={x} cy={y} r={radius} color={"#0a1f2b"} style="stroke" strokeWidth={2} />
            {font && (
              <SkiaText
                x={x - label.width / 2}
                y={y + label.height / 3}
                text={text}
                font={font}
                color={"white"}
              />
            )}
          </Group>
        );
      })}
    </Canvas>
  );
}

interface OverlayProps {
  action: Action;
  play: PlaySchema;
  t: number;
  width: number;
  height: number;
  padding: number;
  opacity: number;
}

function ActionOverlay({ action: a, play, t, width, height, padding, opacity }: OverlayProps) {
  const playerPos = (pid: PlayerId) => {
    const norm = playerPosAtTime(play, pid, t);
    return normToCanvas(norm, width, height, padding);
  };
  const loc = (l: any) => normToCanvas(locationToNorm(l), width, height, padding);
  const alpha = (hex: string) => withAlpha(hex, opacity);

  switch (a.t) {
    case "screen": {
      const at = loc(a.location);
      return (
        <Group>
          <Line p1={vec(at.x - 12, at.y)} p2={vec(at.x + 12, at.y)} color={alpha(SCREEN_COLOR)} strokeWidth={3} />
          <Line p1={vec(at.x, at.y)} p2={vec(at.x, at.y - 14)} color={alpha(SCREEN_COLOR)} strokeWidth={3} />
        </Group>
      );
    }
    case "cut": {
      const from = loc(a.from);
      const to = loc(a.to);
      return (
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.moveTo(from.x, from.y);
            const ctrlX = (from.x + to.x) / 2 + (to.y - from.y) * 0.15;
            const ctrlY = (from.y + to.y) / 2 - (to.x - from.x) * 0.15;
            p.quadTo(ctrlX, ctrlY, to.x, to.y);
            return p;
          })()}
          color={alpha(CUT_COLOR)}
          style="stroke"
          strokeWidth={2}
        />
      );
    }
    case "move":
    case "dribble": {
      const from = playerPos(a.actor);
      const to = loc(a.to);
      const color = a.t === "dribble" ? DRIBBLE_COLOR : MOVE_COLOR;
      return <Line p1={vec(from.x, from.y)} p2={vec(to.x, to.y)} color={alpha(color)} strokeWidth={2} />;
    }
    case "pass": {
      const from = playerPos(a.from);
      const to = playerPos(a.to);
      return <Line p1={vec(from.x, from.y)} p2={vec(to.x, to.y)} color={alpha(PASS_COLOR)} strokeWidth={2.5} />;
    }
    case "handoff": {
      const at = loc(a.location);
      return <Circle cx={at.x} cy={at.y} r={10} color={alpha(PASS_COLOR)} style="stroke" strokeWidth={2.5} />;
    }
    case "shot": {
      const from = loc(a.from);
      const rim = normToCanvas({ nx: 0.5, ny: 0.06 }, width, height, padding);
      return (
        <Group>
          <Line p1={vec(from.x, from.y)} p2={vec(rim.x, rim.y)} color={alpha(SHOT_COLOR)} strokeWidth={3} />
          <Circle cx={rim.x} cy={rim.y} r={6} color={alpha(SHOT_COLOR)} />
        </Group>
      );
    }
    default:
      return null;
  }
}

/** Append an alpha (0..1) component to a #RRGGBB color. */
function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return hex + a.toString(16).padStart(2, "0");
}
