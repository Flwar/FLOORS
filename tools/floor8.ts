/**
 * Floor 8 end to end (npm run floor8): the Endless Stair from the Clockwork Heights, Sunwell,
 * the Hall of the Sun's Archivist, sun drakes, Sandmaw and the Solar Seal, and the Sun Pyramid:
 * the Hall of Kings, the Sun Chamber (carry the sun from the well to four dark altars before it
 * burns out), Nephra the Embalmer and Solkaris, the Sun Pharaoh (and his High Noon).
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor8, EAct, ENEMIES, HazardKind, PG, scrollSkill, SERVER_PORT, SUN_ALTARS, SUN_CARRY_MS, SUNWELL_TILE, TILE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
const guest = `Nomad${Math.floor(Math.random() * 1e5)}`;
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
const notices = (c: Conn, mark: number) => since(c, mark, "notice").map((n: any) => String(n.text)).join(" | ");

// --- Up from the Clockwork Heights ---------------------------------------------------------------
let w = await connect("world");
w.room.send("dev:floor", 8);
w.room.send("dev:give", { key: "", xp: 16_000_000 });
w.room.send("dev:questdone", "f7_archon");
await wait(500);
check("a climber can reach level 36", (w.inv?.level ?? 0) >= 36, `level ${w.inv?.level}`);
await leave(w);
const f7 = await connect("floor7");
await tp(f7, 97, 12);
let mark = f7.msgs.length;
f7.room.send("interact", "sealed-stair8");
const up = await waitFor(() => since(f7, mark, "travel")[0]);
check("the Endless Stair leads up out of the Clockwork Heights", up?.room === "floor8", JSON.stringify(up));
await leave(f7);

const map = buildFloor8();
let f = await connect("floor8");
const p0 = me(f);
const descent = map.object("descent8")!;
check("you arrive at Sunwell's Descent", !!p0 && Math.hypot(p0.x - descent.x, p0.y - descent.y) < 120, p0 ? `at ${Math.round(p0.x / TILE)},${Math.round(p0.y / TILE)}` : "");
check("Floor 8 is announced", f.msgs.some((x) => x.type === "discover" && x.m.name === "Floor 8"), "");
const amara = map.npcs.find((n) => n.id === "vizier")!;
await tpPx(f, amara.x, amara.y + 30);
const vz = await talk(f, "vizier");
check("Vizier Amara offers the Floor 8 story", !!vz?.offers?.some((o: any) => o.id === "f8_arrival"), vz ? vz.offers.map((o: any) => o.id).join(",") : "no dialog");
const hall = map.object("enter-hall8")!;
await tpPx(f, hall.x, hall.y + 20);
f.room.send("interact", "enter-hall8");
await waitFor(() => (me(f).y > map.outdoorHeight * TILE ? me(f) : undefined));
const nadir = map.npcs.find((n) => n.id === "archivist8")!;
await tpPx(f, nadir.x, nadir.y + 30);
const a8 = await talk(f, "archivist8");
const sunArts = (a8?.shop ?? []).filter((e: any) => scrollSkill(e.key)?.floor === 8).map((e: any) => scrollSkill(e.key)!.name);
const regular = (a8?.shop ?? []).filter((e: any) => !scrollSkill(e.key)?.floor).length;
check("the Hall of the Sun's Archivist sells the Sands' own arts", sunArts.length >= 3, sunArts.join(", "));
check("…and at least 10 new regular scrolls", regular >= 10, `${regular} regular`);
const inn = map.npcs.find((n) => n.id === "innkeep8")!;
const innDoor = map.object("enter-inn8")!;
await tpPx(f, innDoor.x, innDoor.y + 20);
f.room.send("interact", "enter-inn8");
await waitFor(() => (me(f).y > map.outdoorHeight * TILE ? me(f) : undefined));
const innMap = map.npcs.find((n) => n.id === "innkeep8")!;
await tpPx(f, innMap.x, innMap.y + 30);
const yusra = await talk(f, "innkeep8");
check("Old Yusra pours drinks at the Cool Well", !!yusra?.services?.includes("drinks") && (yusra?.drinkPrice ?? 0) > 0, `${yusra?.services?.join(",")} · ${yusra?.drinkPrice}g`);
void inn;

// Sun drakes on the Glass Flats.
await tp(f, 26, 106);
f.room.send("dev:spawn", { key: "sundrake", level: 34 });
await wait(800);
let drakeId = "";
f.room.state.enemies?.forEach((e: any, id: string) => {
  if (ENEMIES[e.def]?.key === "sundrake" && e.act !== EAct.Dead) drakeId = id;
});
check("sun drakes circle the Glass Flats", !!drakeId, "");
f.room.send("dev:killnear", 500);
await wait(700);
// Sandmaw swallowed the Solar Seal.
await tp(f, 122, 38);
f.room.send("dev:spawn", { key: "sandmaw", level: 35 });
await wait(900);
f.room.send("dev:killnear", 400);
await wait(900);
await pickupAll(f);
const key = await waitFor(() => f.inv?.inventory?.some((it: any) => it?.key === "key_pyramid") || undefined, 5000);
check("Sandmaw gives up the Solar Seal", !!key, f.inv?.inventory?.filter(Boolean).map((i: any) => i.key).join(",") ?? "");
await tp(f, 90, 9);
mark = f.msgs.length;
f.room.send("interact", "pyramid-door");
const inTravel = await waitFor(() => since(f, mark, "travel")[0], 5000);
check("the Solar Seal opens the Pyramid Door", inTravel?.room === "pyramid" && !!inTravel.roomId, JSON.stringify(inTravel));
await leave(f);

// --- The Sun Pyramid --------------------------------------------------------------------------
const r = await connect("pyramid", inTravel?.roomId);
await wait(700);
check("inside the Sun Pyramid", r.msgs.some((x) => x.type === "discover" && x.m.name === "The Sun Pyramid"), r.room.state.stage ?? "");
await tp(r, 42, 103);
check("the Hall of Kings wakes", !!(await waitFor(() => banner(r, (t) => t === "The Hall of Kings"), 4000)), r.room.state.stage);
for (let i = 0; i < 18 && !banner(r, (t) => t.includes("hall falls quiet")); i++) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 800);
  await wait(700);
}
check("three waves of the kings' servants laid to rest", banner(r, (t) => t.includes("hall falls quiet")), r.room.state.stage);
check("the Risen King stepped down last", banner(r, (t) => t === "The Risen King"), "");

// The Sun Chamber: carry the sun from the well to each dark altar.
await tp(r, 42, 81);
check("the Sun Chamber wakes", !!(await waitFor(() => banner(r, (t) => t === "The Sun Chamber"), 3000)), r.room.state.stage);
const [a0x, a0y] = SUN_ALTARS[0];
await tp(r, a0x + 1, a0y + 1);
mark = r.msgs.length;
r.room.send("interact", "altar-0");
await wait(400);
check("a dark altar won't light without the sun", /cold and dark/.test(notices(r, mark)), notices(r, mark));
// Too slow: the sun burns out in your hands.
await tp(r, SUNWELL_TILE[0], SUNWELL_TILE[1] + 1);
r.room.send("interact", "sunwell");
// (Keep the dead in their tombs while we wait.)
for (let t = 0; t < SUN_CARRY_MS + 700; t += 700) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 700);
  await wait(700);
}
mark = r.msgs.length;
await tp(r, a0x + 1, a0y + 1);
r.room.send("interact", "altar-0");
await wait(400);
check("dawdle, and the sun burns out in your hands", /cold and dark/.test(notices(r, mark)) && ((r.room.state.gates >> 16) & 1) === 0, notices(r, mark));
for (const [i, [ax, ay]] of SUN_ALTARS.entries()) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 700);
  await tp(r, SUNWELL_TILE[0], SUNWELL_TILE[1] + 1);
  r.room.send("interact", "sunwell");
  await wait(200);
  await tp(r, ax + (ax < 42 ? 1 : -1), ay + 1);
  r.room.send("interact", `altar-${i}`);
  await wait(300);
  if (i === 2) check("three blazing altars are not enough", ((r.room.state.gates >> PG.sunNorth) & 1) === 0, `mask ${r.room.state.gates}`);
}
check("four blazing altars: THE CHAMBER BLAZES", !!(await waitFor(() => banner(r, (t) => t === "THE CHAMBER BLAZES"), 3000)), r.room.state.stage);
check("the way to the Embalmer opens", ((r.room.state.gates >> PG.sunNorth) & 1) === 1, `mask ${r.room.state.gates}`);

r.room.send("dev:heal");
await tp(r, 42, 48);
await wait(600);
for (let i = 0; i < 3 && !banner(r, (t) => t.includes("Embalmer is undone")); i++) {
  r.room.send("dev:heal");
  await tp(r, 42, 48);
  r.room.send("dev:bosshp", { boss: "warden", frac: 0.02 });
  await wait(150);
  r.room.send("dev:killnear", 600);
  await wait(900);
}
check("Nephra the Embalmer is undone", !!(await waitFor(() => banner(r, (t) => t.includes("Embalmer is undone")), 4000)), r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 19);
const intro = await waitFor(() => r.msgs.find((x) => x.type === "bossIntro"), 4000);
check("the Sun Pharaoh's intro", intro?.m.name === "Solkaris, the Sun Pharaoh", JSON.stringify(intro?.m));
await wait(800);
// High Noon: the sun burns everything but the obelisks' shade.
r.room.send("dev:bosshp", { frac: 0.3 });
await wait(200);
r.room.send("dev:bossatk", "High Noon");
const shade = await waitFor(() => {
  let n = 0;
  r.room.state.hazards?.forEach((h: any) => {
    if (h.kind === HazardKind.Glyph) n++;
  });
  return n >= 2 ? n : undefined;
}, 3000);
check("High Noon leaves patches of shade to shelter in", !!shade, `${shade ?? 0} shade`);
r.room.send("dev:heal");
r.room.send("dev:bosshp", { frac: 0.02 });
await wait(200);
r.room.send("dev:killnear", 900);
const victory = await waitFor(() => r.msgs.find((x) => x.type === "victory"), 5000);
check("the sun sets on Solkaris", !!victory, JSON.stringify(victory?.m));
await wait(900);
await pickupAll(r);
check("the Crown of Solkaris won", r.inv?.inventory?.some((it: any) => it?.key === "art_suncrown") ?? false, "");
const legendary = r.inv?.inventory?.find((it: any) => it && scrollSkill(it.key)?.rarity === 4);
check("a first victory over the Pharaoh yields a legendary scroll", !!legendary, legendary ? scrollSkill(legendary.key)!.name : "none");
await tp(r, 42, 144);
mark = r.msgs.length;
r.room.send("interact", "exit");
const down = await waitFor(() => since(r, mark, "travel")[0], 3000);
check("the exit leads back to the Sands", down?.room === "floor8", JSON.stringify(down));
await leave(r);
f = await connect("floor8");
const p1 = me(f);
const door = map.object("pyramid-door")!;
check("you step out by the Pyramid Door", !!p1 && Math.hypot(p1.x - door.x, p1.y - door.y) < 160, p1 ? `at ${Math.round(p1.x / TILE)},${Math.round(p1.y / TILE)}` : "");
// The Crown of Solkaris carries you home to Sunwell.
mark = f.msgs.length;
f.room.send("relic:use", { key: "art_suncrown" });
await wait(700);
const p2 = me(f);
check("the Crown of Solkaris carries you home to Sunwell", !!p2 && Math.hypot(p2.x - descent.x, p2.y - descent.y) < 120, `${notices(f, mark)} · at ${Math.round(p2.x / TILE)},${Math.round(p2.y / TILE)}`);
await leave(f);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
