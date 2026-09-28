/**
 * Floor 2 end to end (npm run floor2): the Ascent Gate takes you up, the Herald gives the
 * story, lynxes count for it, the Storm Colossus drops the Stormspire Seal, the seal opens
 * the Stormspire, and the dungeon's gallery, conduits, Stormwarden and Vaelra all play out.
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor2, EAct, ENEMIES, SERVER_PORT, TILE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
const guest = `Climber${Math.floor(Math.random() * 1e5)}`;
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

interface Conn {
  room: Room;
  msgs: { type: string; m: any }[];
  inv?: any;
}
async function connect(kind: string, roomId?: string): Promise<Conn> {
  const c = new Client(endpoint);
  const room = roomId ? await c.joinById(roomId, { guest }) : await c.joinOrCreate(kind, { guest });
  const conn: Conn = { room, msgs: [] };
  room.onMessage("*", (type, m) => {
    conn.msgs.push({ type: String(type), m });
    if (type === "inv") conn.inv = m;
  });
  for (let i = 0; i < 200 && (!room.state.players?.get(room.sessionId) || !conn.inv); i++) await wait(25);
  return conn;
}
async function waitFor<T>(fn: () => T | undefined | false, ms = 4000): Promise<T | undefined> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(50);
  }
  return undefined;
}
const since = (c: Conn, mark: number, type: string) => c.msgs.slice(mark).filter((x) => x.type === type).map((x) => x.m);
const me = (c: Conn) => c.room.state.players.get(c.room.sessionId);
const tp = async (c: Conn, tx: number, ty: number) => {
  c.room.send("dev:teleport", { x: px(tx), y: px(ty) });
  await wait(350);
};
/** Pick up every drop near you (boss loot lands on the ground). */
const pickupAll = async (c: Conn) => {
  if (process.env.DEBUG) { const l: string[] = []; c.room.state.drops?.forEach((d: any) => l.push(`${d.key}@${Math.round(d.x)},${Math.round(d.y)}`)); console.log("  drops:", l.join(" ") || "none", "me", Math.round(me(c)?.x ?? 0), Math.round(me(c)?.y ?? 0)); }
  const p = me(c);
  c.room.state.drops?.forEach((d: any, id: string) => {
    if (p && Math.hypot(d.x - p.x, d.y - p.y) < 400) {
      c.room.send("dev:teleport", { x: d.x, y: d.y });
      c.room.send("pickup", id);
    }
  });
  await wait(700);
  if (process.env.DEBUG) console.log("  notices:", c.msgs.filter((x) => x.type === "notice" || x.type === "looted").slice(-6).map((x) => JSON.stringify(x.m)).join(" "));
};
const leave = (c: Conn) => Promise.race([c.room.leave().catch(() => {}), wait(1200)]);

// --- Floor 1: unlock and climb -------------------------------------------------------------
let w = await connect("world");
w.room.send("dev:floor", 2);
w.room.send("dev:questdone", "q_keeper");
// A climber who has finished Floor 1: level 12, so a stray boss hit during a scripted step
// cannot kill them (a wipe would reset the fight and fail the step for the wrong reason).
w.room.send("dev:give", { key: "", xp: 60000 });
await wait(300);
await tp(w, 38, 69);
let mark = w.msgs.length;
w.room.send("interact", "ascent-gate");
const up = await waitFor(() => since(w, mark, "travel")[0]);
check("the Ascent Gate leads up", up?.room === "floor2", JSON.stringify(up));
await leave(w);

// --- Floor 2 -------------------------------------------------------------------------------
let f = await connect("floor2");
const p0 = me(f);
check("you arrive at Skyreach Landing", !!p0 && Math.hypot(p0.x - px(85), p0.y - px(130)) < 140, p0 ? `at ${Math.round(p0.x / TILE)},${Math.round(p0.y / TILE)}` : "no player");
await tp(f, 85, 116);
mark = f.msgs.length;
f.room.send("interact", "herald");
const dlg = await waitFor(() => since(f, mark, "dialog")[0]);
check("the Herald offers the Floor 2 story", !!dlg?.offers?.some((o: any) => o.id === "f2_arrival"), dlg ? dlg.offers.map((o: any) => o.id).join(",") : "no dialog");
f.room.send("quest:accept", "f2_arrival");
await wait(400);
check("Above the Clouds accepted", !!f.inv?.quests?.f2_arrival, JSON.stringify(f.inv?.quests?.f2_arrival));

// Skyreach Landing's services: the Quartermaster's map, the Skysmith's stock, the vault, the inn.
f.room.send("dev:give", { key: "", gold: 2000 });
const f2map = buildFloor2();
/** Walk up to an NPC wherever they stand (shopkeepers work indoors now). */
const talkTo = async (npc: string, _tx?: number, _ty?: number) => {
  const n = f2map.npcs.find((q) => q.id === npc)!;
  f.room.send("dev:teleport", { x: n.x, y: n.y + 30 });
  await wait(350);
  const m = f.msgs.length;
  f.room.send("interact", npc);
  return waitFor(() => since(f, m, "dialog")[0]);
};
const qm = await talkTo("quarter", 71, 119);
check("the Quartermaster sells Floor 2 wares", !!qm?.services?.includes("shop:store2") && qm?.shop?.[0]?.key === "map_floor2", qm ? qm.services.join(",") : "no dialog");
f.room.send("shop:buy", { shop: "store2", idx: 0 });
const mapped = await waitFor(() => f.inv?.discovered?.includes("map:floor2") || undefined);
check("the Map of the Gilded Terraces is learned", !!mapped, "");
const sm = await talkTo("skysmith", 100, 119);
check("the Skysmith forges and sells the Stormglass weapons", !!sm?.services?.includes("smith") && (sm?.shop?.length ?? 0) > 0, sm ? `${sm.services.join(",")} · ${sm.shop?.length ?? 0} wares` : "no dialog");
const before = f.inv?.inventory?.filter(Boolean).length ?? 0;
f.room.send("shop:buy", { shop: "smith2", idx: 0 });
const bought = await waitFor(() => (f.inv?.inventory?.filter(Boolean).length ?? 0) > before || undefined);
check("a Skysmith weapon bought", !!bought, sm?.shop?.[0]?.key ?? "");
// Floor 2 gear is worked with Floor 2 materials: Gilded Plate, not Floor 1 scrap.
const blade = f.inv?.inventory?.find((it: any) => it?.key === "sword_storm");
let fm = f.msgs.length;
f.room.send("smith:upgrade", blade?.uid);
const refused = await waitFor(() => since(f, fm, "notice").find((n: any) => String(n.text).includes("Gilded Plate")));
check("upgrading Stormglass asks for Gilded Plate", !!refused, refused?.text ?? JSON.stringify(since(f, fm, "notice")));
f.room.send("dev:give", { key: "mat_gilded", qty: 2 });
await wait(300);
if (process.env.DEBUG) console.log("  pack:", f.inv?.inventory?.filter(Boolean).map((i: any) => `${i.key}x${i.qty}`).join(" "));
fm = f.msgs.length;
f.room.send("smith:upgrade", blade?.uid);
const forged = await waitFor(() => since(f, fm, "forged")[0]);
check("the Skysmith forges it to +1", forged?.plus === 1, JSON.stringify(forged ?? since(f, fm, "notice")));
const vk = await talkTo("vaultkeep", 72, 126);
check("the Vaultkeeper keeps a vault", !!vk?.services?.includes("bank"), vk ? vk.services.join(",") : "no dialog");
let bm = f.msgs.length;
f.room.send("bank:deposit", { gold: 100 });
const bank = await waitFor(() => since(f, bm, "bank")[0]);
check("gold deposited in the Skyreach vault", (bank?.bankGold ?? 0) >= 100, JSON.stringify({ bankGold: bank?.bankGold }));
const inn = await talkTo("windrest", 99, 128);
check("the Windrest innkeeper trades rumours", !!inn?.services?.includes("rumour") && !!inn?.greeting, inn?.greeting?.slice(0, 60) ?? "no dialog");
await tp(f, 85, 116);

await tp(f, 70, 80);
await wait(700); // the zone visit registers first
const lynx: number | undefined = await waitFor(() => {
  let n = 0;
  f.room.state.enemies?.forEach((e: any) => {
    if (ENEMIES[e.def]?.key === "skylynx" && e.act !== EAct.Dead && Math.hypot(e.x - px(70), e.y - px(82)) < 220) n++;
  });
  return n || undefined;
}, 3000);
check("sky lynxes hunt the terraces", (lynx ?? 0) > 0 || !!buildFloor2().spawns.find((sp) => sp.enemies.includes("skylynx") && Math.hypot(sp.x - px(70), sp.y - px(82)) < 400), `${lynx ?? 0} nearby`);
// Another run may have just cleared them (the world is shared): raise a pack of our own.
if (!lynx) for (let i = 0; i < 3; i++) f.room.send("dev:spawn", { key: "skylynx", level: 8 });
await wait(lynx ? 300 : 900); // fresh spawns shimmer in, untouchable, for a moment
const lm = f.msgs.length;
f.room.send("dev:killnear", 300);
await wait(900);
if (process.env.DEBUG) console.log("  lynx", lynx, "me", Math.round(me(f).x / TILE), Math.round(me(f).y / TILE), "deaths", since(f, lm, "death").length, "quest msgs", JSON.stringify(since(f, lm, "quest")));
check("lynx kills count for the quest", (f.inv?.quests?.f2_arrival?.progress ?? 0) > 0 || (f.inv?.quests?.f2_arrival?.stage ?? 0) > 1, JSON.stringify(f.inv?.quests?.f2_arrival));

// The Colossus in the Thunder Ring wears the Stormspire Seal. The world is shared (another
// run may have felled the ring's Colossus), so raise one of our own.
const ring = buildFloor2().spawns.find((sp) => sp.enemies.includes("colossus"));
check("the Colossus stands in the Thunder Ring", !!ring && Math.hypot(ring.x - px(108), ring.y - px(26)) < 64, ring ? `${ring.id} respawns every ${ring.respawn}s` : "no spawn");
await tp(f, 104, 36);
f.room.send("dev:spawn", { key: "colossus", level: 12 });
await wait(600);
mark = f.msgs.length;
f.room.send("dev:killnear", 200);
await wait(900);
await pickupAll(f);
const seal = await waitFor(() => f.inv?.inventory?.some((it: any) => it?.key === "key_stormspire") || undefined, 5000);
check("the Storm Colossus drops the Stormspire Seal", !!seal, f.inv?.inventory?.filter(Boolean).map((i: any) => i.key).join(",") ?? "");

// The rest of the story, then the last quest.
for (const q of ["f2_arrival", "f2_causeway", "f2_storm"]) f.room.send("dev:questdone", q);
await wait(300);
await tp(f, 85, 116);
f.room.send("quest:accept", "f2_spire");
await wait(400);
check("The Stormspire accepted", !!f.inv?.quests?.f2_spire, JSON.stringify(f.inv?.quests?.f2_spire));

await tp(f, 85, 6);
mark = f.msgs.length;
f.room.send("interact", "stormspire-door");
const inTravel = await waitFor(() => since(f, mark, "travel")[0], 5000);
check("the seal opens the Stormspire", inTravel?.room === "stormspire" && !!inTravel.roomId, JSON.stringify(inTravel));
await leave(f);

// --- The Stormspire --------------------------------------------------------------------------
const s = await connect("stormspire", inTravel?.roomId);
await wait(700);
check("inside the Stormspire", s.msgs.some((x) => x.type === "discover" && x.m.name === "The Stormspire"), s.room.state.stage ?? "");
check("the dungeon step completes on entry", (s.inv?.quests?.f2_spire?.stage ?? 0) >= 1, JSON.stringify(s.inv?.quests?.f2_spire));

await tp(s, 40, 96);
const gal = await waitFor(() => s.msgs.find((x) => x.type === "banner" && x.m.title === "The Gallery"), 4000);
check("the Gallery ambush springs", !!gal, s.room.state.stage);
for (let i = 0; i < 12 && !s.msgs.some((x) => x.type === "banner" && String(x.m.title).includes("silent")); i++) {
  s.room.send("dev:killnear", 700);
  await wait(700);
}
check("both Gallery waves cleared", s.msgs.some((x) => x.type === "banner" && String(x.m.title).includes("silent")), s.room.state.stage);

for (const [id, tx, ty] of [["lever-0", 29, 69], ["lever-1", 40, 64], ["lever-2", 52, 69]] as const) {
  await tp(s, tx, ty);
  s.room.send("interact", id);
  await wait(400);
  s.room.send("dev:killnear", 500);
  await wait(300);
}
const blaze = await waitFor(() => s.msgs.find((x) => x.type === "banner" && String(x.m.title).includes("Conduits blaze")), 3000);
check("three conduits open the way", !!blaze, s.room.state.stage);

s.room.send("dev:heal");
await tp(s, 40, 48);
await wait(800);
s.room.send("dev:bosshp", { boss: "warden", frac: 0.02 });
await wait(200);
s.room.send("dev:killnear", 600);
const kael = await waitFor(() => s.msgs.find((x) => x.type === "banner" && String(x.m.title).includes("Stormwarden falls")), 4000);
if (process.env.DEBUG && !kael) {
  const l: string[] = [];
  s.room.state.enemies?.forEach((e: any) => l.push(`${ENEMIES[e.def]?.key}@${Math.round(e.x / TILE)},${Math.round(e.y / TILE)} act${e.act} hp${e.hp}`));
  const pl = me(s);
  console.log("  enemies:", l.join(" | "), "me", Math.round((pl?.x ?? 0) / TILE), Math.round((pl?.y ?? 0) / TILE), "act", pl?.act, "hp", pl?.hp, "stage", s.room.state.stage, "banners", s.msgs.filter((x) => x.type === "banner").map((x) => x.m.title).join(" / "));
}
check("Kael, the Stormwarden falls", !!kael, s.room.state.stage);

s.room.send("dev:heal");
await tp(s, 40, 16);
const intro = await waitFor(() => s.msgs.find((x) => x.type === "bossIntro"), 4000);
check("Vaelra's intro", intro?.m.name === "Vaelra, Keeper of the Storm", JSON.stringify(intro?.m));
await wait(800);
s.room.send("dev:bosshp", { frac: 0.02 });
await wait(200);
s.room.send("dev:killnear", 800);
const victory = await waitFor(() => s.msgs.find((x) => x.type === "victory"), 5000);
check("Vaelra falls — the storm breaks", !!victory, JSON.stringify(victory?.m));
await wait(900);
await pickupAll(s);
check("the story advances", (s.inv?.quests?.f2_spire?.stage ?? 0) >= 2, JSON.stringify(s.inv?.quests?.f2_spire));
check("Heart of the Storm won", s.inv?.inventory?.some((it: any) => it?.key === "art_stormheart") ?? false, "");

await tp(s, 40, 134);
mark = s.msgs.length;
s.room.send("interact", "exit");
const down = await waitFor(() => since(s, mark, "travel")[0], 3000);
check("the exit leads back to the Heights", down?.room === "floor2", JSON.stringify(down));
await leave(s);
f = await connect("floor2");
const p1 = me(f);
check("you step out by the Stormspire Gate", !!p1 && Math.hypot(p1.x - px(85), p1.y - px(5)) < 160, p1 ? `at ${Math.round(p1.x / TILE)},${Math.round(p1.y / TILE)}` : "");
await leave(f);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
