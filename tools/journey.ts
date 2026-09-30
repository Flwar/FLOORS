/**
 * End-to-end player journey against a running dev server (npm run journey):
 * account creation, quest accept → progress → hand-in, combat loot, equipment,
 * shop, storage, death + bag recovery, persistence across reconnect, parties,
 * party chat, and entering the dungeon together.
 */
import { Client, Predict, type Room } from "@colyseus/sdk";
import {
  Btn, buildFloor1, EAct, ENEMIES, impactMs, INTERP_DELAY, radToAim, SERVER_PORT, SHOPS, stepPlayer, type PlayerSim,
} from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const map = buildFloor1();
// Guests live in server memory: a fixed name would carry the last run's party into this one.
const BUDDY = `Buddy${Math.floor(Math.random() * 1e5)}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const FIELDS = ["x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted", "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge", "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "potions"];
const npc = (id: string) => map.npcs.find((n) => n.id === id)!;

class Bot {
  room!: Room<any, any>;
  msgs: { type: string; m: any }[] = [];
  inv: any;
  token?: string;
  predict!: Predict<any>;
  input: any;
  me: any;
  mx = 0;
  my = 0;
  aim = 64;
  pending = 0;
  running = true;

  constructor(readonly client: Client) {}

  async join(roomName: string, opts: Record<string, unknown>, byId?: string) {
    this.room = byId ? await this.client.joinById(byId, opts) : await this.client.joinOrCreate(roomName, opts);
    this.msgs = [];
    this.room.onMessage("*", (type, m) => {
      this.msgs.push({ type: String(type), m });
      if (type === "inv") this.inv = m;
      if (type === "session") this.token = (m as { token: string }).token;
    });
    while (!this.room.state.players?.get(this.room.sessionId)) await wait(20);
    const player = this.room.state.players.get(this.room.sessionId);
    this.predict = Predict.get(this.room, { mode: "lerp", delay: INTERP_DELAY });
    this.predict.attachAll("enemies", { fields: ["x", "y"], mode: "lerp" });
    this.input = this.room.input({ mode: "reliable" });
    this.me = this.predict.reconciler(player as PlayerSim, {
      input: this.input,
      fields: FIELDS as never,
      step: (ctx, s, cmd) => stepPlayer(s, cmd as never, ctx.dt, map),
    });
    this.running = true;
    void this.drive();
    for (let i = 0; i < 100 && !this.inv; i++) await wait(20);
  }

  private async drive() {
    const room = this.room;
    while (this.running && this.room === room) {
      const n = this.predict.tick(performance.now());
      for (let i = 0; i < n; i++) {
        this.input.data.mx = this.mx;
        this.input.data.my = this.my;
        this.input.data.aim = this.aim;
        this.input.data.btn = this.pending;
        this.pending = 0;
        this.input.send();
      }
      await wait(8);
    }
  }

  get p() {
    return this.room.state.players.get(this.room.sessionId);
  }

  async next(type: string, pred: (m: any) => boolean = () => true, timeout = 5000) {
    const start = this.msgs.length;
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      const hit = this.msgs.slice(start).find((x) => x.type === type && pred(x.m));
      if (hit) return hit.m;
      await wait(20);
    }
    return undefined;
  }

  since(mark: number, type: string) {
    return this.msgs.slice(mark).filter((x) => x.type === type).map((x) => x.m);
  }

  async teleport(x: number, y: number) {
    this.room.send("dev:teleport", { x, y });
    for (let i = 0; i < 50; i++) {
      await wait(20);
      if (Math.hypot(this.p.x - x, this.p.y - y) < 4) break;
    }
    await wait(150);
  }

  count(key: string) {
    return (this.inv?.inventory ?? []).filter((x: any) => x?.key === key).reduce((a: number, b: any) => a + b.qty, 0);
  }

  async leave() {
    this.running = false;
    await this.room.leave(true);
  }
}

async function main() {
  const user = `Tester${Math.floor(Math.random() * 1e6)}`;
  const pass = "hunter22";
  const a = new Bot(new Client(endpoint));

  // --- Account -------------------------------------------------------------------
  await a.join("world", { username: user, password: pass, register: true });
  check("account created and joined", !!a.token && !!a.inv, `token ${a.token ? "issued" : "missing"}`);
  check("starting kit", a.inv?.equipment?.weapon?.key === "sword_rusty" && a.count("tonic") === 3 && a.inv.gold === 20, `weapon ${a.inv?.equipment?.weapon?.key}, tonics ${a.count("tonic")}, gold ${a.inv?.gold}`);

  // --- Quest: accept ----------------------------------------------------------------
  const gm = npc("guildmaster");
  await a.teleport(gm.x, gm.y + 30);
  a.room.send("interact", "guildmaster");
  const dlg = await a.next("dialog");
  check("guildmaster offers First Steps", !!dlg?.offers?.some((o: any) => o.id === "q_welcome"), `offers: ${dlg?.offers?.map((o: any) => o.id).join(",")}`);
  a.room.send("quest:accept", "q_welcome");
  const acc = await a.next("quest", (u) => u.some((x: any) => x.accepted));
  check("quest accepted", !!acc, JSON.stringify(acc?.[0] ?? null));

  // --- Quest: parry the sparring knight 3 times -----------------------------------
  const yard = map.spawns.find((s) => s.id === "yard-sparring")!;
  await a.teleport(yard.x + 48, yard.y);
  a.aim = radToAim(Math.PI);
  let knight: any;
  a.room.state.enemies?.forEach((e: any) => { if (ENEMIES[e.def].key === "sparring") knight = e; });
  let lastStart = 0;
  let stageDone = false;
  const t0 = performance.now();
  while (!stageDone && performance.now() - t0 < 45000) {
    await wait(5);
    if (knight.act !== EAct.Attack || knight.actStart === lastStart) continue;
    lastStart = knight.actStart;
    const atk = ENEMIES[knight.def].attacks[knight.atk];
    const H = knight.actStart + impactMs(atk, knight.flags);
    const view = () => a.room.clock.serverNow() - INTERP_DELAY - a.room.clock.smoothedRtt() / 2;
    while (view() < H - 60) await wait(1);
    if (atk.parryable) a.pending |= Btn.Parry;
    else {
      a.mx = -1;
      a.pending |= Btn.Dodge;
      await wait(40);
      a.mx = 0;
    }
    await wait(900);
    const q = a.inv?.quests?.q_welcome;
    stageDone = q && q.stage >= 1;
    await a.teleport(yard.x + 48, yard.y);
  }
  check("parried 3 times", stageDone, `quest stage ${a.inv?.quests?.q_welcome?.stage}`);

  // --- Quest: hand in ---------------------------------------------------------------
  const goldBefore = a.inv.gold;
  await a.teleport(gm.x, gm.y + 30);
  a.room.send("interact", "guildmaster");
  const done = await a.next("quest", (u) => u.some((x: any) => x.done));
  await wait(300);
  check("quest completed with rewards", !!done && a.inv.quests.q_welcome.done && a.inv.gold === goldBefore + 20 && a.count("tonic") >= 5, `gold ${goldBefore}→${a.inv.gold}, tonics ${a.count("tonic")}, xp ${a.inv.xp}`);

  // --- Combat loot -------------------------------------------------------------------
  const field = { x: 70 * 32, y: 78 * 32 };
  await a.teleport(field.x, field.y);
  a.room.send("dev:spawn", { key: "goblin", level: 1 });
  await wait(700);
  let goblinId = "";
  a.room.state.enemies?.forEach((e: any, id: string) => { if (ENEMIES[e.def].key === "goblin" && Math.hypot(e.x - a.p.x, e.y - a.p.y) < 140) goblinId = id; });
  const mark = a.msgs.length;
  const goldBeforeFight = a.inv.gold;
  for (let i = 0; i < 80 && a.room.state.enemies.get(goblinId) && a.room.state.enemies.get(goblinId).act !== EAct.Dead; i++) {
    const e = a.room.state.enemies.get(goblinId);
    const d = Math.hypot(e.x - a.p.x, e.y - a.p.y);
    a.aim = radToAim(Math.atan2(e.y - a.p.y, e.x - a.p.x));
    a.mx = d > 30 ? Math.sign(Math.round((e.x - a.p.x) / d * 2)) : 0;
    a.my = d > 30 ? Math.sign(Math.round((e.y - a.p.y) / d * 2)) : 0;
    if (d < 45) a.pending |= Btn.Light;
    await wait(120);
    if (a.p.hp < 40) a.room.send("dev:heal");
  }
  a.mx = a.my = 0;
  const xpGain = a.since(mark, "xp");
  check("goblin killed for experience", xpGain.length > 0, `xp events: ${xpGain.map((x) => x.amount).join(",")}`);
  await wait(400);
  // Goblins always carry gold; walking over it collects it (it may already be under our feet).
  let goldDrop: any;
  a.room.state.drops?.forEach((d: any) => { if (d.kind === 1 && Math.hypot(d.x - a.p.x, d.y - a.p.y) < 200) goldDrop = d; });
  if (goldDrop) await a.teleport(goldDrop.x, goldDrop.y);
  await wait(500);
  const looted = a.since(mark, "looted").filter((m) => m.key === "gold");
  check("gold dropped and collected by walking over it", a.inv.gold > goldBeforeFight && looted.length > 0, `gold ${goldBeforeFight}→${a.inv.gold} (${looted.map((m) => m.qty).join(",")})`);

  // --- Equipment ----------------------------------------------------------------------
  a.room.send("dev:give", { key: "armor_leather", rarity: 2 });
  await wait(300);
  const jerkin = a.inv.inventory.find((x: any) => x?.key === "armor_leather");
  a.room.send("equip", jerkin?.uid);
  await wait(400);
  check("equip changes gear and looks", a.inv.equipment.armor?.key === "armor_leather" && a.p.armorLook === 2 && a.inv.derived.defense > 6, `armor ${a.inv.equipment.armor?.key}, look ${a.p.armorLook}, defense ${a.inv.derived.defense}`);

  // --- Shop ------------------------------------------------------------------------------
  const tilde = npc("merchant");
  await a.teleport(tilde.x, tilde.y + 30);
  a.room.send("dev:give", { gold: 100 });
  await wait(200);
  const g1 = a.inv.gold;
  const tonics = a.count("tonic");
  a.room.send("shop:buy", { shop: "store", idx: SHOPS.store.findIndex((e) => e.key === "tonic") });
  await wait(400);
  check("buy a tonic", a.inv.gold === g1 - 18 && a.count("tonic") === tonics + 1, `gold ${g1}→${a.inv.gold}, tonics ${tonics}→${a.count("tonic")}`);
  const padded = a.inv.inventory.find((x: any) => x?.key === "armor_padded");
  const g2 = a.inv.gold;
  a.room.send("shop:sell", padded?.uid);
  await wait(400);
  check("sell old armour", a.inv.gold > g2 && !a.inv.inventory.some((x: any) => x?.uid === padded?.uid), `gold ${g2}→${a.inv.gold}`);

  // --- Storage -----------------------------------------------------------------------------
  const wick = npc("banker");
  await a.teleport(wick.x, wick.y + 30);
  const g3 = a.inv.gold;
  a.room.send("bank:deposit", { gold: 50 });
  const bank = await a.next("bank");
  await wait(200);
  check("deposit gold in storage", bank?.bankGold === 50 && a.inv.gold === g3 - 50, `bank ${bank?.bankGold}, carried ${g3}→${a.inv.gold}`);

  // --- Death: bag drop and recovery -------------------------------------------------------
  a.room.send("dev:give", { key: "mat_scrap", qty: 4 });
  await wait(300);
  const carried = a.inv.gold;
  // Fall somewhere quiet (dev-only self-kill) so recovering the bag is a fair test.
  const quiet = { x: 60 * 32, y: 100 * 32 };
  await a.teleport(quiet.x, quiet.y);
  const diedP = a.next("died", () => true, 10000);
  a.room.send("dev:kill");
  const died = await diedP;
  await wait(300); // the pack update follows the death notice
  check("death drops a bag", !!died && (died.gold > 0 || died.items > 0) && a.count("mat_scrap") === 0, `dropped ${died?.gold} gold, ${died?.items} stack(s); scrap now ${a.count("mat_scrap")}`);
  let bag: any;
  a.room.state.drops?.forEach((d: any) => { if (d.kind === 2) bag = d; });
  const bagPos = bag ? { x: bag.x, y: bag.y } : undefined;
  await wait(1400); // "Return now" unlocks a moment after falling
  a.room.send("respawnNow");
  await wait(1200);
  if (bagPos) {
    // Clear the area so recovery is testable, then walk back to the bag.
    await a.teleport(bagPos.x, bagPos.y);
    a.room.send("dev:heal");
    let id = "";
    a.room.state.drops?.forEach((d: any, k: string) => { if (d.kind === 2) id = k; });
    a.room.send("pickup", id);
    const rec = await a.next("looted", (m) => m.key === "bag", 3000);
    await wait(300);
    check("recover belongings", !!rec && a.count("mat_scrap") === 4, `scrap ${a.count("mat_scrap")}, gold ${a.inv.gold} (carried ${carried} before death)`);
  } else check("bag present", false, "no bag found");
  await a.teleport(gm.x, gm.y + 40);

  // --- Persistence --------------------------------------------------------------------------
  const snapshot = JSON.stringify({ eq: a.inv.equipment, gold: a.inv.gold, quests: a.inv.quests, level: a.inv.level });
  const token = a.token;
  await a.leave();
  await wait(500);
  const a2 = new Bot(new Client(endpoint));
  await a2.join("world", { token });
  const again = JSON.stringify({ eq: a2.inv.equipment, gold: a2.inv.gold, quests: a2.inv.quests, level: a2.inv.level });
  check("character persists across reconnect", snapshot === again, snapshot === again ? `gold ${a2.inv.gold}, quests ${Object.keys(a2.inv.quests).join(",")}` : `before ${snapshot.slice(0, 120)}… after ${again.slice(0, 120)}…`);
  check("position persists", Math.hypot(a2.p.x - gm.x, a2.p.y - gm.y - 40) < 40, `at ${a2.p.x.toFixed(0)},${a2.p.y.toFixed(0)}`);

  // --- Party -----------------------------------------------------------------------------
  const b = new Bot(new Client(endpoint));
  await b.join("world", { guest: BUDDY });
  a2.room.send("party:invite", BUDDY);
  const inv = await b.next("partyInvite");
  b.room.send("party:accept");
  const pa = await a2.next("party", (m) => m && m.members?.length === 2);
  check("party formed", !!inv && !!pa, `members ${pa?.members?.map((m: any) => m.name).join(", ")}`);
  a2.room.send("chat", { text: "hello party", channel: "party" });
  const heard = await b.next("chat", (m) => m.channel === "party" && m.text === "hello party");
  check("party chat reaches member", !!heard, heard ? `${heard.from}: ${heard.text}` : "not received");
  const status = await b.next("partyStatus", (m) => m.length === 2);
  check("party frames show health", !!status && status.every((m: any) => typeof m.hp === "number"), status ? status.map((m: any) => `${m.name} ${m.hp}/${m.hpMax}`).join(", ") : "none");

  // --- Dungeon together --------------------------------------------------------------------
  a2.room.send("dev:give", { key: "key_ruins" });
  const door = map.object("undercroft-door")!;
  await a2.teleport(door.x, door.y + 30);
  await b.teleport(door.x + 20, door.y + 40);
  await wait(300);
  const tbP = b.next("travel", () => true, 5000);
  const taP = a2.next("travel", () => true, 5000);
  a2.room.send("interact", "undercroft-door");
  const [ta, tb] = await Promise.all([taP, tbP]);
  check("both receive the dungeon invitation", !!ta?.roomId && ta?.roomId === tb?.roomId, `room ${ta?.roomId}`);
  if (ta?.roomId) {
    a2.running = false;
    b.running = false;
    await a2.room.leave(true);
    await b.room.leave(true);
    await a2.join("dungeon", { token }, ta.roomId);
    await b.join("dungeon", { guest: BUDDY }, tb.roomId);
    await wait(500);
    check("party is together in the Undercroft", a2.room.state.players.size === 2 && a2.room.roomId === b.room.roomId, `${a2.room.state.players.size} players in ${a2.room.roomId}`);
  }

  await a2.leave();
  await b.leave();
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
