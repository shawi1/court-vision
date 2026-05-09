/**
 * Court Vision play schema (TypeScript).
 *
 * Mirrors backend/app/schemas.py. Keep these in sync. When the vocabulary glossary
 * lands, both sides regenerate their enums from docs/vocabulary.md.
 */

export type PlayerId = "P1" | "P2" | "P3" | "P4" | "P5";

export type Role = "PG" | "SG" | "SF" | "PF" | "C";

export type Situation = "ATO" | "BLOB" | "SLOB" | "EOG" | "halfCourtSet";

export type NamedLocation =
  | "topOfKey" | "leftSlot" | "rightSlot"
  | "leftWing" | "rightWing"
  | "leftCorner" | "rightCorner"
  | "leftElbow" | "rightElbow"
  | "highPost" | "nail" | "ftLine"
  | "leftBlock" | "rightBlock"
  | "leftShortCorner" | "rightShortCorner"
  | "dunkerLeft" | "dunkerRight"
  | "paint" | "rim"
  | "baselineInbound" | "sidelineInbound"
  | "hashLeft" | "hashRight";

export type NamedFormation =
  | "box" | "stack" | "1-4-high" | "1-4-low" | "horns"
  | "floppy" | "pistol" | "diamond" | "spread" | "custom";

export type ScreenType =
  | "ballScreen" | "downScreen" | "pinDown" | "flare"
  | "backScreen" | "crossScreen" | "stagger" | "elevator"
  | "hammer" | "ghost" | "slip" | "spain" | "wedge"
  | "ram" | "stepUp" | "drag" | "reScreen";

export type CutType =
  | "backdoor" | "curl" | "fade" | "flare" | "ucla"
  | "vCut" | "lCut" | "iverson" | "basket" | "giveAndGo"
  | "shuffle" | "flex" | "baseline" | "replace" | "banana";

export type HandoffType = "DHO" | "stationary" | "pitch";

export type Coord = { x: number; y: number };
export type CourtLocation = NamedLocation | Coord;

export interface Player {
  id: PlayerId;
  role: Role;
  startPosition: CourtLocation;
  isInbounder?: boolean;
}

export type TriggerType =
  | "slap"
  | "verbalGo"
  | "verbalSet"
  | "automatic"
  | "deny"
  | "screen";

export interface Trigger {
  type: TriggerType;
  actor?: PlayerId | null;
  description?: string | null;
}

export interface Meta {
  name?: string | null;
  situation: Situation;
  timeRemaining?: string | null;
  trigger?: Trigger | null;
}

export interface Counter {
  trigger: string;
  actions: Action[];
}

export type Action =
  | { t: "move"; actor: PlayerId; to: CourtLocation; tick: number }
  | { t: "screen"; screener: PlayerId; screenee: PlayerId; screenType: ScreenType; location: CourtLocation; tick: number }
  | { t: "cut"; actor: PlayerId; cutType: CutType; from: CourtLocation; to: CourtLocation; tick: number }
  | { t: "pass"; from: PlayerId; to: PlayerId; tick: number }
  | { t: "dribble"; actor: PlayerId; to: CourtLocation; tick: number }
  | { t: "handoff"; from: PlayerId; to: PlayerId; handoffType: HandoffType; location: CourtLocation; tick: number }
  | { t: "shot"; actor: PlayerId; from: CourtLocation; tick: number };

export interface PlaySchema {
  schemaVersion: "0.2";
  meta: Meta;
  players: Player[];
  initialFormation: NamedFormation | "custom";
  actions: Action[];
  counters?: Counter[];
}

export function isNamedLocation(loc: CourtLocation): loc is NamedLocation {
  return typeof loc === "string";
}
