import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import type { GateDef } from "./undercroft.ts";

export const GLACIER_W = 84;
export const GLACIER_H = 150;

/** Rooms of the Glacier Throne, bottom (entrance) to top (Hrimthar). */
export const GLACIER_ROOMS = {
  entrance: { x0: 34, y0: 136, x1: 51, y1: 147 },
  bridge: { x0: 40, y0: 116, x1: 45, y1: 136 },
  mirrors: { x0: 22, y0: 90, x1: 63, y1: 116 },
  echoes: { x0: 20, y0: 62, x1: 65, y1: 80 },
  jarnhild: { x0: 24, y0: 38, x1: 61, y1: 54 },
  ante: { x0: 36, y0: 29, x1: 49, y1: 35 },
  boss: { cx: 42, cy: 14, r: 14 },
};

export const GG = { mirrorsSouth: 0, mirrorsNorth: 1, echoesNorth: 2, jarnSouth: 3, jarnNorth: 4, bossSouth: 5 } as const;
/** Runes struck in the right order ride in the synced gate mask from this bit up (one per rune). */
export const GG_RUNE_BIT = 16;
export const RUNES = ["Wolf", "Bear", "Eagle", "Serpent"];

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Glacier Throne — Floor 4's boss dungeon, a palace carved inside a glacier, instanced
 * per party. Built bottom-up:
 *   entrance → the Icicle Bridge → the Hall of Mirrors (three waves) → the Hall of Echoes
 *   (read the four echo stones, then strike the runes in their order) → Jarnhild the Frost
 *   Giant → antechamber → Hrimthar, the Winter King.
 */
export function buildGlacier(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = GLACIER_W;
  const H = GLACIER_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Glacier Throne";
  m.theme = "frost";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Void);
  const R = GLACIER_ROOMS;
  const room = (r: { x0: number; y0: number; x1: number; y1: number }) => {
    m.fill(r.x0, r.y0, r.x1, r.y1, Tile.StoneFloor);
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

  room(R.entrance);
  walk(R.bridge.x0, R.bridge.y0, R.bridge.x1, R.bridge.y1);
  room(R.mirrors);
  walk(40, 80, 45, 90);
  room(R.echoes);
  walk(40, 54, 45, 62);
  room(R.jarnhild);
  walk(40, 35, 45, 38);
  room(R.ante);

  // Hrimthar's throne room: a round hall of ice with pillars, the throne at its heart.
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
      if (m.get(x, y) === Tile.StoneFloor && ((d > 7.6 && d < 8.5) || d < 1.8)) m.set(x, y, Tile.Cobble);
    }
  }
  for (const [dx, dy] of [[-9, -5], [8, -5], [-9, 5], [8, 5]]) m.fill(R.boss.cx + dx, R.boss.cy + dy, R.boss.cx + dx + 2, R.boss.cy + dy + 2, Tile.Crystal);

  // The Hall of Mirrors: ice pillars, and holes in the floor into the dark below.
  for (const [x, y] of [[28, 96], [55, 96], [28, 108], [55, 108]]) m.fill(x, y, x + 2, y + 2, Tile.Crystal);
  for (const [x, y] of [[33, 101], [49, 101]]) m.fill(x, y, x + 3, y + 2, Tile.Void);
  for (let y = 93; y <= 113; y += 4) for (const x of [22, 62]) m.set(x, y, Tile.Crystal);
  // The Hall of Echoes: four rune pillars across the hall, four echo stones along its south side.
  for (const [x, y] of [[21, 63], [64, 63], [21, 79], [64, 79]]) m.set(x, y, Tile.Crystal);
  // Jarnhild's hall: great pillars of ice.
  for (const [x, y] of [[31, 42], [51, 42], [31, 49], [51, 49]]) m.fill(x, y, x + 2, y + 2, Tile.Crystal);
  // A dark runner leads through every hall toward the throne.
  const runner = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = 41; x <= 43; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  };
  runner(R.mirrors.y0, R.mirrors.y1);
  runner(R.echoes.y0 + 4, R.echoes.y1);
  runner(R.jarnhild.y0, R.jarnhild.y1);
  runner(R.ante.y0, R.ante.y1);

  gate(GG.mirrorsSouth, 116);
  gate(GG.mirrorsNorth, 90);
  gate(GG.echoesNorth, 62);
  gate(GG.jarnSouth, 54);
  gate(GG.jarnNorth, 38);
  gate(GG.bossSouth, 29);

  // Icicles fall across the bridge in rows, in a rhythm you can learn.
  for (const [row, y] of [[0, 120], [1, 125], [2, 131]] as const) for (let x = 40; x < 45; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "glacier-inner", name: "The Glacier Throne", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [19, 20], music: "glacier" });
  m.zones.push({ id: "glacier-jarnhild", name: "Hall of the Frost Giant", safe: false, ...R.jarnhild, music: "miniboss" });
  m.zones.push({ id: "glacier-boss", name: "The Winter Throne", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 29, music: "boss" });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 42, ty: 141, name: "Entrance Brazier" });
  obj({ id: "brazier-1", kind: "campfire", tx: 42, ty: 58, name: "Echo Brazier" });
  obj({ id: "brazier-2", kind: "campfire", tx: 42, ty: 32, name: "Last Brazier" });
  obj({ id: "exit", kind: "door", tx: 42, ty: 145, name: "Down to the Peak" });
  RUNES.forEach((rune, i) => obj({ id: `lever-${i}`, kind: "lever", tx: [26, 35, 49, 58][i], ty: [67, 64, 64, 67][i], name: `Rune of the ${rune}` }));
  for (let i = 0; i < 4; i++) obj({ id: `echo-${i}`, kind: "lore", tx: [25, 34, 50, 59][i], ty: [77, 78, 78, 77][i], name: "Echo Stone", text: "The ice hums, but says nothing." });
  obj({ id: "mirror-tablet", kind: "lore", tx: 42, ty: 113, name: "Frosted Mirror", text: "Your reflection in the ice moves a moment after you do. Then a second one steps out of it." });
  obj({ id: "lore-ante", kind: "lore", tx: 38, ty: 31, name: "The Winter Decree", text: "\"Every fire goes out. Every climber stops climbing. I am only what comes after.\"" });
  obj({ id: "ascent", kind: "gate", tx: 42, ty: 2, dest: "floor5", name: "The Frozen Stair", text: "A stair of ice climbs into a darkening sky. It will not open while the Winter King sits his throne." });

  m.spawns.push({ id: "warden", x: px(42), y: px(44), radius: 0, enemies: ["jarnhild"], respawn: 0, elite: 0, level: 19 });
  m.spawns.push({ id: "boss", x: px(42), y: px(10), radius: 0, enemies: ["hrimthar"], respawn: 0, elite: 0, level: 20 });
  m.spawn = { x: px(42), y: px(142) };
  return m;
}
