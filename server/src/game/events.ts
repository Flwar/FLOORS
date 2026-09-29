import { makeItem, rollRarity, TILE, randomScroll, itemBase, floorOfRoom } from "@floors/shared";
import type { WorldRoom } from "../rooms/WorldRoom.ts";
import type { EnemyData } from "./sim.ts";

export interface EventDef {
  id: string;
  name: string;
  announce: string;
  durationMs: number;
  /** Tile position of the event. */
  where: () => { x: number; y: number };
  enemies?: { key: string; elite?: boolean; level: number; hpScale?: number }[];
  reward: { xp: number; gold: number; loot?: boolean };
  /** Item keys a participant may win (defaults to Floor 1 gear). */
  lootPool?: string[];
}

export const FLOOR1_EVENTS: EventDef[] = [
  {
    id: "frenzy",
    name: "Frenzied Pack",
    announce: "Howls echo across the Green Fields — a frenzied pack is on the hunt!",
    durationMs: 5 * 60_000,
    where: () => [{ x: 88, y: 60 }, { x: 100, y: 88 }, { x: 72, y: 70 }][Math.floor(Math.random() * 3)],
    enemies: [{ key: "alpha", level: 3 }, { key: "wolf", level: 2 }, { key: "wolf", level: 2 }, { key: "wolf", level: 2 }, { key: "wolf", level: 2 }],
    reward: { xp: 120, gold: 40 },
  },
  {
    id: "raid",
    name: "Bandit Raid",
    announce: "Bandits are raiding the farms outside Emberwatch's east gate!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 72, y: 90 }),
    enemies: [
      { key: "shieldbearer", level: 3 }, { key: "cutpurse", level: 3 }, { key: "cutpurse", level: 3 },
      { key: "archer", level: 3 }, { key: "archer", level: 3 }, { key: "shieldbearer", level: 3, elite: true },
    ],
    reward: { xp: 180, gold: 70, loot: true },
  },
  {
    id: "greyback",
    name: "Old Greyback",
    announce: "Old Greyback, the scarred alpha, has been sighted in the Green Fields!",
    durationMs: 6 * 60_000,
    where: () => [{ x: 110, y: 64 }, { x: 80, y: 100 }][Math.floor(Math.random() * 2)],
    enemies: [{ key: "alpha", level: 5, elite: true, hpScale: 1.6 }, { key: "wolf", level: 3 }, { key: "wolf", level: 3 }],
    reward: { xp: 260, gold: 90, loot: true },
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "A travelling merchant has set up in the Emberwatch plaza — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 42, y: 80 }),
    reward: { xp: 0, gold: 0 },
  },
];

/** Floor 2: storms, a great pride, and the wandering merchant. */
export const FLOOR2_EVENTS: EventDef[] = [
  {
    id: "stormfront",
    name: "Stormfront",
    announce: "A stormfront breaks over the Gilded Terraces — storm adepts ride the lightning down!",
    durationMs: 5 * 60_000,
    where: () => [{ x: 80, y: 74 }, { x: 96, y: 62 }][Math.floor(Math.random() * 2)],
    enemies: [
      { key: "stormadept", level: 9 }, { key: "stormadept", level: 9 }, { key: "stormadept", level: 9 },
      { key: "skyguard", level: 9 }, { key: "skyguard", level: 9 }, { key: "sentinel", level: 10, elite: true },
    ],
    reward: { xp: 450, gold: 160, loot: true },
    lootPool: ["mat_stormglass", "mat_gilded", "charm_gale", "sword_knight", "helm_greathelm", "armor_brigandine"],
  },
  {
    id: "pride",
    name: "The Golden Pride",
    announce: "A great sky-lynx pride is hunting the western terraces!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 62, y: 76 }),
    enemies: [
      { key: "skylynx", level: 9 }, { key: "skylynx", level: 9 }, { key: "skylynx", level: 9 }, { key: "skylynx", level: 9 },
      { key: "skylynx", level: 10, elite: true, hpScale: 1.5 },
    ],
    reward: { xp: 380, gold: 130, loot: true },
    lootPool: ["mat_feather", "mat_pelt", "charm_wolf", "daggers_night", "spear_glaive"],
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "Sella the Wanderer has set up at Skyreach Landing — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 86, y: 127 }),
    reward: { xp: 0, gold: 0 },
  },
];

/** Floor 3: dragons on the wing, the caldera stirring, and the wandering merchant. */
export const FLOOR3_EVENTS: EventDef[] = [
  {
    id: "dragonraid",
    name: "Dragon Raid",
    announce: "Drakes are diving on the Ashen Slopes — a raiding flight, and something bigger leads it!",
    durationMs: 6 * 60_000,
    where: () => [{ x: 80, y: 96 }, { x: 104, y: 84 }][Math.floor(Math.random() * 2)],
    enemies: [
      { key: "drake", level: 13 }, { key: "drake", level: 13 }, { key: "ashling", level: 13 }, { key: "ashling", level: 13 },
      { key: "drake", level: 14, elite: true, hpScale: 1.7 },
    ],
    reward: { xp: 900, gold: 260, loot: true },
    lootPool: ["mat_dragonscale", "mat_emberheart", "helm_dragon", "armor_drakehide", "daggers_dragon", "spear_dragon"],
  },
  {
    id: "eruption",
    name: "The Caldera Wakes",
    announce: "The ground splits on the Caldera Heights — obsidian golems climb out of the magma!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 80, y: 42 }),
    enemies: [
      { key: "obsidian", level: 14 }, { key: "obsidian", level: 14 }, { key: "flamecaller", level: 14 }, { key: "flamecaller", level: 14 },
      { key: "emberguard", level: 15, elite: true },
    ],
    reward: { xp: 1000, gold: 300, loot: true },
    lootPool: ["mat_cinder", "mat_emberheart", "armor_emberweave", "staff_dragon", "sword_dragon", "greatsword_dragon"],
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "Sella the Wanderer has braved the heat to set up in Emberhold — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 92, y: 138 }),
    reward: { xp: 0, gold: 0 },
  },
];

/** Floor 4: the wolves' winter hunt, the white storm, and the wandering merchant. */
export const FLOOR4_EVENTS: EventDef[] = [
  {
    id: "wintermoon",
    name: "The Winter Moon Hunt",
    announce: "A winter moon rises over the Snowfields — the rime wolves run in a great pack tonight!",
    durationMs: 6 * 60_000,
    where: () => [{ x: 78, y: 96 }, { x: 108, y: 84 }][Math.floor(Math.random() * 2)],
    enemies: [
      { key: "rimewolf", level: 17 }, { key: "rimewolf", level: 17 }, { key: "rimewolf", level: 17 }, { key: "rimewolf", level: 17 },
      { key: "rimewolf", level: 18, elite: true, hpScale: 1.8 }, { key: "yeti", level: 17 },
    ],
    reward: { xp: 1500, gold: 380, loot: true },
    lootPool: ["mat_frostpelt", "mat_glacialheart", "helm_furhood", "armor_furmantle", "daggers_rime", "spear_rime"],
  },
  {
    id: "whitestorm",
    name: "The White Storm",
    announce: "A white storm rolls off the Glacier Peak — ice golems and wraiths walk inside it!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 82, y: 42 }),
    enemies: [
      { key: "icegolem", level: 18 }, { key: "icegolem", level: 18 }, { key: "icewraith", level: 18 }, { key: "icewraith", level: 18 },
      { key: "rimeguard", level: 19, elite: true },
    ],
    reward: { xp: 1700, gold: 420, loot: true },
    lootPool: ["mat_rimeshard", "mat_glacialheart", "armor_frostweave", "staff_rime", "sword_rime", "greatsword_rime"],
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "Sella the Wanderer has stamped the snow off her boots in Rimeholt — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 92, y: 138 }),
    reward: { xp: 0, gold: 0 },
  },
];

/** Floor 5: the blood moon, the eclipse tide, and the wandering merchant. */
export const FLOOR5_EVENTS: EventDef[] = [
  {
    id: "bloodmoon",
    name: "The Blood Moon",
    announce: "A red moon shows through the dark over the Gloaming — the void hounds run mad beneath it!",
    durationMs: 6 * 60_000,
    where: () => [{ x: 76, y: 90 }, { x: 108, y: 96 }][Math.floor(Math.random() * 2)],
    enemies: [
      { key: "voidhound", level: 21 }, { key: "voidhound", level: 21 }, { key: "voidhound", level: 21 }, { key: "voidhound", level: 21 },
      { key: "voidhound", level: 22, elite: true, hpScale: 1.8 }, { key: "shade", level: 21 },
    ],
    reward: { xp: 2200, gold: 480, loot: true },
    lootPool: ["mat_shadowsilk", "mat_voidheart", "helm_shadowveil", "armor_shadowsilk", "daggers_void", "spear_void"],
  },
  {
    id: "eclipsetide",
    name: "The Eclipse Tide",
    announce: "The void spills over the Shattered Moon — golems and knights march out of the craters!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 152, y: 84 }),
    enemies: [
      { key: "voidgolem", level: 22 }, { key: "voidgolem", level: 22 }, { key: "voidcaller", level: 22 }, { key: "voidcaller", level: 22 },
      { key: "abyssalknight", level: 23, elite: true },
    ],
    reward: { xp: 2500, gold: 540, loot: true },
    lootPool: ["mat_umbralshard", "mat_voidheart", "armor_voidweave", "staff_void", "sword_void", "greatsword_void"],
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "Sella the Wanderer has lit a lantern in Duskhollow — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 92, y: 137 }),
    reward: { xp: 0, gold: 0 },
  },
];

/** Floor 6: the spring tide, the wreckers, and the wandering merchant. */
export const FLOOR6_EVENTS: EventDef[] = [
  {
    id: "springtide",
    name: "The Spring Tide",
    announce: "The spring tide is in over the Tidepools — the brinehounds run with it!",
    durationMs: 6 * 60_000,
    where: () => [{ x: 120, y: 126 }, { x: 138, y: 120 }][Math.floor(Math.random() * 2)],
    enemies: [
      { key: "brinehound", level: 25 }, { key: "brinehound", level: 25 }, { key: "brinehound", level: 25 }, { key: "brinehound", level: 25 },
      { key: "brinehound", level: 26, elite: true, hpScale: 1.8 }, { key: "siren", level: 25 },
    ],
    reward: { xp: 2800, gold: 560, loot: true },
    lootPool: ["mat_brinepearl", "mat_leviathanscale", "helm_divers", "armor_sharkskin", "daggers_tide", "spear_tide"],
  },
  {
    id: "wreckers",
    name: "The Wreckers",
    announce: "Lights on the Wreck Coast — the drowned crews are coming ashore to loot their own ships!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 154, y: 80 }),
    enemies: [
      { key: "drowned", level: 26 }, { key: "drowned", level: 26 }, { key: "drowned", level: 26 }, { key: "merrowguard", level: 26 },
      { key: "coralgolem", level: 27, elite: true },
    ],
    reward: { xp: 3100, gold: 620, loot: true },
    lootPool: ["mat_coral", "mat_leviathanscale", "armor_seasilk", "staff_tide", "sword_tide", "greatsword_tide"],
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "Sella the Wanderer has tied up at Saltmere's pier — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 47, y: 137 }),
    reward: { xp: 0, gold: 0 },
  },
];

/** Floor 7: the runaway line, the boiler storm, and the wandering merchant. */
export const FLOOR7_EVENTS: EventDef[] = [
  {
    id: "runaway",
    name: "The Runaway Line",
    announce: "The Foundry's line has jammed open — clockhounds are pouring out of the yards!",
    durationMs: 6 * 60_000,
    where: () => [{ x: 80, y: 92 }, { x: 102, y: 84 }][Math.floor(Math.random() * 2)],
    enemies: [
      { key: "clockhound", level: 29 }, { key: "clockhound", level: 29 }, { key: "clockhound", level: 29 }, { key: "clockhound", level: 29 },
      { key: "clockhound", level: 30, elite: true, hpScale: 1.8 }, { key: "tinkerer", level: 29 },
    ],
    reward: { xp: 3400, gold: 640, loot: true },
    lootPool: ["mat_spring", "mat_aethercore", "helm_goggles", "armor_tinker", "daggers_brass", "spear_brass"],
  },
  {
    id: "boilerstorm",
    name: "The Boiler Storm",
    announce: "The Steam Vents are overpressured — golems and soldiers march out of the fog!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 34, y: 96 }),
    enemies: [
      { key: "steamgolem", level: 30 }, { key: "steamgolem", level: 30 }, { key: "cogsoldier", level: 30 }, { key: "sentry", level: 30 },
      { key: "cogsoldier", level: 31, elite: true },
    ],
    reward: { xp: 3800, gold: 700, loot: true },
    lootPool: ["mat_brassgear", "mat_aethercore", "armor_aether", "staff_brass", "sword_brass", "greatsword_brass"],
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "Sella the Wanderer has parked her ticking cart in Gearhaven — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 133, y: 137 }),
    reward: { xp: 0, gold: 0 },
  },
];

/** Each floor's world events. */
/** Floor 8: the great sandstorm, the tombs opening, and the wandering merchant. */
export const FLOOR8_EVENTS: EventDef[] = [
  {
    id: "sandstorm",
    name: "The Great Sandstorm",
    announce: "A wall of sand is rolling across the Dune Sea — and things are walking inside it!",
    durationMs: 6 * 60_000,
    where: () => [{ x: 80, y: 92 }, { x: 102, y: 84 }][Math.floor(Math.random() * 2)],
    enemies: [
      { key: "sandwraith", level: 33 }, { key: "sandwraith", level: 33 }, { key: "sandjackal", level: 33 }, { key: "sandjackal", level: 33 },
      { key: "sandwraith", level: 34, elite: true, hpScale: 1.8 }, { key: "sunpriest", level: 33 },
    ],
    reward: { xp: 3800, gold: 700, loot: true },
    lootPool: ["mat_scarab", "mat_solarheart", "helm_veil", "armor_nomad", "daggers_solar", "spear_solar"],
  },
  {
    id: "tombs",
    name: "The Tombs Open",
    announce: "The Colossus's tombs have cracked open — the guardians are marching on the sands!",
    durationMs: 5 * 60_000,
    where: () => ({ x: 152, y: 86 }),
    enemies: [
      { key: "tombguard", level: 34 }, { key: "tombguard", level: 34 }, { key: "sandgolem", level: 34 }, { key: "sunpriest", level: 34 },
      { key: "tombguard", level: 35, elite: true },
    ],
    reward: { xp: 4200, gold: 780, loot: true },
    lootPool: ["mat_sunstone", "mat_solarheart", "armor_sunweave", "staff_solar", "sword_solar", "greatsword_solar"],
  },
  {
    id: "merchant",
    name: "Travelling Merchant",
    announce: "Sella the Wanderer has pitched her tent by the well in Sunwell — rare wares, for a while.",
    durationMs: 6 * 60_000,
    where: () => ({ x: 93, y: 137 }),
    reward: { xp: 0, gold: 0 },
  },
];

export const FLOOR_EVENTS: Record<number, EventDef[]> = { 1: FLOOR1_EVENTS, 2: FLOOR2_EVENTS, 3: FLOOR3_EVENTS, 4: FLOOR4_EVENTS, 5: FLOOR5_EVENTS, 6: FLOOR6_EVENTS, 7: FLOOR7_EVENTS, 8: FLOOR8_EVENTS };

/** Periodic world events: announced to everyone, rewarding everyone who takes part. */
export class WorldEvents {
  private active?: { def: EventDef; until: number; enemies: Set<string>; contributors: Set<string> };
  private nextAt: number;
  merchantStock: { key: string; rarity: number; price: number }[] = [];

  constructor(private room: WorldRoom, private defs: EventDef[] = FLOOR1_EVENTS) {
    this.nextAt = 3 * 60_000;
  }

  update(now: number) {
    const a = this.active;
    if (a) {
      if (now > a.until) this.finish(false);
      return;
    }
    if (now >= this.nextAt && this.room.state.players.size > 0) {
      this.start(this.defs[Math.floor(Math.random() * this.defs.length)].id);
    }
  }

  start(id: string) {
    const def = this.defs.find((e) => e.id === id);
    if (!def || this.active) return;
    const now = this.room.sim.now;
    const at = def.where();
    const wx = at.x * TILE + TILE / 2;
    const wy = at.y * TILE + TILE / 2;
    const enemies = new Set<string>();
    for (const [i, e] of (def.enemies ?? []).entries()) {
      const a = (i / Math.max(1, def.enemies!.length)) * Math.PI * 2;
      const ed = this.room.sim.spawnEnemy(e.key, wx + Math.cos(a) * 40, wy + Math.sin(a) * 30, { level: e.level, elite: e.elite, hpScale: e.hpScale });
      ed.homeX = wx;
      ed.homeY = wy;
      enemies.add(ed.id);
    }
    if (def.id === "merchant") {
      this.merchantStock = [
        { key: "charm_duelist", rarity: 2, price: 320 },
        { key: "charm_feather", rarity: 2, price: 300 },
        { key: "charm_gale", rarity: rollRarity(0.5, 2), price: 360 },
        { key: ["sword_iron", "daggers_stalker", "spear_iron", "staff_ember", "greatsword_bandit"][Math.floor(Math.random() * 5)], rarity: rollRarity(0.7, 2), price: 420 },
        { key: ["armor_ranger", "armor_robes", "helm_horned"][Math.floor(Math.random() * 3)], rarity: rollRarity(0.7, 2), price: 380 },
      ];
      // The caravan sometimes carries a skill scroll, for gold alone (no Marks) — at a price.
      const scroll = Math.random() < 0.6 ? randomScroll(Math.random() < 0.25 ? 2 : 1, Math.random, floorOfRoom(this.room.kind)?.n ?? 1) : undefined;
      if (scroll) this.merchantStock.push({ key: scroll, rarity: itemBase(scroll)?.rarity ?? 1, price: itemBase(scroll)?.rarity === 2 ? 1500 : 600 });
    }
    this.active = { def, until: now + def.durationMs, enemies, contributors: new Set() };
    const st = this.room.state;
    st.event = def.id;
    st.eventName = def.name;
    st.eventUntil = now + def.durationMs;
    st.eventX = wx;
    st.eventY = wy;
    this.room.broadcast("event", { id: def.id, name: def.name, text: def.announce, x: wx, y: wy });
  }

  /** Track who fought in the event (anyone who hit an event enemy). */
  onKill(ed: EnemyData) {
    const a = this.active;
    if (!a || !a.enemies.has(ed.id)) return;
    for (const sid of ed.contrib.keys()) a.contributors.add(sid);
  }

  onRemoved(ed: EnemyData) {
    const a = this.active;
    if (!a || !a.enemies.delete(ed.id)) return;
    if (a.enemies.size === 0 && a.def.enemies?.length) this.finish(true);
  }

  private finish(success: boolean) {
    const a = this.active;
    if (!a) return;
    this.active = undefined;
    this.nextAt = this.room.sim.now + (7 + Math.random() * 4) * 60_000;
    for (const id of a.enemies) this.room.sim.removeEnemy(id);
    const st = this.room.state;
    st.event = "";
    st.eventName = "";
    st.eventUntil = 0;
    if (!success) {
      if (a.def.id !== "merchant") this.room.broadcast("event", { id: a.def.id, name: a.def.name, text: `${a.def.name} has ended.`, ended: true });
      else this.room.broadcast("event", { id: a.def.id, name: a.def.name, text: "The travelling merchant packs up and moves on.", ended: true });
      return;
    }
    this.room.broadcast("event", { id: a.def.id, name: a.def.name, text: `${a.def.name} has been defeated!`, ended: true, success: true });
    for (const sid of a.contributors) {
      const ch = this.room.chars.get(sid);
      if (!ch) continue;
      ch.addXp(a.def.reward.xp);
      ch.data.gold += a.def.reward.gold;
      if (a.def.reward.loot) {
        const pool = a.def.lootPool ?? ["charm_amber", "charm_wolf", "armor_chain", "armor_ranger", "helm_iron", "helm_horned", "sword_iron"];
        const it = makeItem(pool[Math.floor(Math.random() * pool.length)], rollRarity(0.6, 1));
        if (!ch.addItem(it)) ch.data.bank[ch.data.bank.indexOf(null)] = it;
        this.room.clients.getById(sid)?.send("looted", { key: it.key, rarity: it.rarity, qty: 1 });
      }
      ch.dirty = true;
      this.room.clients.getById(sid)?.send("xp", { amount: a.def.reward.xp, event: a.def.name });
    }
  }

  /** Dev/test: end whatever event is running. */
  stop() {
    if (this.active) this.finish(false);
  }

  get merchantActive() {
    return this.active?.def.id === "merchant";
  }
}
