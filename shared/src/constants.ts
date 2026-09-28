/** Simulation rate shared by server and client prediction. One input == one step. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
/** State patch rate (Hz). Inputs and simulation run at TICK_RATE. */
export const PATCH_RATE = 30;
/** Interpolation delay for remote entities (ms). Also the lag-comp render delay. */
export const INTERP_DELAY = 100;
export const STEP_SECONDS = 1 / TICK_RATE;

export const TILE = 32;

export const WALK_SPEED = 150; // px/s
export const SPRINT_SPEED = 245; // px/s

export const STAMINA_MAX = 100;
export const SPRINT_DRAIN = 22; // per second while sprinting
export const STAMINA_REGEN = 34; // per second
export const STAMINA_REGEN_DELAY = 0.6; // seconds after spending before regen starts
/** Once emptied, sprint stays locked until stamina refills to this level (no stutter-sprinting). */
export const EXHAUST_RECOVER = 30;

/** Feet collision box half-extents, centred on the entity's (x, y) ground point. */
export const BODY_HALF_W = 7;
export const BODY_HALF_H = 5;

export const SERVER_PORT = 2567;

export const Gait = { Idle: 0, Walk: 1, Sprint: 2 } as const;
