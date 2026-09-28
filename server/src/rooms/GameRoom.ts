import { Room, ServerError, type AuthContext, type Client } from "colyseus";
import { StateView } from "@colyseus/schema";
import {
  Act, EAct, EFlag, itemBase, killXp, masteryLevel, newAchievements, PATCH_RATE, rollLoot, sanitizeSettings, TICK_RATE, TILE, type EquipSlot, type Item, type PlayerSim, type WorldMap,
} from "@floors/shared";
import { db } from "../db.ts";
import { Character, newCharacter, type CharacterData } from "../game/character.ts";
import { online, roomSenders, sendToKey, broadcastAll } from "../game/registry.ts";
import { acceptInvite, declineInvite, invite, kick, leaveParty, memberOffline, partyMembers, partyOf, promote, syncParty } from "../game/parties.ts";
import { RESPAWN_DELAY_MS, Sim, type EnemyData, type PlayerData, type RewindLike } from "../game/sim.ts";
import { Trades } from "../game/trade.ts";
import { loginFailsByIp, loginFailsByName, signupsByIp } from "../game/limiter.ts";
import { Drop, Player, PlayerInput, WorldState } from "../state.ts";

export const DEV = process.env.NODE_ENV !== "production";
const EVENT_RADIUS = 900;
const PICKUP_RANGE = 44;
const GOLD_MAGNET = 30;
const OWNER_RIGHTS_MS = 60_000;
const DROP_LIFE_MS = 180_000;
const BAG_LIFE_MS = 600_000;
const LINKDEAD_MS = 8000;
const SAVE_EVERY_MS = 30_000;

export const DropKind = { Item: 0, Gold: 1, Bag: 2 } as const;

/** Dev guest characters, kept in memory for the life of the server process. */
const guestStore = new Map<string, CharacterData>();

interface AuthData {
  key: string;
  accountId: number | null;
  name: string;
  token?: string;
}

interface DropData {
  id: string;
  d: Drop;
  item?: Item;
  gold?: number;
  bag?: { items: Item[]; gold: number };
  ownerKey: string;
  rightsUntil: number;
  expireAt: number;
}

/**
 * Shared base for every playable space (the Floor 1 world, dungeon instances).
 * Owns accounts, characters, persistence, inventory, loot, death and chat.
 * All valuable state changes happen here, server-side.
 */
export abstract class GameRoom extends Room<{ state: WorldState; input: PlayerInput }> {
  state = new WorldState();
  inputs = this.defineInput(PlayerInput, { sanitize: { mx: [-1, 1], my: [-1, 1] } });
  map!: WorldMap;
  sim!: Sim;
  readonly chars = new Map<string, Character>();
  readonly keys = new Map<string, string>();
  private drops = new Map<string, DropData>();
  private linkdead = new Map<string, { timer: { clear(): void }; key: string }>();
  private chatBudget = new Map<string, { tokens: number; at: number }>();
  /** Per-client interest: which enemies/drops/projectiles/hazards each client receives. */
  private interest = new Map<string, { view: StateView; seen: Set<object> }>();
  private relevanceAt = 0;
  protected trades = new Trades({
    char: (sid) => this.chars.get(sid),
    pos: (sid) => {
      const p = this.state.players.get(sid);
      return p ? { x: p.x, y: p.y, dead: p.act === Act.Dead } : undefined;
    },
    name: (sid) => this.state.players.get(sid)?.name ?? "?",
    send: (sid, type, data) => this.clients.getById(sid)?.send(type, data),
    save: (sid) => this.save(sid),
  });
  private lastSave = 0;
  private partyTickAt = 0;
  private reviving = new Map<string, { by: string; until: number }>();
  abstract readonly kind: "world" | "dungeon" | "floor2";

  protected abstract buildMap(options: Record<string, unknown>): WorldMap;
  /** Where a character appears when joining / respawning. */
  protected abstract spawnPoint(ch: Character, respawn: boolean): { x: number; y: number };
  protected setup(_options: Record<string, unknown>) {}
  protected tickRoom(_now: number, _dt: number) {}
  protected onKillRewards(_ch: Character, _ed: EnemyData) {}
  protected onPlayerJoined(_sid: string, _ch: Character) {}
  protected onPlayerLeft(_sid: string, _ch: Character) {}

  onCreate(options: Record<string, unknown> = {}) {
    this.patchRate = 1000 / PATCH_RATE;
    this.map = this.buildMap(options);
    const rewind = this.allowRewindState({ maxRewindMs: 600 });
    rewind.attachAll(this.state.enemies, { fields: ["x", "y"] });
    this.sim = new Sim(this.map, this.state, rewind as unknown as RewindLike, (type, data, x, y) => this.emitNear(type, data, x, y));
    this.sim.onEnemyKilled = (ed) => this.rewardKill(ed);
    this.sim.onPlayerDied = (pd) => this.playerDied(pd);
    this.sim.onPlayerRespawn = (pd) => {
      const ch = pd.ch!;
      const pos = this.spawnPoint(ch, true);
      pd.p.x = Math.fround(pos.x);
      pd.p.y = Math.fround(pos.y);
    };
    this.sim.onDamageDealt = (pd, ed, amount) => {
      // The training yard teaches the basics (up to mastery 3) at a quarter rate; mastery is earned in danger.
      const practice = ed.def.behavior === "dummy" || ed.def.behavior === "sparring";
      if (practice && (pd.ch?.derived.mastery ?? 1) >= 3) return;
      if (pd.ch?.addMastery(Math.round(practice ? amount * 0.25 : amount))) {
        this.clients.getById(pd.sid)?.send("mastery", { weapon: pd.ch.weaponKey, level: pd.ch.derived.mastery });
      }
    };
    this.sim.onParry = (pd, perfect) => {
      if (!pd.ch) return;
      pd.ch.data.stats.parries++;
      if (perfect) pd.ch.data.stats.perfects++;
    };
    this.sim.onUseStart = (pd) => !!pd.ch?.consume("tonic", 1);
    this.sim.onSpawn = (obj, x, y) => this.revealNear(obj, x, y);
    roomSenders.set(this.roomId, (sid, type, data) => this.clients.getById(sid)?.send(type, data));

    this.setFixedTimestep((ctx) => {
      const now = this.clock.elapsedTime;
      this.sim.now = now;
      for (const [sid, pd] of this.sim.players) {
        const acc = this.inputs.get(sid);
        for (const cmd of acc) this.sim.applyInput(pd, cmd, ctx.dt, acc.renderTime);
      }
      this.sim.tick(ctx.dt, now);
      this.tickDrops(now);
      this.tickRoom(now, ctx.dt);
      this.flushCharacters();
      this.tickRevives(now);
      if (now >= this.relevanceAt) {
        this.relevanceAt = now + 200;
        this.updateInterest();
      }
      if (now >= this.partyTickAt) {
        this.partyTickAt = now + 500;
        this.tickParties();
        this.trades.tick();
      }
      if (now - this.lastSave > SAVE_EVERY_MS) {
        this.lastSave = now;
        this.saveAll();
      }
    }, TICK_RATE);

    this.registerMessages();
    this.setup(options);
  }

  // ---------------------------------------------------------------------------
  // Accounts

  async onAuth(_client: Client, options: { token?: string; username?: string; password?: string; register?: boolean; guest?: string }, context?: AuthContext): Promise<AuthData> {
    if (options.token) {
      const acc = db.sessionAccount(String(options.token));
      if (!acc) throw new ServerError(401, "Your session expired. Please log in again.");
      return { key: `a:${acc.id}`, accountId: acc.id, name: acc.username, token: options.token };
    }
    if (options.username && options.password) {
      const username = String(options.username).trim();
      const password = String(options.password);
      let acc: { id: number; username: string } | undefined;
      // Slow down password guessing and mass sign-ups (production only; tests sign up freely).
      const ip = context?.ip ?? "unknown";
      const nameKey = username.toLowerCase();
      if (options.register) {
        if (!DEV && signupsByIp.blocked(ip)) throw new ServerError(429, "Too many new adventurers from here. Try again later.");
        const res = db.createAccount(username, password);
        if ("error" in res) throw new ServerError(400, res.error);
        if (!DEV) signupsByIp.hit(ip);
        acc = { id: res.id, username };
      } else {
        if (!DEV && (loginFailsByName.blocked(nameKey) || loginFailsByIp.blocked(ip))) {
          throw new ServerError(429, "Too many attempts. Wait a few minutes and try again.");
        }
        acc = db.verify(username, password);
        if (!acc) {
          if (!DEV) {
            loginFailsByName.hit(nameKey);
            loginFailsByIp.hit(ip);
          }
          throw new ServerError(401, "Wrong name or password.");
        }
        loginFailsByName.clear(nameKey);
      }
      return { key: `a:${acc.id}`, accountId: acc.id, name: acc.username, token: db.createSession(acc.id) };
    }
    if (DEV && options.guest) {
      const name = cleanName(options.guest) ?? "Guest";
      // Dev guests are keyed by name so they keep their character across rooms (in memory only).
      return { key: `g:${name}`, accountId: null, name };
    }
    throw new ServerError(401, "Please log in.");
  }

  onJoin(client: Client, _options: unknown, auth: AuthData) {
    const view = new StateView();
    client.view = view;
    this.interest.set(client.sessionId, { view, seen: new Set() });
    // One character, one session: take over any existing session for this account.
    let ch: Character | undefined;
    const existing = online.get(auth.key);
    if (existing) {
      existing.superseded = true;
      ch = existing.ch;
      const dead = this.linkdead.get(existing.sid);
      if (existing.roomId === this.roomId && dead) {
        dead.timer.clear();
        this.linkdead.delete(existing.sid);
        this.finalizeLeave(existing.sid);
      } else {
        existing.client.leave(4001, "You logged in somewhere else.");
      }
    }
    if (!ch) {
      const data = auth.accountId !== null ? db.loadCharacter<CharacterData>(auth.accountId) : guestStore.get(auth.key);
      ch = new Character(data ?? newCharacter(auth.name), auth.accountId);
      if (!data && auth.accountId !== null) db.saveCharacter(auth.accountId, ch.data);
    }
    online.set(auth.key, {
      key: auth.key, accountId: auth.accountId, ch, roomId: this.roomId, sid: client.sessionId, client,
      status: () => {
        const pl = this.state.players.get(client.sessionId);
        return { hp: pl?.hp ?? 0, hpMax: pl?.hpMax ?? 1, dead: pl?.act === Act.Dead, x: pl?.x ?? 0, y: pl?.y ?? 0, room: this.kind, level: ch!.data.level };
      },
    });
    this.keys.set(client.sessionId, auth.key);
    this.chars.set(client.sessionId, ch);

    const p = new Player();
    p.name = ch.data.name;
    p.hue = ch.data.hue;
    const pos = this.spawnPoint(ch, false);
    p.x = Math.fround(pos.x);
    p.y = Math.fround(pos.y);
    // Every simulated field starts defined: schema numbers are undefined until set,
    // and an undefined value would poison client prediction and animation.
    Object.assign(p, {
      dir: 2, gait: 0, aim: 64, act: Act.None, actTick: 0, actMove: 0, actAim: 64, actSeq: 0, combo: 0, comboTimer: 0,
      buf: 0, bufAim: 0, bufAge: 0, dodgeDx: 0, dodgeDy: 1, kbx: 0, kby: 0, hurtDur: 0, parryOk: 0, cd1: 0, cd2: 0,
      staminaDelay: 0, exhausted: false, weaponRarity: 0, weaponLook: 0, armorLook: 0, helmLook: 0, mastered: false, party: "", potions: 0,
    });
    ch.applyTo(p);
    p.hp = Math.max(1, Math.min(p.hpMax, ch.data.pos?.room === this.kind && ch.data.pos.hp ? ch.data.pos.hp : p.hpMax));
    p.stamina = p.staminaMax;
    this.state.players.set(client.sessionId, p);
    const pd = this.sim.addPlayer(client.sessionId, p);
    this.updateInterest(client.sessionId);
    pd.ch = ch;
    this.syncDerived(pd);
    if (auth.token) client.send("session", { token: auth.token, name: auth.name });
    client.send("inv", ch.view({ key: auth.key }));
    client.send("settings", ch.data.settings ?? null);
    ch.dirty = false;
    this.onPlayerJoined(client.sessionId, ch);
    syncParty(partyOf(auth.key));
    console.log(`[${this.kind}] ${p.name} joined (${this.clients.length} here, ${online.size} online)`);
  }

  onLeave(client: Client) {
    const sid = client.sessionId;
    const key = this.keys.get(sid);
    const entry = key ? online.get(key) : undefined;
    const pd = this.sim.players.get(sid);
    // Leaving mid-fight doesn't save you: the body stays in the world for a few seconds.
    if (pd && !entry?.superseded && pd.combatUntil > this.sim.now && pd.p.act !== Act.Dead && this.kind === "world") {
      const timer = this.clock.setTimeout(() => {
        this.linkdead.delete(sid);
        this.finalizeLeave(sid);
      }, LINKDEAD_MS);
      this.linkdead.set(sid, { timer, key: key! });
      return;
    }
    this.finalizeLeave(sid);
  }

  private finalizeLeave(sid: string) {
    const key = this.keys.get(sid);
    const ch = this.chars.get(sid);
    const pd = this.sim.players.get(sid);
    if (ch && pd) {
      ch.data.pos = { room: this.kind, x: pd.p.x, y: pd.p.y, hp: pd.p.act === Act.Dead ? pd.p.hpMax : pd.p.hp };
      this.onPlayerLeft(sid, ch);
    }
    const entry = key ? online.get(key) : undefined;
    if (ch && entry && entry.sid === sid && !entry.superseded) {
      online.delete(key!);
      memberOffline(key!);
    }
    else if (entry?.superseded && entry.sid === sid) online.delete(key!);
    if (ch?.accountId != null) db.saveCharacter(ch.accountId, ch.data);
    else if (ch && key) guestStore.set(key, ch.data);
    this.sim.removePlayer(sid);
    this.interest.delete(sid);
    this.trades.cancel(sid, "Your trading partner left.");
    this.state.players.delete(sid);
    this.chars.delete(sid);
    this.keys.delete(sid);
    console.log(`[${this.kind}] ${pd?.p.name ?? sid} left (${online.size} online)`);
  }

  onDispose() {
    this.saveAll();
    roomSenders.delete(this.roomId);
  }

  saveAll() {
    for (const [sid, ch] of this.chars) {
      const pd = this.sim.players.get(sid);
      if (pd) ch.data.pos = { room: this.kind, x: pd.p.x, y: pd.p.y, hp: pd.p.hp };
      if (ch.accountId != null) db.saveCharacter(ch.accountId, ch.data);
    }
  }

  protected save(sid: string) {
    const ch = this.chars.get(sid);
    if (ch?.accountId != null) db.saveCharacter(ch.accountId, ch.data);
  }

  private syncDerived(pd: PlayerData) {
    const ch = pd.ch!;
    ch.applyTo(pd.p);
    pd.atkMul = ch.derived.atkMul;
    pd.defense = ch.derived.defense;
  }

  /** Push changed characters to their owners (at most once per tick). */
  private flushCharacters() {
    for (const [sid, ch] of this.chars) {
      if (!ch.dirty) continue;
      ch.dirty = false;
      const pd = this.sim.players.get(sid);
      if (pd) this.syncDerived(pd);
      const d = ch.data;
      const earned = newAchievements(
        {
          kills: d.stats.kills, perfects: d.stats.perfects, parries: d.stats.parries, deaths: d.stats.deaths,
          discovered: d.discovered, bossKills: d.bossKills, gold: d.gold, level: d.level, floor: d.floor,
          maxMastery: Math.max(0, ...Object.values(d.mastery).map((xp) => masteryLevel(xp ?? 0))),
        },
        d.achievements,
      );
      for (const a of earned) {
        d.achievements.push(a.id);
        this.clients.getById(sid)?.send("achievement", a);
      }
      if (earned.length) this.save(sid);
      this.clients.getById(sid)?.send("inv", ch.view({ key: this.keys.get(sid) }));
    }
  }

  // ---------------------------------------------------------------------------
  // Messages

  protected player(client: Client) {
    const pd = this.sim.players.get(client.sessionId);
    const ch = this.chars.get(client.sessionId);
    return pd && ch ? { pd, ch, p: pd.p } : undefined;
  }

  protected notify(client: Client, text: string, kind: "info" | "error" | "good" = "info") {
    client.send("notice", { text, kind });
  }

  private registerMessages() {
    this.onMessage("equip", (client, uid: string) => {
      const me = this.player(client);
      if (!me || typeof uid !== "string") return;
      if (me.p.act !== Act.None && me.p.act !== Act.Dead) return this.notify(client, "Not while fighting.", "error");
      const err = me.ch.equip(uid);
      if (err) this.notify(client, err, "error");
    });
    this.onMessage("unequip", (client, slot: EquipSlot) => {
      const me = this.player(client);
      if (!me) return;
      const err = me.ch.unequip(slot);
      if (err) this.notify(client, err, "error");
    });
    this.onMessage("perk", (client, id: string) => {
      const me = this.player(client);
      if (!me) return;
      const err = me.ch.choosePerk(String(id));
      if (err) this.notify(client, err, "error");
      else this.save(client.sessionId);
    });
    this.onMessage("pickup", (client, id: string) => this.pickup(client, String(id)));
    this.onMessage("discard", (client, uid: string) => {
      const me = this.player(client);
      if (!me) return;
      const it = me.ch.takeItem(String(uid));
      if (!it) return;
      if (itemBase(it.key)?.bound) {
        me.ch.addItem(it);
        return this.notify(client, "You can't part with that.", "error");
      }
      this.spawnDrop(me.p.x, me.p.y + 10, { item: it }, this.keys.get(client.sessionId)!, 0);
    });
    this.onMessage("chat", (client, msg: { text?: string; channel?: string }) => this.chat(client, msg));
    const keyOf = (c: Client) => this.keys.get(c.sessionId)!;
    const report = (c: Client, err?: string) => err && this.notify(c, err, "error");
    this.onMessage("party:invite", (c, name: string) => {
      const err = invite(keyOf(c), String(name ?? ""));
      if (err) report(c, err);
      else this.notify(c, `Invitation sent to ${name}.`, "good");
    });
    this.onMessage("party:accept", (c) => report(c, acceptInvite(keyOf(c))));
    this.onMessage("party:decline", (c) => declineInvite(keyOf(c)));
    this.onMessage("party:leave", (c) => leaveParty(keyOf(c)));
    this.onMessage("party:kick", (c, name: string) => report(c, kick(keyOf(c), String(name ?? ""))));
    this.onMessage("party:promote", (c, name: string) => report(c, promote(keyOf(c), String(name ?? ""))));
    this.onMessage("settings", (c, raw: unknown) => {
      const ch = this.chars.get(c.sessionId);
      if (!ch) return;
      ch.data.settings = sanitizeSettings(raw);
      ch.dirty = true;
    });
    this.onMessage("inspect", (c, sid: string) => {
      const ch = this.chars.get(String(sid));
      if (!ch) return;
      c.send("inspect", { sid: String(sid), name: ch.data.name, level: ch.data.level, equipment: ch.data.equipment, mastery: ch.data.mastery, perks: ch.data.perks, stats: ch.data.stats, bossKills: ch.data.bossKills, floor: ch.data.floor });
    });
    this.onMessage("revive", (c, sid: string) => {
      const me = this.player(c);
      const target = this.sim.players.get(String(sid));
      if (!me || !target || me.p.act === Act.Dead || target.p.act !== Act.Dead) return;
      if (Math.hypot(target.p.x - me.p.x, target.p.y - me.p.y) > 50) return;
      this.reviving.set(target.sid, { by: c.sessionId, until: this.sim.now + 1500 });
      this.emitNear("reviving", { by: c.sessionId, t: target.sid, ms: 1500 }, target.p.x, target.p.y);
    });
    this.onMessage("trade:request", (c, sid: string) => report(c, this.trades.request(c.sessionId, String(sid))));
    this.onMessage("trade:accept", (c, from: string) => report(c, this.trades.accept(c.sessionId, String(from))));
    this.onMessage("trade:decline", (c) => this.trades.cancel(c.sessionId, "The trade was declined."));
    this.onMessage("trade:offer", (c, msg: { uids?: unknown; gold?: unknown }) => report(c, this.trades.offer(c.sessionId, msg?.uids, msg?.gold)));
    this.onMessage("trade:ready", (c) => this.trades.ready(c.sessionId));
    this.onMessage("trade:cancel", (c) => this.trades.cancel(c.sessionId));
    this.onMessage("respawnNow", (c) => {
      const pd = this.sim.players.get(c.sessionId);
      if (pd && pd.p.act === Act.Dead && this.sim.now - pd.deadAt > 1200) this.sim.respawn(pd);
    });
  }

  private chat(client: Client, msg: { text?: string; channel?: string }) {
    const me = this.player(client);
    if (!me || typeof msg?.text !== "string") return;
    const text = msg.text.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 160);
    if (!text) return;
    const now = Date.now();
    const b = this.chatBudget.get(client.sessionId) ?? { tokens: 5, at: now };
    b.tokens = Math.min(5, b.tokens + (now - b.at) / 1500);
    b.at = now;
    if (b.tokens < 1) return this.notify(client, "Slow down a little.", "error");
    b.tokens -= 1;
    this.chatBudget.set(client.sessionId, b);
    const out = { from: me.p.name, text, channel: msg.channel === "world" ? "world" : msg.channel === "party" ? "party" : "say" };
    if (out.channel === "world") broadcastAll("chat", out);
    else if (out.channel === "party") this.partyChat(client.sessionId, out);
    else {
      for (const c of this.clients) {
        const p = this.state.players.get(c.sessionId);
        if (p && Math.hypot(p.x - me.p.x, p.y - me.p.y) < 640) c.send("chat", out);
      }
    }
  }

  protected partyChat(sid: string, out: unknown) {
    const key = this.keys.get(sid);
    if (!key || !partyOf(key)) return this.notify(this.clients.getById(sid)!, "You're not in a party.", "error");
    for (const k of partyMembers(key)) sendToKey(k, "chat", out);
  }

  /** Party frames: every member sees every member's health, wherever they are. */
  private tickParties() {
    for (const [sid, key] of this.keys) {
      const p = partyOf(key);
      const pl = this.state.players.get(sid);
      if (pl) pl.party = p?.id ?? "";
      if (!p) continue;
      const members = p.members.map((k) => {
        const e = online.get(k);
        const st = e?.status?.();
        return { key: k, name: e?.ch.data.name ?? "?", online: !!e, leader: k === p.leader, ...(st ?? {}), sid: e?.sid, here: e?.roomId === this.roomId };
      });
      this.clients.getById(sid)?.send("partyStatus", members);
    }
  }

  private tickRevives(now: number) {
    for (const [tsid, r] of this.reviving) {
      const target = this.sim.players.get(tsid);
      const by = this.sim.players.get(r.by);
      if (!target || !by || target.p.act !== Act.Dead || by.p.act === Act.Dead || Math.hypot(target.p.x - by.p.x, target.p.y - by.p.y) > 64 || by.p.act === Act.Hurt || by.p.act === Act.Knockdown) {
        this.reviving.delete(tsid);
        continue;
      }
      if (now < r.until) continue;
      this.reviving.delete(tsid);
      this.sim.revive(target, 0.35);
    }
  }

  protected sendToKey(key: string, type: string, data: unknown) {
    sendToKey(key, type, data);
  }

  // ---------------------------------------------------------------------------
  // Loot

  spawnDrop(x: number, y: number, content: { item?: Item; gold?: number; bag?: { items: Item[]; gold: number } }, ownerKey: string, rightsMs = OWNER_RIGHTS_MS) {
    const id = this.sim.id("d");
    const d = new Drop();
    d.kind = content.bag ? DropKind.Bag : content.gold !== undefined ? DropKind.Gold : DropKind.Item;
    d.key = content.item?.key ?? (content.bag ? "bag" : "gold");
    d.rarity = content.item?.rarity ?? 0;
    d.qty = content.item?.qty ?? content.gold ?? 1;
    // Never land inside a wall.
    for (let i = 0; i < 8 && this.map.isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE)); i++) {
      x += (Math.random() - 0.5) * 30;
      y += (Math.random() - 0.5) * 30;
    }
    d.x = Math.fround(x);
    d.y = Math.fround(y);
    d.owner = ownerKey;
    d.born = this.sim.now;
    this.state.drops.set(id, d);
    this.revealNear(d, d.x, d.y);
    this.drops.set(id, {
      id, d, item: content.item, gold: content.gold, bag: content.bag, ownerKey,
      rightsUntil: content.bag ? Infinity : this.sim.now + rightsMs,
      expireAt: this.sim.now + (content.bag ? BAG_LIFE_MS : DROP_LIFE_MS),
    });
    return id;
  }

  private canLoot(dd: DropData, key: string) {
    return dd.ownerKey === key || !dd.ownerKey || this.sim.now >= dd.rightsUntil;
  }

  private pickup(client: Client, id: string) {
    const me = this.player(client);
    const dd = this.drops.get(id);
    if (!me || !dd || me.p.act === Act.Dead) return;
    const key = this.keys.get(client.sessionId)!;
    if (Math.hypot(dd.d.x - me.p.x, dd.d.y - me.p.y) > PICKUP_RANGE) return;
    if (!this.canLoot(dd, key)) return this.notify(client, dd.bag ? "That isn't yours." : "Someone else has claim to that for now.", "error");
    if (dd.item) {
      if (!me.ch.addItem(dd.item)) return this.notify(client, "Your pack is full.", "error");
      client.send("looted", { key: dd.item.key, rarity: dd.item.rarity, qty: dd.item.qty });
      if (dd.item.rarity >= 2) this.save(client.sessionId);
    } else if (dd.bag) {
      const back: Item[] = [];
      for (const it of dd.bag.items) if (!me.ch.addItem(it)) back.push(it);
      me.ch.data.gold += dd.bag.gold;
      me.ch.dirty = true;
      client.send("looted", { key: "bag", rarity: 0, qty: dd.bag.gold });
      if (back.length) {
        dd.bag = { items: back, gold: 0 };
        this.notify(client, "Your pack is full — some of your belongings are still here.", "error");
        this.save(client.sessionId);
        return;
      }
      this.save(client.sessionId);
    }
    this.removeDrop(id);
  }

  private removeDrop(id: string) {
    this.drops.delete(id);
    this.state.drops.delete(id);
  }

  private tickDrops(now: number) {
    for (const dd of this.drops.values()) {
      if (now > dd.expireAt) {
        this.removeDrop(dd.id);
        continue;
      }
      if (dd.gold === undefined) continue;
      // Gold is picked up just by walking over it.
      for (const [sid, pd] of this.sim.players) {
        if (pd.p.act === Act.Dead || Math.hypot(pd.p.x - dd.d.x, pd.p.y - dd.d.y) > GOLD_MAGNET) continue;
        const key = this.keys.get(sid)!;
        if (!this.canLoot(dd, key)) continue;
        const ch = this.chars.get(sid)!;
        ch.data.gold += dd.gold;
        ch.dirty = true;
        this.clients.getById(sid)?.send("looted", { key: "gold", rarity: 0, qty: dd.gold });
        this.removeDrop(dd.id);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Kills, XP, death

  private rewardKill(ed: EnemyData) {
    const def = ed.def;
    const e = ed.e;
    const total = [...ed.contrib.values()].reduce((a, b) => a + b, 0);
    if (!total) return;
    let top: { sid: string; amt: number } | undefined;
    for (const [sid, amt] of ed.contrib) {
      const ch = this.chars.get(sid);
      const pd = this.sim.players.get(sid);
      if (!ch || !pd) continue;
      if (!top || amt > top.amt) top = { sid, amt };
      // Everyone who meaningfully helped gets full experience: fighting together is never a penalty.
      if (amt < total * 0.1 && amt < 15) continue;
      const xp = killXp(def.xp * (e.flags & EFlag.Elite ? 2.5 : 1), e.level, ch.data.level);
      const levels = ch.addXp(xp);
      ch.data.stats.kills++;
      this.clients.getById(sid)?.send("xp", { amount: xp, x: e.x, y: e.y });
      if (levels) {
        pd.p.hp = ch.derived.hpMax;
        this.emitNear("levelup", { p: sid, level: ch.data.level, x: pd.p.x, y: pd.p.y }, pd.p.x, pd.p.y);
        this.save(sid);
      }
      this.onKillRewards(ch, ed);
      // Bosses reward everyone who fought with their own loot.
      if (def.boss) this.dropLoot(ed, sid);
    }
    if (!def.boss && top) this.dropLoot(ed, top.sid);
    // Party members fighting nearby share quest progress and most of the experience.
    const rewarded = new Set(ed.contrib.keys());
    for (const sid of [...rewarded]) {
      const key = this.keys.get(sid);
      if (!key) continue;
      for (const mk of partyMembers(key)) {
        const entry = online.get(mk);
        if (!entry || entry.roomId !== this.roomId || rewarded.has(entry.sid)) continue;
        const mpd = this.sim.players.get(entry.sid);
        if (!mpd || mpd.p.act === Act.Dead || Math.hypot(mpd.p.x - e.x, mpd.p.y - e.y) > 1000) continue;
        rewarded.add(entry.sid);
        const xp = Math.round(killXp(def.xp * (e.flags & EFlag.Elite ? 2.5 : 1), e.level, entry.ch.data.level) * 0.6);
        if (entry.ch.addXp(xp)) this.emitNear("levelup", { p: entry.sid, level: entry.ch.data.level, x: mpd.p.x, y: mpd.p.y }, mpd.p.x, mpd.p.y);
        this.clients.getById(entry.sid)?.send("xp", { amount: xp, x: e.x, y: e.y, party: true });
        this.onKillRewards(entry.ch, ed);
        if (def.boss) this.dropLoot(ed, entry.sid);
      }
    }
  }

  private dropLoot(ed: EnemyData, sid: string) {
    const ch = this.chars.get(sid);
    const key = this.keys.get(sid);
    if (!ch || !key) return;
    const loot = rollLoot(ed.def.loot, { elite: (ed.e.flags & EFlag.Elite) !== 0, owns: (k) => ch.owns(k) });
    const scatter = () => ({ x: ed.e.x + (Math.random() - 0.5) * 40, y: ed.e.y + (Math.random() - 0.5) * 28 });
    if (loot.gold > 0) {
      const s = scatter();
      this.spawnDrop(s.x, s.y, { gold: loot.gold }, key);
    }
    for (const it of loot.items) {
      const s = scatter();
      // Quest items and uniques from bosses are personal.
      this.spawnDrop(s.x, s.y, { item: it }, key, itemBase(it.key)?.bound || ed.def.boss ? Infinity : OWNER_RIGHTS_MS);
    }
  }

  private playerDied(pd: PlayerData) {
    const ch = pd.ch;
    const key = this.keys.get(pd.sid);
    if (!ch || !key) return;
    ch.data.stats.deaths++;
    // Death matters: half your carried gold and your materials stay where you fell.
    // Equipped gear, keys and quest items are never dropped; banked gold is safe.
    const gold = Math.floor(ch.data.gold * 0.5);
    ch.data.gold -= gold;
    const items: Item[] = [];
    ch.data.inventory.forEach((it, i) => {
      if (!it) return;
      const b = itemBase(it.key);
      if (b?.kind === "material") {
        items.push(it);
        ch.data.inventory[i] = null;
      }
    });
    for (const it of Object.values(ch.data.equipment)) if (it) it.dur = Math.max(0, it.dur - 10);
    ch.recompute();
    if (gold > 0 || items.length) this.spawnDrop(pd.p.x, pd.p.y, { bag: { items, gold } }, key);
    this.clients.getById(pd.sid)?.send("died", { gold, items: items.length });
    this.save(pd.sid);
  }

  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Interest management: each client only receives the world around it.

  private static readonly VIEW_IN = 1150;
  private static readonly VIEW_OUT = 1450;

  /** Add/remove entities from each client's view with hysteresis (in < out) so edges never flicker. */
  private updateInterest(only?: string) {
    const alive = new Set<object>();
    const all: [object, number, number][] = [];
    this.state.enemies.forEach((e) => all.push([e, e.x, e.y]));
    this.state.drops.forEach((d) => all.push([d, d.x, d.y]));
    this.state.hazards.forEach((h) => all.push([h, h.x, h.y]));
    // Projectiles travel from their launch point; their range is well inside the margin.
    this.state.projectiles.forEach((pr) => all.push([pr, pr.x0, pr.y0]));
    for (const [o] of all) alive.add(o);
    for (const [sid, it] of this.interest) {
      if (only && sid !== only) continue;
      const p = this.state.players.get(sid);
      if (!p) continue;
      for (const obj of it.seen) if (!alive.has(obj)) it.seen.delete(obj);
      for (const [obj, x, y] of all) {
        const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
        const has = it.seen.has(obj);
        if (!has && d <= GameRoom.VIEW_IN) {
          it.view.add(obj as never);
          it.seen.add(obj);
        } else if (has && d > GameRoom.VIEW_OUT) {
          it.view.remove(obj as never);
          it.seen.delete(obj);
        }
      }
    }
  }

  /** New projectiles/hazards/drops reach nearby clients immediately, not on the next pass. */
  revealNear(obj: object, x: number, y: number) {
    for (const [sid, it] of this.interest) {
      const p = this.state.players.get(sid);
      if (!p || it.seen.has(obj)) continue;
      if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) > GameRoom.VIEW_IN) continue;
      it.view.add(obj as never);
      it.seen.add(obj);
    }
  }

  emitNear(type: string, data: Record<string, unknown>, x: number, y: number) {
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId);
      if (!p || Math.abs(p.x - x) > EVENT_RADIUS || Math.abs(p.y - y) > EVENT_RADIUS) continue;
      client.send(type, data);
    }
  }

  /** Nearest living player to a point (for NPC proximity checks). */
  protected near(client: Client, x: number, y: number, range: number) {
    const p = this.state.players.get(client.sessionId);
    return !!p && p.act !== Act.Dead && Math.hypot(p.x - x, p.y - y) <= range;
  }
}

export function cleanName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = raw.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16);
  return name.length >= 2 ? name : undefined;
}

void EAct;
void (null as unknown as PlayerSim);
