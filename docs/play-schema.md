# Play Schema

> **Status:** Stub. The final schema (enum members, named locations, screen types, etc.) depends on the coach vocabulary glossary in `docs/vocabulary.md`. This file sketches the shape; final field names and enum values come from the glossary.

## Goals

- Deterministic input for the court renderer.
- Captures any ATO a real coach could describe.
- Round-trips: a coach reading the JSON should recognize their play; the renderer drawing the JSON should produce something the coach would recognize.
- Validates: Claude emits this with structured-output JSON-schema enforcement, so malformed plays never reach the renderer.

## Shape (provisional v0.1)

```ts
type PlaySchema = {
  schemaVersion: "0.1";
  meta: {
    name?: string;                                 // e.g. "Horns Flare" — verbal label if the coach gave one
    situation: "ATO" | "BLOB" | "SLOB" | "EOG" | "halfCourtSet";
    timeRemaining?: string;                        // e.g. "4.2s"
  };
  players: Player[];                               // exactly 5 offensive; defenders optional in v1
  initialFormation: NamedFormation | "custom";     // e.g. "horns", "box", "1-4-high"
  actions: Action[];                               // ordered, with tick timing
};

type PlayerId = "P1" | "P2" | "P3" | "P4" | "P5";

type Player = {
  id: PlayerId;
  role: "PG" | "SG" | "SF" | "PF" | "C";
  startPosition: CourtLocation;
  isInbounder?: boolean;                           // for BLOB / SLOB sets
};

type CourtLocation =
  | NamedLocation                                  // preferred — see vocabulary.md
  | { x: number; y: number };                      // fallback for custom spots

// NamedLocation, NamedFormation, ScreenType, CutType, HandoffType
// are all derived from docs/vocabulary.md and will be enumerated there.

type Action =
  | { t: "move";    actor: PlayerId; to: CourtLocation; tick: number }
  | { t: "screen";  screener: PlayerId; screenee: PlayerId; screenType: ScreenType; location: CourtLocation; tick: number }
  | { t: "cut";     actor: PlayerId; cutType: CutType; from: CourtLocation; to: CourtLocation; tick: number }
  | { t: "pass";    from: PlayerId; to: PlayerId; tick: number }
  | { t: "dribble"; actor: PlayerId; to: CourtLocation; tick: number }
  | { t: "handoff"; from: PlayerId; to: PlayerId; handoffType: HandoffType; location: CourtLocation; tick: number }
  | { t: "shot";    actor: PlayerId; from: CourtLocation; tick: number };
```

## Design principles

1. **Abstract player IDs.** `P1..P5` map to positional roles, not jersey numbers. Coaches design ATOs against roles; the rendering layer can paint jersey numbers later if we have a lineup.
2. **Named locations beat coordinates.** "left wing" round-trips with coach language; raw `{x: 0.34, y: 0.71}` doesn't. Coordinates exist as a fallback.
3. **Tick is ordering, not seconds.** Two actions with the same `tick` are simultaneous. The renderer maps ticks to real time during playback.
4. **Defenders are optional.** v1 may render offense only; defensive players model is a v2 concern.
5. **Enums live in `docs/vocabulary.md`.** When a new term is added there, the schema grows automatically.

## Open questions (resolve after vocabulary research lands)

- **Reads / options.** ATOs often have a primary action plus a counter ("if they switch, slip to the rim; if not, the shooter curls"). Do we model branches in the schema, or render only the primary read in v1?
- **Simultaneity granularity.** Same-tick actions handle "two screens at the same time" but not "screen happens slightly after the cut starts." Is per-action `tick` (integer) enough, or do we need `startTick` / `endTick`?
- **Ball tracking.** Is ball position implicit (follows the last passer/dribbler) or an explicit field? Implicit is simpler but breaks for hand-off chains.
- **Trigger actions.** BLOB/SLOB plays have a designated trigger (e.g., "first cutter rubs off the screen"). Encode as `meta.trigger`, or just rely on `actions[0]`?
- **Tempo.** Do we need a `tempo` modifier per action ("quick", "late", "delayed") or is that purely a rendering / playback-speed concern?
- **Defensive coverages.** When we add the scouting layer, do we annotate actions with expected coverages ("PnR — expect drop coverage from #5") or keep that purely in the scouting panel?
