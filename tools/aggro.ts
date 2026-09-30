/**
 * Aggro (npm run aggro): enemies fight whoever threatens them most, not just whoever they
 * saw first. Two players against one enemy: the first to hit pulls it, a harder hitter
 * pulls it away, a taunt (Battle Cry) pulls it back and holds it, and when a player leaves
 * the enemy turns on the other instead of going home.
 */
import { Client, type Room } from "@colyseus/sdk";
import { SERVER_PORT } from "@floors/shared";

/** How long a body lingers after its player leaves mid-fight (server/src/rooms/GameRoom.ts). */
const LINKDEAD_MS = 8000;

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const tag = Math.floor(Math.random() * 1e5);
async function join(name: string) {
  const room: Room = await new Client(endpoint).joinOrCreate("world", { guest: name });
  const msgs: { type: string; m: any }[] = [];
  room.onMessage("*", (type, m) => msgs.push({ type: String(type), m }));
  for (let i = 0; i < 200 && !room.state.players?.get(room.sessionId); i++) await wait(25);
  return { room, msgs, name };
}
const A = await join(`Alda${tag}`);
const B = await join(`Bram${tag}`);
for (const p of [A, B]) {
  p.room.send("dev:give", { key: "", xp: 3_000_000 });
  p.room.send("dev:teleport", { x: 2600, y: 1700 });
}
await wait(600);
B.room.send("dev:teleport", { x: 2640, y: 1700 });
await wait(300);
// A big, tough target, well away from anything else.
A.room.send("dev:killnear", 700);
await wait(300);
A.room.send("dev:spawn", { key: "brute", level: 20, elite: true, affix: 3 });
await wait(1200);
const who = async () => {
  const mark = A.msgs.length;
  A.room.send("dev:targets", 300);
  for (let i = 0; i < 40; i++) {
    const t = A.msgs.slice(mark).find((x) => x.type === "targets");
    if (t) return (t.m as { key: string; target?: string }[]).find((e) => e.key === "brute")?.target;
    await wait(25);
  }
  return undefined;
};
const keepBothAlive = () => {
  A.room.send("dev:heal");
  B.room.send("dev:heal");
};

// (An enemy reconsiders between swings, so give it a moment to finish the one it started.)
A.room.send("dev:strike", { damage: 30 });
await wait(2000);
check("the first to hit it pulls it", (await who()) === A.name, String(await who()));

// B hits far harder: the brute turns on B.
for (let i = 0; i < 3; i++) {
  B.room.send("dev:strike", { damage: 120 });
  keepBothAlive();
  await wait(300);
}
await wait(1500);
check("a harder hitter pulls it away", (await who()) === B.name, String(await who()));

// A taunts: it turns straight back, and holds even while B keeps hitting.
A.room.send("dev:taunt", 300);
await wait(200);
check("a taunt pulls it back at once", (await who()) === A.name, String(await who()));
B.room.send("dev:strike", { damage: 60 });
keepBothAlive();
await wait(1200);
check("…and holds it while the other keeps hitting", (await who()) === A.name, String(await who()));

// A small hit doesn't steal it back from the bigger threat.
await wait(2500);
for (let i = 0; i < 3; i++) {
  B.room.send("dev:strike", { damage: 150 });
  keepBothAlive();
  await wait(300);
}
// (It only turns between swings: give it a moment to finish the one it started.)
let before = await who();
for (let i = 0; i < 12 && before !== B.name; i++) {
  keepBothAlive();
  await wait(250);
  before = await who();
}
A.room.send("dev:strike", { damage: 5 });
await wait(900);
check("a small hit doesn't steal it from the bigger threat", (await who()) === before, `${before} → ${await who()}`);

// Whoever it's fighting leaves: it turns on the other, instead of going home. (Leaving
// mid-fight leaves the body behind for a few seconds, so wait that out.)
const leaver = before === A.name ? A : B;
const stayer = leaver === A ? B : A;
await Promise.race([leaver.room.leave().catch(() => {}), wait(1200)]);
await wait(LINKDEAD_MS + 2000);
const mark = stayer.msgs.length;
stayer.room.send("dev:targets", 300);
await wait(400);
const after = (stayer.msgs.slice(mark).find((x) => x.type === "targets")?.m as { key: string; target?: string }[] | undefined)?.find((e) => e.key === "brute")?.target;
check("when its target leaves, it turns on the other", after === stayer.name, String(after));

stayer.room.send("dev:killnear", 500);
await Promise.race([stayer.room.leave().catch(() => {}), wait(1200)]);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
