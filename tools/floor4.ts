/**
 * Floor 4 end to end (npm run floor4): the Frozen Stair from the Ember Reaches, Rimeholt,
 * the Longhall's Archivist, frost drakes and chill, Glacierfang's Rime Seal, and the Glacier
 * Throne: the Hall of Mirrors, the echo-stone rune puzzle (wrong rune first, then right),
 * Jarnhild the Frost Giant and Hrimthar, the Winter King.
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor4, EAct, ENEMIES, RUNES, scrollSkill, SERVER_PORT, TILE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
const guest = `Winterfeller${Math.floor(Math.random() * 1e5)}`;
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

// --- Up from the Ember Reaches ---------------------------------------------------------------
let w = await connect("world");
w.room.send("dev:floor", 4);
w.room.send("dev:give", { key: "", xp: 2_000_000 });
w.room.send("dev:questdone", "f3_roost");
await wait(500);
check("a climber can reach level 20", (w.inv?.level ?? 0) >= 20, `level ${w.inv?.level}`);
await leave(w);
const f3 = await connect("floor3");
await tp(f3, 97, 12);
let mark = f3.msgs.length;
f3.room.send("interact", "sealed-stair4");
const up = await waitFor(() => since(f3, mark, "travel")[0]);
check("the Frozen Stair leads up from the Ember Reaches", up?.room === "floor4", JSON.stringify(up));
await leave(f3);

const map = buildFloor4();
let f = await connect("floor4");
const p0 = me(f);
const descent = map.object("descent4")!;
check("you arrive at Rimeholt's Descent", !!p0 && Math.hypot(p0.x - descent.x, p0.y - descent.y) < 120, p0 ? `at ${Math.round(p0.x / TILE)},${Math.round(p0.y / TILE)}` : "");
check("Floor 4 is announced", f.msgs.some((x) => x.type === "discover" && x.m.name === "Floor 4"), "");
const jarl = map.npcs.find((n) => n.id === "jarl")!;
await tpPx(f, jarl.x, jarl.y + 30);
const sig = await talk(f, "jarl");
check("Jarl Sigrun offers the Floor 4 story", !!sig?.offers?.some((o: any) => o.id === "f4_arrival"), sig ? sig.offers.map((o: any) => o.id).join(",") : "no dialog");
const hall = map.object("enter-longhall")!;
await tpPx(f, hall.x, hall.y + 20);
f.room.send("interact", "enter-longhall");
await waitFor(() => (me(f).y > map.outdoorHeight * TILE ? me(f) : undefined));
const tove = map.npcs.find((n) => n.id === "archivist4")!;
await tpPx(f, tove.x, tove.y + 30);
const a4 = await talk(f, "archivist4");
const frostArts = (a4?.shop ?? []).filter((e: any) => scrollSkill(e.key)?.floor === 4).map((e: any) => scrollSkill(e.key)!.name);
const regular = (a4?.shop ?? []).filter((e: any) => !scrollSkill(e.key)?.floor).length;
check("the Longhall's Archivist sells the Frostvale's own arts", frostArts.length >= 3, frostArts.join(", "));
check("…and at least 10 new regular scrolls", regular >= 10, `${regular} regular`);

// Frost drakes and chill.
await tp(f, 30, 100);
f.room.send("dev:spawn", { key: "frostdrake", level: 18 });
await wait(800);
let drakeId = "";
f.room.state.enemies?.forEach((e: any, id: string) => {
  if (ENEMIES[e.def]?.key === "frostdrake" && e.act !== EAct.Dead) drakeId = id;
});
check("frost drakes hunt the lake", !!drakeId, "");
f.room.send("dev:killnear", 500);
await wait(700);
// Glacierfang carries the Rime Seal.
await tp(f, 112, 40);
f.room.send("dev:spawn", { key: "glacierfang", level: 19 });
await wait(900);
f.room.send("dev:killnear", 400);
await wait(900);
await pickupAll(f);
const seal = await waitFor(() => f.inv?.inventory?.some((it: any) => it?.key === "key_glacier") || undefined, 5000);
check("Glacierfang drops the Rime Seal", !!seal, f.inv?.inventory?.filter(Boolean).map((i: any) => i.key).join(",") ?? "");
await tp(f, 90, 9);
mark = f.msgs.length;
f.room.send("interact", "glacier-door");
const inTravel = await waitFor(() => since(f, mark, "travel")[0], 5000);
check("the Rime Seal opens the Glacier Throne", inTravel?.room === "glacier" && !!inTravel.roomId, JSON.stringify(inTravel));
await leave(f);

// --- The Glacier Throne -----------------------------------------------------------------------
const r = await connect("glacier", inTravel?.roomId);
await wait(700);
check("inside the Glacier Throne", r.msgs.some((x) => x.type === "discover" && x.m.name === "The Glacier Throne"), r.room.state.stage ?? "");
await tp(r, 42, 103);
check("the Hall of Mirrors wakes", !!(await waitFor(() => r.msgs.find((x) => x.type === "banner" && x.m.title === "The Hall of Mirrors"), 4000)), r.room.state.stage);
for (let i = 0; i < 18 && !r.msgs.some((x) => x.type === "banner" && String(x.m.title).includes("mirrors are still")); i++) {
  r.room.send("dev:heal");
  r.room.send("dev:killnear", 800);
  await wait(700);
}
check("three waves of reflections broken", r.msgs.some((x) => x.type === "banner" && String(x.m.title).includes("mirrors are still")), r.room.state.stage);
check("the Frozen Champion came last", r.msgs.some((x) => x.type === "banner" && x.m.title === "The Frozen Champion"), "");
// The echo stones tell the order.
const order: number[] = [];
const ORD = ["first", "second", "third", "last"];
for (let i = 0; i < 4; i++) {
  await tp(r, [25, 34, 50, 59][i], [76, 77, 77, 76][i]);
  mark = r.msgs.length;
  r.room.send("interact", `echo-${i}`);
  const lore = await waitFor(() => since(r, mark, "lore")[0]);
  const mm = /The (\w+) rune is the (\w+)/.exec(String(lore?.text));
  if (mm) order[ORD.indexOf(mm[1])] = RUNES.indexOf(mm[2]);
}
check("the four echo stones tell the rune order", order.filter((x) => x >= 0).length === 4, order.map((i) => RUNES[i]).join(" → "));
const levers: [number, number][] = [[26, 68], [35, 65], [49, 65], [58, 68]];
// A wrong rune first.
const wrong = [0, 1, 2, 3].find((i) => i !== order[0])!;
await tp(r, levers[wrong][0], levers[wrong][1]);
mark = r.msgs.length;
r.room.send("interact", `lever-${wrong}`);
check("a wrong rune shatters them", !!(await waitFor(() => since(r, mark, "banner").find((b: any) => b.title === "The runes shatter"))), "");
r.room.send("dev:killnear", 800);
await wait(300);
for (const rune of order) {
  await tp(r, levers[rune][0], levers[rune][1]);
  r.room.send("interact", `lever-${rune}`);
  await wait(300);
}
check("the runes, struck in order, open the way", !!(await waitFor(() => r.msgs.find((x) => x.type === "banner" && x.m.title === "The runes answer"), 3000)), r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 50);
await wait(600);
// The giant hits hard: heal and finish him, twice if a stomp got there first.
for (let i = 0; i < 3 && !r.msgs.some((x) => x.type === "banner" && String(x.m.title).includes("Frost Giant falls")); i++) {
  r.room.send("dev:heal");
  await tp(r, 42, 50);
  r.room.send("dev:bosshp", { boss: "warden", frac: 0.02 });
  await wait(150);
  r.room.send("dev:killnear", 600);
  await wait(900);
}
check("Jarnhild the Frost Giant falls", !!(await waitFor(() => r.msgs.find((x) => x.type === "banner" && String(x.m.title).includes("Frost Giant falls")), 4000)), r.room.state.stage);

r.room.send("dev:heal");
await tp(r, 42, 20);
const intro = await waitFor(() => r.msgs.find((x) => x.type === "bossIntro"), 4000);
check("Hrimthar's intro", intro?.m.name === "Hrimthar, the Winter King", JSON.stringify(intro?.m));
await wait(800);
r.room.send("dev:bosshp", { frac: 0.02 });
await wait(200);
r.room.send("dev:killnear", 900);
const victory = await waitFor(() => r.msgs.find((x) => x.type === "victory"), 5000);
check("Hrimthar falls — winter breaks", !!victory, JSON.stringify(victory?.m));
await wait(900);
await pickupAll(r);
check("the Crown of Hrimthar won", r.inv?.inventory?.some((it: any) => it?.key === "art_wintercrown") ?? false, "");
const legendary = r.inv?.inventory?.find((it: any) => it && scrollSkill(it.key)?.rarity === 4);
check("a first victory over the Winter King yields a legendary scroll", !!legendary, legendary ? scrollSkill(legendary.key)!.name : "none");
await tp(r, 42, 144);
mark = r.msgs.length;
r.room.send("interact", "exit");
const down = await waitFor(() => since(r, mark, "travel")[0], 3000);
check("the exit leads back to the Peak", down?.room === "floor4", JSON.stringify(down));
await leave(r);
f = await connect("floor4");
const p1 = me(f);
const gate = map.object("glacier-door")!;
check("you step out by the Glacier Gate", !!p1 && Math.hypot(p1.x - gate.x, p1.y - gate.y) < 160, p1 ? `at ${Math.round(p1.x / TILE)},${Math.round(p1.y / TILE)}` : "");
await leave(f);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
