/** World events (npm run events): a Bandit Raid is announced, fought, and rewards participants. */
import { Client } from "@colyseus/sdk";
import { SERVER_PORT, TILE } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

const room = await new Client(endpoint).joinOrCreate("world", { guest: "Defender" });
const msgs: { type: string; m: any }[] = [];
let inv: any;
room.onMessage("*", (type, m) => {
  msgs.push({ type: String(type), m });
  if (type === "inv") inv = m;
});
while (!room.state.players?.get(room.sessionId) || !inv) await wait(20);
// Make sure no other event is running, then start the raid.
room.send("dev:event", "end");
for (let i = 0; i < 40 && room.state.event; i++) await wait(250);
room.send("dev:event", "raid");
await wait(600);
const started = msgs.find((x) => x.type === "event" && x.m.id === "raid" && !x.m.ended);
check("raid announced to the world", !!started && room.state.event === "raid", started?.m.text ?? `state.event=${room.state.event}`);
room.send("dev:teleport", { x: room.state.eventX, y: room.state.eventY });
await wait(1200);
let raiders = 0;
room.state.enemies?.forEach((e: any) => { if (Math.hypot(e.x - room.state.eventX, e.y - room.state.eventY) < 200) raiders++; });
check("raiders are at the farms", raiders >= 5, `${raiders} raiders near ${Math.round(room.state.eventX / TILE)},${Math.round(room.state.eventY / TILE)}`);
const xp0 = inv.xp + inv.level * 1e6;
const gold0 = inv.gold;
room.send("dev:killnear", 400);
await wait(2600);
const ended = msgs.find((x) => x.type === "event" && x.m.id === "raid" && x.m.ended);
check("raid defeated", !!ended?.m.success && !room.state.event, ended?.m.text ?? "no end message");
await wait(300);
check("participants rewarded", inv.gold > gold0 && inv.xp + inv.level * 1e6 > xp0, `gold ${gold0}→${inv.gold}, xp ${inv.xp} (level ${inv.level})`);
await room.leave();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
