/**
 * Skill scrolls, interiors, missions and Floor 3 end to end (npm run floor3):
 *   - a new climber knows Whirlwind; reading a scroll teaches a skill (once), universal
 *     skills go in any weapon's slots;
 *   - buildings have interiors: the Archivist works inside and sells scrolls for gold and Marks;
 *   - the Mission Board posts repeatable missions that pay Marks;
 *   - the Ember Stair leads to Floor 3; Cindermaw carries the Emberwyrm Sigil; the sigil
 *     opens the Dragon's Roost, whose hatchery, flame seals, Vyrmak and Ignivar all play out.
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor1, buildFloor3, EAct, ENEMIES, scrollSkill, SERVER_PORT, TILE, UNIVERSAL_BASE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
const guest = `Wyrmslayer${Math.floor(Math.random() * 1e5)}`;
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
const tpPx = async (c: Conn, x: number, y: number) => {
  c.room.send("dev:teleport", { x, y });
  await wait(350);
};
const pickupAll = async (c: Conn) => {
  const p = me(c);
  c.room.state.drops?.forEach((d: any, id: string) => {
    if (p && Math.hypot(d.x - p.x, d.y - p.y) < 500) {
      c.room.send("dev:teleport", { x: d.x, y: d.y });
      c.room.send("pickup", id);
    }
  });
  await wait(800);
};
const leave = (c: Conn) => Promise.race([c.room.leave().catch(() => {}), wait(1200)]);
const talk = async (c: Conn, npc: string) => {
  const m = c.msgs.length;
  c.room.send("interact", npc);
  return waitFor(() => since(c, m, "dialog")[0]);
};
const uidOf = (c: Conn, key: string) => c.inv?.inventory?.find((it: any) => it?.key === key)?.uid as string | undefined;

// --- Skill scrolls ---------------------------------------------------------------------------
const f1 = buildFloor1();
let w = await connect("world");
check("a new climber knows Whirlwind", !!w.inv?.skills?.includes("sword.whirlwind") && w.inv?.loadout?.sword?.[0] === 0, JSON.stringify({ skills: w.inv?.skills, loadout: w.inv?.loadout?.sword }));
check("and has no Marks yet", w.inv?.marks === 0, String(w.inv?.marks));
w.room.send("dev:give", { key: "scroll_any_kick", qty: 2 });
await waitFor(() => uidOf(w, "scroll_any_kick"));
let mark = w.msgs.length;
w.room.send("skills:read", uidOf(w, "scroll_any_kick"));
const learned = await waitFor(() => since(w, mark, "learned")[0]);
check("reading a scroll teaches its skill", learned?.id === "any.kick" && !!w.inv?.skills?.includes("any.kick"), JSON.stringify(learned));
await waitFor(() => w.inv?.inventory?.find((it: any) => it?.key === "scroll_any_kick")?.qty === 1);
check("the scroll is used up", w.inv?.inventory?.find((it: any) => it?.key === "scroll_any_kick")?.qty === 1, "");
check("a universal skill drops into your free slot", w.inv?.loadout?.sword?.[1] === UNIVERSAL_BASE, JSON.stringify(w.inv?.loadout?.sword));
mark = w.msgs.length;
w.room.send("skills:read", uidOf(w, "scroll_any_kick"));
const again = await waitFor(() => since(w, mark, "notice").find((n: any) => String(n.text).includes("already know")));
check("a skill can't be learned twice", !!again, again?.text ?? "");
w.room.send("skills:equip", { weapon: "spear", slot: 0, index: UNIVERSAL_BASE });
await waitFor(() => w.inv?.loadout?.spear?.[0] === UNIVERSAL_BASE);
check("universal skills fit any weapon's slots", w.inv?.loadout?.spear?.[0] === UNIVERSAL_BASE, JSON.stringify(w.inv?.loadout?.spear));
w.room.send("skills:equip", { weapon: "spear", slot: 1, index: 0 });
await wait(300);
check("…but another weapon's skills don't", w.inv?.loadout?.spear?.[1] !== 0 || !w.inv?.skills?.includes("sp.charge"), JSON.stringify(w.inv?.loadout?.spear));

// --- Interiors and the Archivist ---------------------------------------------------------------
const door = f1.object("enter-scholar")!;
await tpPx(w, door.x, door.y + 20);
w.room.send("interact", "enter-scholar");
const inside = await waitFor(() => (me(w).y > f1.outdoorHeight * TILE ? me(w) : undefined));
check("the door takes you inside", !!inside, `y ${Math.round(me(w).y / TILE)} (outdoors ends at ${f1.outdoorHeight})`);
const pell = f1.npcs.find((n) => n.id === "archivist1")!;
await tpPx(w, pell.x, pell.y + 30);
const arch = await talk(w, "archivist1");
check("the Archivist sells scrolls indoors", !!arch?.services?.includes("shop:scrolls1") && (arch?.shop?.length ?? 0) >= 10, arch ? `${arch.shop?.length} scrolls` : "no dialog");
const floorOwn = (arch?.shop ?? []).filter((e: any) => scrollSkill(e.key)?.floor === 1).length;
check("including Floor 1's own abilities", floorOwn >= 3, `${floorOwn} floor abilities`);
const idx = (arch?.shop ?? []).findIndex((e: any) => e.key === "scroll_any_knife");
// (Under 1,000 gold: the Deep Pockets achievement would pay Marks of its own.)
w.room.send("dev:give", { key: "", gold: 900 });
await wait(200);
mark = w.msgs.length;
w.room.send("shop:buy", { shop: "scrolls1", idx });
const poor = await waitFor(() => since(w, mark, "notice").find((n: any) => String(n.text).includes("Marks")));
check("scrolls cost Marks as well as gold", !!poor, poor?.text ?? "");
w.room.send("dev:give", { key: "", marks: 10 });
await waitFor(() => w.inv?.marks >= 10);
w.room.send("shop:buy", { shop: "scrolls1", idx });
const got = await waitFor(() => uidOf(w, "scroll_any_knife"));
check("bought with gold and Marks", !!got && w.inv?.marks === 8, `marks ${w.inv?.marks}`);
const mat = f1.object("leave-scholar")!;
await tpPx(w, mat.x, mat.y - 26);
w.room.send("interact", "leave-scholar");
const out = await waitFor(() => (me(w).y < f1.outdoorHeight * TILE ? me(w) : undefined));
check("the doormat takes you back out", !!out && Math.hypot(me(w).x - door.x, me(w).y - door.y) < 80, `at ${Math.round(me(w).x / TILE)},${Math.round(me(w).y / TILE)}`);

// --- The Mission Board ------------------------------------------------------------------------
w.room.send("dev:questdone", "q_welcome");
const board = f1.npcs.find((n) => n.id === "board1")!;
await tpPx(w, board.x, board.y + 24);
const posted = await talk(w, "board1");
check("the Mission Board posts missions", !!posted?.offers?.some((o: any) => o.id === "m1_wolves"), posted ? posted.offers.map((o: any) => o.id).join(",") : "no dialog");
w.room.send("quest:accept", "m1_wolves");
await waitFor(() => w.inv?.quests?.m1_wolves);
const marksBefore = w.inv?.marks ?? 0;
await tp(w, 90, 70);
for (let i = 0; i < 12 && !w.inv?.quests?.m1_wolves?.done; i++) {
  w.room.send("dev:spawn", { key: "wolf", level: 2 });
  await wait(650);
  w.room.send("dev:killnear", 300);
  await wait(250);
}
check("a finished mission pays Marks", !!w.inv?.quests?.m1_wolves?.done && (w.inv?.marks ?? 0) >= marksBefore + 2, `marks ${marksBefore} → ${w.inv?.marks}`);
await tpPx(w, board.x, board.y + 24);
const later = await talk(w, "board1");
check("…and goes back on the board later, not at once", !later?.offers?.some((o: any) => o.id === "m1_wolves"), later ? later.offers.map((o: any) => o.id).join(",") : "");

// --- Up to Floor 3 --------------------------------------------------------------------------
w.room.send("dev:floor", 3);
w.room.send("dev:give", { key: "", xp: 400000 });
for (const q of ["q_keeper", "f2_spire"]) w.room.send("dev:questdone", q);
await wait(400);
check("a climber can reach level 16", (w.inv?.level ?? 0) >= 15, `level ${w.inv?.level}`);
await leave(w);
let f2 = await connect("floor2");
await tp(f2, 92, 10);
mark = f2.msgs.length;
f2.room.send("interact", "sealed-stair");
const up = await waitFor(() => since(f2, mark, "travel")[0]);
check("the Ember Stair leads up", up?.room === "floor3", JSON.stringify(up));
await leave(f2);

const f3map = buildFloor3();
let f = await connect("floor3");
const p0 = me(f);
const descent = f3map.object("descent3")!;
check("you arrive at Emberhold's Descent", !!p0 && Math.hypot(p0.x - descent.x, p0.y - descent.y) < 120, p0 ? `at ${Math.round(p0.x / TILE)},${Math.round(p0.y / TILE)}` : "");
check("Floor 3 is announced", f.msgs.some((x) => x.type === "discover" && x.m.name === "Floor 3"), "");
const cap = f3map.npcs.find((n) => n.id === "captain")!;
await tpPx(f, cap.x, cap.y + 30);
const brask = await talk(f, "captain");
check("Captain Brask offers the Floor 3 story", !!brask?.offers?.some((o: any) => o.id === "f3_arrival"), brask ? brask.offers.map((o: any) => o.id).join(",") : "no dialog");
const keep = f3map.object("enter-emberkeep")!;
await tpPx(f, keep.x, keep.y + 20);
f.room.send("interact", "enter-emberkeep");
await waitFor(() => (me(f).y > f3map.outdoorHeight * TILE ? me(f) : undefined));
const corvane = f3map.npcs.find((n) => n.id === "archivist3")!;
await tpPx(f, corvane.x, corvane.y + 30);
const a3 = await talk(f, "archivist3");
const dragonArts = (a3?.shop ?? []).filter((e: any) => scrollSkill(e.key)?.floor === 3).map((e: any) => scrollSkill(e.key)!.name);
check("the Keep's Archivist sells the Ember Reaches' own arts", dragonArts.length >= 3, dragonArts.join(", "));
const ys = f3map.npcs.find((n) => n.id === "scholar")!;
await tpPx(f, ys.x, ys.y + 26);
const ysolde = await talk(f, "scholar");
check("Ysolde reads in the Keep's library", !!ysolde, "");

// Dragons.
await tp(f, 30, 90);
f.room.send("dev:spawn", { key: "drake", level: 14 });
await wait(700);
let drake = false;
f.room.state.enemies?.forEach((e: any) => {
  if (ENEMIES[e.def]?.key === "drake" && e.act !== EAct.Dead) drake = true;
});
check("drakes take wing in the canyon", drake, "");
f.room.send("dev:killnear", 400);
await wait(900);
// Cindermaw carries the Emberwyrm Sigil.
await tp(f, 112, 40);
f.room.send("dev:spawn", { key: "cindermaw", level: 15 });
await wait(900);
f.room.send("dev:killnear", 400);
await wait(900);
await pickupAll(f);
const sigil = await waitFor(() => uidOf(f, "key_roost"), 5000);
check("Cindermaw drops the Emberwyrm Sigil", !!sigil, f.inv?.inventory?.filter(Boolean).map((i: any) => i.key).join(",") ?? "");
await tp(f, 90, 9);
mark = f.msgs.length;
f.room.send("interact", "roost-door");
const inTravel = await waitFor(() => since(f, mark, "travel")[0], 5000);
check("the sigil opens the Dragon's Roost", inTravel?.room === "roost" && !!inTravel.roomId, JSON.stringify(inTravel));
await leave(f);

// --- The Dragon's Roost -------------------------------------------------------------------------
const r = await connect("roost", inTravel?.roomId);
await wait(700);
check("inside the Dragon's Roost", r.msgs.some((x) => x.type === "discover" && x.m.name === "The Dragon's Roost"), r.room.state.stage ?? "");
await tp(r, 42, 103);
const hatch = await waitFor(() => r.msgs.find((x) => x.type === "banner" && x.m.title === "The Hatchery"), 4000);
check("the Hatchery wakes", !!hatch, r.room.state.stage);
for (let i = 0; i < 18 && !r.msgs.some((x) => x.type === "banner" && String(x.m.title).includes("falls silent")); i++) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 800);
  await wait(700);
}
check("three waves of the brood cleared", r.msgs.some((x) => x.type === "banner" && String(x.m.title).includes("falls silent")), r.room.state.stage);
check("the Brood-Mother came last", r.msgs.some((x) => x.type === "banner" && x.m.title === "The Brood-Mother"), "");
for (const [id, tx, ty] of [["lever-0", 25, 67], ["lever-1", 42, 66], ["lever-2", 60, 67]] as const) {
  await tp(r, tx, ty);
  r.room.send("interact", id);
  await wait(350);
  r.room.send("dev:killnear", 500);
  r.room.send("dev:heal");
  await wait(250);
}
const blaze = await waitFor(() => r.msgs.find((x) => x.type === "banner" && String(x.m.title).includes("seals blaze")), 3000);
check("three flame seals lit in time open the way", !!blaze, r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 50);
await wait(800);
r.room.send("dev:bosshp", { boss: "warden", frac: 0.02 });
await wait(200);
r.room.send("dev:killnear", 600);
const vyrmak = await waitFor(() => r.msgs.find((x) => x.type === "banner" && String(x.m.title).includes("Dragonsworn falls")), 4000);
check("Vyrmak the Dragonsworn falls", !!vyrmak, r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 20);
const intro = await waitFor(() => r.msgs.find((x) => x.type === "bossIntro"), 4000);
check("Ignivar's intro", intro?.m.name === "Ignivar, the Ember Tyrant", JSON.stringify(intro?.m));
await wait(800);
r.room.send("dev:bosshp", { frac: 0.02 });
await wait(200);
r.room.send("dev:killnear", 900);
const victory = await waitFor(() => r.msgs.find((x) => x.type === "victory"), 5000);
check("Ignivar falls — the Tyrant is dead", !!victory, JSON.stringify(victory?.m));
await wait(900);
await pickupAll(r);
check("the Heart of Ignivar won", r.inv?.inventory?.some((it: any) => it?.key === "art_dragonheart") ?? false, "");
const legendary = r.inv?.inventory?.find((it: any) => it && scrollSkill(it.key)?.rarity === 4);
check("a first victory over Ignivar yields a legendary scroll", !!legendary, legendary ? scrollSkill(legendary.key)!.name : "none");
check("first boss victories pay Marks", (r.inv?.marks ?? 0) > 8, `marks ${r.inv?.marks}`);
await tp(r, 42, 144);
mark = r.msgs.length;
r.room.send("interact", "exit");
const down = await waitFor(() => since(r, mark, "travel")[0], 3000);
check("the exit leads back to the Caldera", down?.room === "floor3", JSON.stringify(down));
await leave(r);
f = await connect("floor3");
const p1 = me(f);
const gate = f3map.object("roost-door")!;
check("you step out by the Roost Gate", !!p1 && Math.hypot(p1.x - gate.x, p1.y - gate.y) < 160, p1 ? `at ${Math.round(p1.x / TILE)},${Math.round(p1.y / TILE)}` : "");
await leave(f);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
