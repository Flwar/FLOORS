import { TILE } from "../constants.ts";
import { Tile, WorldMap } from "./map.ts";
import type { GateDef } from "./undercroft.ts";

export const STORMSPIRE_W = 80;
export const STORMSPIRE_H = 140;

/** Rooms of the Stormspire, bottom (entrance) to top (Vaelra). */
export const STORMSPIRE_ROOMS = {
  entrance: { x0: 32, y0: 126, x1: 49, y1: 137 },
  bridge: { x0: 38, y0: 108, x1: 43, y1: 126 },
  gallery: { x0: 22, y0: 84, x1: 59, y1: 108 },
  conduits: { x0: 24, y0: 60, x1: 57, y1: 76 },
  warden: { x0: 24, y0: 36, x1: 57, y1: 52 },
  ante: { x0: 34, y0: 27, x1: 47, y1: 33 },
  boss: { cx: 40, cy: 12, r: 12 },
};

export const SS_GATE = { gallerySouth: 0, galleryNorth: 1, conduitsNorth: 2, wardenSouth: 3, wardenNorth: 4, bossSouth: 5 } as const;
/** Woken conduits ride in the synced gate mask from this bit up (one bit per conduit). */
export const SS_CONDUIT_BIT = 16;

const px = (t: number) => t * TILE + TILE / 2;

/**
 * The Stormspire — Floor 2's boss dungeon, a tower of gilded platforms open to the sky,
 * instanced per party. Built bottom-up:
 *   entrance → lightning bridge → the Gallery (ambush) → the Conduits (overcharge three)
 *   → Kael, the Stormwarden → antechamber → Vaelra, Keeper of the Storm.
 */
export function buildStormspire(): WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] } {
  const W = STORMSPIRE_W;
  const H = STORMSPIRE_H;
  const m = new WorldMap(W, H) as WorldMap & { gates: GateDef[]; traps: { x: number; y: number; row: number }[] };
  m.name = "The Stormspire";
  m.gates = [];
  m.traps = [];
  m.fill(0, 0, W, H, Tile.Void);
  const R = STORMSPIRE_ROOMS;
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
  /** A walkway between rooms: stone over open sky, no rails. */
  const walk = (x0: number, y0: number, x1: number, y1: number) => m.fill(x0, y0, x1, y1, Tile.StoneFloor);
  const gate = (id: number, y: number, x0 = 38, x1 = 43) => {
    const tiles: [number, number][] = [];
    for (let x = x0; x < x1; x++) tiles.push([x, y]);
    m.gates.push({ id, tiles });
  };

  room(R.entrance);
  walk(R.bridge.x0, R.bridge.y0, R.bridge.x1, R.bridge.y1);
  room(R.gallery);
  walk(38, 76, 43, 84);
  room(R.conduits);
  walk(38, 52, 43, 60);
  room(R.warden);
  walk(38, 33, 43, 36);
  room(R.ante);
  // Vaelra's arena: a round platform ringed with broken columns.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (d < R.boss.r) m.set(x, y, Tile.StoneFloor);
      else if (d < R.boss.r + 1.2 && m.get(x, y) === Tile.Void) m.set(x, y, Tile.RuinWall);
    }
  }
  walk(38, 24, 43, 27);
  // The eye of the storm is inlaid in the arena floor: a dark ring, and a pupil at its heart.
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - R.boss.cx, (y - R.boss.cy) * 1.05);
      if (m.get(x, y) === Tile.StoneFloor && ((d > 6.4 && d < 7.4) || d < 1.6)) m.set(x, y, Tile.Cobble);
    }
  }
  for (const [dx, dy] of [[-7, -4], [6, -4], [-7, 5], [6, 5]]) m.fill(R.boss.cx + dx, R.boss.cy + dy, R.boss.cx + dx + 2, R.boss.cy + dy + 2, Tile.RuinWall);
  // Columns in the gallery and the Stormwarden's hall; crystal clusters at the conduits.
  for (const [x, y] of [[28, 90], [51, 90], [28, 101], [51, 101]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (const [x, y] of [[31, 40], [48, 40], [31, 47], [48, 47]]) m.fill(x, y, x + 2, y + 2, Tile.RuinWall);
  for (const [x, y] of [[26, 62], [55, 62], [26, 74], [55, 74]]) m.set(x, y, Tile.Crystal);
  // A dark processional runner leads through every hall toward the eye of the storm, so the
  // way on always reads at a glance.
  const runner = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) for (let x = 39; x <= 41; x++) if (m.get(x, y) === Tile.StoneFloor) m.set(x, y, Tile.Cobble);
  };
  runner(R.gallery.y0, R.gallery.y1);
  runner(R.conduits.y0 + 5, R.conduits.y1);
  runner(R.warden.y0, R.warden.y1);
  runner(R.ante.y0, R.ante.y1);
  // Colonnades down the Gallery's long sides, and windows of open sky in its floor.
  for (let y = 87; y <= 105; y += 3) for (const x of [24, 57]) m.set(x, y, Tile.RuinWall);
  for (const [x, y] of [[30, 93], [48, 93]]) m.fill(x, y, x + 3, y + 2, Tile.Void);
  // Stormglass has grown through the Conduits hall.
  for (const [x, y] of [[25, 67], [56, 67], [33, 61], [48, 61], [34, 75], [47, 75]]) m.set(x, y, Tile.Crystal);
  // The Stormwarden's hall: sky breaks through either side of the duelling floor.
  for (const [x, y] of [[26, 43], [52, 43]]) m.fill(x, y, x + 3, y + 3, Tile.Void);

  gate(SS_GATE.gallerySouth, 108);
  gate(SS_GATE.galleryNorth, 84);
  gate(SS_GATE.conduitsNorth, 60);
  gate(SS_GATE.wardenSouth, 52);
  gate(SS_GATE.wardenNorth, 36);
  gate(SS_GATE.bossSouth, 25);

  // Lightning strikes rake the bridge in three rows, in a rhythm you can learn.
  for (const [row, y] of [[0, 112], [1, 117], [2, 122]] as const) for (let x = 38; x < 43; x++) m.traps.push({ x: px(x), y: px(y), row });

  m.zones.push({ id: "stormspire-inner", name: "The Stormspire", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [11, 12], music: "storm" });
  m.zones.push({ id: "ss-warden", name: "Hall of the Stormwarden", safe: false, ...R.warden, music: "miniboss" });
  m.zones.push({ id: "ss-boss", name: "The Eye of the Storm", safe: false, x0: R.boss.cx - R.boss.r, y0: 0, x1: R.boss.cx + R.boss.r, y1: 25, music: "boss" });

  const obj = (o: Omit<WorldMap["objects"][number], "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "brazier-0", kind: "campfire", tx: 40, ty: 131, name: "Entrance Brazier" });
  obj({ id: "brazier-1", kind: "campfire", tx: 40, ty: 56, name: "Conduit Brazier" });
  obj({ id: "brazier-2", kind: "campfire", tx: 40, ty: 30, name: "Last Brazier" });
  obj({ id: "exit", kind: "door", tx: 40, ty: 135, name: "Down to the Heights" });
  obj({ id: "lever-0", kind: "lever", tx: 29, ty: 68, name: "West Conduit" });
  obj({ id: "lever-1", kind: "lever", tx: 40, ty: 63, name: "High Conduit" });
  obj({ id: "lever-2", kind: "lever", tx: 52, ty: 68, name: "East Conduit" });
  obj({ id: "conduit-tablet", kind: "lore", tx: 40, ty: 73, name: "Conduit Plate", text: "\"Wake all three conduits and the storm will open the way. The storm does not like to be woken.\"" });
  obj({ id: "lore-ante", kind: "lore", tx: 36, ty: 29, name: "Vaelra's Vow", text: "\"I am the storm that keeps the stair. Stand in my eye and I will teach you to fear the calm — and to run when the wind turns.\"" });
  obj({ id: "ascent", kind: "gate", tx: 40, ty: 3, dest: "floor3", name: "The Ember Stair", text: "The stair climbs into a burning sky. It will not open while Vaelra lives." });

  m.spawns.push({ id: "warden", x: px(40), y: px(42), radius: 0, enemies: ["stormwarden"], respawn: 0, elite: 0, level: 11 });
  m.spawns.push({ id: "boss", x: px(40), y: px(9), radius: 0, enemies: ["vaelra"], respawn: 0, elite: 0, level: 12 });
  m.spawn = { x: px(40), y: px(132) };
  return m;
}
