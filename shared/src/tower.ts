import type { WorldMap } from "./world/map.ts";
import { buildFloor1 } from "./world/floor1.ts";
import { buildUndercroft } from "./world/undercroft.ts";
import { buildFloor2 } from "./world/floor2.ts";
import { buildStormspire } from "./world/stormspire.ts";
import { buildFloor3 } from "./world/floor3.ts";
import { buildRoost } from "./world/roost.ts";
import { buildFloor4 } from "./world/floor4.ts";
import { buildGlacier } from "./world/glacier.ts";

/**
 * The tower: every floor, its boss dungeon, and how they connect. Rooms, travel, level caps,
 * skies, music, maps and floor openings all read this table, so a new floor is its content
 * (map, dungeon, enemies, items, quests) plus one entry here.
 */

export type Theme = "meadow" | "cave" | "gilded" | "storm" | "ember" | "frost" | "shadow";
export type Sky = "day" | "dusk" | "gold" | "storm" | "ember" | "frost" | "void";

export interface FloorDef {
  n: number;
  /** The floor's shared world room. */
  room: string;
  /** Its boss dungeon (instanced per party). */
  dungeon: string;
  title: string;
  town: string;
  dungeonName: string;
  levels: [number, number];
  /** Monsters rise to meet stronger players, up to this level. */
  levelCap: number;
  /** Gate objects: the way up (on this floor) and the way down (none on Floor 1). */
  up: string;
  down?: string;
  /** The dungeon's door on this floor (you step out beside it). */
  door: string;
  /** The Floor Boss in the dungeon: beating it opens the next floor for everyone. */
  boss: string;
  /** Zone announced (and recorded) when you first arrive. */
  arrival: string;
  theme: Theme;
  dungeonTheme: Theme;
  sky: Sky;
  dungeonSky: Sky;
  music: string;
  dungeonMusic: string;
  /** What the map screen says in the dungeon (never charted). */
  uncharted: { title: string; text: string };
  /** Who sells this floor's map, and for how much. */
  mapSeller: string;
  build: () => WorldMap;
  buildDungeon: () => WorldMap;
}

export const TOWER: FloorDef[] = [
  {
    n: 1, room: "world", dungeon: "dungeon", title: "The Verdant Floor", town: "Emberwatch", dungeonName: "The Undercroft", levels: [1, 8], levelCap: 8,
    up: "ascent-gate", door: "undercroft-door", boss: "aurelion", arrival: "town",
    theme: "meadow", dungeonTheme: "cave", sky: "day", dungeonSky: "dusk", music: "town", dungeonMusic: "dungeon",
    uncharted: { title: "The Undercroft was never charted", text: "No map covers these halls. Follow your quest markers and the torchlight." },
    mapSeller: "Tilde sells one at the General Store in Emberwatch, for 35 gold.",
    build: buildFloor1, buildDungeon: buildUndercroft,
  },
  {
    n: 2, room: "floor2", dungeon: "stormspire", title: "The Gilded Terraces", town: "Skyreach Landing", dungeonName: "The Stormspire", levels: [8, 12], levelCap: 12,
    up: "sealed-stair", down: "descent", door: "stormspire-door", boss: "vaelra", arrival: "skyreach",
    theme: "gilded", dungeonTheme: "storm", sky: "gold", dungeonSky: "storm", music: "skyreach", dungeonMusic: "storm",
    uncharted: { title: "The Stormspire was never charted", text: "Climb. Every hall leads upward, toward the eye of the storm." },
    mapSeller: "Quartermaster Iven sells one at Skyreach Landing, for 60 gold.",
    build: buildFloor2, buildDungeon: buildStormspire,
  },
  {
    n: 3, room: "floor3", dungeon: "roost", title: "The Ember Reaches", town: "Emberhold", dungeonName: "The Dragon's Roost", levels: [12, 16], levelCap: 16,
    up: "sealed-stair4", down: "descent3", door: "roost-door", boss: "ignivar", arrival: "ember-reaches",
    theme: "ember", dungeonTheme: "ember", sky: "ember", dungeonSky: "ember", music: "emberhold", dungeonMusic: "dragon",
    uncharted: { title: "Nobody who mapped the Roost came back", text: "Up. Always up — toward the heat, and the Tyrant's throne." },
    mapSeller: "Quartermaster Sable sells one in Emberhold, for 90 gold.",
    build: buildFloor3, buildDungeon: buildRoost,
  },
  {
    n: 4, room: "floor4", dungeon: "glacier", title: "The Frostvale", town: "Rimeholt", dungeonName: "The Glacier Throne", levels: [16, 20], levelCap: 20,
    up: "sealed-stair5", down: "descent4", door: "glacier-door", boss: "hrimthar", arrival: "frostvale",
    theme: "frost", dungeonTheme: "frost", sky: "frost", dungeonSky: "frost", music: "rimeholt", dungeonMusic: "glacier",
    uncharted: { title: "The Glacier Throne has no map", text: "Its halls shift as the ice moves. Climb toward the cold at its heart." },
    mapSeller: "Ottar the Outfitter sells one in Rimeholt, for 120 gold.",
    build: buildFloor4, buildDungeon: buildGlacier,
  },
];

/** The highest floor that exists. */
export const TOP_FLOOR_N = () => TOWER.length;
export const floorDef = (n: number) => TOWER[n - 1];
/** The floor a room belongs to (its world or its dungeon). */
export const floorOfRoom = (room: string) => TOWER.find((f) => f.room === room || f.dungeon === room);
export const isWorldRoom = (room: string) => TOWER.some((f) => f.room === room);
export const isDungeonRoom = (room: string) => TOWER.some((f) => f.dungeon === room);
/** A room's name as players say it ("Floor 3", "the Dragon's Roost"). */
export function roomLabel(room: string) {
  const f = floorOfRoom(room);
  if (!f) return "?";
  return f.room === room ? `Floor ${f.n}` : f.dungeonName.replace(/^The /, "the ");
}
/** The floor number a map belongs to (0 for dungeons), from its name ("Floor 3 — …"). */
export const mapFloorNumber = (name: string) => Number(/^Floor (\d+)/.exec(name)?.[1] ?? 0);
