import { addInteriors } from "./interiors.ts";
import { connectEverything, hash, isleBuilder, noise, px } from "./isles.ts";
import { Tile, WorldMap } from "./map.ts";

/** Rimeholt's walls: the town's safe rectangle. */
export const RIMEHOLT = { x0: 70, y0: 118, x1: 111, y1: 142 };

/**
 * Floor 4 — the Frostvale: snow-bound isles under a white sky. Grass here is snow, water is
 * ice, and the trees are pines (the renderer paints them so).
 *   Rimeholt (south, safe) → the Snowfields (centre) → the Frozen Lake (west, with a hidden
 *   hunters' cache), the Pinewood (east), the Glacier Peak (north, Glacierfang's ring)
 *   → the Glacier Throne (the floor's dungeon).
 */
export function buildFloor4(): WorldMap {
  const W = 180;
  const H = 150;
  const m = new WorldMap(W, H);
  m.name = "Floor 4 — The Frostvale";
  m.theme = "frost";
  m.fill(0, 0, W, H, Tile.Void);
  const b = isleBuilder(m);

  // --- Islands ---------------------------------------------------------------------------
  b.island(90, 130, 22, 13, 41); // Rimeholt
  b.island(90, 88, 46, 24, 42); // the Snowfields
  b.island(30, 84, 20, 25, 43); // the Frozen Lake
  b.island(9, 50, 7, 6, 44); // the Hunters' Cache (secret)
  b.island(152, 80, 21, 23, 45); // the Pinewood
  b.island(90, 38, 42, 15, 46); // the Glacier Peak
  b.island(90, 11, 11, 7, 47); // the Glacier Throne

  // --- Bridges (ice-bound stone) ----------------------------------------------------------
  b.bridge(101, 121, 101, 106, 2); // Rimeholt → snowfields (east of the Longhall)
  b.bridge(47, 88, 52, 88, 1);
  b.bridge(133, 86, 138, 84, 1);
  b.bridge(90, 65, 90, 52, 2);
  b.bridge(90, 24, 90, 17, 2);
  // The cache's way in: a span of old ice behind the lake's northern rocks.
  b.bridge(20, 62, 12, 54, 1, Tile.Path);

  // --- Rimeholt (town) ----------------------------------------------------------------------
  const T = RIMEHOLT;
  b.protectRect(T);
  m.fill(78, 123, 103, 137, Tile.StoneFloor);
  b.house("longhall", "Rimeholt Longhall", 84, 118, 10, 4);
  b.house("quarter4", "Outfitter", 72, 122, 6, 4);
  b.house("forge4", "The Runeforge", 103, 122, 6, 4);
  b.house("vault4", "Frost Vault", 73, 131, 5, 3);
  b.house("inn4", "The Frozen Flagon", 103, 131, 6, 4);
  for (const [x, y] of [[80, 125], [100, 125], [82, 136], [98, 136]] as const) m.prop("lamp", x, y);
  m.prop("bench", 86, 134, 2, 1);
  m.prop("bench", 93, 134, 2, 1);
  m.prop("logs", 79, 129, 2, 1);
  m.prop("anvil", 101, 127);
  m.prop("rack", 108, 127);
  m.prop("crates", 79, 128);
  m.prop("barrel", 78, 131);
  m.prop("sacks", 107, 136);
  m.prop("well", 89, 128, 2, 2);

  // --- The Snowfields ---------------------------------------------------------------------
  b.bridge(90, 109, 90, 66, 1, Tile.Path);
  b.bridge(101, 105, 91, 97, 1, Tile.Path);
  b.bridge(90, 90, 53, 88, 0, Tile.Path);
  b.bridge(90, 88, 132, 86, 0, Tile.Path);
  b.pool(66, 78, 5, 3, 51);
  b.pool(116, 98, 6, 3, 52);
  b.pool(106, 74, 3, 2, 53);
  b.scatter(46, 66, 134, 110, (x, y, t) => (t === Tile.Grass && noise(x, y, 7, 54) > 0.74 ? Tile.Rock : undefined));

  // --- The Frozen Lake ----------------------------------------------------------------------
  b.bridge(46, 88, 44, 84, 1, Tile.Path);
  // A lake of ice at the heart of the isle, with a path around its shore.
  for (let y = 60; y <= 108; y++) {
    for (let x = 10; x <= 50; x++) {
      if (!b.open(x, y)) continue;
      const d = Math.hypot((x - 30) / 11, (y - 84) / 13);
      if (d < 1 + (noise(x, y, 4, 55) - 0.5) * 0.25) m.set(x, y, Tile.Water);
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = Math.round(30 + Math.cos(a) * 14.5);
    const y = Math.round(84 + Math.sin(a) * 16.5);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (b.land(x + dx, y + dy)) m.set(x + dx, y + dy, Tile.Path);
  }
  b.bridge(30, 67, 20, 62, 1, Tile.Path);
  b.scatter(10, 60, 50, 108, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const d = Math.hypot((x - 30) / 20, (y - 84) / 25);
    return d > 0.75 && noise(x, y, 5, 56) > 0.5 ? Tile.Rock : undefined;
  });
  // Rocks hide the old ice bridge to the cache.
  for (const [x, y] of [[18, 64], [19, 65], [22, 63], [23, 64]] as const) if (b.open(x, y)) m.set(x, y, Tile.Rock);
  // The cache: frost crystals on bare ice.
  b.scatter(3, 45, 15, 56, (x, y) => (hash(x, y, 57) < 0.12 ? Tile.Crystal : undefined));

  // --- The Pinewood -------------------------------------------------------------------------
  b.bridge(138, 84, 152, 80, 1, Tile.Path);
  b.bridge(152, 80, 152, 62, 1, Tile.Path);
  b.bridge(152, 80, 160, 98, 1, Tile.Path);
  b.bridge(152, 72, 166, 70, 1, Tile.Path);
  b.scatter(132, 58, 174, 104, (x, y, t) => (t === Tile.Grass && noise(x, y, 4, 58) > 0.46 && hash(x, y, 59) < 0.7 ? Tile.Tree : undefined));

  // --- The Glacier Peak ---------------------------------------------------------------------
  b.bridge(90, 52, 90, 25, 1, Tile.StoneFloor);
  b.bridge(90, 40, 64, 36, 1, Tile.StoneFloor);
  b.bridge(90, 36, 112, 34, 1, Tile.StoneFloor);
  const CX = 118;
  const CY = 34;
  b.arena(CX, CY, 10, 8);
  b.scatter(48, 23, 132, 53, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 6, 61);
    return n > 0.7 ? Tile.Rock : n > 0.62 && hash(x, y, 62) < 0.5 ? Tile.Crystal : n < 0.3 ? Tile.StoneFloor : undefined;
  });
  b.pool(70, 30, 4, 2, 63);
  b.pool(104, 46, 3, 2, 64);

  // --- The Glacier Throne (approach) --------------------------------------------------------
  b.scatter(80, 5, 100, 17, () => Tile.StoneFloor);
  for (const [x, y] of [[83, 7], [97, 7], [83, 13], [97, 13]]) m.set(x, y, Tile.RuinWall);

  // --- Pines and snowdrifts, then the rim --------------------------------------------------
  b.vegetate(0.05, 0.05, 70);
  b.rim();

  // --- Zones --------------------------------------------------------------------------------
  m.zones.push({ id: "frostvale", name: "The Frostvale", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [16, 18], music: "frost" });
  m.zones.push({ id: "snowfields", name: "The Snowfields", safe: false, x0: 44, y0: 64, x1: 136, y1: 112, level: [16, 17], music: "frost" });
  m.zones.push({ id: "frozen-lake", name: "The Frozen Lake", safe: false, x0: 8, y0: 58, x1: 50, y1: 110, level: [17, 18], music: "frost" });
  m.zones.push({ id: "pinewood", name: "The Pinewood", safe: false, x0: 130, y0: 56, x1: 176, y1: 106, level: [17, 19], music: "frost" });
  m.zones.push({ id: "glacier-peak", name: "The Glacier Peak", safe: false, x0: 46, y0: 22, x1: 134, y1: 56, level: [18, 19], music: "glacier" });
  m.zones.push({ id: "whitefang-ring", name: "The White Ring", safe: false, x0: 106, y0: 25, x1: 131, y1: 44, level: [19, 19], music: "glacier" });
  m.zones.push({ id: "glacier-throne", name: "The Glacier Throne", safe: false, x0: 76, y0: 0, x1: 104, y1: 20, level: [19, 20], music: "glacier" });
  m.zones.push({ id: "hunters-cache", name: "The Hunters' Cache", safe: false, x0: 0, y0: 42, x1: 18, y1: 58, secret: true });
  m.zones.push({ id: "rimeholt", name: "Rimeholt", safe: true, ...T, music: "rimeholt" });

  // --- People -------------------------------------------------------------------------------
  b.npc("jarl", "Jarl Sigrun", "guild", 90, 124, { skin: "#e8c8a8", cloth: "#2e4a6a", trim: "#e8c867", hair: "#e8e0d0", helm: "helm" },
    "Rimeholt stands because we never stop watching the snow. Welcome, climber. Pick up a spear — or a shovel.");
  b.npc("quarter4", "Ottar the Outfitter", "store", 75, 127, { skin: "#d9a77c", cloth: "#5a4a3a", trim: "#c9d3dd", hair: "#8a6a4a", helm: "cap" },
    "Furs, ropes, maps. Up here, the wrong coat kills you before the wolves do.", "store4");
  b.npc("runesmith", "Halla the Runesmith", "smith", 106, 127, { skin: "#f1d0ae", cloth: "#3a4a5a", trim: "#8fd3ff", hair: "#e8e0d0" },
    "Rime shards, frost pelts, a glacial heart if you're lucky. Bring them and I'll carve the cold into your steel.", "smith4");
  b.npc("vault4", "Vaultkeeper Brynja", "storage", 76, 135, { skin: "#e0b890", cloth: "#4a5a6a", trim: "#c9a24a", hair: "#b8863b" },
    "Your things are safe here. Nothing thaws in the Frost Vault.");
  b.npc("innkeep4", "Old Magnus", "inn", 105, 136, { skin: "#c98f65", cloth: "#6b3a2a", trim: "#e8d8b0", hair: "#e8e0d0" },
    "Sit by the fire. Mead's warm, stew's warmer, and the stories are mostly true.");
  b.npc("seer", "Seer Ylva", "lore", 84, 132, { skin: "#f1d0ae", cloth: "#2a3a5a", trim: "#bfe6ff", hair: "#fff6d8", helm: "hood" },
    "The snow remembers everything that falls into it. Ask the right questions and it answers.");
  b.npc("caravan4", "Sella the Wanderer", "merchant", 92, 138, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" },
    "Snow! I hate snow. Buy something, so I can leave sooner.");
  b.board("board4", 94, 124);

  // --- Places -------------------------------------------------------------------------------
  b.obj({ id: "descent4", kind: "gate", tx: 90, ty: 140, name: "The Descent", text: "Warm air rises from the stairs down to the Ember Reaches.", dest: "floor3" });
  b.obj({ id: "ws-rimeholt", kind: "waystone", tx: 96, ty: 128, name: "Rimeholt Waystone" });
  b.obj({ id: "ws-snowfields", kind: "waystone", tx: 93, ty: 86, name: "Snowfields Waystone" });
  b.obj({ id: "ws-lake", kind: "waystone", tx: 44, ty: 84, name: "Lakeshore Waystone" });
  b.obj({ id: "ws-pinewood", kind: "waystone", tx: 155, ty: 80, name: "Pinewood Waystone" });
  b.obj({ id: "ws-peak", kind: "waystone", tx: 86, ty: 40, name: "Glacier Peak Waystone" });
  b.obj({ id: "frozen-knight", kind: "lore", tx: 87, ty: 76, name: "The Frozen Knight", text: "A knight in old Emberwatch plate, frozen solid mid-stride, sword still raised toward the peak. His eyes are open." });
  b.obj({ id: "lake-shrine", kind: "lore", tx: 30, ty: 67, name: "Shrine of the Still Water", text: "Offerings of fish bones and silver, frozen into the ice. Beneath the surface, something enormous turns over in its sleep." });
  b.obj({ id: "hunters-post", kind: "lore", tx: 158, ty: 88, name: "The Hunters' Post", text: "A notice nailed to a pine: YETIS SEEN NORTH OF THE CREEK. TRAVEL IN THREES. The rest has been clawed away." });
  b.obj({ id: "kings-oath", kind: "lore", tx: 102, ty: 32, name: "The King's Oath", text: "Carved into the glacier in letters as tall as a man: WINTER WAITS. WINTER WINS. — H." });
  b.obj({ id: "cache-sled", kind: "lore", tx: 8, ty: 49, name: "The Lost Sled", text: "A hunters' sled, its dogs long gone. Whatever they were hauling, they buried it here and never came back." });
  b.obj({ id: "cache-chest", kind: "chest", tx: 11, ty: 52, name: "Hunters' Cache", gold: 560, loot: [{ key: "mat_glacialheart", qty: 2 }, { key: "mat_frostpelt", qty: 4 }, { key: "charm_gale", rarity: 2 }] });
  b.obj({ id: "lake-chest", kind: "chest", tx: 36, ty: 102, name: "Ice-Locked Chest", gold: 240, loot: [{ key: "mat_rimeshard", qty: 4 }, { key: "tonic", qty: 2 }] });
  b.obj({ id: "pine-chest", kind: "chest", tx: 166, ty: 64, name: "Woodcutter's Chest", gold: 260, loot: [{ key: "mat_frostpelt", qty: 4 }] });
  b.obj({ id: "glacier-door", kind: "door", tx: 90, ty: 8, name: "The Glacier Gate", requires: "key_glacier", text: "A wall of blue ice, clear as glass, with a throne room dimly visible beyond. A seal-shaped hollow waits in it — Glacierfang wears the seal.", dest: "glacier" });
  b.obj({ id: "sealed-stair5", kind: "gate", tx: 97, ty: 11, name: "The Frozen Stair", text: "A stair of ice climbs into a darkening sky and stops. Floor 5 is not open to you yet.", dest: "floor5" });

  // --- Enemies ------------------------------------------------------------------------------
  b.spawn("s-wolf-a", 76, 98, ["rimewolf", "rimewolf", "rimewolf"], 16, 56);
  b.spawn("s-wolf-b", 108, 92, ["rimewolf", "rimewolf"], 16);
  b.spawn("s-yeti-a", 66, 86, ["yeti"], 17, 40, 80);
  b.spawn("s-yeti-b", 116, 82, ["yeti", "rimewolf"], 17);
  b.spawn("s-wraith", 84, 72, ["icewraith", "rimewolf"], 17);
  b.spawn("l-wraith-a", 16, 76, ["icewraith", "icewraith"], 17);
  b.spawn("l-wraith-b", 44, 96, ["icewraith"], 18);
  b.spawn("l-drake", 26, 104, ["frostdrake"], 18, 30, 90);
  b.spawn("l-wolves", 40, 70, ["rimewolf", "rimewolf", "rimewolf"], 17, 56);
  b.spawn("p-guard-a", 148, 70, ["rimeguard", "icewraith"], 18);
  b.spawn("p-guard-b", 160, 92, ["rimeguard", "rimeguard"], 18);
  b.spawn("p-yeti", 144, 96, ["yeti", "yeti"], 18, 50, 90);
  b.spawn("p-wolves", 164, 76, ["rimewolf", "rimewolf", "rimewolf"], 18, 56);
  b.spawn("h-golem-a", 70, 40, ["icegolem"], 19, 30, 90);
  b.spawn("h-golem-b", 100, 44, ["icegolem", "icewraith"], 19);
  b.spawn("h-drake", 64, 32, ["frostdrake", "frostdrake"], 19, 40, 100);
  b.spawn("h-guard", 80, 30, ["rimeguard", "rimeguard"], 19);
  b.spawn("glacierfang", CX, CY, ["glacierfang"], 19, 10, 600, 0);
  b.spawn("t-guard", 90, 14, ["rimeguard", "icewraith", "yeti"], 20, 40, 80, 0.2);

  b.clearAroundEverything();
  m.spawn = { x: px(90), y: px(131) };
  connectEverything(m);
  addInteriors(m, [
    {
      building: "longhall",
      style: "hall",
      npcs: [{ id: "seer", at: [10, 2] }],
      add: [{ id: "archivist4", name: "Archivist Tove", role: "archivist", shop: "scrolls4", at: [2, 2], look: { skin: "#f1d0ae", cloth: "#2a3a5a", trim: "#bfe6ff", hair: "#e8c867", helm: "hood" },
        greeting: "The Longhall keeps the arts of the cold: ice and hail and the Winter King's own. They cost Marks, climber, and they're worth it." }],
    },
    { building: "quarter4", style: "shop", npcs: [{ id: "quarter4" }] },
    { building: "forge4", style: "smithy", npcs: [{ id: "runesmith" }] },
    { building: "vault4", style: "vault", npcs: [{ id: "vault4" }] },
    { building: "inn4", style: "inn", npcs: [{ id: "innkeep4" }] },
  ]);
  return m;
}
