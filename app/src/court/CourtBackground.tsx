/**
 * Static half-court markings: baseline, sidelines, FT lane, FT circle, 3-pt arc,
 * half-court line. Skia-based, cross-platform.
 *
 * Drawn in canvas-pixel space using helpers in coords.ts.
 */
import React from "react";
import { Group, Path, Skia, Rect, Circle, Line, vec } from "@shopify/react-native-skia";

import { COURT, normToCanvas } from "@/court/coords";

const LINE_COLOR = "#1a3a4a";
const LINE_WIDTH = 2;
const FLOOR_COLOR = "#f5e2b8"; // hardwood

interface Props {
  width: number;
  height: number;
  padding?: number;
}

export function CourtBackground({ width, height, padding = 24 }: Props) {
  const N = (nx: number, ny: number) => normToCanvas({ nx, ny }, width, height, padding);

  // Three-point arc as a Skia Path.
  // Sweep from (cornerThreeX_left, cornerThreeY) up over the top of the key to (cornerThreeX_right, cornerThreeY).
  const arcPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const start = N(COURT.cornerThreeX_left, COURT.cornerThreeY);
    const top = N(0.5, COURT.arcCenter.ny + COURT.arcRadius);
    const end = N(COURT.cornerThreeX_right, COURT.cornerThreeY);
    p.moveTo(start.x, start.y);
    p.quadTo(top.x, top.y, end.x, end.y);
    return p;
  }, [width, height, padding]);

  // Half-court arc (semicircle at the bottom of our drawn region)
  const halfCourtArc = React.useMemo(() => {
    const p = Skia.Path.Make();
    const cx = N(0.5, 1.0).x;
    const cy = N(0.5, 1.0).y;
    const r = ((width - padding * 2) * COURT.halfCourtRadius);
    p.addArc({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, 180, 180);
    return p;
  }, [width, height, padding]);

  // FT circle (centered on FT line)
  const ftCircleCenter = N(0.5, COURT.laneTop);
  const ftCircleRadius = (width - padding * 2) * 0.06;

  // Lane rect
  const laneTL = N(COURT.laneLeft, COURT.laneTop);
  const laneBR = N(COURT.laneRight, COURT.laneBottom);

  // Baseline / sidelines / half-court border
  const tl = N(0, 0);     // top-left = baseline corner left
  const tr = N(1, 0);     // top-right = baseline corner right
  const bl = N(0, 1);     // bottom-left = half-court line left
  const br = N(1, 1);     // bottom-right = half-court line right

  // Rim circle
  const rim = N(0.5, COURT.arcCenter.ny);
  const rimRadius = (width - padding * 2) * 0.018;

  return (
    <Group>
      {/* Floor */}
      <Rect x={tl.x} y={tl.y} width={tr.x - tl.x} height={bl.y - tl.y} color={FLOOR_COLOR} />

      {/* Outer border (baseline, sidelines, half-court line) */}
      <Line p1={vec(tl.x, tl.y)} p2={vec(tr.x, tr.y)} color={LINE_COLOR} strokeWidth={LINE_WIDTH} />
      <Line p1={vec(tr.x, tr.y)} p2={vec(br.x, br.y)} color={LINE_COLOR} strokeWidth={LINE_WIDTH} />
      <Line p1={vec(br.x, br.y)} p2={vec(bl.x, bl.y)} color={LINE_COLOR} strokeWidth={LINE_WIDTH} />
      <Line p1={vec(bl.x, bl.y)} p2={vec(tl.x, tl.y)} color={LINE_COLOR} strokeWidth={LINE_WIDTH} />

      {/* Lane / paint */}
      <Rect
        x={laneTL.x}
        y={laneTL.y}
        width={laneBR.x - laneTL.x}
        height={laneBR.y - laneTL.y}
        color={"transparent"}
        style="stroke"
        strokeWidth={LINE_WIDTH}
      />
      {/* Lane fill (slight tint) */}
      <Rect
        x={laneTL.x}
        y={laneTL.y}
        width={laneBR.x - laneTL.x}
        height={laneBR.y - laneTL.y}
        color={"#eed29a"}
      />

      {/* Lane border re-drawn on top of fill */}
      <Path path={(() => {
        const p = Skia.Path.Make();
        p.moveTo(laneTL.x, laneTL.y);
        p.lineTo(laneBR.x, laneTL.y);
        p.lineTo(laneBR.x, laneBR.y);
        p.lineTo(laneTL.x, laneBR.y);
        p.close();
        return p;
      })()} color={LINE_COLOR} style="stroke" strokeWidth={LINE_WIDTH} />

      {/* FT circle */}
      <Circle cx={ftCircleCenter.x} cy={ftCircleCenter.y} r={ftCircleRadius} color={LINE_COLOR} style="stroke" strokeWidth={LINE_WIDTH} />

      {/* 3-pt arc */}
      <Path path={arcPath} color={LINE_COLOR} style="stroke" strokeWidth={LINE_WIDTH} />

      {/* Corner three vertical segments */}
      <Line
        p1={vec(N(COURT.cornerThreeX_left, 0).x, N(COURT.cornerThreeX_left, 0).y)}
        p2={vec(N(COURT.cornerThreeX_left, COURT.cornerThreeY).x, N(COURT.cornerThreeX_left, COURT.cornerThreeY).y)}
        color={LINE_COLOR}
        strokeWidth={LINE_WIDTH}
      />
      <Line
        p1={vec(N(COURT.cornerThreeX_right, 0).x, N(COURT.cornerThreeX_right, 0).y)}
        p2={vec(N(COURT.cornerThreeX_right, COURT.cornerThreeY).x, N(COURT.cornerThreeX_right, COURT.cornerThreeY).y)}
        color={LINE_COLOR}
        strokeWidth={LINE_WIDTH}
      />

      {/* Half-court arc (decorative for the half-court line) */}
      <Path path={halfCourtArc} color={LINE_COLOR} style="stroke" strokeWidth={LINE_WIDTH} />

      {/* Rim */}
      <Circle cx={rim.x} cy={rim.y} r={rimRadius} color={"#c0392b"} style="stroke" strokeWidth={LINE_WIDTH + 1} />
    </Group>
  );
}
