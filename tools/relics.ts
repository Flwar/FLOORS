/**
 * Floor Boss trophies (npm run relics): the Fragment of the First Gate carries you to the town
 * of any floor that's open to you, the other trophies home to their own floor's town. One
 * shared cooldown; not mid-fight; not to a floor that isn't open; not without the trophy.
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor1, RELIC_COOLDOWN_MS, SERVER_PORT } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const spawn = buildFloor1().spawn;
const tag = Math.floor(Math.random() * 1e5);

async function join(name: string) {
  const room: Room = await new Client(endpoint).joinOrCreate("world", { guest: name });
  const msgs: { type: string; m: any }[] = [];
  room.onMessage("*", (type, m) => msgs.push({ type: String(type), m }));
  for (let i = 0; i < 200 && !room.state.players?.get(room.sessionId); i++) await wait(25);
  const me = () => room.state.players.get(room.sessionId) as { x: number; y: number };
  /** What the server said since `mark`. */
  const said = (mark: number) => msgs.slice(mark).map((x) => (x.type === "notice" ? x.m.text : x.type === "travel" ? `travel:${x.m.room}` : "")).filter(Boolean).join(" | ");
  return { room, msgs, me, said };
}

// The Fragment of the First Gate: back to the Floor 1 town from out in the fields.
const A = await join(`Gatekeeper${tag}`);
A.room.send("dev:give", { key: "art_gatestone" });
A.room.send("dev:floor", 3);
A.room.send("dev:teleport", { x: 2600, y: 1700 });
await wait(500);
let mark = A.msgs.length;
A.room.send("relic:use", { key: "art_gatestone", floor: 5 });
await wait(400);
check("the Gate won't open onto a floor you haven't reached", /isn't open/.test(A.said(mark)), A.said(mark));
mark = A.msgs.length;
A.room.send("relic:use", { key: "art_gatestone", floor: 1 });
await wait(600);
const at = A.me();
check("the Fragment of the First Gate carries you to town", Math.hypot(at.x - spawn.x, at.y - spawn.y) < 60, `${Math.round(at.x)},${Math.round(at.y)} (town ${spawn.x},${spawn.y}); ${A.said(mark)}`);
mark = A.msgs.length;
A.room.send("relic:use", { key: "art_gatestone", floor: 1 });
await wait(400);
check(`then it rests (${RELIC_COOLDOWN_MS / 60000} minutes)`, /gathering itself/.test(A.said(mark)), A.said(mark));
mark = A.msgs.length;
A.room.send("relic:use", { key: "art_stormheart" });
await wait(400);
check("a trophy you don't have does nothing", A.said(mark) === "", A.said(mark) || "nothing");

// Another floor's trophy takes you home to it.
const B = await join(`Stormborn${tag}`);
B.room.send("dev:give", { key: "art_stormheart" });
B.room.send("dev:floor", 2);
B.room.send("dev:hurt", { amount: 1, combat: true });
await wait(400);
mark = B.msgs.length;
B.room.send("relic:use", { key: "art_stormheart" });
await wait(400);
check("not in the middle of a fight", /middle of a fight/.test(B.said(mark)), B.said(mark));
await wait(6200);
mark = B.msgs.length;
B.room.send("relic:use", { key: "art_stormheart" });
await wait(600);
check("the Stormheart takes you home to Floor 2", /travel:floor2/.test(B.said(mark)), B.said(mark));

for (const p of [A, B]) await Promise.race([p.room.leave().catch(() => {}), wait(1200)]);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
