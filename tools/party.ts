/**
 * Party dungeons (npm run party): when an encounter seals its entrance (a wave hall, a
 * miniboss hall, a boss arena), every living party member still outside is brought in,
 * so nobody is locked out and a party can play together, in both dungeons.
 */
import { Client, type Room } from "@colyseus/sdk";
import { GATE, SERVER_PORT, SS_GATE, STORMSPIRE_ROOMS, TILE, UNDERCROFT_ROOMS } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
type Rect = { x0: number; y0: number; x1: number; y1: number };
const inRect = (x: number, y: number, r: Rect) => x >= r.x0 * TILE && x < r.x1 * TILE && y >= r.y0 * TILE && y < r.y1 * TILE;

interface Bot {
  room: Room;
  msgs: { type: string; m: any }[];
}
async function join(kind: string, name: string, roomId?: string): Promise<Bot> {
  const c = new Client(endpoint);
  const room = roomId ? await c.joinById(roomId, { guest: name }) : kind === "floor2" ? await c.joinOrCreate(kind, { guest: name }) : await c.create(kind, { guest: name });
  const bot: Bot = { room, msgs: [] };
  room.onMessage("*", (type, m) => bot.msgs.push({ type: String(type), m }));
  for (let i = 0; i < 100 && !room.state.players?.get(room.sessionId); i++) await wait(30);
  await wait(300);
  return bot;
}
const pos = (b: Bot) => {
  const p = b.room.state.players.get(b.room.sessionId);
  return { x: p?.x ?? 0, y: p?.y ?? 0 };
};
const tile = (b: Bot) => `${Math.floor(pos(b).x / TILE)},${Math.floor(pos(b).y / TILE)}`;
const tp = (b: Bot, tx: number, ty: number) => b.room.send("dev:teleport", { x: px(tx), y: px(ty) });
async function waitFor<T>(fn: () => T | undefined | false, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(50);
  }
  return undefined;
}
const leave = (b: Bot) => Promise.race([b.room.leave().catch(() => {}), wait(1000)]);
const tag = Math.floor(Math.random() * 1e5);

/** One member walks in; the other, waiting by the entrance, must be pulled in too. */
async function encounter(label: string, lead: Bot, other: Bot, into: [number, number], area: (x: number, y: number) => boolean, ms = 3000) {
  const mark = other.msgs.length;
  for (const b of [lead, other]) b.room.send("dev:heal");
  tp(lead, ...into);
  const inside = await waitFor(() => area(pos(other).x, pos(other).y), ms);
  const told = other.msgs.slice(mark).find((x) => x.type === "notice" && String(x.m.text).includes("Your party is fighting"));
  check(`${label}: the member outside is brought in`, !!inside, `now at ${tile(other)}`);
  check(`${label}: and told why`, !!told, told?.m.text ?? "no notice");
}

// --- The Undercroft --------------------------------------------------------------------------
{
  const R = UNDERCROFT_ROOMS;
  const a = await join("dungeon", `Lead${tag}`);
  const b = await join("dungeon", `Wing${tag}`, a.room.roomId);
  check("two party members in one Undercroft", a.room.state.players.size === 2, `${a.room.state.players.size} players`);
  const hallCx = Math.floor((R.hall.x0 + R.hall.x1) / 2);
  await encounter("Undercroft Sealed Hall", a, b, [hallCx, R.hall.y0 + 8], (x, y) => inRect(x, y, R.hall));
  check("the hall seals behind both", ((a.room.state.gates ?? 0) & (1 << GATE.hallSouth)) === 0, `gates ${a.room.state.gates}`);
  // Clear the waves so the hall opens again, then send the other member back out.
  for (let i = 0; i < 10 && a.msgs.every((x) => !(x.type === "banner" && x.m.title === "Hall cleared")); i++) {
    a.room.send("dev:killnear", 900);
    await wait(500);
  }
  tp(b, 45, 120);
  await wait(400);
  const wx = Math.floor((R.warden.x0 + R.warden.x1) / 2);
  await encounter("Undercroft Warden's Hall", a, b, [wx, R.warden.y0 + 6], (x, y) => inRect(x, y, R.warden));
  a.room.send("dev:bosshp", { boss: "warden", frac: 0.01 });
  await wait(150);
  a.room.send("dev:killnear", 900);
  await wait(700);
  tp(b, 45, 70);
  await wait(400);
  const inBoss = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05) < R.boss.r - 0.5;
  await encounter("Undercroft boss arena", a, b, [R.boss.cx, R.boss.cy + 4], inBoss, 5000);
  // The Keeper falls while one member lies dead back at the entrance: the whole run still
  // gets the kill, and with it Floor 2.
  tp(b, 45, 128);
  await wait(300);
  b.room.send("dev:kill");
  await wait(300);
  const bMark = b.msgs.length;
  a.room.send("dev:bosshp", { frac: 0.01 });
  await wait(150);
  a.room.send("dev:killnear", 900);
  const won = await waitFor(() => a.msgs.find((x) => x.type === "victory"), 5000);
  check("the Keeper falls", !!won, JSON.stringify(won?.m ?? ""));
  const sheet = await waitFor(() => b.msgs.slice(bMark).filter((x) => x.type === "inv").map((x) => x.m).find((v) => v.floor >= 2));
  check("the downed member unlocks Floor 2 too", !!sheet, sheet ? `floor ${sheet.floor}` : "no unlock");
  check("and gets the boss kill", !!sheet?.bossKills?.includes("aurelion"), (sheet?.bossKills ?? []).join(","));
  await leave(a);
  await leave(b);
  // Floor 2 lets them in (a climber without the unlock is sent back down).
  const up = await join("floor2", `Wing${tag}`);
  await wait(1200);
  const bounced = up.msgs.some((x) => x.type === "travel");
  check("Floor 2 lets the downed member in", !bounced, bounced ? "sent back to Floor 1" : `standing at ${tile(up)}`);
  await leave(up);
}

// --- The Stormspire --------------------------------------------------------------------------
{
  const R = STORMSPIRE_ROOMS;
  const a = await join("stormspire", `Spire${tag}`);
  const b = await join("stormspire", `Wing2${tag}`, a.room.roomId);
  await encounter("Stormspire Gallery", a, b, [40, R.gallery.y0 + 8], (x, y) => inRect(x, y, R.gallery));
  check("the Gallery seals behind both", ((a.room.state.gates ?? 0) & (1 << SS_GATE.gallerySouth)) === 0, `gates ${a.room.state.gates}`);
  tp(b, 40, 70);
  await wait(400);
  await encounter("Stormspire Stormwarden's hall", a, b, [40, R.warden.y0 + 5], (x, y) => inRect(x, y, R.warden));
  a.room.send("dev:bosshp", { boss: "warden", frac: 0.01 });
  await wait(150);
  a.room.send("dev:killnear", 900);
  await wait(700);
  tp(b, 40, 45);
  await wait(400);
  const inBoss = (x: number, y: number) => Math.hypot(x / TILE - R.boss.cx, (y / TILE - R.boss.cy) * 1.05) < R.boss.r - 0.5;
  await encounter("Stormspire boss arena", a, b, [R.boss.cx, R.boss.cy + 4], inBoss, 5000);
  await leave(a);
  await leave(b);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
