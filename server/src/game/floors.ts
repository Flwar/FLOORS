import { TOWER } from "@floors/shared";
import { db } from "../db.ts";
import { isAdminName } from "./admin.ts";
import { broadcastAll, online, sendToKey } from "./registry.ts";

/** The server-wide record of how far the tower is open. */
export interface FloorRecord {
  floor: number;
  /** Who last opened (or sealed) it, and when. */
  by: string[];
  at: number;
  /** An admin sealed the floor above this one. */
  sealed?: boolean;
}

/** Floors that exist so far: nothing opens past this. */
export const TOP_FLOOR = TOWER.length;

/** Which boss guards the way up from each floor. */
const FLOOR_BOSS: Record<number, string> = Object.fromEntries(TOWER.slice(0, -1).map((f) => [f.n + 1, f.boss]));
/** Rooms that belong to each floor (the floor itself and its dungeon). */
const ROOMS_ON: Record<number, string[]> = Object.fromEntries(TOWER.map((f) => [f.n, [f.room, f.dungeon]]));
/** Where someone lands when the floor above them is sealed: the way up on the floor below. */
const LANDING: Record<number, { room: string; via: string }> = Object.fromEntries(TOWER.map((f) => [f.n, { room: f.room, via: f.up }]));

/**
 * The saved record. A server from before floors opened for everyone starts with Floor 2
 * open if anyone ever beat Aurelion, so nobody loses a floor they reached.
 */
export function worldFloorRecord(): FloorRecord {
  const saved = db.getWorld<FloorRecord>("floor");
  if (saved) return saved;
  const slayers = db.bossSlayers(FLOOR_BOSS[2]);
  const rec: FloorRecord = slayers.length ? { floor: 2, by: slayers.slice(0, 4), at: Date.now() } : { floor: 1, by: [], at: 0 };
  db.setWorld("floor", rec);
  return rec;
}

/**
 * The highest floor open to everyone on this server. Floors open for the whole world at
 * once: the first party to defeat a Floor Boss opens the next floor for every player.
 */
export function worldFloor(): number {
  return worldFloorRecord().floor;
}

/**
 * The floor a character may reach when they log in: whatever the world has open. Admins
 * keep anything they have, and dev guests (tests) are never pulled down.
 */
export function floorOnJoin(current: number, registered: boolean, admin: boolean) {
  const open = worldFloor();
  if (current < open) return open;
  if (current > open && registered && !admin) return open;
  return current;
}

/**
 * A Floor Boss fell (or an admin opened the way): open `floor` for everyone. Online
 * players see it happen; everyone else finds it open when they next log in.
 * Returns false if that floor was already open.
 */
export function openFloor(floor: number, by: string[], boss: string | undefined, admin = false): boolean {
  if (floor > TOP_FLOOR || floor <= worldFloor()) return false;
  db.setWorld("floor", { floor, by, at: Date.now() } satisfies FloorRecord);
  for (const e of online.values()) {
    if (e.ch.data.floor >= floor) continue;
    e.ch.data.floor = floor;
    e.ch.dirty = true;
  }
  broadcastAll("floorOpened", { floor, by, boss, admin });
  return true;
}

/**
 * Admin: seal `floor` again. Everyone loses the way up (admins and dev guests excepted),
 * and anyone on it (or above) is sent down to the floor below, beside its way up.
 */
export function sealFloor(floor: number, by: string): boolean {
  if (floor < 2 || worldFloor() < floor) return false;
  const below = floor - 1;
  db.setWorld("floor", { floor: below, by: [by], at: Date.now(), sealed: true } satisfies FloorRecord);
  for (const e of online.values()) {
    if (e.accountId === null || isAdminName(e.ch.data.name)) continue;
    if (e.ch.data.floor > below) {
      e.ch.data.floor = below;
      e.ch.dirty = true;
    }
    const room = e.status?.().room;
    const above = Object.entries(ROOMS_ON).some(([f, rooms]) => Number(f) >= floor && rooms.includes(room ?? ""));
    if (above) {
      const land = LANDING[below];
      e.ch.travelTo = { room: land.room, via: land.via };
      sendToKey(e.key, "travel", { room: land.room });
    }
  }
  broadcastAll("floorSealed", { floor, by });
  return true;
}
