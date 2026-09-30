/**
 * Floors open for everyone (npm run worldfloor; run against a server with a fresh FLOORS_DB), Floors 2 and 3:
 * one party defeats Aurelion and Floor 2 opens for the whole server. A player idling on
 * Floor 1 is told and can climb at once, a player who was offline finds it open when they
 * log in, and Floor 2's story starts for them though they never finished Floor 1's.
 */
import { Client, type Room } from "@colyseus/sdk";
import { SERVER_PORT, TILE, UNDERCROFT_ROOMS as R } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const px = (t: number) => t * TILE + TILE / 2;
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
interface Bot {
  room: Room;
  msgs: { type: string; m: any }[];
  inv?: any;
  token?: string;
}
const watch = (room: Room): Bot => {
  const b: Bot = { room, msgs: [] };
  room.onMessage("*", (type, m) => {
    b.msgs.push({ type: String(type), m });
    if (type === "inv") b.inv = m;
    if (type === "session") b.token = m.token;
  });
  return b;
};
async function settle(b: Bot) {
  for (let i = 0; i < 100 && (!b.room.state.players?.get(b.room.sessionId) || !b.inv); i++) await wait(30);
}
async function register(name: string): Promise<Bot> {
  const b = watch(await new Client(endpoint).joinOrCreate("world", { username: name, password: "climb-the-tower-1", register: true }));
  await settle(b);
  return b;
}
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

// Three climbers on Floor 1. The third logs out before the fight.
const opener = await register(`Opener${tag}`);
const idle = await register(`Idle${tag}`);
const away = await register(`Away${tag}`);
await leave(away);
check("Floor 2 starts closed", (idle.inv?.floor ?? 0) === 1, `idle is on floor ${idle.inv?.floor}`);
idle.room.send("dev:teleport", { x: px(38), y: px(69) });
await wait(300);
let mark = idle.msgs.length;
idle.room.send("interact", "ascent-gate");
const sealed = await waitFor(() => idle.msgs.slice(mark).find((x) => x.type === "lore" || x.type === "travel"));
check("the Ascent Gate is sealed before anyone wins", sealed?.type === "lore", sealed?.type ?? "nothing");

// The opener beats Aurelion alone in the Undercroft.
const token = opener.token;
await leave(opener);
const dun = watch(await new Client(endpoint).create("dungeon", { token }));
await settle(dun);
dun.room.send("dev:teleport", { x: px(R.boss.cx), y: px(R.boss.cy + 4) });
await wait(900);
dun.room.send("dev:bosshp", { frac: 0.01 });
await wait(150);
dun.room.send("dev:killnear", 900);
const won = await waitFor(() => dun.msgs.find((x) => x.type === "victory"), 5000);
check("Aurelion falls", !!won, won?.m?.title ?? "");

// The player idling on Floor 1 hears it, and the way up opens for them.
const news = await waitFor(() => idle.msgs.find((x) => x.type === "floorOpened"));
check("everyone online sees Floor 2 open", news?.m.floor === 2 && news.m.by?.includes(`Opener${tag}`), JSON.stringify(news?.m ?? "nothing"));
const opened = await waitFor(() => (idle.inv?.floor ?? 0) >= 2 || undefined);
check("the idle player's Floor 2 opens", !!opened, `floor ${idle.inv?.floor}`);
mark = idle.msgs.length;
idle.room.send("interact", "ascent-gate");
const up = await waitFor(() => idle.msgs.slice(mark).find((x) => x.type === "travel"));
check("the Ascent Gate now takes them up", up?.m.room === "floor2", JSON.stringify(up?.m ?? ""));
await leave(idle);

// On Floor 2, the Herald's story is open to them though Floor 1's isn't finished.
const f2 = watch(await new Client(endpoint).joinOrCreate("floor2", { token: idle.token }));
await settle(f2);
await wait(600);
check("Floor 2 lets them in", !f2.msgs.some((x) => x.type === "travel"), `in ${f2.room.name}`);
f2.room.send("dev:teleport", { x: px(85), y: px(116) });
await wait(300);
mark = f2.msgs.length;
f2.room.send("interact", "herald");
const dlg = await waitFor(() => f2.msgs.slice(mark).find((x) => x.type === "dialog"));
check("the Herald offers Floor 2's story anyway", !!dlg?.m.offers?.some((o: any) => o.id === "f2_arrival"), dlg ? dlg.m.offers.map((o: any) => o.id).join(",") || "no offers" : "no dialog");
f2.room.send("quest:accept", "f2_arrival");
const took = await waitFor(() => f2.inv?.quests?.f2_arrival || undefined);
check("and they can take it", !!took, JSON.stringify(took ?? ""));

// An admin seals Floor 2 while they're up there: they're sent down to the Ascent Gate.
const admin = watch(await new Client(endpoint).joinOrCreate("world", { guest: "Ofir" }));
await settle(admin);
mark = f2.msgs.length;
admin.room.send("admin:tower", { floor: 2, open: false });
const sealedMsg = await waitFor(() => f2.msgs.slice(mark).find((x) => x.type === "floorSealed"));
check("the player on Floor 2 sees it sealed", sealedMsg?.m.floor === 2, JSON.stringify(sealedMsg?.m ?? "nothing"));
const down = await waitFor(() => f2.msgs.slice(mark).find((x) => x.type === "travel"));
check("and is sent back down", down?.m.room === "world", JSON.stringify(down?.m ?? "nothing"));
const panel = await waitFor(() => admin.msgs.find((x) => x.type === "admin:overview" && x.m.world));
check("the admin panel shows it sealed", panel?.m.world.floor === 1 && !!panel.m.world.sealed, JSON.stringify(panel?.m.world ?? ""));
await leave(f2);
const below = watch(await new Client(endpoint).joinOrCreate("world", { token: idle.token }));
await settle(below);
const bp = below.room.state.players.get(below.room.sessionId);
check("they arrive by the Ascent Gate", !!bp && Math.hypot(bp.x - px(38), bp.y - px(69)) < 96, bp ? `at ${Math.floor(bp.x / TILE)},${Math.floor(bp.y / TILE)}` : "nowhere");
check("with Floor 2 locked for them", (below.inv?.floor ?? 0) === 1, `floor ${below.inv?.floor}`);
mark = below.msgs.length;
below.room.send("interact", "ascent-gate");
const shut = await waitFor(() => below.msgs.slice(mark).find((x) => x.type === "lore" || x.type === "travel"));
check("the Ascent Gate is sealed again", shut?.type === "lore", shut?.type ?? "nothing");
const late = await register(`Late${tag}`);
check("a new player can't go up while it's sealed", (late.inv?.floor ?? 0) === 1, `floor ${late.inv?.floor}`);

// The admin opens it again: everyone gets the celebration.
mark = below.msgs.length;
const lateMark = late.msgs.length;
admin.room.send("admin:tower", { floor: 2, open: true });
const again = await waitFor(() => below.msgs.slice(mark).find((x) => x.type === "floorOpened"));
check("reopening plays the celebration for everyone", !!again?.m.admin && !!late.msgs.slice(lateMark).find((x) => x.type === "floorOpened"), JSON.stringify(again?.m ?? "nothing"));
const reopened = await waitFor(() => ((below.inv?.floor ?? 0) >= 2 && (late.inv?.floor ?? 0) >= 2) || undefined);
check("and the way up opens for them", !!reopened, `floors ${below.inv?.floor}, ${late.inv?.floor}`);
await leave(below);
await leave(late);
await leave(admin);

// The climber who was offline logs in to an open Floor 2.
const back = watch(await new Client(endpoint).joinOrCreate("world", { token: away.token }));
await settle(back);
check("a player who was offline finds Floor 2 open", (back.inv?.floor ?? 0) >= 2, `floor ${back.inv?.floor}`);
check("Floor 3 stays closed until Vaelra falls", (back.inv?.floor ?? 0) === 2, `floor ${back.inv?.floor}`);

// Floor 3: an admin opens it (as Vaelra's fall would) — everyone online goes up a floor.
const admin3 = watch(await new Client(endpoint).joinOrCreate("world", { guest: "Ofir" }));
await settle(admin3);
mark = back.msgs.length;
admin3.room.send("admin:tower", { floor: 3, open: true });
const f3news = await waitFor(() => back.msgs.slice(mark).find((x) => x.type === "floorOpened"));
check("Floor 3 opens for everyone", f3news?.m.floor === 3, JSON.stringify(f3news?.m ?? "nothing"));
await waitFor(() => (back.inv?.floor ?? 0) >= 3 || undefined);
check("the climber can now reach Floor 3", (back.inv?.floor ?? 0) >= 3, `floor ${back.inv?.floor}`);
await leave(back);
const up3 = watch(await new Client(endpoint).joinOrCreate("floor3", { token: away.token }));
await settle(up3);
check("they stand on Floor 3", !!up3.room.state.players?.get(up3.room.sessionId) && !up3.msgs.some((x) => x.type === "travel"), up3.msgs.filter((x) => x.type === "travel").map((x) => JSON.stringify(x.m)).join(" ") || "on floor 3");
// Sealing Floor 3 sends them down to Floor 2, beside the Ember Stair (not all the way to Floor 1).
mark = up3.msgs.length;
admin3.room.send("admin:tower", { floor: 3, open: false });
const down3 = await waitFor(() => up3.msgs.slice(mark).find((x) => x.type === "travel"));
check("sealing Floor 3 sends them to Floor 2", down3?.m.room === "floor2", JSON.stringify(down3?.m ?? "nothing"));
await leave(up3);
const on2 = watch(await new Client(endpoint).joinOrCreate("floor2", { token: away.token }));
await settle(on2);
const p2 = on2.room.state.players.get(on2.room.sessionId);
check("…by the Ember Stair", !!p2 && Math.hypot(p2.x - px(92), p2.y - px(9)) < 100, p2 ? `at ${Math.floor(p2.x / TILE)},${Math.floor(p2.y / TILE)}` : "nowhere");
check("with Floor 3 locked again", (on2.inv?.floor ?? 0) === 2, `floor ${on2.inv?.floor}`);
await leave(on2);
await leave(admin3);
await leave(dun);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
