/**
 * Floor 6 end to end (npm run floor6): the Stair of Tides from the Umbral Wilds, Saltmere,
 * the Tidehall Archivist, sea drakes, Scylla and the Drowned Key, and the Drowned Cathedral:
 * the Nave of the Drowned, the Rising Tide (the hall floods row by row until three sluice
 * valves are turned), Captain Blackbrine and Thalassa, the Leviathan Queen (and her Deluge).
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor6, CG, CG_FLOOD_ID, EAct, ENEMIES, HazardKind, scrollSkill, SERVER_PORT, SLUICE_VALVES, TILE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
const guest = `Tidewalker${Math.floor(Math.random() * 1e5)}`;
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


// --- Up from the Umbral Wilds ----------------------------------------------------------------
let w = await connect("world");
w.room.send("dev:floor", 6);
w.room.send("dev:give", { key: "", xp: 9_000_000 });
w.room.send("dev:questdone", "f5_queen");
await wait(500);
check("a climber can reach level 28", (w.inv?.level ?? 0) >= 28, `level ${w.inv?.level}`);
await leave(w);
const f5 = await connect("floor5");
await tp(f5, 97, 12);
let mark = f5.msgs.length;
f5.room.send("interact", "sealed-stair6");
const up = await waitFor(() => since(f5, mark, "travel")[0]);
check("the Starless Stair leads up out of the Umbral Wilds", up?.room === "floor6", JSON.stringify(up));
await leave(f5);

const map = buildFloor6();
let f = await connect("floor6");
const p0 = me(f);
const descent = map.object("descent6")!;
check("you arrive at Saltmere's Descent", !!p0 && Math.hypot(p0.x - descent.x, p0.y - descent.y) < 120, p0 ? `at ${Math.round(p0.x / TILE)},${Math.round(p0.y / TILE)}` : "");
check("Floor 6 is announced", f.msgs.some((x) => x.type === "discover" && x.m.name === "Floor 6"), "");
const oona = map.npcs.find((n) => n.id === "harbormaster")!;
await tpPx(f, oona.x, oona.y + 30);
const hm = await talk(f, "harbormaster");
check("Harbormaster Oona offers the Floor 6 story", !!hm?.offers?.some((o: any) => o.id === "f6_arrival"), hm ? hm.offers.map((o: any) => o.id).join(",") : "no dialog");
const hall = map.object("enter-hall6")!;
await tpPx(f, hall.x, hall.y + 20);
f.room.send("interact", "enter-hall6");
await waitFor(() => (me(f).y > map.outdoorHeight * TILE ? me(f) : undefined));
const coralie = map.npcs.find((n) => n.id === "archivist6")!;
await tpPx(f, coralie.x, coralie.y + 30);
const a6 = await talk(f, "archivist6");
const tideArts = (a6?.shop ?? []).filter((e: any) => scrollSkill(e.key)?.floor === 6).map((e: any) => scrollSkill(e.key)!.name);
const regular = (a6?.shop ?? []).filter((e: any) => !scrollSkill(e.key)?.floor).length;
check("the Tidehall's Archivist sells the Drowned Isles' own arts", tideArts.length >= 3, tideArts.join(", "));
check("…and at least 10 new regular scrolls", regular >= 10, `${regular} regular`);

// Sea drakes in the Coral Gardens.
await tp(f, 38, 94);
f.room.send("dev:spawn", { key: "seadrake", level: 26 });
await wait(800);
let drakeId = "";
f.room.state.enemies?.forEach((e: any, id: string) => {
  if (ENEMIES[e.def]?.key === "seadrake" && e.act !== EAct.Dead) drakeId = id;
});
check("sea drakes hunt the Coral Gardens", !!drakeId, "");
f.room.send("dev:killnear", 500);
await wait(700);
// Scylla swallowed the Drowned Key.
await tp(f, 142, 34);
f.room.send("dev:spawn", { key: "scylla", level: 27 });
await wait(900);
f.room.send("dev:killnear", 400);
await wait(900);
await pickupAll(f);
const key = await waitFor(() => f.inv?.inventory?.some((it: any) => it?.key === "key_cathedral") || undefined, 5000);
check("Scylla gives up the Drowned Key", !!key, f.inv?.inventory?.filter(Boolean).map((i: any) => i.key).join(",") ?? "");
await tp(f, 90, 9);
mark = f.msgs.length;
f.room.send("interact", "cathedral-door");
const inTravel = await waitFor(() => since(f, mark, "travel")[0], 5000);
check("the Drowned Key opens the Cathedral", inTravel?.room === "cathedral" && !!inTravel.roomId, JSON.stringify(inTravel));
await leave(f);

// --- The Drowned Cathedral ---------------------------------------------------------------------
const r = await connect("cathedral", inTravel?.roomId);
await wait(700);
check("inside the Drowned Cathedral", r.msgs.some((x) => x.type === "discover" && x.m.name === "The Drowned Cathedral"), r.room.state.stage ?? "");
await tp(r, 42, 103);
check("the drowned congregation stands", !!(await waitFor(() => banner(r, (t) => t === "The Nave of the Drowned"), 4000)), r.room.state.stage);
for (let i = 0; i < 18 && !banner(r, (t) => t.includes("pews are empty")); i++) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 800);
  await wait(700);
}
check("three waves of the drowned put back down", banner(r, (t) => t.includes("pews are empty")), r.room.state.stage);
check("the Drowned Bishop rose last", banner(r, (t) => t === "The Drowned Bishop"), "");

// The Rising Tide: step in, watch the sea come, and turn the valves before it fills the hall.
await tp(r, 42, 80);
check("the tide begins to rise", !!(await waitFor(() => banner(r, (t) => t === "The Rising Tide"), 3000)), r.room.state.stage);
await tp(r, 42, 81);
const flooded = await waitFor(() => ((r.room.state.gates >> CG_FLOOD_ID) & 1) === 0 || undefined, 6000);
check("the southern row goes under the sea", !!flooded, `mask ${r.room.state.gates}`);
await wait(300);
check("…and the player standing in it is swept north", me(r).y < 81 * TILE, `at ${Math.round(me(r).x / TILE)},${Math.round(me(r).y / TILE)}`);
for (const [i, [vx, vy]] of SLUICE_VALVES.entries()) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 400);
  await tp(r, vx + (vx < 42 ? 1 : -1), vy);
  r.room.send("interact", `valve-${i}`);
  await wait(300);
}
check("three valves turned: the tide is held", !!(await waitFor(() => banner(r, (t) => t === "The tide is held"), 3000)), r.room.state.stage);
check("the hall drains and the way north opens", ((r.room.state.gates >> CG.tideNorth) & 1) === 1 && ((r.room.state.gates >> CG_FLOOD_ID) & 1) === 1, `mask ${r.room.state.gates}`);

r.room.send("dev:heal");
await tp(r, 42, 48);
await wait(600);
for (let i = 0; i < 3 && !banner(r, (t) => t.includes("Blackbrine goes down")); i++) {
  r.room.send("dev:heal");
  await tp(r, 42, 48);
  r.room.send("dev:bosshp", { boss: "warden", frac: 0.02 });
  await wait(150);
  r.room.send("dev:killnear", 600);
  await wait(900);
}
check("Captain Blackbrine goes down with his ship", !!(await waitFor(() => banner(r, (t) => t.includes("Blackbrine goes down")), 4000)), r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 19);
const intro = await waitFor(() => r.msgs.find((x) => x.type === "bossIntro"), 4000);
check("Thalassa's intro", intro?.m.name === "Thalassa, the Leviathan Queen", JSON.stringify(intro?.m));
await wait(800);
// The Deluge: the sea comes down, and only the high ground is safe.
r.room.send("dev:bosshp", { frac: 0.3 });
await wait(200);
r.room.send("dev:bossatk", "The Deluge");
const refuges = await waitFor(() => {
  let n = 0;
  r.room.state.hazards?.forEach((h: any) => {
    if (h.kind === HazardKind.Glyph) n++;
  });
  return n >= 2 ? n : undefined;
}, 3000);
check("the Deluge leaves high ground to shelter on", !!refuges, `${refuges ?? 0} refuges`);
r.room.send("dev:heal");
r.room.send("dev:bosshp", { frac: 0.02 });
await wait(200);
r.room.send("dev:killnear", 900);
const victory = await waitFor(() => r.msgs.find((x) => x.type === "victory"), 5000);
check("Thalassa falls — the tide turns", !!victory, JSON.stringify(victory?.m));
await wait(900);
await pickupAll(r);
check("the Crown of the Deep won", r.inv?.inventory?.some((it: any) => it?.key === "art_tidecrown") ?? false, "");
const legendary = r.inv?.inventory?.find((it: any) => it && scrollSkill(it.key)?.rarity === 4);
check("a first victory over the Leviathan Queen yields a legendary scroll", !!legendary, legendary ? scrollSkill(legendary.key)!.name : "none");
await tp(r, 42, 144);
mark = r.msgs.length;
r.room.send("interact", "exit");
const down = await waitFor(() => since(r, mark, "travel")[0], 3000);
check("the exit leads back to the Cliffs", down?.room === "floor6", JSON.stringify(down));
await leave(r);
f = await connect("floor6");
const p1 = me(f);
const gate = map.object("cathedral-door")!;
check("you step out by the Cathedral Doors", !!p1 && Math.hypot(p1.x - gate.x, p1.y - gate.y) < 160, p1 ? `at ${Math.round(p1.x / TILE)},${Math.round(p1.y / TILE)}` : "");
await leave(f);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
