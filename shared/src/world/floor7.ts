import { addInteriors } from "./interiors.ts";
import { connectEverything, hash, isleBuilder, noise, px } from "./isles.ts";
import { Tile, WorldMap } from "./map.ts";

/** Gearhaven's streets: the town's safe rectangle. */
export const GEARHAVEN = { x0: 104, y0: 112, x1: 160, y1: 146 };

/**
 * Floor 7 — the Clockwork Heights: isles of brass and iron where the tower builds itself.
 * Grass here is dry and dusty, water is hot and steaming, the trees are brass, and the
 * crystals are great cogs half-sunk in the ground (the renderer paints them so).
 *   Gearhaven (south-east, safe) → the Foundry Yards (centre), the Scrap Wastes (south-west),
 *   the Steam Vents (west, with the hidden Tinker's Vault beyond), the Copper Orchard (east),
 *   the Sky Rails (north, the Gearwyrm's Roost) → the Great Engine (the floor's dungeon).
 */
export function buildFloor7(): WorldMap {
  const W = 180;
  const H = 150;
  const m = new WorldMap(W, H);
  m.name = "Floor 7 — The Clockwork Heights";
  m.theme = "brass";
  m.fill(0, 0, W, H, Tile.Void);
  const b = isleBuilder(m);

  // --- Islands ---------------------------------------------------------------------------
  b.island(132, 129, 27, 15, 131); // Gearhaven
  b.island(90, 88, 34, 20, 132); // the Foundry Yards
  b.island(48, 132, 24, 12, 133); // the Scrap Wastes
  b.island(32, 92, 21, 21, 134); // the Steam Vents
  b.island(10, 50, 7, 6, 135); // the Tinker's Vault (secret)
  b.island(155, 74, 20, 20, 136); // the Copper Orchard
  b.island(92, 38, 44, 14, 137); // the Sky Rails
  b.island(90, 11, 11, 7, 138); // the Great Engine

  // --- Bridges: iron girders over the drop ------------------------------------------------
  b.bridge(114, 116, 106, 104, 2, Tile.Cobble);
  b.bridge(146, 116, 152, 92, 1, Tile.Cobble);
  b.bridge(54, 92, 60, 90, 1, Tile.Cobble);
  b.bridge(70, 104, 58, 124, 1, Tile.Cobble);
  b.bridge(122, 84, 137, 80, 1, Tile.Cobble);
  b.bridge(90, 68, 90, 51, 2, Tile.Cobble);
  b.bridge(90, 24, 90, 17, 2, Tile.Cobble);
  // The Vault's way in: a rusted catwalk behind the vents' northern rocks.
  b.bridge(22, 74, 12, 54, 1, Tile.Cobble);

  // --- Gearhaven (town) -------------------------------------------------------------------
  const T = GEARHAVEN;
  b.protectRect(T);
  m.fill(114, 120, 152, 139, Tile.Cobble);
  b.house("hall7", "The Assembly", 124, 116, 10, 4);
  b.house("quarter7", "The Emporium", 111, 121, 6, 4);
  b.house("forge7", "The Gearworks", 144, 121, 6, 4);
  b.house("vault7", "The Locksmith's", 112, 131, 5, 3);
  b.house("inn7", "The Rusty Kettle", 142, 131, 7, 4);
  for (const [x, y] of [[119, 123], [139, 123], [119, 134], [139, 134], [129, 139]] as const) m.prop("lamp", x, y);
  m.prop("crates", 118, 129);
  m.prop("crates", 118, 130);
  m.prop("barrel", 140, 129);
  m.prop("sacks", 140, 130);
  m.prop("anvil", 147, 126);
  m.prop("rack", 150, 126);
  m.prop("cart", 124, 136, 2, 1);
  m.prop("stall", 126, 127, 2, 1);
  m.prop("stall", 131, 127, 2, 1);
  m.prop("well", 129, 131, 2, 2);

  // --- The Foundry Yards ------------------------------------------------------------------
  b.bridge(106, 104, 90, 90, 1, Tile.Cobble);
  b.bridge(90, 90, 90, 68, 1, Tile.Cobble);
  b.bridge(90, 88, 60, 90, 1, Tile.Cobble);
  b.bridge(90, 86, 122, 84, 1, Tile.Cobble);
  b.bridge(80, 96, 70, 104, 1, Tile.Cobble);
  // Plated yards: iron floor with furnaces (walls) and scrap.
  b.scatter(56, 68, 124, 108, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 6, 139);
    return n > 0.72 ? Tile.RuinWall : n > 0.64 && hash(x, y, 140) < 0.5 ? Tile.Rock : n < 0.45 ? Tile.StoneFloor : undefined;
  });
  for (const [cx, cy] of [[74, 78], [106, 96], [100, 74]] as const) b.scatter(cx - 2, cy - 2, cx + 2, cy + 2, (x, y) => (Math.abs(x - cx) < 2 && Math.abs(y - cy) < 2 ? Tile.RuinWall : Tile.Cobble));

  // --- The Scrap Wastes -------------------------------------------------------------------
  b.bridge(58, 124, 48, 132, 1, Tile.Path);
  b.bridge(48, 132, 30, 134, 1, Tile.Path);
  b.bridge(48, 132, 60, 140, 1, Tile.Path);
  b.scatter(24, 120, 72, 144, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 4, 141);
    return n > 0.66 ? (hash(x, y, 142) < 0.4 ? Tile.RuinWall : Tile.Rock) : n < 0.35 ? Tile.Sand : undefined;
  });

  // --- The Steam Vents --------------------------------------------------------------------
  b.bridge(54, 92, 32, 92, 1, Tile.Path);
  b.bridge(32, 92, 32, 112, 1, Tile.Path);
  b.bridge(32, 92, 24, 76, 1, Tile.Path);
  b.bridge(24, 76, 22, 74, 1, Tile.Path);
  // Hot springs, steaming, between black rock.
  b.scatter(11, 71, 53, 113, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 4, 143);
    return n > 0.64 ? Tile.Water : n > 0.55 ? Tile.Rock : n < 0.3 ? Tile.StoneFloor : undefined;
  });
  // Rocks hide the catwalk to the Vault.
  for (const [x, y] of [[20, 72], [21, 71], [24, 72], [25, 73]] as const) if (b.open(x, y)) m.set(x, y, Tile.Rock);
  // The Vault: a platform of iron plate strewn with cogs.
  b.scatter(3, 44, 17, 56, (x, y) => (hash(x, y, 144) < 0.1 ? Tile.Crystal : Tile.StoneFloor));

  // --- The Copper Orchard -----------------------------------------------------------------
  b.bridge(137, 80, 155, 74, 1, Tile.Path);
  b.bridge(155, 74, 155, 58, 1, Tile.Path);
  b.bridge(155, 74, 162, 90, 1, Tile.Path);
  b.bridge(155, 66, 168, 66, 1, Tile.Path);
  // Brass trees in rows, the way someone planted them.
  b.scatter(136, 55, 174, 94, (x, y, t) => (t === Tile.Grass && x % 4 === 0 && y % 3 === 0 && hash(x, y, 145) < 0.8 ? Tile.Tree : undefined));

  // --- The Sky Rails ----------------------------------------------------------------------
  b.bridge(90, 51, 90, 25, 1, Tile.Cobble);
  b.bridge(90, 38, 116, 36, 1, Tile.Cobble);
  b.bridge(90, 36, 60, 36, 1, Tile.Cobble);
  const CX = 122;
  const CY = 36;
  b.arena(CX, CY, 10, 8);
  // Rails: long iron tracks on sleepers running east–west.
  for (const y of [30, 44]) for (let x = 52; x < 132; x++) if (b.open(x, y)) m.set(x, y, Tile.Cobble);
  b.scatter(48, 24, 136, 52, (x, y, t) => {
    if (t !== Tile.Grass) return undefined;
    const n = noise(x, y, 5, 146);
    return n > 0.7 ? Tile.RuinWall : n > 0.62 && hash(x, y, 147) < 0.5 ? Tile.Crystal : n < 0.3 ? Tile.StoneFloor : undefined;
  });

  // --- The Great Engine (approach) --------------------------------------------------------
  b.scatter(80, 5, 100, 17, () => Tile.StoneFloor);
  for (const [x, y] of [[83, 7], [97, 7], [83, 13], [97, 13]]) m.set(x, y, Tile.RuinWall);

  // --- Brass trees and dry grass, then the rim --------------------------------------------
  b.vegetate(0.03, 0.05, 148);
  b.rim();

  // --- Zones ------------------------------------------------------------------------------
  m.zones.push({ id: "clockwork-heights", name: "The Clockwork Heights", safe: false, x0: 0, y0: 0, x1: W, y1: H, level: [28, 30], music: "brass" });
  m.zones.push({ id: "foundry-yards", name: "The Foundry Yards", safe: false, x0: 54, y0: 66, x1: 126, y1: 110, level: [28, 29], music: "brass" });
  m.zones.push({ id: "scrap-wastes", name: "The Scrap Wastes", safe: false, x0: 22, y0: 118, x1: 74, y1: 146, level: [28, 29], music: "brass" });
  m.zones.push({ id: "steam-vents", name: "The Steam Vents", safe: false, x0: 9, y0: 69, x1: 55, y1: 115, level: [29, 30], music: "brass" });
  m.zones.push({ id: "copper-orchard", name: "The Copper Orchard", safe: false, x0: 134, y0: 52, x1: 177, y1: 96, level: [30, 31], music: "brass" });
  m.zones.push({ id: "sky-rails", name: "The Sky Rails", safe: false, x0: 46, y0: 22, x1: 138, y1: 54, level: [30, 31], music: "engine" });
  m.zones.push({ id: "gearwyrm-roost", name: "The Gearwyrm's Roost", safe: false, x0: 110, y0: 26, x1: 135, y1: 46, level: [31, 31], music: "engine" });
  m.zones.push({ id: "great-engine", name: "The Great Engine", safe: false, x0: 76, y0: 0, x1: 104, y1: 20, level: [31, 32], music: "engine" });
  m.zones.push({ id: "tinkers-vault", name: "The Tinker's Vault", safe: false, x0: 0, y0: 42, x1: 20, y1: 58, secret: true });
  m.zones.push({ id: "gearhaven", name: "Gearhaven", safe: true, ...T, music: "gearhaven" });

  // --- People -----------------------------------------------------------------------------
  b.npc("engineer", "Chief Engineer Brask", "guild", 129, 124, { skin: "#c98f65", cloth: "#4a3a2a", trim: "#ffd070", hair: "#e8e0d0", helm: "cap" },
    "Gearhaven runs on steam, spit and stubbornness. Welcome, climber. Don't touch anything that's turning.");
  b.npc("quarter7", "Fennick the Merchant", "store", 114, 126, { skin: "#e0b890", cloth: "#5a3a4a", trim: "#ffd070", hair: "#8a6a4a" },
    "Tonics, blueprints, spare springs. I've got a bit of everything, and I'll tell you what it's for if you pay extra.", "store7");
  b.npc("gearwright", "Ada the Gearwright", "smith", 147, 126, { skin: "#f1d0ae", cloth: "#3a3a3a", trim: "#ff9a3a", hair: "#b8463b" },
    "Brass gears, mainsprings, and an aether core if you can pry one out of a golem. I'll build you something that ticks.", "smith7");
  b.npc("vault7", "Lockmaster Pim", "storage", 114, 135, { skin: "#d9a77c", cloth: "#2a3a4a", trim: "#c9a24a", hair: "#2b2b30" },
    "Forty-two locks, a clockwork dog and a trapdoor. Your things are safe. Mostly from you.");
  b.npc("innkeep7", "Grease-Hand Hilde", "inn", 145, 136, { skin: "#c98f65", cloth: "#6b4a2a", trim: "#e8d8b0", hair: "#e8c867" },
    "Sit down before you fall down. The kettle's always on, and it's always rusty.");
  b.npc("chronicler", "The Chronicler", "lore", 128, 131, { skin: "#c9a24a", cloth: "#5a4a3a", trim: "#ffd070", hair: "#c9a24a", helm: "helm" },
    "I RECORD. I HAVE RECORDED EVERY FLOOR SINCE THE FIRST GEAR TURNED. ASK, AND I WILL PLAY IT BACK.");
  b.npc("caravan7", "Sella the Wanderer", "merchant", 133, 137, { skin: "#c79a74", cloth: "#7a3a5a", trim: "#f0c860", hair: "#2b2b30", helm: "hood" },
    "Everything up here ticks. My cart ticks now. I don't know what I bought.");
  b.board("board7", 134, 124);

  // --- Places -----------------------------------------------------------------------------
  b.obj({ id: "descent7", kind: "gate", tx: 132, ty: 141, name: "The Descent", text: "Salt air and the sound of surf drift up the stairs from the Drowned Isles.", dest: "floor6" });
  b.obj({ id: "ws-gearhaven", kind: "waystone", tx: 136, ty: 131, name: "Gearhaven Waystone" });
  b.obj({ id: "ws-foundry", kind: "waystone", tx: 93, ty: 86, name: "Foundry Waystone" });
  b.obj({ id: "ws-vents", kind: "waystone", tx: 35, ty: 92, name: "Steam Vents Waystone" });
  b.obj({ id: "ws-orchard", kind: "waystone", tx: 158, ty: 74, name: "Orchard Waystone" });
  b.obj({ id: "ws-rails", kind: "waystone", tx: 86, ty: 40, name: "Sky Rails Waystone" });
  b.obj({ id: "first-gear", kind: "lore", tx: 86, ty: 80, name: "The First Gear", text: "A cog as tall as a house, half-buried and still turning, very slowly. A plaque reads: THE TOWER BUILDS ITSELF. WE ONLY OIL IT." });
  b.obj({ id: "pressure-gauge", kind: "lore", tx: 28, ty: 86, name: "The Great Gauge", text: "A pressure gauge the size of a wagon wheel, bolted to the rock. The needle is deep in the red, and has been for a hundred years." });
  b.obj({ id: "brass-tree", kind: "lore", tx: 162, ty: 70, name: "The Brass Tree", text: "Someone planted a tree made of brass, and it grew. Its leaves are thin gears; when the wind blows, the whole orchard ticks." });
  b.obj({ id: "scrap-grave", kind: "lore", tx: 40, ty: 138, name: "The Golem's Grave", text: "A steam golem lies in pieces under a cairn of scrap. Someone scratched on its chest: HE BUILT US. WE WILL BUILD HIM AGAIN." });
  b.obj({ id: "builders-plan", kind: "lore", tx: 104, ty: 32, name: "The Builder's Plan", text: "A blueprint etched into a steel plate: the whole tower, floor by floor, with a note at the very top in a tiny hand — AND THEN?" });
  b.obj({ id: "tinker-journal", kind: "lore", tx: 10, ty: 47, name: "The Tinker's Journal", text: "The last entry: \"The Archon asked me what it was for. I didn't have an answer. It went to find one.\"" });
  b.obj({ id: "vault-chest", kind: "chest", tx: 14, ty: 52, name: "The Tinker's Hoard", gold: 960, loot: [{ key: "mat_aethercore", qty: 2 }, { key: "mat_spring", qty: 4 }, { key: "charm_cog", rarity: 3 }] });
  b.obj({ id: "scrap-chest", kind: "chest", tx: 30, ty: 134, name: "Scrap Pile", gold: 380, loot: [{ key: "mat_brassgear", qty: 4 }, { key: "tonic", qty: 2 }] });
  b.obj({ id: "orchard-chest", kind: "chest", tx: 168, ty: 62, name: "Gardener's Toolbox", gold: 400, loot: [{ key: "mat_spring", qty: 4 }, { key: "mat_brassgear", qty: 2 }] });
  b.obj({ id: "engine-door", kind: "door", tx: 90, ty: 8, name: "The Engine Gate", requires: "key_engine", text: "A round door of riveted iron, with a great empty cog-socket at its centre. It will turn for the Gearwyrm's heart.", dest: "engine" });
  b.obj({ id: "sealed-stair8", kind: "gate", tx: 97, ty: 11, name: "The Endless Stair", text: "A stair of brass steps that build themselves one ahead of your foot. Floor 8 is not open to you yet.", dest: "floor8" });

  // --- Enemies ----------------------------------------------------------------------------
  b.spawn("f-hounds-a", 76, 94, ["clockhound", "clockhound", "clockhound"], 28, 56);
  b.spawn("f-soldiers", 104, 90, ["cogsoldier", "tinkerer"], 28);
  b.spawn("f-tinker", 96, 78, ["tinkerer", "clockhound"], 29);
  b.spawn("f-sentry", 70, 84, ["sentry"], 29, 30, 80);
  b.spawn("s-hounds", 40, 128, ["clockhound", "clockhound"], 28, 56);
  b.spawn("s-golem", 56, 138, ["steamgolem"], 29, 30, 90);
  b.spawn("s-soldiers", 34, 140, ["cogsoldier", "cogsoldier"], 29);
  b.spawn("v-tinkers", 20, 96, ["tinkerer", "tinkerer"], 29);
  b.spawn("v-golem", 40, 104, ["steamgolem", "sentry"], 30);
  b.spawn("v-drake", 26, 110, ["brassdrake"], 30, 30, 90);
  b.spawn("o-drakes", 150, 64, ["brassdrake", "brassdrake"], 31, 40, 100);
  b.spawn("o-hounds", 162, 84, ["clockhound", "clockhound", "clockhound"], 30, 56);
  b.spawn("o-sentries", 146, 84, ["sentry", "cogsoldier"], 30);
  b.spawn("r-golem", 104, 44, ["steamgolem", "cogsoldier"], 31);
  b.spawn("r-sentries", 70, 32, ["sentry", "sentry", "tinkerer"], 31);
  b.spawn("r-drake", 64, 44, ["brassdrake"], 31, 30, 90);
  b.spawn("gearwyrm", CX, CY, ["gearwyrm"], 31, 10, 600, 0);
  b.spawn("t-guard", 90, 14, ["cogsoldier", "sentry", "steamgolem"], 32, 40, 80, 0.2);

  b.clearAroundEverything();
  m.spawn = { x: px(129), y: px(130) };
  connectEverything(m, { water: true, ruins: true });
  addInteriors(m, [
    {
      building: "hall7",
      style: "library",
      npcs: [{ id: "chronicler", at: [8, 2] }],
      add: [{ id: "archivist7", name: "Archivist Gideon", role: "archivist", shop: "scrolls7", at: [2, 2], look: { skin: "#e0b890", cloth: "#3a2a1a", trim: "#ffd070", hair: "#8a8a8a", helm: "cap" },
        greeting: "The Assembly keeps the arts of the machine: shrapnel and steam, and the Archon's own fist, if anyone ever breaks it open. Marks, please. We don't take gears." }],
    },
    { building: "quarter7", style: "shop", npcs: [{ id: "quarter7" }] },
    { building: "forge7", style: "smithy", npcs: [{ id: "gearwright" }] },
    { building: "vault7", style: "vault", npcs: [{ id: "vault7" }] },
    { building: "inn7", style: "inn", npcs: [{ id: "innkeep7" }] },
  ]);
  return m;
}
