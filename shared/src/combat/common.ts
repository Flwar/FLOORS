import { TICK_MS } from "../constants.ts";
import { EFlag, type EnemyAttack } from "../enemies/defs.ts";

export const PLAYER_RADIUS = 9;

export const ProjKind = { Bolt: 0, Arrow: 1, Knife: 2, ShadowBolt: 3, Blade: 4, Reflected: 5, Wave: 6, Javelin: 7, Fireball: 8, IceShard: 9, VoidOrb: 10, TideWave: 11, Spark: 12 } as const;
export const HazardKind = { Hex: 0, Meteor: 1, Sigil: 2, Glyph: 3, Judgement: 4, Frost: 5, Lightning: 6, Void: 7, Tide: 8, Steam: 9 } as const;

/** Enraged enemies (boss phases, howl) wind up faster. Client and server both apply this. */
export const ENRAGE_WINDUP = 0.82;
/** Chilled enemies wind up 20% slower (and move 45% slower). */
export const CHILL_WINDUP = 1.2;
export function windupTicks(a: EnemyAttack, flags: number): number {
  let w = a.windup;
  if (flags & EFlag.Enraged) w *= ENRAGE_WINDUP;
  if (flags & EFlag.Chilled) w *= CHILL_WINDUP;
  return Math.round(w);
}
export const attackTicks = (a: EnemyAttack, flags: number) => windupTicks(a, flags) + a.active + a.recovery;
/** Time (ms from action start) at which an enemy attack connects. */
export const impactMs = (a: EnemyAttack, flags: number) => windupTicks(a, flags) * TICK_MS;

/** Slack on parry / dodge windows to absorb tick quantisation and clock jitter. */
export const TIMING_TOLERANCE_MS = 20;
/** A client's view of the world is never allowed to lag the server by more than this for hit judgement. */
export const MAX_VIEW_LAG_MS = 300;

export const HitResult = { Hit: 0, Parry: 1, Perfect: 2, Evade: 3, Blocked: 4, Armor: 5 } as const;
