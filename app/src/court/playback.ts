/**
 * Playback math: compute a player's position at any (possibly fractional) tick by
 * interpolating between the anchor positions implied by the play's actions.
 *
 * Timing model: an action with `tick: N` BEGINS at t=N and the player reaches its
 * destination at t=N+1. Between actions the player holds. This matches a coach's
 * mental model: clicking tick 0 shows the starting formation; tick 1 shows the
 * state after the first action completes; etc.
 *
 * Actions that REPOSITION a player:
 *   - move, dribble: actor goes to `to`
 *   - cut: actor goes to `to`
 *   - handoff: the giver (`from`) ends at `location`
 *
 * Passes, screens, shots do NOT directly reposition; the screener's start position
 * already says where they are when they screen.
 */
import type { Action, Player, PlayerId, PlaySchema } from "@/types/play";
import { locationToNorm, type NormCoord } from "@/court/coords";

interface Anchor {
  tick: number;
  pos: NormCoord;
}

const POSITION_BY_ANCHOR_TICK_CACHE = new WeakMap<PlaySchema, Map<PlayerId, Anchor[]>>();

function anchorsForPlayer(play: PlaySchema, pid: PlayerId): Anchor[] {
  let cache = POSITION_BY_ANCHOR_TICK_CACHE.get(play);
  if (!cache) {
    cache = new Map();
    POSITION_BY_ANCHOR_TICK_CACHE.set(play, cache);
  }
  const hit = cache.get(pid);
  if (hit) return hit;

  const player = play.players.find((p) => p.id === pid)!;
  let pos = locationToNorm(player.startPosition);
  const anchors: Anchor[] = [{ tick: 0, pos }];
  const sorted = [...play.actions].sort((a, b) => a.tick - b.tick);
  for (const a of sorted) {
    const dest = positionChangeFor(a, pid);
    if (!dest) continue;
    // Hold at current position until the action begins, then animate to dest
    // over the interval [tick, tick+1].
    anchors.push({ tick: a.tick, pos });
    anchors.push({ tick: a.tick + 1, pos: dest });
    pos = dest;
  }
  cache.set(pid, anchors);
  return anchors;
}

function positionChangeFor(a: Action, pid: PlayerId): NormCoord | null {
  switch (a.t) {
    case "move":
    case "dribble":
      return a.actor === pid ? locationToNorm(a.to) : null;
    case "cut":
      return a.actor === pid ? locationToNorm(a.to) : null;
    case "handoff":
      return a.from === pid ? locationToNorm(a.location) : null;
    default:
      return null;
  }
}

function lerp(a: NormCoord, b: NormCoord, u: number): NormCoord {
  return {
    nx: a.nx + (b.nx - a.nx) * u,
    ny: a.ny + (b.ny - a.ny) * u,
  };
}

export function maxTick(play: PlaySchema): number {
  return play.actions.reduce((m, a) => Math.max(m, a.tick), 0);
}

export function playerPosAtTime(play: PlaySchema, pid: PlayerId, t: number): NormCoord {
  const anchors = anchorsForPlayer(play, pid);
  if (anchors.length === 0) return { nx: 0.5, ny: 0.5 };
  if (t <= anchors[0].tick) return anchors[0].pos;
  if (t >= anchors[anchors.length - 1].tick) return anchors[anchors.length - 1].pos;
  for (let i = 0; i < anchors.length - 1; i++) {
    const cur = anchors[i];
    const next = anchors[i + 1];
    if (t >= cur.tick && t <= next.tick) {
      const span = next.tick - cur.tick || 1;
      const u = Math.max(0, Math.min(1, (t - cur.tick) / span));
      return lerp(cur.pos, next.pos, u);
    }
  }
  return anchors[anchors.length - 1].pos;
}

export interface ActionVisibility {
  visible: boolean;
  highlighted: boolean;  // currently happening at time t
  opacity: number;
}

/**
 * Return per-action visibility at time `t`. An action is visible once t >= action.tick.
 * Within a small window after t becomes >= tick, it's "highlighted" with a brief
 * fade-in.
 */
export function actionVisibilityAtTime(a: Action, t: number): ActionVisibility {
  if (t < a.tick) return { visible: false, highlighted: false, opacity: 0 };
  const fadeWindow = 1.0;
  const since = t - a.tick;
  if (since <= fadeWindow) {
    return {
      visible: true,
      highlighted: true,
      opacity: 0.55 + 0.45 * (since / fadeWindow),
    };
  }
  return { visible: true, highlighted: false, opacity: 0.7 };
}
