import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import type { GateDef } from "./undercroft.ts";

export const ROOST_W = 84;
export const ROOST_H = 150;

/** Rooms of the Dragon's Roost, bottom (entrance) to top (Ignivar). */
export const ROOST_ROOMS = {
  entrance: { x0: 34, y0: 136, x1: 51, y1: 147 },
  bridge: { x0: 40, y0: 116, x1: 45, y1: 136 },
  hatchery: { x0: 22, y0: 90, x1: 63, y1: 116 },
  seals: { x0: 20, y0: 62, x1: 65, y1: 80 },
  vyrmak: { x0: 24, y0: 38, x1: 61, y1: 54 },
  ante: { x0: 36, y0: 29, x1: 49, y1: 35 },
  boss: { cx: 42, cy: 14, r: 14 },
};

export const RG = { hatcherySouth: 0, hatcheryNorth: 1, sealsNorth: 2, vyrmakSouth: 3, vyrmakNorth: 4, bossSouth: 5 } as const;
/** Lit flame seals ride in the synced gate mask from this bit up (one bit per seal). */
export const RG_SEAL_BIT = 16;
/** Seconds the three seals stay lit: light them all before the first gutters out. */
export const SEAL_WINDOW = 30;

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Dragon's Roost — Floor 3's boss dungeon, a mountain of black rock hollowed by
 * dragonfire, instanced per party. Built bottom-up:
 *   entrance → the Lava Bridge (geysers) → the Hatchery (the brood wakes) → the Flame
 *   Seals (light all three before they gutter) → Vyrmak, the Dragonsworn → antechamber
 *   → Ignivar, the Ember Tyrant.
 */
export function buildRoost(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = ROOST_W;
  const H = ROOST_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Dragon's Roost";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Void);
  const R = ROOST_ROOMS;
  const room = (r: { x0: number; y0: number; x1: number; y1: number }, floor: number = Tile.StoneFloor) => {
    m.fill(r.x0, r.y0, r.x1, r.y1, floor);
    for (let x = r.x0 - 1; x <= r.x1; x++) {
      if (m.get(x, r.y0 - 1) === Tile.Void) m.set(x, r.y0 - 1, Tile.RuinWall);
      if (m.get(x, r.y1) === Tile.Void) m.set(x, r.y1, Tile.RuinWall);
    }
    for (let y = r.y0 - 1; y <= r.y1; y++) {
      if (m.get(r.x0 - 1, y) === Tile.Void) m.set(r.x0 - 1, y, Tile.RuinWall);
      if (m.get(r.x1, y) === Tile.Void) m.set(r.x1, y, Tile.RuinWall);
    }
  };
  const walk = (x0: number, y0: number, x1: number, y1: number) => m.fill(x0, y0, x1, y1, Tile.StoneFloor);
  const gate = (id: number, y: number, x0 = 40, x1 = 45) => {
    const tiles: [number, number][] = [];
    for (let x = x0; x < x1; x++) tiles.push([x, y]);
    m.gates.push({ id, tiles });
  };
  /** Lava (water tiles, painted molten on this map) inside a room, leaving the room walkable around it. */
  const lava = (x0: number, y0: number, x1: number, y1: number) => m.fill(x0, y0, x1, y1, Tile.Water);

  room(R.entrance);
  // The Lava Bridge: a basalt span over a river of fire.
  walk(R.bridge.x0, R.bridge.y0, R.bridge.x1, R.bridge.y1);
  for (let y = R.bridge.y0 + 1; y < R.bridge.y1 - 1; y++) {
    for (const x of [R.bridge.x0 - 3, R.bridge.x0 - 2, R.bridge.x0 - 1, R.bridge.x1, R.bridge.x1 + 1, R.bridge.x1 + 2]) m.set(x, y, Tile.Water);
  }
  room(R.hatchery);
  walk(40, 80, 45, 90);
  room(R.seals);
  walk(40, 54, 45, 62);
  room(R.vyrmak);
  walk(40, 35, 45, 38);
  room(R.ante);

  // Ignivar's arena: a caldera floor, a ring of lava around the rim, broken spires.
  for (let y = 0; y < 29; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (d < R.boss.r) m.set(x, y, Tile.StoneFloor);
      else if (d < R.boss.r + 1.2 && m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
    }
  }
  walk(40, 26, 45, 29);
  for (let y = 0; y < 29; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (m.get(x, y) !== Tile.StoneFloor) continue;
      if (d > 7.6 && d < 8.5) m.set(x, y, Tile.Cobble);
      else if (d < 1.8) m.set(x, y, Tile.Cobble);
    }
  }
  for (const [dx, dy] of [[-9, -5], [8, -5], [-9, 5], [8, 5]]) m.fill(R.boss.cx + dx, R.boss.cy + dy, R.boss.cx + dx + 2, R.boss.cy + dy + 2, Tile.RuinWall);

  // The Hatchery: nests of hot ash, pools of lava, eggs in the rock.
  for (const [x, y] of [[26, 94], [55, 94], [26, 108], [55, 108]]) lava(x, y, x + 4, y + 3);
  for (const [x, y] of [[33, 100], [50, 100]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (const [x, y] of [[24, 101], [60, 101], [36, 92], [48, 112]]) m.set(x, y, Tile.Crystal);
  // The Flame Seals hall: three braziers-in-stone on islands of rock among lava channels.
  for (let x = R.seals.x0; x < R.seals.x1; x++) {
    if (x >= 39 && x <= 45) continue;
    for (const y of [70, 71]) if (Math.abs(x - 27) > 2 && Math.abs(x - 58) > 2) m.set(x, y, Tile.Water);
  }
  for (const [x, y] of [[21, 63], [62, 63], [21, 78], [62, 78]]) m.set(x, y, Tile.Crystal);
  // Vyrmak's hall: pillars and two lava vents.
  for (const [x, y] of [[31, 42], [51, 42], [31, 49], [51, 49]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (const [x, y] of [[26, 45], [56, 45]]) lava(x, y, x + 3, y + 2);
  // A dark runner leads through every hall toward the caldera.
  const runner = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = 41; x <= 43; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  };
  runner(R.hatchery.y0, R.hatchery.y1);
  runner(R.seals.y0 + 4, R.seals.y1);
  runner(R.vyrmak.y0, R.vyrmak.y1);
  runner(R.ante.y0, R.ante.y1);

  gate(RG.hatcherySouth, 116);
  gate(RG.hatcheryNorth, 90);
  gate(RG.sealsNorth, 62);
  gate(RG.vyrmakSouth, 54);
  gate(RG.vyrmakNorth, 38);
  gate(RG.bossSouth, 29);

  // Geysers erupt across the bridge in rows, in a rhythm you can learn.
  for (const [row, y] of [[0, 120], [1, 125], [2, 131]] as const) for (let x = 40; x < 45; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "roost-inner", name: "The Dragon's Roost", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [15, 16], music: "dragon" });
  m.zones.push({ id: "roost-vyrmak", name: "Hall of the Dragonsworn", safe: false, ...R.vyrmak, music: "miniboss" });
  m.zones.push({ id: "roost-boss", name: "The Caldera Throne", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 29, music: "boss" });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 42, ty: 141, name: "Entrance Brazier" });
  obj({ id: "brazier-1", kind: "campfire", tx: 42, ty: 58, name: "Seal Brazier" });
  obj({ id: "brazier-2", kind: "campfire", tx: 42, ty: 32, name: "Last Brazier" });
  obj({ id: "exit", kind: "door", tx: 42, ty: 145, name: "Down to the Caldera" });
  obj({ id: "lever-0", kind: "lever", tx: 25, ty: 66, name: "Seal of Ash" });
  obj({ id: "lever-1", kind: "lever", tx: 42, ty: 65, name: "Seal of Flame" });
  obj({ id: "lever-2", kind: "lever", tx: 60, ty: 66, name: "Seal of Cinder" });
  obj({ id: "seal-tablet", kind: "lore", tx: 42, ty: 77, name: "The Seal Stone", text: `"Three seals bar the Tyrant's stair. Light them all while the first still burns — ${SEAL_WINDOW} heartbeats, no more. The brood answers the flame."` });
  obj({ id: "hatchery-egg", kind: "lore", tx: 42, ty: 96, name: "Cracked Egg", text: "Still warm. The shell is as thick as a shield, and something clawed its way out of it very recently." });
  obj({ id: "lore-ante", kind: "lore", tx: 38, ty: 31, name: "Ignivar's Decree", text: "\"The tower is mine from this floor to the sky. Climb, little one. Climb to me, and burn.\"" });
  obj({ id: "ascent", kind: "gate", tx: 42, ty: 2, dest: "floor4", name: "The Burning Stair", text: "A stair of black glass climbs into smoke and stops. Floor 4 is not open yet." });

  m.spawns.push({ id: "warden", x: px(42), y: px(44), radius: 0, enemies: ["vyrmak"], respawn: 0, elite: 0, level: 15 });
  m.spawns.push({ id: "boss", x: px(42), y: px(10), radius: 0, enemies: ["ignivar"], respawn: 0, elite: 0, level: 16 });
  m.spawn = { x: px(42), y: px(142) };
  return m;
}
