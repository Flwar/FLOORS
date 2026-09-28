/**
 * Headless multiplayer smoke test against a running server.
 *   npm run smoke            (server must be running: npm run dev:server)
 *
 * Two bots join the world. Bot A walks and collides; bot B must observe A's
 * authoritative movement. Exits non-zero on any failed check.
 */
import { Client, type Room } from "@colyseus/sdk";
import { BODY_HALF_H, BODY_HALF_W, buildFloor1, SERVER_PORT, STEP_SECONDS, WALK_SPEED } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const map = buildFloor1();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
}

async function join(name: string) {
  const room = await new Client(endpoint).joinOrCreate("world", { guest: name });
  while (!room.state.players?.get(room.sessionId)) await wait(20);
  const input = room.input({ mode: "reliable" });
  return { room, input, me: () => room.state.players.get(room.sessionId) };
}

/** Send one input per fixed step for `seconds`, like a real client's input loop. */
async function drive(bot: Awaited<ReturnType<typeof join>>, mx: number, my: number, seconds: number, sprint = false) {
  const steps = Math.round(seconds / STEP_SECONDS);
  for (let i = 0; i < steps; i++) {
    bot.input.data.mx = mx;
    bot.input.data.my = my;
    bot.input.data.btn = sprint ? 64 : 0;
    bot.input.data.aim = 64;
    bot.input.send();
    await wait(STEP_SECONDS * 1000);
  }
  await wait(300); // let the last patches arrive
}

async function main() {
  const a = await join("BotA");
  const b = await join("BotB");
  const view = (room: Room, sid: string) => room.state.players.get(sid);
  for (let i = 0; i < 100 && (a.room.state.players.size < 2 || b.room.state.players.size < 2); i++) await wait(20);

  check("both bots see two players", a.room.state.players.size >= 2 && b.room.state.players.size >= 2,
    `A sees ${a.room.state.players.size}, B sees ${b.room.state.players.size}`);

  // Walk east 1s: ~WALK_SPEED px, and B must see the same authoritative position.
  const x0 = a.me().x;
  await drive(a, 1, 0, 1);
  const moved = a.me().x - x0;
  check("walk speed", Math.abs(moved - WALK_SPEED) < WALK_SPEED * 0.1, `moved ${moved.toFixed(1)}px in 1s (expected ~${WALK_SPEED})`);
  const seenByB = view(b.room, a.room.sessionId);
  check("B observes A", Math.abs(seenByB.x - a.me().x) < 0.01 && Math.abs(seenByB.y - a.me().y) < 0.01,
    `A at ${a.me().x.toFixed(1)},${a.me().y.toFixed(1)}; B sees ${seenByB.x.toFixed(1)},${seenByB.y.toFixed(1)}`);

  // Walk far north into the town wall and confirm the server stops A flush against it.
  await drive(a, 0, -1, 6);
  const { x, y } = a.me();
  const flush = !map.boxBlocked(x, y, BODY_HALF_W, BODY_HALF_H) && map.boxBlocked(x, y - 1, BODY_HALF_W, BODY_HALF_H);
  check("wall collision", flush, `stopped at ${x.toFixed(1)},${y.toFixed(1)}; free here and blocked 1px north: ${flush}`);

  // Sprint drains stamina server-side.
  const s0 = a.me().stamina;
  await drive(a, 0, 1, 1, true);
  check("sprint drains stamina", a.me().stamina < s0 - 15, `stamina ${s0.toFixed(1)} -> ${a.me().stamina.toFixed(1)}`);

  // Clients cannot cheat speed: out-of-range axis values are clamped by the server.
  const cx = a.me().x;
  for (let i = 0; i < 60; i++) {
    a.input.data.mx = 100;
    a.input.data.my = 0;
    a.input.data.btn = 0;
    a.input.data.aim = 64;
    a.input.send();
    await wait(STEP_SECONDS * 1000);
  }
  await wait(300);
  const cheatMoved = a.me().x - cx;
  check("speed hack clamped", cheatMoved <= WALK_SPEED * 1.1, `mx=100 for 1s moved ${cheatMoved.toFixed(1)}px`);

  await a.room.leave();
  await wait(300);
  check("leave removes player", !b.room.state.players.has(a.room.sessionId), `B sees ${b.room.state.players.size} player(s)`);
  await b.room.leave();

  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
