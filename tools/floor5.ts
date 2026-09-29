/**
 * Floor 5 end to end (npm run floor5): the Starless Stair from the Frostvale, Duskhollow,
 * the Lantern Chapel's Archivist, curses, Nightwing's Moon Sigil, and the Abyssal Sanctum:
 * the Hollow Court, the Hall of Moons (read the dial, turn the lanterns — each drags its
 * neighbour), Maelgrim the Hollow Knight and Nyxara, Queen of the Void (and her eclipse).
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor5, EAct, ENEMIES, HazardKind, MOON_LANTERNS, MOON_PHASES, scrollSkill, SERVER_PORT, TILE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
const guest = `Nightwalker${Math.floor(Math.random() * 1e5)}`;
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
const banner = (c: Conn, test: (title: string) => boolean) => c.msgs.some((x) => x.type === "banner" && test(String(x.m.title)));

// --- Up from the Frostvale -------------------------------------------------------------------
let w = await connect("world");
w.room.send("dev:floor", 5);
w.room.send("dev:give", { key: "", xp: 5_000_000 });
w.room.send("dev:questdone", "f4_throne");
await wait(500);
check("a climber can reach level 24", (w.inv?.level ?? 0) >= 24, `level ${w.inv?.level}`);
await leave(w);
const f4 = await connect("floor4");
await tp(f4, 97, 12);
let mark = f4.msgs.length;
f4.room.send("interact", "sealed-stair5");
const up = await waitFor(() => since(f4, mark, "travel")[0]);
check("the Frozen Stair leads up out of the Frostvale", up?.room === "floor5", JSON.stringify(up));
await leave(f4);

const map = buildFloor5();
let f = await connect("floor5");
const p0 = me(f);
const descent = map.object("descent5")!;
check("you arrive at Duskhollow's Descent", !!p0 && Math.hypot(p0.x - descent.x, p0.y - descent.y) < 120, p0 ? `at ${Math.round(p0.x / TILE)},${Math.round(p0.y / TILE)}` : "");
check("Floor 5 is announced", f.msgs.some((x) => x.type === "discover" && x.m.name === "Floor 5"), "");
const warden = map.npcs.find((n) => n.id === "warden5")!;
await tpPx(f, warden.x, warden.y + 30);
const iso = await talk(f, "warden5");
check("Lanternwarden Isolde offers the Floor 5 story", !!iso?.offers?.some((o: any) => o.id === "f5_arrival"), iso ? iso.offers.map((o: any) => o.id).join(",") : "no dialog");
const chapel = map.object("enter-chapel5")!;
await tpPx(f, chapel.x, chapel.y + 20);
f.room.send("interact", "enter-chapel5");
await waitFor(() => (me(f).y > map.outdoorHeight * TILE ? me(f) : undefined));
const elowen = map.npcs.find((n) => n.id === "archivist5")!;
await tpPx(f, elowen.x, elowen.y + 30);
const a5 = await talk(f, "archivist5");
const voidArts = (a5?.shop ?? []).filter((e: any) => scrollSkill(e.key)?.floor === 5).map((e: any) => scrollSkill(e.key)!.name);
const regular = (a5?.shop ?? []).filter((e: any) => !scrollSkill(e.key)?.floor).length;
check("the Chapel's Archivist sells the Umbral Wilds' own arts", voidArts.length >= 3, voidArts.join(", "));
check("…and at least 10 new regular scrolls", regular >= 10, `${regular} regular`);

// Void drakes, and curses.
await tp(f, 24, 106);
f.room.send("dev:spawn", { key: "umbraldrake", level: 22 });
await wait(800);
let drakeId = "";
f.room.state.enemies?.forEach((e: any, id: string) => {
  if (ENEMIES[e.def]?.key === "umbraldrake" && e.act !== EAct.Dead) drakeId = id;
});
check("umbral drakes haunt the marsh", !!drakeId, "");
f.room.send("dev:killnear", 500);
await wait(700);
// Nightwing carries the Moon Sigil.
await tp(f, 60, 38);
f.room.send("dev:spawn", { key: "nightwing", level: 23 });
await wait(900);
f.room.send("dev:killnear", 400);
await wait(900);
await pickupAll(f);
const sigil = await waitFor(() => f.inv?.inventory?.some((it: any) => it?.key === "key_sanctum") || undefined, 5000);
check("Nightwing drops the Moon Sigil", !!sigil, f.inv?.inventory?.filter(Boolean).map((i: any) => i.key).join(",") ?? "");
await tp(f, 90, 9);
mark = f.msgs.length;
f.room.send("interact", "sanctum-door");
const inTravel = await waitFor(() => since(f, mark, "travel")[0], 5000);
check("the Moon Sigil opens the Abyssal Sanctum", inTravel?.room === "sanctum" && !!inTravel.roomId, JSON.stringify(inTravel));
await leave(f);

// --- The Abyssal Sanctum ----------------------------------------------------------------------
const r = await connect("sanctum", inTravel?.roomId);
await wait(700);
check("inside the Abyssal Sanctum", r.msgs.some((x) => x.type === "discover" && x.m.name === "The Abyssal Sanctum"), r.room.state.stage ?? "");
await tp(r, 42, 103);
check("the Hollow Court rises", !!(await waitFor(() => banner(r, (t) => t === "The Hollow Court"), 4000)), r.room.state.stage);
for (let i = 0; i < 18 && !banner(r, (t) => t.includes("court is silent")); i++) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 800);
  await wait(700);
}
check("three waves of the court broken", banner(r, (t) => t.includes("court is silent")), r.room.state.stage);
check("the Hollow Champion came last", banner(r, (t) => t === "The Hollow Champion"), "");

// The Moon Dial tells the sky; the lanterns drag each other round.
await tp(r, 42, 77);
mark = r.msgs.length;
r.room.send("interact", "moon-dial");
const dial = await waitFor(() => since(r, mark, "lore")[0]);
const mm = /west to east: ([^.]+)\./.exec(String(dial?.text));
const target = mm ? mm[1].split(", ").map((n) => MOON_PHASES.indexOf(n)) : [];
check("the Moon Dial shows four moons", target.length === 4 && target.every((t) => t >= 0), mm?.[1] ?? String(dial?.text));
// Linger a moment: the dark sends a shade while the moons are wrong.
await wait(4600);
check("the dark is patient (a shade comes while the moons are wrong)", banner(r, (t) => t === "The dark is patient"), "");
r.room.send("dev:heal");
r.room.send("dev:killnear", 700);
const phases = [0, 0, 0, 0];
let turns = 0;
for (let i = 0; i < 4 && target.length === 4; i++) {
  while (phases[i] !== target[i]) {
    const [lx, ly] = MOON_LANTERNS[i];
    await tp(r, lx, ly + 1);
    r.room.send("interact", `lantern-${i}`);
    await wait(250);
    phases[i] = (phases[i] + 1) % 4;
    if (i < 3) phases[i + 1] = (phases[i + 1] + 1) % 4;
    turns++;
    r.room.send("dev:heal");
  }
}
const synced = r.room.state.gates;
check("the lanterns' phases are shared with everyone", typeof synced === "number" && synced !== 0, `mask ${synced}`);
check("the moons, set to the dial, open the way", !!(await waitFor(() => banner(r, (t) => t === "The moons align"), 3000)), `${turns} turns, stage ${r.room.state.stage}`);

r.room.send("dev:heal");
await tp(r, 42, 50);
await wait(600);
for (let i = 0; i < 3 && !banner(r, (t) => t.includes("Hollow Knight falls")); i++) {
  r.room.send("dev:heal");
  await tp(r, 42, 50);
  r.room.send("dev:bosshp", { boss: "warden", frac: 0.02 });
  await wait(150);
  r.room.send("dev:killnear", 600);
  await wait(900);
}
check("Maelgrim the Hollow Knight falls", !!(await waitFor(() => banner(r, (t) => t.includes("Hollow Knight falls")), 4000)), r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 20);
const intro = await waitFor(() => r.msgs.find((x) => x.type === "bossIntro"), 4000);
check("Nyxara's intro", intro?.m.name === "Nyxara, Queen of the Void", JSON.stringify(intro?.m));
await wait(800);
// The eclipse: the Queen puts out the sun, and only the moonlight is safe.
r.room.send("dev:bosshp", { frac: 0.3 });
await wait(200);
r.room.send("dev:bossatk", "Total Eclipse");
const glyphs = await waitFor(() => {
  let n = 0;
  r.room.state.hazards?.forEach((h: any) => {
    if (h.kind === HazardKind.Glyph) n++;
  });
  return n >= 2 ? n : undefined;
}, 3000);
check("Total Eclipse leaves pools of moonlight to hide in", !!glyphs, `${glyphs ?? 0} pools`);
r.room.send("dev:heal");
r.room.send("dev:bosshp", { frac: 0.02 });
await wait(200);
r.room.send("dev:killnear", 900);
const victory = await waitFor(() => r.msgs.find((x) => x.type === "victory"), 5000);
check("Nyxara falls — the dawn returns", !!victory, JSON.stringify(victory?.m));
await wait(900);
await pickupAll(r);
check("the Shard of the Eclipse won", r.inv?.inventory?.some((it: any) => it?.key === "art_eclipse") ?? false, "");
const legendary = r.inv?.inventory?.find((it: any) => it && scrollSkill(it.key)?.rarity === 4);
check("a first victory over the Void Queen yields a legendary scroll", !!legendary, legendary ? scrollSkill(legendary.key)!.name : "none");
await tp(r, 42, 144);
mark = r.msgs.length;
r.room.send("interact", "exit");
const down = await waitFor(() => since(r, mark, "travel")[0], 3000);
check("the exit leads back to the Spires", down?.room === "floor5", JSON.stringify(down));
await leave(r);
f = await connect("floor5");
const p1 = me(f);
const gate = map.object("sanctum-door")!;
check("you step out by the Sanctum Gate", !!p1 && Math.hypot(p1.x - gate.x, p1.y - gate.y) < 160, p1 ? `at ${Math.round(p1.x / TILE)},${Math.round(p1.y / TILE)}` : "");
await leave(f);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
