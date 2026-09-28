import { TICK_MS } from "../constants.ts";
import { EFlag, type EnemyAttack } from "../enemies/defs.ts";

export const PLAYER_RADIUS = 9;

export const ProjKind = { Bolt: 0, Arrow: 1, Knife: 2, ShadowBolt: 3, Blade: 4, Reflected: 5, Wave: 6, Javelin: 7 } as const;
export const HazardKind = { Hex: 0, Meteor: 1, Sigil: 2, Glyph: 3, Judgement: 4, Frost: 5, Lightning: 6 } as const;

/** Enraged enemies (boss phases, howl) wind up faster. Client and server both apply this. */
export const ENRAGE_WINDUP = 0.82;
export function windupTicks(a: EnemyAttack, flags: number): number {
  return flags & EFlag.Enraged ? Math.round(a.windup * ENRAGE_WINDUP) : a.windup;
}
export const attackTicks = (a: EnemyAttack, flags: number) => windupTicks(a, flags) + a.active + a.recovery;
/** Time (ms from action start) at which an enemy attack connects. */
export const impactMs = (a: EnemyAttack, flags: number) => windupTicks(a, flags) * TICK_MS;

/** Slack on parry / dodge windows to absorb tick quantisation and clock jitter. */
export const TIMING_TOLERANCE_MS = 20;
/** A client's view of the world is never allowed to lag the server by more than this for hit judgement. */
export const MAX_VIEW_LAG_MS = 300;

export const HitResult = { Hit: 0, Parry: 1, Perfect: 2, Evade: 3, Blocked: 4, Armor: 5 } as const;
