"""
Pydantic models for the Court Vision play schema.

These models are the source of truth for the JSON shape Claude emits via structured
output, and for what the renderer consumes. Keep field names short — they show up in
every LLM completion and we pay tokens for them.

Enum values listed here are the v0.1 baseline. Once docs/vocabulary.md is finalized,
these enums will be expanded from it (see `scripts/regen_enums.py`, planned).
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Situation(str, Enum):
    ATO = "ATO"
    BLOB = "BLOB"
    SLOB = "SLOB"
    EOG = "EOG"  # end-of-game
    HALF_COURT = "halfCourtSet"


class Role(str, Enum):
    PG = "PG"
    SG = "SG"
    SF = "SF"
    PF = "PF"
    C = "C"


class NamedLocation(str, Enum):
    """Named court locations. Coach-facing terminology.

    To be expanded from docs/vocabulary.md. These are the v0.1 baseline.
    """
    # Perimeter
    TOP_OF_KEY = "topOfKey"
    LEFT_SLOT = "leftSlot"
    RIGHT_SLOT = "rightSlot"
    LEFT_WING = "leftWing"
    RIGHT_WING = "rightWing"
    LEFT_CORNER = "leftCorner"
    RIGHT_CORNER = "rightCorner"
    # Mid / high post
    LEFT_ELBOW = "leftElbow"
    RIGHT_ELBOW = "rightElbow"
    HIGH_POST = "highPost"
    NAIL = "nail"
    FT_LINE = "ftLine"
    # Low / interior
    LEFT_BLOCK = "leftBlock"
    RIGHT_BLOCK = "rightBlock"
    LEFT_SHORT_CORNER = "leftShortCorner"
    RIGHT_SHORT_CORNER = "rightShortCorner"
    DUNKER_LEFT = "dunkerLeft"
    DUNKER_RIGHT = "dunkerRight"
    PAINT = "paint"
    RIM = "rim"
    # Inbound
    BASELINE_INBOUND = "baselineInbound"
    SIDELINE_INBOUND = "sidelineInbound"
    HASH_LEFT = "hashLeft"
    HASH_RIGHT = "hashRight"


class NamedFormation(str, Enum):
    """Initial player formations on the court."""
    BOX = "box"
    STACK = "stack"
    ONE_FOUR_HIGH = "1-4-high"
    ONE_FOUR_LOW = "1-4-low"
    HORNS = "horns"
    FLOPPY = "floppy"
    PISTOL = "pistol"
    DIAMOND = "diamond"
    SPREAD = "spread"
    CUSTOM = "custom"


class ScreenType(str, Enum):
    BALL = "ballScreen"          # on-ball PnR
    DOWN = "downScreen"          # for a perimeter player coming up
    PIN_DOWN = "pinDown"
    FLARE = "flare"
    BACK = "backScreen"
    CROSS = "crossScreen"
    STAGGER = "stagger"          # two screeners in sequence
    ELEVATOR = "elevator"        # two screeners side-by-side
    HAMMER = "hammer"            # weak-side back screen during PnR drive
    GHOST = "ghost"              # fake screen, slip immediately
    SLIP = "slip"                # screener cuts before setting
    SPAIN = "spain"              # PnR + back screen on screener's defender
    WEDGE = "wedge"              # back screen for the screener
    RAM = "ram"                  # screen for the screener before PnR
    STEP_UP = "stepUp"           # ball screen angled toward baseline
    DRAG = "drag"                # transition / on-the-move ball screen
    RE_SCREEN = "reScreen"


class CutType(str, Enum):
    BACKDOOR = "backdoor"
    CURL = "curl"
    FADE = "fade"
    FLARE = "flare"
    UCLA = "ucla"
    V_CUT = "vCut"
    L_CUT = "lCut"
    IVERSON = "iverson"
    BASKET = "basket"
    GIVE_AND_GO = "giveAndGo"
    SHUFFLE = "shuffle"
    FLEX = "flex"
    BASELINE = "baseline"
    REPLACE = "replace"
    BANANA = "banana"


class HandoffType(str, Enum):
    DHO = "DHO"              # dribble handoff
    STATIONARY = "stationary"
    PITCH = "pitch"          # short pitch / flip pass


PlayerId = Literal["P1", "P2", "P3", "P4", "P5"]


class Coord(BaseModel):
    """Fallback for custom positions. 0..1 normalized over a half-court."""
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)


CourtLocation = Union[NamedLocation, Coord]


class Player(BaseModel):
    id: PlayerId
    role: Role
    startPosition: CourtLocation
    isInbounder: bool = False


class TriggerType(str, Enum):
    """How the play starts. For BLOB/SLOB this is the inbounder's cue."""
    SLAP = "slap"                # inbounder slaps the ball
    VERBAL_GO = "verbalGo"       # verbal call like "go"
    VERBAL_SET = "verbalSet"     # named play call kicks it off
    AUTOMATIC = "automatic"      # action initiates with no explicit cue
    DENY = "deny"                # action keyed off a defensive denial
    SCREEN = "screen"            # action keyed off the first screen


class Trigger(BaseModel):
    """Captures the cue that initiates the play. Optional but expected for BLOB/SLOB."""
    type: TriggerType
    actor: PlayerId | None = None
    description: str | None = None


class Meta(BaseModel):
    name: str | None = None
    situation: Situation
    timeRemaining: str | None = None
    trigger: Trigger | None = None


class MoveAction(BaseModel):
    t: Literal["move"] = "move"
    actor: PlayerId
    to: CourtLocation
    tick: int


class ScreenAction(BaseModel):
    t: Literal["screen"] = "screen"
    screener: PlayerId
    screenee: PlayerId
    screenType: ScreenType
    location: CourtLocation
    tick: int


class CutAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    t: Literal["cut"] = "cut"
    actor: PlayerId
    cutType: CutType
    from_: CourtLocation = Field(alias="from")
    to: CourtLocation
    tick: int


class PassAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    t: Literal["pass"] = "pass"
    from_: PlayerId = Field(alias="from")
    to: PlayerId
    tick: int


class DribbleAction(BaseModel):
    t: Literal["dribble"] = "dribble"
    actor: PlayerId
    to: CourtLocation
    tick: int


class HandoffAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    t: Literal["handoff"] = "handoff"
    from_: PlayerId = Field(alias="from")
    to: PlayerId
    handoffType: HandoffType
    location: CourtLocation
    tick: int


class ShotAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    t: Literal["shot"] = "shot"
    actor: PlayerId
    from_: CourtLocation = Field(alias="from")
    tick: int


Action = Annotated[
    Union[
        MoveAction,
        ScreenAction,
        CutAction,
        PassAction,
        DribbleAction,
        HandoffAction,
        ShotAction,
    ],
    Field(discriminator="t"),
]


class Counter(BaseModel):
    """An alternative read branching off the primary play.

    Coaches often describe ATOs with at least two reads ('if they switch, slip to
    the rim; if not, the shooter curls'). The primary read lives in `actions`; each
    Counter captures a branch the coach mentioned plus its own action sequence.

    `trigger` is a natural-language description (e.g. 'if they switch the screen').
    """
    trigger: str = Field(min_length=1)
    actions: list[Action] = Field(min_length=1)


class PlaySchema(BaseModel):
    schemaVersion: Literal["0.2"] = "0.2"
    meta: Meta
    players: list[Player] = Field(min_length=5, max_length=5)
    initialFormation: Union[NamedFormation, Literal["custom"]] = NamedFormation.CUSTOM
    actions: list[Action] = Field(min_length=1)
    counters: list[Counter] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique_player_ids(self) -> "PlaySchema":
        ids = [p.id for p in self.players]
        if len(set(ids)) != 5:
            raise ValueError("players must have unique ids P1..P5")
        if set(ids) != {"P1", "P2", "P3", "P4", "P5"}:
            raise ValueError("players must be exactly {P1,P2,P3,P4,P5}")
        return self


class ParsePlayRequest(BaseModel):
    transcript: str = Field(min_length=1)
    hint: str | None = None  # optional context, e.g. "BLOB" or "out of timeout"


class ParsePlayResponse(BaseModel):
    play: PlaySchema
    notes: str | None = None
    transcript: str


class TranscribeResponse(BaseModel):
    text: str


class LineupPlayer(BaseModel):
    name: str
    role: Role | None = None


class ScoutRequest(BaseModel):
    lineup: list[LineupPlayer] = Field(min_length=1, max_length=5)
    opponent_lineup: list[LineupPlayer] | None = None
    question: str | None = None  # e.g. "what defensive coverages have they been showing on PnR?"


class ScoutResponse(BaseModel):
    summary: str
    bullets: list[str]
    mock: bool = False          # True if Claude synthesis is mocked (no API key)
    data_source: str = "stub"   # "stub" | "nba_stats_mcp" — where stats came from
