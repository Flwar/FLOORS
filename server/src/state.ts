import { schema, t, type SchemaType } from "@colyseus/schema";

export const Player = schema(
  {
    name: t.string(),
    hue: t.uint16(),
    level: t.uint8(),
    hp: t.uint16(),
    hpMax: t.uint16(),
    // Appearance of equipped gear, so other players see it.
    armorLook: t.uint8(),
    helmLook: t.uint8(),
    weaponRarity: t.uint8(),
    weaponLook: t.uint8(),
    party: t.string(),
    // --- PlayerSim (predicted by the owning client; keep in sync with shared/sim/player.ts) ---
    x: t.float32(),
    y: t.float32(),
    dir: t.uint8(),
    gait: t.uint8(),
    aim: t.uint8(),
    stamina: t.float32(),
    staminaMax: t.float32(),
    staminaDelay: t.float32(),
    exhausted: t.boolean(),
    act: t.uint8(),
    actTick: t.uint16(),
    actMove: t.uint8(),
    actAim: t.uint8(),
    actSeq: t.uint8(),
    combo: t.uint8(),
    comboTimer: t.uint8(),
    buf: t.uint8(),
    bufAim: t.uint8(),
    bufAge: t.uint8(),
    dodgeDx: t.float32(),
    dodgeDy: t.float32(),
    kbx: t.float32(),
    kby: t.float32(),
    hurtDur: t.uint8(),
    weapon: t.uint8(),
    mods: t.uint16(),
    parryOk: t.uint8(),
    cd1: t.uint16(),
    cd2: t.uint16(),
    potions: t.uint8(),
    /** Weapon mastery 10: the weapon glows. */
    mastered: t.boolean(),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** Fields the owning client predicts (everything the shared step reads or writes). */
export const PREDICTED_FIELDS = [
  "x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted",
  "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge",
  "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "potions",
] as const;

export const Enemy = schema(
  {
    def: t.uint8(),
    x: t.float32(),
    y: t.float32(),
    aim: t.uint8(),
    act: t.uint8(),
    atk: t.uint8(),
    /** Server time (ms since room start) the current action began — clients derive animation progress from it. */
    actStart: t.float64(),
    /** Anchor of a targeted ground attack (hex circles, sigils). */
    ax: t.float32(),
    ay: t.float32(),
    hp: t.uint16(),
    hpMax: t.uint16(),
    flags: t.uint8(),
    /** Boss posture 0–255. */
    posture: t.uint8(),
    level: t.uint8(),
  },
  "Enemy",
);
export type Enemy = SchemaType<typeof Enemy>;

/**
 * Projectiles sync only their launch parameters; every client computes the path
 * itself (x = x0 + cos(a)·speed·t), so flight costs no bandwidth.
 */
export const Projectile = schema(
  {
    kind: t.uint8(),
    team: t.uint8(),
    owner: t.string(),
    x0: t.float32(),
    y0: t.float32(),
    angle: t.float32(),
    speed: t.float32(),
    range: t.float32(),
    radius: t.uint8(),
    born: t.float64(),
  },
  "Projectile",
);
export type Projectile = SchemaType<typeof Projectile>;

/** Delayed area effects: telegraphed ground blasts, meteors, safe glyphs. */
export const Hazard = schema(
  {
    kind: t.uint8(),
    team: t.uint8(),
    x: t.float32(),
    y: t.float32(),
    radius: t.float32(),
    born: t.float64(),
    /** ms from born until it detonates. */
    delay: t.float32(),
  },
  "Hazard",
);
export type Hazard = SchemaType<typeof Hazard>;

/** Loot on the ground: an item, a pile of gold, or a death bag. */
export const Drop = schema(
  {
    kind: t.uint8(),
    key: t.string(),
    rarity: t.uint8(),
    qty: t.uint16(),
    x: t.float32(),
    y: t.float32(),
    /** Session with pickup rights ("" = anyone). */
    owner: t.string(),
    born: t.float64(),
  },
  "Drop",
);
export type Drop = SchemaType<typeof Drop>;

export const WorldState = schema(
  {
    players: t.map(Player),
    drops: t.map(Drop).view(),
    enemies: t.map(Enemy).view(),
    projectiles: t.map(Projectile).view(),
    hazards: t.map(Hazard).view(),
    /** Active world event ("" when none). */
    event: t.string(),
    eventName: t.string(),
    eventUntil: t.float64(),
    eventX: t.float32(),
    eventY: t.float32(),
    /** Dungeon checkpoint / boss state, when in an instance. */
    stage: t.string(),
    /** Dungeon portcullis bitmask (bit set = open). */
    gates: t.uint32(),
    /** Floor boss fight in progress (instance). */
    bossActive: t.boolean(),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;

/** One 60 Hz input frame. Fields must match shared PlayerCommand. */
export const PlayerInput = schema(
  {
    mx: t.int8(),
    my: t.int8(),
    aim: t.uint8(),
    btn: t.uint8(),
  },
  "PlayerInput",
);
export type PlayerInput = SchemaType<typeof PlayerInput>;
