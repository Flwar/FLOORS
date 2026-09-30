import { TILE } from "./constants.ts";
import type { PropDef } from "./world/map.ts";

/** Emotes typed as chat commands (/wave …), with how they read in a speech bubble. */
export const EMOTES = {
  wave: "waves",
  cheer: "cheers",
  dance: "dances",
  bow: "bows",
  laugh: "laughs",
} as const;
export type Emote = keyof typeof EMOTES;
export const isEmote = (s: string): s is Emote => Object.prototype.hasOwnProperty.call(EMOTES, s);

/** How long an emote plays (ms) unless you move first. */
export const EMOTE_MS = 2600;

/** Props you can sit on, and what the prompt calls them. */
export const SEAT_PROPS: Partial<Record<PropDef["kind"], string>> = { bench: "bench", logs: "logs" };

/** Where a sitter's feet go: centred just in front (south) of the prop, on open ground. */
export function seatPoint(pr: PropDef) {
  return { x: (pr.tx + pr.tw / 2) * TILE, y: (pr.ty + pr.th) * TILE + 6 };
}

/** Sit states synced on the player: standing, on the ground, or on a seat. */
export const Sit = { None: 0, Ground: 1, Seat: 2 } as const;

/** Resting (sitting out of combat) closes wounds this many times faster. */
export const REST_REGEN = 3;
