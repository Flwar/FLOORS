/**
 * Floor 7 end to end (npm run floor7): the Endless Stair from the Drowned Isles, Gearhaven,
 * the Assembly Archivist, brass drakes, the Gearwyrm and the Master Cog, and the Great Engine:
 * the Assembly Line, the Overload Room (four breakers live at once), Forgemaster Vulk and the
 * Archon Engine (and its Overload).
 */
import { Client, type Room } from "@colyseus/sdk";
import { BREAKERS, buildFloor7, EAct, EG, ENEMIES, HazardKind, scrollSkill, SERVER_PORT, TILE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
const guest = `Tinker${Math.floor(Math.random() * 1e5)}`;
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


// --- Up from the Drowned Isles -----------------------------------------------------------------
let w = await connect("world");
w.room.send("dev:floor", 7);
w.room.send("dev:give", { key: "", xp: 16_000_000 });
w.room.send("dev:questdone", "f6_leviathan");
await wait(500);
check("a climber can reach level 32", (w.inv?.level ?? 0) >= 32, `level ${w.inv?.level}`);
await leave(w);
const f6 = await connect("floor6");
await tp(f6, 97, 12);
let mark = f6.msgs.length;
f6.room.send("interact", "sealed-stair7");
const up = await waitFor(() => since(f6, mark, "travel")[0]);
check("the Stair of Tides leads up out of the Drowned Isles", up?.room === "floor7", JSON.stringify(up));
await leave(f6);

const map = buildFloor7();
let f = await connect("floor7");
const p0 = me(f);
const descent = map.object("descent7")!;
check("you arrive at Gearhaven's Descent", !!p0 && Math.hypot(p0.x - descent.x, p0.y - descent.y) < 120, p0 ? `at ${Math.round(p0.x / TILE)},${Math.round(p0.y / TILE)}` : "");
check("Floor 7 is announced", f.msgs.some((x) => x.type === "discover" && x.m.name === "Floor 7"), "");
const brask = map.npcs.find((n) => n.id === "engineer")!;
await tpPx(f, brask.x, brask.y + 30);
const ce = await talk(f, "engineer");
check("Chief Engineer Brask offers the Floor 7 story", !!ce?.offers?.some((o: any) => o.id === "f7_arrival"), ce ? ce.offers.map((o: any) => o.id).join(",") : "no dialog");
const hall = map.object("enter-hall7")!;
await tpPx(f, hall.x, hall.y + 20);
f.room.send("interact", "enter-hall7");
await waitFor(() => (me(f).y > map.outdoorHeight * TILE ? me(f) : undefined));
const gideon = map.npcs.find((n) => n.id === "archivist7")!;
await tpPx(f, gideon.x, gideon.y + 30);
const a7 = await talk(f, "archivist7");
const brassArts = (a7?.shop ?? []).filter((e: any) => scrollSkill(e.key)?.floor === 7).map((e: any) => scrollSkill(e.key)!.name);
const regular = (a7?.shop ?? []).filter((e: any) => !scrollSkill(e.key)?.floor).length;
check("the Assembly's Archivist sells the Clockwork Heights' own arts", brassArts.length >= 3, brassArts.join(", "));
check("…and at least 10 new regular scrolls", regular >= 10, `${regular} regular`);

// Brass drakes in the Steam Vents.
await tp(f, 26, 106);
f.room.send("dev:spawn", { key: "brassdrake", level: 30 });
await wait(800);
let drakeId = "";
f.room.state.enemies?.forEach((e: any, id: string) => {
  if (ENEMIES[e.def]?.key === "brassdrake" && e.act !== EAct.Dead) drakeId = id;
});
check("brass drakes nest in the Steam Vents", !!drakeId, "");
f.room.send("dev:killnear", 500);
await wait(700);
// The Gearwyrm's heart is the Master Cog.
await tp(f, 122, 38);
f.room.send("dev:spawn", { key: "gearwyrm", level: 31 });
await wait(900);
f.room.send("dev:killnear", 400);
await wait(900);
await pickupAll(f);
const key = await waitFor(() => f.inv?.inventory?.some((it: any) => it?.key === "key_engine") || undefined, 5000);
check("the Gearwyrm gives up the Master Cog", !!key, f.inv?.inventory?.filter(Boolean).map((i: any) => i.key).join(",") ?? "");
await tp(f, 90, 9);
mark = f.msgs.length;
f.room.send("interact", "engine-door");
const inTravel = await waitFor(() => since(f, mark, "travel")[0], 5000);
check("the Master Cog turns the Engine Gate", inTravel?.room === "engine" && !!inTravel.roomId, JSON.stringify(inTravel));
await leave(f);

// --- The Great Engine --------------------------------------------------------------------------
const r = await connect("engine", inTravel?.roomId);
await wait(700);
check("inside the Great Engine", r.msgs.some((x) => x.type === "discover" && x.m.name === "The Great Engine"), r.room.state.stage ?? "");
await tp(r, 42, 103);
check("the Assembly Line starts up", !!(await waitFor(() => banner(r, (t) => t === "The Assembly Line"), 4000)), r.room.state.stage);
for (let i = 0; i < 18 && !banner(r, (t) => t.includes("line stops")); i++) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 800);
  await wait(700);
}
check("three waves off the line broken", banner(r, (t) => t.includes("line stops")), r.room.state.stage);
check("the Prototype came off the line last", banner(r, (t) => t === "The Prototype"), "");

// The Overload Room: four breakers, live at once.
await tp(r, 42, 81);
check("the Overload Room wakes", !!(await waitFor(() => banner(r, (t) => t === "The Overload Room"), 3000)), r.room.state.stage);
for (const [i, [bx, by]] of BREAKERS.entries()) {
  r.room.send("dev:heal");
  await tp(r, bx + (bx < 42 ? 1 : -1), by + 1);
  r.room.send("interact", `breaker-${i}`);
  await wait(250);
  if (i === 2) check("three live breakers are not enough", ((r.room.state.gates >> EG.overNorth) & 1) === 0, `mask ${r.room.state.gates}`);
}
check("four live breakers: OVERLOAD", !!(await waitFor(() => banner(r, (t) => t === "OVERLOAD"), 3000)), r.room.state.stage);
check("the way to the forge opens", ((r.room.state.gates >> EG.overNorth) & 1) === 1, `mask ${r.room.state.gates}`);

r.room.send("dev:heal");
await tp(r, 42, 48);
await wait(600);
for (let i = 0; i < 3 && !banner(r, (t) => t.includes("Forgemaster falls")); i++) {
  r.room.send("dev:heal");
  await tp(r, 42, 48);
  r.room.send("dev:bosshp", { boss: "warden", frac: 0.02 });
  await wait(150);
  r.room.send("dev:killnear", 600);
  await wait(900);
}
check("Forgemaster Vulk falls", !!(await waitFor(() => banner(r, (t) => t.includes("Forgemaster falls")), 4000)), r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 19);
const intro = await waitFor(() => r.msgs.find((x) => x.type === "bossIntro"), 4000);
check("the Archon Engine's intro", intro?.m.name === "The Archon Engine", JSON.stringify(intro?.m));
await wait(800);
// Overload: the Engine tears itself apart — only the grounding pylons are safe.
r.room.send("dev:bosshp", { frac: 0.3 });
await wait(200);
r.room.send("dev:bossatk", "Overload");
const pylons = await waitFor(() => {
  let n = 0;
  r.room.state.hazards?.forEach((h: any) => {
    if (h.kind === HazardKind.Glyph) n++;
  });
  return n >= 2 ? n : undefined;
}, 3000);
check("Overload leaves grounding pylons to shelter at", !!pylons, `${pylons ?? 0} pylons`);
r.room.send("dev:heal");
r.room.send("dev:bosshp", { frac: 0.02 });
await wait(200);
r.room.send("dev:killnear", 900);
const victory = await waitFor(() => r.msgs.find((x) => x.type === "victory"), 5000);
check("the Archon Engine stops", !!victory, JSON.stringify(victory?.m));
await wait(900);
await pickupAll(r);
check("the Heart of the Archon won", r.inv?.inventory?.some((it: any) => it?.key === "art_archoncore") ?? false, "");
const legendary = r.inv?.inventory?.find((it: any) => it && scrollSkill(it.key)?.rarity === 4);
check("a first victory over the Archon yields a legendary scroll", !!legendary, legendary ? scrollSkill(legendary.key)!.name : "none");
await tp(r, 42, 144);
mark = r.msgs.length;
r.room.send("interact", "exit");
const down = await waitFor(() => since(r, mark, "travel")[0], 3000);
check("the exit leads back to the Rails", down?.room === "floor7", JSON.stringify(down));
await leave(r);
f = await connect("floor7");
const p1 = me(f);
const gate = map.object("engine-door")!;
check("you step out by the Engine Gate", !!p1 && Math.hypot(p1.x - gate.x, p1.y - gate.y) < 160, p1 ? `at ${Math.round(p1.x / TILE)},${Math.round(p1.y / TILE)}` : "");
await leave(f);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
