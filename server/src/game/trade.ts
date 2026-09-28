import { itemBase, type Item } from "@floors/shared";
import type { Character } from "./character.ts";

const REQUEST_MS = 30_000;
const RANGE = 120;
const BREAK_RANGE = 320;

interface Side {
  sid: string;
  uids: string[];
  gold: number;
  ready: boolean;
}

interface Trade {
  a: Side;
  b: Side;
}

export interface TradeHost {
  char(sid: string): Character | undefined;
  pos(sid: string): { x: number; y: number; dead: boolean } | undefined;
  name(sid: string): string;
  send(sid: string, type: string, data: unknown): void;
  save(sid: string): void;
}

/**
 * Two-party trades, fully server-side. Items stay in their owners' inventories until
 * both confirm; then everything is re-validated and swapped in one step. Any change
 * to either offer clears both confirmations, so nothing can be switched at the last second.
 */
export class Trades {
  private requests = new Map<string, { from: string; until: number }>();
  private trades = new Map<string, Trade>();

  constructor(private host: TradeHost) {}

  private near(a: string, b: string, range: number) {
    const pa = this.host.pos(a);
    const pb = this.host.pos(b);
    return !!pa && !!pb && !pa.dead && !pb.dead && Math.hypot(pa.x - pb.x, pa.y - pb.y) <= range;
  }

  request(from: string, to: string): string | undefined {
    if (from === to) return "You can't trade with yourself.";
    if (this.trades.has(from) || this.trades.has(to)) return "One of you is already trading.";
    if (!this.near(from, to, RANGE)) return "Stand closer to trade.";
    this.requests.set(to, { from, until: Date.now() + REQUEST_MS });
    this.host.send(to, "tradeRequest", { from, name: this.host.name(from) });
    return undefined;
  }

  accept(sid: string, from: string): string | undefined {
    const req = this.requests.get(sid);
    this.requests.delete(sid);
    if (!req || req.from !== from || req.until < Date.now()) return "That trade offer has expired.";
    if (this.trades.has(sid) || this.trades.has(from)) return "One of you is already trading.";
    if (!this.near(sid, from, RANGE)) return "Stand closer to trade.";
    const t: Trade = { a: { sid: from, uids: [], gold: 0, ready: false }, b: { sid, uids: [], gold: 0, ready: false } };
    this.trades.set(from, t);
    this.trades.set(sid, t);
    this.push(t);
    return undefined;
  }

  offer(sid: string, uids: unknown, gold: unknown): string | undefined {
    const t = this.trades.get(sid);
    const ch = this.host.char(sid);
    if (!t || !ch) return undefined;
    const side = t.a.sid === sid ? t.a : t.b;
    const list = Array.isArray(uids) ? [...new Set(uids.filter((u) => typeof u === "string"))].slice(0, 12) : [];
    for (const uid of list) {
      const it = ch.data.inventory.find((x) => x?.uid === uid);
      if (!it) return "That item isn't in your pack.";
      if (itemBase(it.key)?.bound) return "Bound items can't be traded.";
    }
    const g = Math.floor(Number(gold) || 0);
    if (g < 0 || g > ch.data.gold) return "You don't have that much gold.";
    side.uids = list;
    side.gold = g;
    t.a.ready = false;
    t.b.ready = false;
    this.push(t);
    return undefined;
  }

  ready(sid: string) {
    const t = this.trades.get(sid);
    if (!t) return;
    (t.a.sid === sid ? t.a : t.b).ready = true;
    if (t.a.ready && t.b.ready) this.execute(t);
    else this.push(t);
  }

  cancel(sid: string, reason = "Trade cancelled.") {
    const t = this.trades.get(sid);
    this.requests.delete(sid);
    if (!t) return;
    this.trades.delete(t.a.sid);
    this.trades.delete(t.b.sid);
    for (const s of [t.a.sid, t.b.sid]) this.host.send(s, "trade", { closed: true, reason });
  }

  /** Break trades whose players wander apart, die or leave. */
  tick() {
    for (const [sid, t] of this.trades) {
      if (sid !== t.a.sid) continue;
      if (!this.near(t.a.sid, t.b.sid, BREAK_RANGE)) this.cancel(sid, "You moved too far apart.");
    }
  }

  private items(ch: Character, uids: string[]): Item[] | undefined {
    const out: Item[] = [];
    for (const uid of uids) {
      const it = ch.data.inventory.find((x) => x?.uid === uid);
      if (!it || itemBase(it.key)?.bound) return undefined;
      out.push(it);
    }
    return out;
  }

  private execute(t: Trade) {
    const ca = this.host.char(t.a.sid);
    const cb = this.host.char(t.b.sid);
    const ia = ca && this.items(ca, t.a.uids);
    const ib = cb && this.items(cb, t.b.uids);
    if (!ca || !cb || !ia || !ib || ca.data.gold < t.a.gold || cb.data.gold < t.b.gold) {
      this.cancel(t.a.sid, "The trade changed — nothing was exchanged.");
      return;
    }
    // Capacity: each side must have room for what it receives once its own offer leaves.
    const free = (ch: Character, leaving: number) => ch.data.inventory.filter((x) => !x).length + leaving;
    if (free(ca, ia.length) < ib.length || free(cb, ib.length) < ia.length) {
      t.a.ready = false;
      t.b.ready = false;
      for (const s of [t.a.sid, t.b.sid]) this.host.send(s, "notice", { text: "Not enough room in a pack for this trade.", kind: "error" });
      this.push(t);
      return;
    }
    for (const it of ia) ca.takeItem(it.uid);
    for (const it of ib) cb.takeItem(it.uid);
    for (const it of ia) cb.addItem(it);
    for (const it of ib) ca.addItem(it);
    ca.data.gold += t.b.gold - t.a.gold;
    cb.data.gold += t.a.gold - t.b.gold;
    ca.dirty = true;
    cb.dirty = true;
    this.trades.delete(t.a.sid);
    this.trades.delete(t.b.sid);
    this.host.save(t.a.sid);
    this.host.save(t.b.sid);
    for (const s of [t.a.sid, t.b.sid]) this.host.send(s, "trade", { closed: true, done: true, reason: "Trade complete." });
  }

  private push(t: Trade) {
    for (const [me, them] of [[t.a, t.b], [t.b, t.a]]) {
      const cm = this.host.char(me.sid);
      const ct = this.host.char(them.sid);
      const pick = (ch: Character | undefined, uids: string[]) => uids.map((u) => ch?.data.inventory.find((x) => x?.uid === u)).filter(Boolean);
      this.host.send(me.sid, "trade", {
        partner: this.host.name(them.sid),
        mine: { items: pick(cm, me.uids), gold: me.gold, ready: me.ready },
        theirs: { items: pick(ct, them.uids), gold: them.gold, ready: them.ready },
      });
    }
  }
}
