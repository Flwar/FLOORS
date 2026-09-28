import { matchMaker, type Client } from "colyseus";
import {
  Act, buildFloor1, isEquipment, itemBase, makeItem, questDef, repairCost, sellPrice, SHOPS, TILE, upgradeCost, WEAPONS,
  type NpcDef, type WorldMap, type WorldObject,
} from "@floors/shared";
import { BANK_SIZE, type Character } from "../game/character.ts";
import { accept, offers, questEvent, turnIns, type QuestEvent } from "../game/quests.ts";
import { Spawners } from "../game/spawners.ts";
import type { EnemyData } from "../game/sim.ts";
import { DEV, GameRoom } from "./GameRoom.ts";
import { WorldEvents } from "../game/events.ts";
import { partyMembers } from "../game/parties.ts";
import { online } from "../game/registry.ts";

const TALK_RANGE = 60;

const RUMOURS = [
  "They say a shrine hides where Whisperwood meets the rim, north-west. Only one gap in the trees leads there.",
  "Foxes nest in a hollow south-east of the fields, behind a wall of trees. Where there's a fox, there's a hoard.",
  "A scholar swore the ruins held a library. The east wall's got a crack you could squeeze through.",
  "Miners won't go past the crystals in the deep caves. Something pale moves down there.",
  "When the Keeper raises his blade high, it's a trick — don't parry too early. Wait for the light.",
  "Waystones remember you once you've touched them. Saves a lot of walking.",
];

/** The persistent Floor 1 world everyone shares. */
export class WorldRoom extends GameRoom {
  readonly kind = "world" as const;
  spawners!: Spawners;
  events!: WorldEvents;
  private zoneCheckAt = 0;
  private lastZone = new Map<string, string>();

  protected buildMap(): WorldMap {
    return buildFloor1();
  }

  protected spawnPoint(ch: Character, respawn: boolean) {
    const pos = ch.data.pos;
    if (!respawn && pos?.room === "world" && !this.map.boxBlocked(pos.x, pos.y, 7, 5) && !this.map.isSolidTile(Math.floor(pos.x / TILE), Math.floor(pos.y / TILE))) {
      return { x: pos.x, y: pos.y };
    }
    const a = Math.random() * Math.PI * 2;
    return { x: this.map.spawn.x + Math.cos(a) * 36, y: this.map.spawn.y + Math.sin(a) * 20 };
  }

  protected setup() {
    this.autoDispose = false;
    this.spawners = new Spawners(this.sim, this.map.spawns);
    this.sim.onEnemyRemoved = (ed) => {
      this.spawners.onRemoved(ed);
      this.events.onRemoved(ed);
    };
    this.events = new WorldEvents(this);
    const baseParry = this.sim.onParry;
    this.sim.onParry = (pd, perfect) => {
      baseParry?.(pd, perfect);
      if (pd.ch) this.quest(pd.sid, pd.ch, { kind: "parry" });
    };
    this.registerWorldMessages();
    if (DEV) this.registerDevMessages();
  }

  protected tickRoom(now: number) {
    this.spawners.update(now);
    this.events.update(now);
    if (now >= this.zoneCheckAt) {
      this.zoneCheckAt = now + 400;
      this.checkZones();
    }
  }

  protected onKillRewards(ch: Character, ed: EnemyData) {
    const sid = [...this.chars.entries()].find(([, c]) => c === ch)?.[0];
    if (sid) this.quest(sid, ch, { kind: "kill", enemy: ed.def.key });
    this.events.onKill(ed);
  }

  /** Discovery: entering a secret area for the first time is announced and rewarded. */
  private checkZones() {
    for (const [sid, pd] of this.sim.players) {
      const ch = this.chars.get(sid);
      const zone = this.map.zoneAt(pd.p.x, pd.p.y);
      if (!ch || !zone || this.lastZone.get(sid) === zone.id) continue;
      this.lastZone.set(sid, zone.id);
      const tag = `zone:${zone.id}`;
      if (!ch.data.discovered.includes(tag)) {
        ch.data.discovered.push(tag);
        ch.dirty = true;
        if (zone.secret) {
          ch.addXp(40);
          this.clients.getById(sid)?.send("discover", { name: zone.name, secret: true });
        }
      }
      this.quest(sid, ch, { kind: "visit", zone: zone.id });
    }
  }

  quest(sid: string, ch: Character, ev: QuestEvent) {
    const updates = questEvent(ch, ev);
    if (!updates.length) return;
    this.clients.getById(sid)?.send("quest", updates);
    if (updates.some((u) => u.done)) this.save(sid);
  }

  // ---------------------------------------------------------------------------

  private npcNear(client: Client, role?: NpcDef["role"], id?: string): NpcDef | undefined {
    const p = this.state.players.get(client.sessionId);
    if (!p) return undefined;
    return this.map.npcs.find((n) => (!role || n.role === role) && (!id || n.id === id) && Math.hypot(n.x - p.x, n.y - p.y) <= TALK_RANGE);
  }

  private registerWorldMessages() {
    this.onMessage("interact", (client, id: string) => {
      const me = this.player(client);
      if (!me || me.p.act === Act.Dead) return;
      const npc = this.map.npcs.find((n) => n.id === id && (n.role !== "merchant" || this.events.merchantActive));
      if (npc) return this.talk(client, me.ch, npc);
      const obj = this.map.object(String(id));
      if (obj && Math.hypot(obj.x - me.p.x, obj.y - me.p.y) <= TALK_RANGE) this.useObject(client, me.ch, obj);
    });

    this.onMessage("quest:accept", (client, id: string) => {
      const me = this.player(client);
      const q = questDef(String(id));
      if (!me || !q || !this.npcNear(client, undefined, q.giver)) return;
      const err = accept(me.ch, q.id);
      if (err) return this.notify(client, err, "error");
      client.send("quest", [{ id: q.id, name: q.name, text: q.stages[0].text, accepted: true }]);
      // Stages that are already satisfied (e.g. an item you carry) resolve immediately.
      this.quest(client.sessionId, me.ch, { kind: "talk", npc: q.giver });
    });

    this.onMessage("shop:buy", (client, msg: { shop: string; idx: number }) => {
      const me = this.player(client);
      const merchant = msg?.shop === "merchant";
      if (merchant && !this.events.merchantActive) return;
      const stock = merchant ? this.events.merchantStock : SHOPS[msg?.shop];
      const entry = stock?.[msg.idx];
      const role = msg?.shop === "smith" ? "smith" : merchant ? "merchant" : "store";
      if (!me || !entry || !this.npcNear(client, role)) return;
      if (me.ch.data.gold < entry.price) return this.notify(client, "Not enough gold.", "error");
      const item = makeItem(entry.key, entry.rarity ?? 0, 1);
      if (!me.ch.addItem(item)) return this.notify(client, "Your pack is full.", "error");
      me.ch.data.gold -= entry.price;
      if (merchant) this.events.merchantStock.splice(msg.idx, 1);
      me.ch.dirty = true;
      this.notify(client, `Bought ${itemBase(entry.key)?.name}.`, "good");
    });

    this.onMessage("shop:sell", (client, uid: string) => {
      const me = this.player(client);
      if (!me || !(this.npcNear(client, "store") || this.npcNear(client, "smith") || this.npcNear(client, "merchant"))) return;
      const i = me.ch.findSlot(String(uid));
      const it = i >= 0 ? me.ch.data.inventory[i] : null;
      if (!it) return;
      const price = sellPrice(it);
      if (price <= 0) return this.notify(client, "Nobody will buy that.", "error");
      me.ch.data.inventory[i] = null;
      me.ch.data.gold += price;
      me.ch.dirty = true;
      this.notify(client, `Sold for ${price} gold.`, "good");
    });

    this.onMessage("smith:upgrade", (client, uid: string) => {
      const me = this.player(client);
      if (!me || !this.npcNear(client, "smith")) return;
      const it = me.ch.data.inventory.find((x) => x?.uid === uid) ?? Object.values(me.ch.data.equipment).find((x) => x?.uid === uid);
      if (!it) return;
      const cost = upgradeCost(it);
      if (!cost) return this.notify(client, "That can't be improved further.", "error");
      if (me.ch.data.gold < cost.gold) return this.notify(client, "Not enough gold.", "error");
      for (const mat of cost.mats) if (me.ch.count(mat.key) < mat.qty) return this.notify(client, `You need ${mat.qty} ${itemBase(mat.key)?.name}.`, "error");
      me.ch.data.gold -= cost.gold;
      for (const mat of cost.mats) me.ch.consume(mat.key, mat.qty);
      it.plus++;
      it.dur = 100;
      me.ch.recompute();
      this.save(client.sessionId);
      client.send("forged", { key: it.key, plus: it.plus });
    });

    this.onMessage("smith:repair", (client) => {
      const me = this.player(client);
      if (!me || !this.npcNear(client, "smith")) return;
      const items = [...Object.values(me.ch.data.equipment), ...me.ch.data.inventory].filter((x) => x && isEquipment(itemBase(x.key)!) && x.dur < 100);
      const cost = items.reduce((a, it) => a + repairCost(it!), 0);
      if (!cost) return this.notify(client, "Your gear is in good shape.");
      if (me.ch.data.gold < cost) return this.notify(client, `Repairs cost ${cost} gold.`, "error");
      me.ch.data.gold -= cost;
      for (const it of items) it!.dur = 100;
      me.ch.recompute();
      this.notify(client, `Repaired for ${cost} gold.`, "good");
    });

    this.onMessage("bank:open", (client) => {
      const me = this.player(client);
      if (!me || !this.npcNear(client, "storage")) return;
      client.send("bank", { bank: me.ch.data.bank, bankGold: me.ch.data.bankGold });
    });
    this.onMessage("bank:deposit", (client, msg: { uid?: string; gold?: number }) => {
      const me = this.player(client);
      if (!me || !this.npcNear(client, "storage")) return;
      const d = me.ch.data;
      if (typeof msg?.gold === "number") {
        const g = Math.max(0, Math.min(d.gold, Math.floor(msg.gold)));
        d.gold -= g;
        d.bankGold += g;
      } else if (msg?.uid) {
        const slot = d.bank.indexOf(null);
        if (slot < 0) return this.notify(client, "Storage is full.", "error");
        const it = me.ch.takeItem(msg.uid);
        if (!it) return;
        d.bank[slot] = it;
      }
      me.ch.dirty = true;
      this.save(client.sessionId);
      client.send("bank", { bank: d.bank, bankGold: d.bankGold });
    });
    this.onMessage("bank:withdraw", (client, msg: { uid?: string; gold?: number }) => {
      const me = this.player(client);
      if (!me || !this.npcNear(client, "storage")) return;
      const d = me.ch.data;
      if (typeof msg?.gold === "number") {
        const g = Math.max(0, Math.min(d.bankGold, Math.floor(msg.gold)));
        d.bankGold -= g;
        d.gold += g;
      } else if (msg?.uid) {
        const slot = d.bank.findIndex((x) => x?.uid === msg.uid);
        if (slot < 0) return;
        if (!me.ch.addItem(d.bank[slot]!)) return this.notify(client, "Your pack is full.", "error");
        d.bank[slot] = null;
      }
      me.ch.dirty = true;
      this.save(client.sessionId);
      client.send("bank", { bank: d.bank, bankGold: d.bankGold });
    });

    this.onMessage("waystone:travel", (client, id: string) => {
      const me = this.player(client);
      const dest = this.map.object(String(id));
      if (!me || !dest || dest.kind !== "waystone") return;
      if (!me.ch.data.discovered.includes(`ws:${dest.id}`)) return;
      const near = this.map.objects.some((o) => o.kind === "waystone" && Math.hypot(o.x - me.p.x, o.y - me.p.y) <= TALK_RANGE);
      if (!near) return;
      if (me.pd.combatUntil > this.sim.now) return this.notify(client, "Not while enemies hunt you.", "error");
      this.emitNear("fx", { k: "warp", x: me.p.x, y: me.p.y }, me.p.x, me.p.y);
      me.p.x = Math.fround(dest.x);
      me.p.y = Math.fround(dest.y + 28);
      this.emitNear("fx", { k: "warp", x: me.p.x, y: me.p.y }, me.p.x, me.p.y);
    });
  }

  private talk(client: Client, ch: Character, npc: NpcDef) {
    if (!this.npcNear(client, undefined, npc.id)) return;
    // Talking can complete stages (report back, hand in collections).
    const updates = questEvent(ch, { kind: "talk", npc: npc.id });
    if (updates.length) {
      client.send("quest", updates);
      if (updates.some((u) => u.done)) this.save(client.sessionId);
    }
    const services: string[] = [];
    if (npc.role === "store") services.push("shop:store", "sell");
    if (npc.role === "smith") services.push("shop:smith", "smith", "sell");
    if (npc.role === "storage") services.push("bank");
    if (npc.role === "inn") services.push("rumour");
    if (npc.role === "merchant") services.push("shop:merchant", "sell");
    const done = updates.filter((u) => u.done).map((u) => ({ id: u.id, name: u.name, thanks: questDef(u.id)!.thanks }));
    client.send("dialog", {
      npc: npc.id,
      name: npc.name,
      role: npc.role,
      greeting: npc.role === "inn" ? `${npc.greeting} ${RUMOURS[Math.floor(Math.random() * RUMOURS.length)]}` : npc.role === "gate" && ch.data.floor >= 2 ? "The gate is open, climber. The Floor above is waiting." : npc.greeting,
      offers: offers(ch, npc.id).map((q) => ({ id: q.id, name: q.name, pitch: q.pitch, main: !!q.main })),
      done,
      services,
      shop: npc.role === "store" ? SHOPS.store : npc.role === "smith" ? SHOPS.smith : npc.role === "merchant" ? this.events.merchantStock : undefined,
    });
  }

  private useObject(client: Client, ch: Character, obj: WorldObject) {
    const tag = `${obj.kind}:${obj.id}`;
    switch (obj.kind) {
      case "chest": {
        if (ch.data.discovered.includes(tag)) return this.notify(client, "Empty. You've already taken what was here.");
        const items = (obj.loot ?? []).map((l) => makeItem(l.key, l.rarity, l.qty ?? 1));
        const free = ch.data.inventory.filter((x) => !x).length;
        if (items.length > free) return this.notify(client, "Make room in your pack first.", "error");
        for (const it of items) {
          ch.addItem(it);
          client.send("looted", { key: it.key, rarity: it.rarity, qty: it.qty });
        }
        if (obj.gold) {
          ch.data.gold += obj.gold;
          client.send("looted", { key: "gold", rarity: 0, qty: obj.gold });
        }
        ch.data.discovered.push(tag);
        ch.dirty = true;
        this.save(client.sessionId);
        this.quest(client.sessionId, ch, { kind: "interact", object: obj.id });
        return;
      }
      case "lore":
        if (!ch.data.discovered.includes(tag)) {
          ch.data.discovered.push(tag);
          ch.addXp(15);
          ch.dirty = true;
        }
        client.send("lore", { name: obj.name, text: obj.text });
        this.quest(client.sessionId, ch, { kind: "interact", object: obj.id });
        return;
      case "waystone": {
        if (!ch.data.discovered.includes(`ws:${obj.id}`)) {
          ch.data.discovered.push(`ws:${obj.id}`);
          ch.dirty = true;
          this.notify(client, `${obj.name} attuned.`, "good");
        }
        const list = this.map.objects.filter((o) => o.kind === "waystone" && ch.data.discovered.includes(`ws:${o.id}`)).map((o) => ({ id: o.id, name: o.name }));
        client.send("waystones", { from: obj.id, list });
        return;
      }
      case "door": {
        if (obj.requires && !ch.owns(obj.requires)) return this.notify(client, obj.text ?? "It's sealed.", "error");
        void this.openDungeon(client, ch);
        return;
      }
      case "gate": {
        if (ch.data.floor < 2) return client.send("lore", { name: obj.name, text: `${obj.text} It is sealed. Something below the ruins holds it shut.` });
        client.send("travel", { room: "floor2" });
        return;
      }
    }
  }

  /** Create a dungeon instance for this player (and their party, when grouped). */
  protected async openDungeon(client: Client, ch: Character) {
    const key = this.keys.get(client.sessionId)!;
    const members = this.partyKeys(key);
    const room = await matchMaker.createRoom("dungeon", { allowed: members, leader: key });
    for (const k of members) this.sendToKey(k, "travel", { room: "dungeon", roomId: room.roomId, leader: ch.data.name });
    this.quest(client.sessionId, ch, { kind: "dungeon" });
  }

  /** Party members in this world come along into the instance. */
  protected partyKeys(key: string): string[] {
    return partyMembers(key).filter((k) => online.get(k)?.roomId === this.roomId);
  }

  private registerDevMessages() {
    this.onMessage("dev:weapon", (client, key: string) => {
      const me = this.player(client);
      const w = WEAPONS.find((x) => x.key === key);
      if (!me || !w || me.p.act !== Act.None) return;
      const base = { sword: "sword_iron", greatsword: "greatsword_iron", daggers: "daggers_twin", spear: "spear_hunting", staff: "staff_oak" }[w.key];
      me.ch.data.equipment.weapon = makeItem(base, 1);
      me.ch.data.mastery[w.key] = Math.max(me.ch.data.mastery[w.key] ?? 0, 2200);
      me.p.cd1 = 0;
      me.p.cd2 = 0;
      me.ch.recompute();
    });
    // Dev/test: wear a full outfit by item key (used by the appearance screenshots).
    this.onMessage("dev:wear", (client, m: { weapon?: string; armor?: string; helm?: string; rarity?: number }) => {
      const me = this.player(client);
      if (!me || me.p.act !== Act.None) return;
      const eq = me.ch.data.equipment;
      for (const slot of ["weapon", "armor", "helm"] as const) {
        const key = m?.[slot];
        if (key === "") delete eq[slot];
        else if (key && itemBase(key)?.kind === slot) eq[slot] = makeItem(key, m.rarity ?? itemBase(key)!.rarity ?? 1);
      }
      me.ch.recompute();
      me.ch.dirty = true;
    });
    this.onMessage("dev:heal", (client) => {
      const me = this.player(client);
      if (me) me.p.hp = me.p.hpMax;
    });
    this.onMessage("dev:teleport", (client, pos: { x: number; y: number }) => {
      const me = this.player(client);
      if (me && Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) {
        me.p.x = Math.fround(pos.x);
        me.p.y = Math.fround(pos.y);
      }
    });
    this.onMessage("dev:give", (client, msg: { key: string; rarity?: number; qty?: number; xp?: number; gold?: number }) => {
      const me = this.player(client);
      if (!me) return;
      if (msg.key && itemBase(msg.key)) me.ch.addItem(makeItem(msg.key, msg.rarity, msg.qty ?? 1));
      if (msg.xp) me.ch.addXp(msg.xp);
      if (msg.gold) me.ch.data.gold += msg.gold;
      me.ch.dirty = true;
    });
    this.onMessage("dev:spawn", (client, msg: { key: string; elite?: boolean; level?: number }) => {
      const me = this.player(client);
      if (!me) return;
      const ed = this.sim.spawnEnemy(msg.key, me.p.x + 90, me.p.y, { elite: msg.elite, level: msg.level ?? 3 });
      ed.homeX = ed.e.x;
      ed.homeY = ed.e.y;
    });
    this.onMessage("dev:event", (_client, id: string) => (id === "end" ? this.events.stop() : this.events.start(String(id))));
    this.onMessage("dev:killnear", (client, radius: number) => {
      const me = this.player(client);
      if (!me) return;
      for (const ed of [...this.sim.enemies.values()]) {
        if (ed.e.act === 5 || ed.def.behavior === "dummy" || ed.def.behavior === "sparring") continue;
        if (Math.hypot(ed.e.x - me.p.x, ed.e.y - me.p.y) > (Number(radius) || 600)) continue;
        this.sim.damageEnemy(ed, me.pd, 99999, 0, 0, 0);
      }
    });
    this.onMessage("dev:kill", (client) => {
      const me = this.player(client);
      if (me && me.p.act !== Act.Dead) this.sim.killPlayer(me.pd);
    });
  }
}

void BANK_SIZE;
