import { TILE } from "../constants.ts";
import { Tile, WorldMap, type WorldObject } from "./map.ts";
import { addInteriors } from "./interiors.ts";

const px = (t: number) => t * TILE + TILE / 2;

function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
function noise(x: number, y: number, scale: number, seed: number) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Floor 2 — the Gilded Terraces: floating islands strung together by bridges above open sky.
 *   Skyreach Landing (south, safe) → Gilded Terraces (centre) → Sunken Gardens (west),
 *   Shattered Causeway (east), Stormveil Heights (north) → the Stormspire (the floor's dungeon).
 */
export function buildFloor2(): WorldMap {
  const W = 170;
  const H = 140;
  const m = new WorldMap(W, H);
  m.name = "Floor 2 — The Gilded Terraces";
  m.theme = "gilded";
  m.fill(0, 0, W, H, Tile.Void);
  const protect = new Uint8Array(W * H);
  const P = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && protect[y * W + x] === 1;
  const setP = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) protect[y * W + x] = 1;
  };

  /** An island: an ellipse with a noisy rim. */
  const island = (cx: number, cy: number, rx: number, ry: number, seed: number, tile: number = Tile.Grass) => {
    for (let y = cy - ry - 3; y <= cy + ry + 3; y++) {
      for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d < 1 + (noise(x, y, 5, seed) - 0.5) * 0.28) m.set(x, y, tile);
      }
    }
  };
  /** A stone bridge (or path) of `half` tiles either side of a straight line. */
  const bridge = (x0: number, y0: number, x1: number, y1: number, half = 1, tile: number = Tile.StoneFloor) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          m.set(x + dx, y + dy, tile);
          setP(x + dx, y + dy);
        }
      }
    }
  };
  const land = (x: number, y: number) => m.get(x, y) !== Tile.Void;

  // --- Islands ---------------------------------------------------------------
  island(85, 120, 21, 13, 1); // Skyreach Landing
  island(85, 76, 44, 25, 2); // Gilded Terraces
  island(31, 74, 19, 23, 3); // Sunken Gardens
  island(12, 44, 7, 6, 4); // Hidden Aviary
  for (const [cx, cy, r, s] of [[138, 82, 6, 5], [150, 69, 6, 6], [160, 55, 6, 7], [149, 41, 5, 8]] as const) island(cx, cy, r, r - 1, s); // Causeway isles
  island(85, 32, 38, 14, 9); // Stormveil Heights
  island(85, 8, 10, 6, 10); // The Stormspire

  // --- Bridges ---------------------------------------------------------------
  bridge(85, 108, 85, 99, 2); // landing → terraces
  bridge(53, 76, 46, 76, 1); // terraces → gardens
  bridge(127, 78, 134, 81, 1); // terraces → causeway
  bridge(142, 79, 146, 72, 1);
  bridge(154, 65, 157, 60, 1);
  bridge(158, 49, 153, 45, 1);
  bridge(85, 52, 85, 45, 2); // terraces → heights
  bridge(85, 19, 85, 13, 2); // heights → stormspire
  // The aviary's way in: a single plank bridge hidden behind the garden's north-west trees.
  bridge(26, 56, 15, 48, 1, Tile.Path);

  // --- Skyreach Landing (town) -----------------------------------------------
  const T = { x0: 66, y0: 108, x1: 105, y1: 132 };
  for (let y = T.y0; y < T.y1; y++) for (let x = T.x0; x < T.x1; x++) if (land(x, y)) setP(x, y);
  m.fill(74, 114, 97, 128, Tile.StoneFloor);
  const house = (id: string, name: string, tx: number, ty: number, tw: number, th: number) => {
    m.fill(tx, ty, tx + tw, ty + th, Tile.House);
    m.buildings.push({ id, name, tx, ty, tw, th });
  };
  house("skyhall", "Skyreach Hall", 74, 109, 8, 4);
  house("quarter", "Quartermaster", 68, 113, 6, 4);
  house("skyforge", "Skyforge", 97, 113, 6, 4);
  house("skyvault", "Sky Vault", 69, 121, 5, 3);
  house("windrest", "The Windrest", 97, 121, 6, 4);
  m.prop("stall", 77, 124, 2, 1, 1);
  m.prop("stall", 91, 124, 2, 1, 0);
  m.prop("lamp", 76, 116);
  m.prop("lamp", 94, 116);
  m.prop("lamp", 79, 127);
  m.prop("lamp", 91, 127);
  m.prop("bench", 83, 125, 2, 1);
  m.prop("planter", 79, 113);
  m.prop("planter", 91, 113);
  m.prop("crates", 96, 118);
  m.prop("barrel", 74, 118);
  m.prop("barrel", 74, 119, 1, 1, 1);
  m.prop("sacks", 104, 118);
  m.prop("board", 88, 113);

  // --- Gilded Terraces ---------------------------------------------------------
  // Two long ridges split the meadow into terraces; gaps are the way up.
  for (let x = 58; x <= 112; x++) {
    if ((x >= 70 && x <= 73) || (x >= 84 && x <= 87) || (x >= 99 && x <= 102)) continue;
    if (land(x, 68) && !P(x, 68)) m.set(x, 68, Tile.Cliff);
  }
  for (let x = 62; x <= 108; x++) {
    if ((x >= 66 && x <= 69) || (x >= 84 && x <= 87) || (x >= 104 && x <= 106)) continue;
    if (land(x, 86) && !P(x, 86)) m.set(x, 86, Tile.Cliff);
  }
  // A worn road from the landing bridge up through the ridge gaps to the heights bridge.
  bridge(85, 98, 85, 53, 1, Tile.Path);
  bridge(85, 78, 60, 76, 0, Tile.Path);
  bridge(85, 78, 126, 78, 0, Tile.Path);
  // Gilded pond and ruined pillars.
  for (let y = 88; y <= 94; y++) for (let x = 100; x <= 110; x++) if (Math.hypot((x - 105) / 5, (y - 91) / 3) < 1 && !P(x, y)) m.set(x, y, Tile.Water);
  for (const [x, y] of [[66, 60], [72, 58], [98, 58], [104, 60], [60, 80], [110, 80], [76, 92], [94, 94]]) if (!P(x, y)) m.set(x, y, Tile.RuinWall);
  // Gilded paving round the waystone and the obelisk: the terraces were a garden of the old climbers.
  const plaza = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        if (Math.hypot((x - cx) / 1.2, y - cy) < r && land(x, y) && !P(x, y) && m.get(x, y) === Tile.Grass) m.set(x, y, Tile.StoneFloor);
      }
    }
  };
  plaza(88, 80, 3.4);
  plaza(88, 62, 2.6);
  // Flowers still line the foot of each ridge, as if someone tends them.
  for (let x = 58; x <= 112; x++) for (const y of [69, 87]) if (m.get(x, y) === Tile.Grass && !P(x, y) && hash(x, y, 77) < 0.7) m.set(x, y, Tile.Flowers);
  // Rows of golden orchard trees on the upper and lower terraces, clear of the road.
  for (const y of [59, 63, 91, 95]) {
    for (let x = 60 + (y % 2 ? 0 : 2); x <= 110; x += 4) {
      if (m.get(x, y) === Tile.Grass && !P(x, y) && Math.abs(x - 85) > 3 && hash(x, y, 88) < 0.8) m.set(x, y, Tile.Tree);
    }
  }

  // --- Sunken Gardens ------------------------------------------------------------
  // Walled garden beds with gaps, pools and flower terraces.
  for (const [x0, y0, x1, y1] of [[22, 60, 40, 70], [20, 78, 38, 90]] as const) {
    for (let x = x0; x <= x1; x++) {
      for (const y of [y0, y1]) if ((x - x0) % 6 !== 3 && land(x, y) && !P(x, y)) m.set(x, y, Tile.RuinWall);
    }
    for (let y = y0; y <= y1; y++) {
      for (const x of [x0, x1]) if ((y - y0) % 5 !== 2 && land(x, y) && !P(x, y)) m.set(x, y, Tile.RuinWall);
    }
    for (let y = y0 + 2; y < y1 - 1; y++) for (let x = x0 + 2; x < x1 - 1; x++) if (land(x, y) && !P(x, y) && hash(x, y, 30) < 0.4) m.set(x, y, Tile.Flowers);
  }
  for (const [cx, cy, rx, ry] of [[30, 74, 4, 2], [18, 70, 2, 2], [40, 94, 3, 2]] as const) {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) if (Math.hypot((x - cx) / rx, (y - cy) / ry) <= 1 && !P(x, y)) m.set(x, y, Tile.Water);
  }

  // --- Stormveil Heights -------------------------------------------------------------
  for (let y = 18; y <= 46; y++) {
    for (let x = 47; x <= 123; x++) {
      if (!land(x, y) || P(x, y)) continue;
      const n = noise(x, y, 6, 40);
      if (n > 0.66) m.set(x, y, Tile.Rock);
      else if (n > 0.6 && hash(x, y, 41) < 0.35) m.set(x, y, Tile.Crystal);
      else if (n < 0.34) m.set(x, y, Tile.StoneFloor);
    }
  }
  // Keep a clear walk from the bridge across the heights, and the Colossus arena open.
  bridge(85, 45, 85, 20, 1, Tile.StoneFloor);
  bridge(85, 34, 60, 30, 1, Tile.StoneFloor);
  bridge(85, 30, 108, 26, 1, Tile.StoneFloor);
  for (let y = 16; y <= 36; y++) for (let x = 98; x <= 118; x++) if (land(x, y) && Math.hypot((x - 108) / 9, (y - 26) / 7) < 1) {
    m.set(x, y, Tile.StoneFloor);
    setP(x, y);
  }
  for (let y = 26; y <= 32; y++) for (let x = 62; x <= 70; x++) if (land(x, y)) {
    m.set(x, y, Tile.StoneFloor);
    setP(x, y);
  }

  // --- The Stormspire ------------------------------------------------------------------
  for (let y = 3; y <= 13; y++) for (let x = 76; x <= 94; x++) if (land(x, y) && !P(x, y)) m.set(x, y, Tile.StoneFloor);
  for (const [x, y] of [[79, 6], [91, 6], [79, 11], [91, 11]]) m.set(x, y, Tile.RuinWall);

  // --- Trees, flowers, tall grass on open grass ---------------------------------------------------
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (m.get(x, y) !== Tile.Grass || P(x, y)) continue;
      const r = hash(x, y, 50);
      const garden = x < 52;
      if (r < (garden ? 0.1 : 0.04) && noise(x, y, 7, 51) > (garden ? 0.5 : 0.62)) m.set(x, y, Tile.Tree);
      else if (r < 0.1) m.set(x, y, Tile.TallGrass);
      else if (r < 0.13) m.set(x, y, Tile.Flowers);
    }
  }
  // A screen of trees hides the aviary plank from the garden.
  for (const [x, y] of [[22, 58], [23, 58], [24, 58], [26, 58], [27, 58], [28, 57], [23, 56], [28, 55]]) if (m.get(x, y) === Tile.Grass) m.set(x, y, Tile.Tree);

  // --- Rim: grassy edges above the sky read as cliff lips -------------------------------------------
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = m.get(x, y);
      if (t !== Tile.Grass && t !== Tile.TallGrass && t !== Tile.Flowers) continue;
      if (m.get(x, y + 1) === Tile.Void || m.get(x - 1, y) === Tile.Void || m.get(x + 1, y) === Tile.Void || m.get(x, y - 1) === Tile.Void) m.set(x, y, Tile.Cliff);
    }
  }

  // --- Zones -----------------------------------------------------------------------------------
  m.zones.push({ id: "skyreach-isles", name: "Skyreach Isles", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [8, 10], music: "terraces" });
  m.zones.push({ id: "gilded-terraces", name: "Gilded Terraces", safe: false, x0: 40, y0: 50, x1: 130, y1: 102, level: [8, 9], music: "terraces" });
  m.zones.push({ id: "sunken-gardens", name: "Sunken Gardens", safe: false, x0: 8, y0: 50, x1: 52, y1: 100, level: [9, 10], music: "gardens" });
  m.zones.push({ id: "shattered-causeway", name: "Shattered Causeway", safe: false, x0: 130, y0: 34, x1: 170, y1: 90, level: [9, 11], music: "causeway" });
  m.zones.push({ id: "stormveil", name: "Stormveil Heights", safe: false, x0: 44, y0: 16, x1: 126, y1: 48, level: [10, 11], music: "storm" });
  m.zones.push({ id: "colossus-ring", name: "The Thunder Ring", safe: false, x0: 98, y0: 18, x1: 119, y1: 35, level: [11, 11], music: "storm" });
  m.zones.push({ id: "stormspire", name: "The Stormspire", safe: false, x0: 72, y0: 0, x1: 98, y1: 16, level: [11, 12], music: "storm" });
  m.zones.push({ id: "hidden-aviary", name: "The Hidden Aviary", safe: false, x0: 4, y0: 37, x1: 20, y1: 51, secret: true });
  m.zones.push({ id: "skyreach", name: "Skyreach Landing", safe: true, ...T, music: "skyreach" });

  // --- People ----------------------------------------------------------------------------------
  const npc = (id: string, name: string, role: "store" | "smith" | "storage" | "guild" | "inn" | "lore" | "merchant", tx: number, ty: number, look: { skin: string; cloth: string; trim: string; hair: string; helm?: "none" | "hood" | "cap" | "helm" | "crown" }, greeting: string, shop?: string) =>
    m.npcs.push({ id, name, role, x: px(tx), y: px(ty), look, greeting, shop });
  npc("herald", "Lumen, the Herald", "guild", 85, 115, { skin: "#f4e6c8", cloth: "#e8d8a8", trim: "#f0c860", hair: "#fff6d8", helm: "crown" },
    "You climbed. Few do. These are the Gilded Terraces — and the storm above them has a Keeper of its own.");
  npc("quarter", "Quartermaster Iven", "store", 71, 118, { skin: "#d9a77c", cloth: "#3f6a8a", trim: "#f0c860", hair: "#2b2b30", helm: "cap" },
    "Supplies are dear this high up. So is a good map.", "store2");
  npc("skysmith", "Brannoc the Skysmith", "smith", 100, 118, { skin: "#c98f65", cloth: "#5a3b2a", trim: "#c9d3dd", hair: "#d9d2c4" },
    "Gilded plate and stormglass. Bring me those and I'll make your steel sing louder than the wind.", "smith2");
  npc("vaultkeep", "Vaultkeeper Oda", "storage", 72, 125, { skin: "#e0b890", cloth: "#4a5a3a", trim: "#c9a24a", hair: "#8a3b2a" },
    "Your things are safe here, and in Emberwatch. The vaults are one and the same.");
  npc("windrest", "Hesta of the Windrest", "inn", 99, 127, { skin: "#a8744f", cloth: "#6b3f5a", trim: "#e8d8b0", hair: "#3b2a20" },
    "Sit down before the wind sits you down.");
  npc("gardener", "Maelis the Gardener", "lore", 80, 124, { skin: "#f1d0ae", cloth: "#4f7a3a", trim: "#d8b35a", hair: "#b8863b", helm: "hood" },
    "The Sunken Gardens were beautiful once. Now the Sentinels guard them from everyone.");
  npc("caravan", "Sella the Wanderer", "merchant", 86, 128, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" },
    "Up here too? The wind carries good trade.");

  // --- Places ----------------------------------------------------------------------------------
  const obj = (o: Omit<WorldObject, "x" | "y"> & { tx: number; ty: number }) => {
    const { tx, ty, ...rest } = o;
    m.objects.push({ ...rest, x: px(tx), y: px(ty) });
  };
  obj({ id: "descent", kind: "gate", tx: 85, ty: 130, name: "The Descent", text: "Light spills down the stairs toward Emberwatch.", dest: "world" });
  obj({ id: "ws-landing", kind: "waystone", tx: 90, ty: 119, name: "Skyreach Waystone" });
  obj({ id: "ws-terraces", kind: "waystone", tx: 88, ty: 80, name: "Terraces Waystone" });
  obj({ id: "ws-gardens", kind: "waystone", tx: 34, ty: 80, name: "Gardens Waystone" });
  obj({ id: "ws-causeway", kind: "waystone", tx: 150, ty: 72, name: "Causeway Waystone" });
  obj({ id: "ws-heights", kind: "waystone", tx: 80, ty: 38, name: "Heights Waystone" });
  obj({ id: "terrace-obelisk", kind: "lore", tx: 88, ty: 62, name: "Gilded Obelisk", text: "Names are carved up its sides — climbers who passed through. The newest are a hundred years old." });
  obj({ id: "causeway-ward", kind: "lore", tx: 160, ty: 55, name: "Causeway Ward", text: "A wardstone thrums as you touch it, and the broken stones around it settle. Something far above notices." });
  obj({ id: "storm-shrine", kind: "lore", tx: 66, ty: 28, name: "Shrine of the Storm", text: "Lightning has etched a single word into the stone: VAELRA. The air tastes of copper." });
  obj({ id: "aviary-nest", kind: "lore", tx: 11, ty: 42, name: "The Aviary", text: "Golden feathers, hundreds of them. Whatever nested here was large, and left in a hurry." });
  obj({ id: "aviary-chest", kind: "chest", tx: 13, ty: 45, name: "Gilded Chest", gold: 220, loot: [{ key: "mat_feather", qty: 5 }, { key: "charm_gale", rarity: 2 }] });
  obj({ id: "causeway-chest", kind: "chest", tx: 150, ty: 40, name: "Weathered Chest", gold: 120, loot: [{ key: "mat_stormglass", qty: 3 }, { key: "tonic", qty: 2 }] });
  obj({ id: "heights-chest", kind: "chest", tx: 114, ty: 30, name: "Storm-Scorched Chest", gold: 150, loot: [{ key: "mat_gilded", qty: 3 }] });
  obj({ id: "stormspire-door", kind: "door", tx: 85, ty: 5, name: "Stormspire Gate", requires: "key_stormspire", text: "A great door of stormglass. A seal-shaped hollow waits in its centre — the Colossus in the Thunder Ring wears the seal.", dest: "stormspire" });
  obj({ id: "sealed-stair", kind: "gate", tx: 92, ty: 9, name: "The Ember Stair", text: "Stairs climb through the clouds toward a sky the colour of embers.", dest: "floor3" });

  // --- Enemies ---------------------------------------------------------------------------------
  const spawn = (id: string, tx: number, ty: number, enemies: string[], level: number, radius = 48, respawn = 55, elite = 0.07) =>
    m.spawns.push({ id, x: px(tx), y: px(ty), radius, enemies, respawn, elite, level });
  spawn("t-lynx-a", 70, 82, ["skylynx", "skylynx", "skylynx"], 8, 56);
  spawn("t-lynx-b", 102, 80, ["skylynx", "skylynx"], 8);
  spawn("t-lynx-c", 64, 62, ["skylynx", "skylynx", "skylynx"], 9, 56);
  spawn("t-guard-a", 78, 60, ["skyguard"], 8);
  spawn("t-guard-b", 96, 70, ["skyguard", "skyguard"], 9);
  spawn("t-guard-c", 108, 64, ["skyguard", "skylynx"], 9);
  spawn("g-sentinel-a", 30, 64, ["sentinel"], 9, 30, 90);
  spawn("g-sentinel-b", 30, 85, ["sentinel"], 10, 30, 90);
  spawn("g-archers", 22, 78, ["windcaller", "windcaller"], 9);
  spawn("g-lynx", 40, 58, ["skylynx", "skylynx"], 9);
  spawn("c-aegis-a", 138, 82, ["aegis"], 9, 24);
  spawn("c-archer-a", 150, 67, ["windcaller", "windcaller"], 10, 30);
  spawn("c-aegis-b", 160, 57, ["aegis", "windcaller"], 10, 30);
  spawn("c-archer-b", 149, 43, ["windcaller", "aegis"], 11, 24);
  spawn("h-adepts-a", 72, 34, ["stormadept", "stormadept"], 10);
  spawn("h-adepts-b", 97, 38, ["stormadept", "skyguard"], 10);
  spawn("h-sentinel", 58, 28, ["sentinel"], 11, 30, 90);
  spawn("h-aegis", 92, 28, ["aegis", "stormadept"], 11);
  spawn("colossus", 108, 26, ["colossus"], 11, 10, 480, 0);
  spawn("s-guard", 85, 10, ["aegis", "stormadept", "skyguard"], 12, 40, 70, 0.2);

  m.spawn = { x: px(85), y: px(121) };
  m.npcs.push({ id: "board2", name: "Mission Board", role: "board", x: px(88), y: px(114), look: { skin: "#000", cloth: "#000", trim: "#000", hair: "#000" }, greeting: "Missions posted by the town. Each pays gold, experience and Marks — and goes back up on the board a while after it's done." });
  addInteriors(m, [
    {
      building: "skyhall",
      style: "library",
      add: [{ id: "archivist2", name: "Archivist Selune", role: "archivist", shop: "scrolls2", look: { skin: "#f4e6c8", cloth: "#3a5a8a", trim: "#f0c860", hair: "#fff6d8", helm: "hood" },
        greeting: "The Skyreach archive keeps the rarer arts — the ones climbers died learning. Marks and gold, climber. The board outside pays in Marks." }],
    },
    { building: "quarter", style: "shop", npcs: [{ id: "quarter" }] },
    { building: "skyforge", style: "smithy", npcs: [{ id: "skysmith" }] },
    { building: "skyvault", style: "vault", npcs: [{ id: "vaultkeep" }] },
    { building: "windrest", style: "inn", npcs: [{ id: "windrest" }] },
  ]);
  return m;
}
