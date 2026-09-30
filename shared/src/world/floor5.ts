import { addInteriors } from "./interiors.ts";
import { connectEverything, hash, isleBuilder, noise, px } from "./isles.ts";
import { Tile, WorldMap } from "./map.ts";

/** Duskhollow's lanterns: the town's safe rectangle. */
export const DUSKHOLLOW = { x0: 66, y0: 114, x1: 115, y1: 146 };

/**
 * Floor 5 — the Umbral Wilds: isles under a starless sky, where the sun has not risen in a
 * hundred years. Grass here is dusk-blue moss, water is black, the trees are twisted
 * shadow-oaks and the crystals are shards of a fallen moon (the renderer paints them so).
 *   Duskhollow (south, safe, lantern-lit) → the Gloaming (centre, a twilight forest) → the
 *   Weeping Marsh (west, with the hidden Moonwell beyond it), the Shattered Moon (east), the
 *   Night Spires (north, Nightwing's Perch) → the Abyssal Sanctum (the floor's dungeon).
 */
export function buildFloor5(): WorldMap {
  const W = 180;
  const H = 150;
  const m = new WorldMap(W, H);
  m.name = "Floor 5 — The Umbral Wilds";
  m.theme = "shadow";
  m.fill(0, 0, W, H, Tile.Void);
  const b = isleBuilder(m);

  // --- Islands ---------------------------------------------------------------------------
  b.island(90, 130, 26, 16, 71); // Duskhollow
  b.island(90, 88, 45, 22, 72); // the Gloaming
  b.island(30, 94, 21, 24, 73); // the Weeping Marsh
  b.island(12, 44, 8, 7, 74); // the Moonwell (secret)
  b.island(153, 86, 22, 24, 75); // the Shattered Moon
  b.island(90, 38, 44, 16, 76); // the Night Spires
  b.island(90, 11, 11, 7, 77); // the Abyssal Sanctum

  // --- Bridges (black stone) ------------------------------------------------------------
  b.bridge(90, 116, 90, 104, 2);
  b.bridge(47, 92, 53, 92, 1);
  b.bridge(133, 88, 139, 86, 1);
  b.bridge(90, 67, 90, 53, 2);
  b.bridge(90, 24, 90, 17, 2);
  // The Moonwell's way in: a span of old stone behind the marsh's northern willows.
  b.bridge(22, 72, 14, 52, 1, Tile.Path);

  // --- Duskhollow (town) ----------------------------------------------------------------
  const T = DUSKHOLLOW;
  b.protectRect(T);
  m.fill(77, 122, 104, 140, Tile.StoneFloor);
  b.house("chapel5", "The Lantern Chapel", 73, 118, 9, 4);
  b.house("quarter5", "The Nightmarket", 99, 118, 7, 4);
  b.house("forge5", "The Moonforge", 102, 126, 6, 4);
  b.house("vault5", "Umbral Vault", 74, 128, 5, 3);
  b.house("inn5", "The Last Lantern", 100, 134, 6, 4);
  // Lanterns everywhere: the town keeps the dark out with them.
  for (const [x, y] of [[80, 124], [100, 124], [80, 132], [96, 131], [84, 139], [96, 139], [88, 118], [92, 118]] as const) m.prop("lamp", x, y);
  m.prop("bench", 85, 134, 2, 1);
  m.prop("bench", 93, 134, 2, 1);
  m.prop("stall", 83, 126, 2, 1);
  m.prop("stall", 95, 126, 2, 1);
  m.prop("crates", 78, 135);
  m.prop("barrel", 78, 136);
  m.prop("sacks", 107, 131);
  m.prop("anvil", 104, 131);
  m.prop("rack", 108, 131);
  m.prop("well", 89, 129, 2, 2);

  // --- The Gloaming ---------------------------------------------------------------------
  b.bridge(90, 104, 90, 68, 1, Tile.Path);
  b.bridge(90, 92, 54, 92, 0, Tile.Path);
  b.bridge(90, 88, 132, 88, 0, Tile.Path);
  b.bridge(90, 80, 70, 72, 0, Tile.Path);
  b.bridge(90, 96, 112, 104, 0, Tile.Path);
  b.pool(70, 98, 4, 3, 81);
  b.pool(114, 78, 5, 3, 82);
  b.pool(104, 96, 3, 2, 83);
  // Shadow-oaks crowd the road; pale fungus glows between their roots.
  b.scatter(46, 66, 134, 110, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 84);
    return n > 0.6 && hash(x, y, 85) < 0.6 ? Tile.Tree : n < 0.26 && hash(x, y, 86) < 0.3 ? Tile.Flowers : undefined;
  });

  // --- The Weeping Marsh ----------------------------------------------------------------
  b.bridge(47, 92, 30, 92, 1, Tile.Path);
  b.bridge(30, 92, 30, 112, 1, Tile.Path);
  b.bridge(30, 92, 24, 74, 1, Tile.Path);
  b.bridge(30, 104, 44, 108, 0, Tile.Path);
  b.bridge(24, 74, 22, 72, 1, Tile.Path);
  // Black water everywhere, in pools between the reeds.
  b.scatter(9, 70, 51, 118, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 4, 87);
    return n > 0.6 ? Tile.Water : n > 0.5 ? Tile.TallGrass : n < 0.2 && hash(x, y, 88) < 0.45 ? Tile.Tree : undefined;
  });
  // Willows hide the old span to the Moonwell.
  for (const [x, y] of [[20, 70], [21, 69], [24, 70], [25, 71]] as const) if (b.open(x, y)) m.set(x, y, Tile.Tree);
  // The Moonwell: pale stone around a well of moonlight.
  b.scatter(4, 37, 20, 51, (x, y) => (Math.hypot(x - 12, y - 44) < 3 ? Tile.StoneFloor : hash(x, y, 89) < 0.1 ? Tile.Crystal : undefined));
  m.fill(11, 43, 13, 45, Tile.Water);

  // --- The Shattered Moon ---------------------------------------------------------------
  b.bridge(139, 86, 153, 86, 1, Tile.Path);
  b.bridge(153, 86, 153, 66, 1, Tile.Path);
  b.bridge(153, 86, 160, 104, 1, Tile.Path);
  b.bridge(153, 76, 168, 76, 1, Tile.Path);
  // Craters where pieces of the moon came down: bare stone, with the shard still in the middle.
  for (const [cx, cy, r] of [[144, 72, 5], [164, 90, 6], [146, 100, 4], [165, 70, 3]] as const) {
    b.scatter(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => {
      const d = Math.hypot(x - cx, (y - cy) * 1.2);
      return d < 1.4 ? Tile.Crystal : d < r ? Tile.StoneFloor : d < r + 1 && hash(x, y, 90) < 0.5 ? Tile.Rock : undefined;
    });
  }
  b.scatter(132, 60, 176, 110, (x, y, t) => (t === Tile.Grass && noise(x, y, 6, 91) > 0.72 ? (hash(x, y, 92) < 0.25 ? Tile.Crystal : Tile.Rock) : undefined));

  // --- The Night Spires -----------------------------------------------------------------
  b.bridge(90, 53, 90, 25, 1, Tile.StoneFloor);
  b.bridge(90, 40, 118, 36, 1, Tile.StoneFloor);
  b.bridge(90, 36, 66, 36, 1, Tile.StoneFloor);
  const CX = 60;
  const CY = 36;
  b.arena(CX, CY, 10, 8);
  // The spires themselves: black stone needles in clusters.
  b.scatter(46, 22, 134, 54, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 93);
    return n > 0.68 ? Tile.RuinWall : n > 0.6 && hash(x, y, 94) < 0.5 ? Tile.Rock : n < 0.28 ? Tile.StoneFloor : n < 0.34 && hash(x, y, 95) < 0.3 ? Tile.Crystal : undefined;
  });
  b.pool(112, 46, 3, 2, 96);
  b.pool(74, 48, 3, 2, 97);

  // --- The Abyssal Sanctum (approach) ---------------------------------------------------
  b.scatter(80, 5, 100, 17, () => Tile.StoneFloor);
  for (const [x, y] of [[83, 7], [97, 7], [83, 13], [97, 13]]) m.set(x, y, Tile.RuinWall);

  // --- Shadow-oaks and dusk grass, then the rim -----------------------------------------
  b.vegetate(0.05, 0.06, 98);
  b.rim();

  // --- Zones ----------------------------------------------------------------------------
  m.zones.push({ id: "umbral-wilds", name: "The Umbral Wilds", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [20, 22], music: "umbral", dark: 0.35 });
  m.zones.push({ id: "gloaming", name: "The Gloaming", safe: false, x0: 44, y0: 64, x1: 136, y1: 112, level: [20, 21], music: "umbral", dark: 0.55 });
  m.zones.push({ id: "weeping-marsh", name: "The Weeping Marsh", safe: false, x0: 7, y0: 68, x1: 50, y1: 120, level: [21, 22], music: "umbral", dark: 0.45 });
  m.zones.push({ id: "shattered-moon", name: "The Shattered Moon", safe: false, x0: 130, y0: 58, x1: 178, y1: 112, level: [21, 23], music: "umbral", dark: 0.3 });
  m.zones.push({ id: "night-spires", name: "The Night Spires", safe: false, x0: 44, y0: 21, x1: 136, y1: 56, level: [22, 23], music: "sanctum", dark: 0.45 });
  m.zones.push({ id: "wyrms-perch", name: "Nightwing's Perch", safe: false, x0: 47, y0: 26, x1: 73, y1: 46, level: [23, 23], music: "sanctum", dark: 0.45 });
  m.zones.push({ id: "abyssal-sanctum", name: "The Abyssal Sanctum", safe: false, x0: 76, y0: 0, x1: 104, y1: 20, level: [23, 24], music: "sanctum", dark: 0.5 });
  m.zones.push({ id: "moonwell", name: "The Moonwell", safe: false, x0: 0, y0: 34, x1: 22, y1: 54, secret: true });
  m.zones.push({ id: "duskhollow", name: "Duskhollow", safe: true, ...T, music: "duskhollow", dark: 0.25 });

  // --- People ---------------------------------------------------------------------------
  b.npc("warden5", "Lanternwarden Isolde", "guild", 90, 123, { skin: "#e8c8a8", cloth: "#2a2440", trim: "#e8c867", hair: "#d8d0e8", helm: "helm" },
    "Every lantern in Duskhollow is lit by hand, every night, because every night is the only kind we have. Welcome, climber. Keep close to the light.");
  b.npc("quarter5", "Corvin the Collector", "store", 102, 124, { skin: "#c9a07c", cloth: "#3a2a4a", trim: "#b77af2", hair: "#1e1a24", helm: "hood" },
    "Maps, tonics, shadowsilk. Everything here was carried out of the dark by someone braver than me.", "store5");
  b.npc("moonsmith", "Mira the Moonsmith", "smith", 105, 131, { skin: "#f1d0ae", cloth: "#2e2a3a", trim: "#e0c8ff", hair: "#e8e0f0" },
    "Umbral shards, shadowsilk, and a void heart if you're mad enough to take one. I forge them by moonlight — what's left of it.", "smith5");
  b.npc("vault5", "Vaultkeeper Nox", "storage", 76, 132, { skin: "#bfb4d4", cloth: "#2a2440", trim: "#c9a24a", hair: "#2b2b30" },
    "Your things are kept in the dark, where nobody thinks to look.");
  b.npc("innkeep5", "Widow Hester", "inn", 103, 139, { skin: "#d9a77c", cloth: "#4a2a3a", trim: "#e8d8b0", hair: "#9a9aa8" },
    "The lantern over the door has not gone out in forty years. Sit. Eat. Nobody sleeps well here, but everyone sleeps better with soup.");
  b.npc("oracle", "The Blind Oracle", "lore", 86, 131, { skin: "#e0d0c8", cloth: "#2a1e3a", trim: "#d8b8ff", hair: "#fff6f0", helm: "hood" },
    "I lost my eyes looking at the eclipse. I see more now. Ask, and I will tell you what the dark says.");
  b.npc("caravan5", "Sella the Wanderer", "merchant", 92, 137, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" },
    "No sun. No stars. No customers. You're the first face I've seen in a week that wasn't trying to eat me.");
  b.board("board5", 95, 123);

  // --- Places ---------------------------------------------------------------------------
  b.obj({ id: "descent5", kind: "gate", tx: 90, ty: 143, name: "The Descent", text: "Cold air and a little snow drift up the stairs from the Frostvale.", dest: "floor4" });
  b.obj({ id: "ws-duskhollow", kind: "waystone", tx: 96, ty: 128, name: "Duskhollow Waystone" });
  b.obj({ id: "ws-gloaming", kind: "waystone", tx: 93, ty: 88, name: "Gloaming Waystone" });
  b.obj({ id: "ws-marsh", kind: "waystone", tx: 33, ty: 92, name: "Marsh Waystone" });
  b.obj({ id: "ws-moon", kind: "waystone", tx: 156, ty: 86, name: "Moonfall Waystone" });
  b.obj({ id: "ws-spires", kind: "waystone", tx: 86, ty: 40, name: "Night Spires Waystone" });
  b.obj({ id: "hollow-oak", kind: "lore", tx: 86, ty: 76, name: "The Hollow Oak", text: "An oak hollowed by something that was not fire. The dark inside is thicker than it should be, and it is breathing, slowly, like something asleep." });
  b.obj({ id: "weeping-stone", kind: "lore", tx: 28, ty: 84, name: "The Weeping Stone", text: "A standing stone that weeps black water, drop by drop. The marsh folk say it has been crying for the sun since the day the Queen put it out." });
  b.obj({ id: "fallen-moon", kind: "lore", tx: 164, ty: 94, name: "The Fallen Moon", text: "A shard of the old moon, taller than a house, still faintly warm. Its pale face is covered in handprints. None of them are human." });
  b.obj({ id: "queens-edict", kind: "lore", tx: 100, ty: 30, name: "The Queen's Edict", text: "Carved into a spire in silver letters: THE SUN WAS A LIE YOU TOLD YOURSELVES. I HAVE ENDED IT. — N." });
  b.obj({ id: "moonwell-altar", kind: "lore", tx: 12, ty: 41, name: "The Moonwell", text: "A well of pure moonlight, the last on the floor. You drink, and for a moment you remember what the sky used to look like." });
  b.obj({ id: "moonwell-chest", kind: "chest", tx: 16, ty: 46, name: "Moonkeeper's Coffer", gold: 760, loot: [{ key: "mat_voidheart", qty: 2 }, { key: "mat_shadowsilk", qty: 4 }, { key: "charm_moonstone", rarity: 3 }] });
  b.obj({ id: "marsh-chest", kind: "chest", tx: 38, ty: 110, name: "Drowned Chest", gold: 300, loot: [{ key: "mat_umbralshard", qty: 4 }, { key: "tonic", qty: 2 }] });
  b.obj({ id: "crater-chest", kind: "chest", tx: 146, ty: 104, name: "Starfall Chest", gold: 320, loot: [{ key: "mat_shadowsilk", qty: 4 }, { key: "mat_umbralshard", qty: 2 }] });
  b.obj({ id: "sanctum-door", kind: "door", tx: 90, ty: 8, name: "The Sanctum Gate", requires: "key_sanctum", text: "A gate of black stone with a silver crescent at its heart. A sigil-shaped hollow waits in the crescent — Nightwing wears the sigil.", dest: "sanctum" });
  b.obj({ id: "sealed-stair6", kind: "gate", tx: 97, ty: 11, name: "The Starless Stair", text: "A stair of black glass rises into nothing at all. Floor 6 is not open to you yet.", dest: "floor6" });

  // --- Enemies --------------------------------------------------------------------------
  b.spawn("g-shade-a", 78, 96, ["shade", "shade"], 20, 50);
  b.spawn("g-shade-b", 104, 90, ["shade", "voidhound"], 20);
  b.spawn("g-hounds-a", 72, 82, ["voidhound", "voidhound", "voidhound"], 20, 56);
  b.spawn("g-hounds-b", 112, 100, ["voidhound", "voidhound"], 21);
  b.spawn("g-caller", 98, 74, ["voidcaller", "shade"], 21);
  b.spawn("g-knight", 120, 84, ["abyssalknight"], 21, 40, 80);
  b.spawn("m-caller-a", 18, 88, ["voidcaller", "voidcaller"], 21);
  b.spawn("m-caller-b", 40, 104, ["voidcaller", "shade"], 21);
  b.spawn("m-hounds", 36, 80, ["voidhound", "voidhound", "voidhound"], 21, 56);
  b.spawn("m-drake", 24, 110, ["umbraldrake"], 22, 30, 90);
  b.spawn("m-knight", 14, 100, ["abyssalknight", "shade"], 22);
  b.spawn("s-golem-a", 144, 76, ["voidgolem"], 22, 30, 90);
  b.spawn("s-golem-b", 162, 96, ["voidgolem", "voidcaller"], 22);
  b.spawn("s-knights", 148, 94, ["abyssalknight", "abyssalknight"], 22);
  b.spawn("s-hounds", 166, 80, ["voidhound", "voidhound", "voidhound"], 22, 56);
  b.spawn("n-drake-a", 110, 30, ["umbraldrake", "umbraldrake"], 23, 40, 100);
  b.spawn("n-golem", 104, 44, ["voidgolem", "abyssalknight"], 23);
  b.spawn("n-knights", 80, 30, ["abyssalknight", "voidcaller"], 23);
  b.spawn("n-shades", 124, 40, ["shade", "shade", "shade"], 23, 56);
  b.spawn("nightwing", CX, CY, ["nightwing"], 23, 10, 600, 0);
  b.spawn("t-guard", 90, 14, ["abyssalknight", "voidcaller", "voidgolem"], 24, 40, 80, 0.2);

  b.clearAroundEverything();
  m.spawn = { x: px(90), y: px(131) };
  connectEverything(m, { water: true, ruins: true });
  addInteriors(m, [
    {
      building: "chapel5",
      style: "library",
      npcs: [{ id: "oracle", at: [8, 2] }],
      add: [{ id: "archivist5", name: "Archivist Elowen", role: "archivist", shop: "scrolls5", at: [2, 2], look: { skin: "#e8d0c0", cloth: "#2a1e3a", trim: "#d8b8ff", hair: "#1e1a24", helm: "hood" },
        greeting: "The Chapel keeps what the dark taught us: curses, siphons, rifts — and the Queen's own eclipse, if anyone ever brings it back. Marks, climber. The dark doesn't take gold." }],
    },
    { building: "quarter5", style: "shop", npcs: [{ id: "quarter5" }] },
    { building: "forge5", style: "smithy", npcs: [{ id: "moonsmith" }] },
    { building: "vault5", style: "vault", npcs: [{ id: "vault5" }] },
    { building: "inn5", style: "inn", npcs: [{ id: "innkeep5" }] },
  ]);
  return m;
}
