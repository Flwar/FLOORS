/** Interest management check: clients only receive entities near them (npm run interest). */
import { Client } from "@colyseus/sdk";
import { SERVER_PORT } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

const room = await new Client(endpoint).joinOrCreate("world", { guest: "Scout" });
room.onMessage("*", () => {});
while (!room.state.players?.get(room.sessionId)) await wait(20);
await wait(800);
const me = () => room.state.players.get(room.sessionId);
const far = () => {
  let n = 0;
  room.state.enemies?.forEach((e: any) => { if (Math.max(Math.abs(e.x - me().x), Math.abs(e.y - me().y)) > 1500) n++; });
  return n;
};
const inTown = room.state.enemies.size;
check("town sees only nearby enemies", inTown > 0 && inTown < 20 && far() === 0, `${inTown} enemies visible, ${far()} beyond range`);
room.send("dev:teleport", { x: 150 * 32, y: 60 * 32 });
await wait(1500);
const inRuins = room.state.enemies.size;
let sawRuinsFoe = false;
room.state.enemies?.forEach((e: any) => { if (e.x > 130 * 32) sawRuinsFoe = true; });
check("moving brings the new area into view", sawRuinsFoe && far() === 0, `${inRuins} enemies visible in the ruins, ${far()} beyond range`);
room.send("dev:teleport", { x: 38 * 32, y: 84 * 32 });
await wait(1500);
check("leaving an area drops it from view", far() === 0, `${room.state.enemies.size} visible after returning, ${far()} beyond range`);
await room.leave();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
