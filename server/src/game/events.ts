import { makeItem, rollRarity, TILE } from "@floors/shared";
import type { WorldRoom } from "../rooms/WorldRoom.ts";
import type { EnemyData } from "./sim.ts";

interface EventDef {
  id: string;
  name: string;
  announce: string;
  durationMs: number;
  /** Tile position of the event. */
  where: () => { x: number; y: number };
  enemies?: { key: string; elite?: boolean; level: number; hpScale?: number }[];
  reward: { xp: number; gold: number; loot?: boolean };
}

const EVENTS: EventDef[] = [
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

/** Periodic world events: announced to everyone, rewarding everyone who takes part. */
export class WorldEvents {
  private active?: { def: EventDef; until: number; enemies: Set<string>; contributors: Set<string> };
  private nextAt: number;
  merchantStock: { key: string; rarity: number; price: number }[] = [];

  constructor(private room: WorldRoom) {
    this.nextAt = 3 * 60_000;
  }

  update(now: number) {
    const a = this.active;
    if (a) {
      if (now > a.until) this.finish(false);
      return;
    }
    if (now >= this.nextAt && this.room.state.players.size > 0) {
      this.start(EVENTS[Math.floor(Math.random() * EVENTS.length)].id);
    }
  }

  start(id: string) {
    const def = EVENTS.find((e) => e.id === id);
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
        { key: "charm_gale", rarity: rollRarity(1, 2), price: 360 },
        { key: ["sword_iron", "daggers_stalker", "spear_iron", "staff_ember", "greatsword_bandit"][Math.floor(Math.random() * 5)], rarity: rollRarity(1.5, 2), price: 420 },
        { key: ["armor_ranger", "armor_robes", "helm_horned"][Math.floor(Math.random() * 3)], rarity: rollRarity(1.5, 2), price: 380 },
      ];
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
        const pool = ["charm_amber", "charm_wolf", "armor_chain", "armor_ranger", "helm_iron", "helm_horned", "sword_iron"];
        const it = makeItem(pool[Math.floor(Math.random() * pool.length)], rollRarity(1.4, 1));
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
