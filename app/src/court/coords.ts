/**
 * Court geometry helpers.
 *
 * Coordinate convention used by named-location lookups:
 *   (0, 0) = baseline corner near LEFT sideline (basket end)
 *   (1, 0) = baseline corner near RIGHT sideline
 *   (0, 1) = half-court line, LEFT sideline
 *   (1, 1) = half-court line, RIGHT sideline
 *
 * Real NBA half-court is 50 ft wide by 47 ft long. Distances below are roughly
 * scaled to those proportions but tuned by eye for plays-on-a-clipboard feel.
 */
import type { CourtLocation, Coord, NamedLocation } from "@/types/play";
import { isNamedLocation } from "@/types/play";

export type NormCoord = { nx: number; ny: number };  // 0..1 in court space

const NAMED: Record<NamedLocation, NormCoord> = {
  // Backcourt-side ring
  topOfKey:        { nx: 0.50, ny: 0.55 },
  leftSlot:        { nx: 0.36, ny: 0.55 },
  rightSlot:       { nx: 0.64, ny: 0.55 },
  leftWing:        { nx: 0.15, ny: 0.36 },
  rightWing:       { nx: 0.85, ny: 0.36 },
  leftCorner:      { nx: 0.07, ny: 0.08 },
  rightCorner:     { nx: 0.93, ny: 0.08 },

  // Mid / high post
  leftElbow:       { nx: 0.36, ny: 0.34 },
  rightElbow:      { nx: 0.64, ny: 0.34 },
  highPost:        { nx: 0.50, ny: 0.34 },
  nail:            { nx: 0.50, ny: 0.32 },
  ftLine:          { nx: 0.50, ny: 0.34 },

  // Interior / paint
  leftBlock:       { nx: 0.36, ny: 0.10 },
  rightBlock:      { nx: 0.64, ny: 0.10 },
  leftShortCorner: { nx: 0.20, ny: 0.08 },
  rightShortCorner:{ nx: 0.80, ny: 0.08 },
  dunkerLeft:      { nx: 0.30, ny: 0.06 },
  dunkerRight:     { nx: 0.70, ny: 0.06 },
  paint:           { nx: 0.50, ny: 0.15 },
  rim:             { nx: 0.50, ny: 0.06 },

  // Inbound spots
  baselineInbound: { nx: 0.65, ny: 0.00 },
  sidelineInbound: { nx: 0.00, ny: 0.50 },
  hashLeft:        { nx: 0.00, ny: 0.60 },
  hashRight:       { nx: 1.00, ny: 0.60 },
};

export function locationToNorm(loc: CourtLocation): NormCoord {
  if (isNamedLocation(loc)) {
    return NAMED[loc];
  }
  const c = loc as Coord;
  return { nx: c.x, ny: c.y };
}

/**
 * Convert a normalized court coord to canvas pixels.
 * The court is rendered with the BASKET AT TOP (small y in canvas = top of screen
 * = baseline / basket end). Half-court is at the bottom of the rendered area.
 */
export function normToCanvas(
  norm: NormCoord,
  canvasW: number,
  canvasH: number,
  padding: number = 24,
): { x: number; y: number } {
  const w = canvasW - 2 * padding;
  const h = canvasH - 2 * padding;
  // Flip y so ny=0 (baseline) is at the TOP of the canvas.
  return {
    x: padding + norm.nx * w,
    y: padding + (1 - norm.ny) * h,
  };
}

/** Court dimensions used for drawing lines. All values are in NORMALIZED 0..1 space. */
export const COURT = {
  // Three-point line
  arcRadius: 0.50, // approximate; tuned by eye in normalized space
  arcCenter: { nx: 0.50, ny: 0.06 }, // basket location
  cornerThreeY: 0.30, // where the corner 3 transitions to the arc (vertical)
  cornerThreeX_left: 0.04,
  cornerThreeX_right: 0.96,

  // Lane (paint)
  laneLeft: 0.36,
  laneRight: 0.64,
  laneTop: 0.34, // FT line — far end of paint
  laneBottom: 0.00, // baseline

  // Half-court arc
  halfCourtCenter: { nx: 0.50, ny: 1.0 },
  halfCourtRadius: 0.12,
};
