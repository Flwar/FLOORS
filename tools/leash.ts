/**
 * Leashing (npm run leash): an enemy doesn't give up and heal the moment you step out of its
 * range. It keeps after you for a few seconds; when it does turn for home it keeps its wounds,
 * turns and fights if you hit it on the way, and only slowly recovers once it has been home and
 * left alone for a while. Step far beyond its reach, though, and it lets you go at once.
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor1, EAct, ENEMIES, SERVER_PORT } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

// A long, open, unsafe lane in the fields to fight along.
const map = buildFloor1();
const LEASH = ENEMIES.find((e) => e.key === "brute")!.leashRange;
const clear = (x: number, y: number) => !map.boxBlocked(x, y, 14, 10) && !map.zoneAt(x, y)?.safe;
let lane: { x: number; y: number } | undefined;
for (let y = 1200; y < map.outdoorHeight * 32 - 400 && !lane; y += 64) {
  for (let x = 600; x < map.width * 32 - 1600 && !lane; x += 64) {
    let ok = true;
    for (let dx = -60; dx <= LEASH * 1.9 + 120 && ok; dx += 16) for (const dy of [-30, 0, 30]) ok &&= clear(x + dx, y + dy);
    if (ok) lane = { x, y };
  }
}
if (!lane) throw new Error("no open lane found");
const home = { x: lane.x + 90, y: lane.y };

type Seen = { id: string; key: string; target?: string; hp: number; hpMax: number; act: number; x: number; y: number; hx: number; hy: number };
const room: Room = await new Client(endpoint).joinOrCreate("world", { guest: `Kiter${Math.floor(Math.random() * 1e5)}` });
const msgs: { type: string; m: any }[] = [];
room.onMessage("*", (type, m) => msgs.push({ type: String(type), m }));
for (let i = 0; i < 200 && !room.state.players?.get(room.sessionId); i++) await wait(25);
const me = room.state.players.get(room.sessionId).name as string;
const seen = async (): Promise<Seen[]> => {
  const mark = msgs.length;
  room.send("dev:targets", 3000);
  for (let i = 0; i < 40; i++) {
    const t = msgs.slice(mark).find((x) => x.type === "targets");
    if (t) return t.m;
    await wait(25);
  }
  return [];
};
room.send("dev:give", { key: "", xp: 3_000_000 });
room.send("dev:teleport", lane);
await wait(500);
room.send("dev:killnear", 1600);
await wait(300);
const before = new Set((await seen()).map((e) => e.id));
room.send("dev:spawn", { key: "brute", level: 10 });
await wait(1500);
const id = (await seen()).find((e) => e.key === "brute" && !before.has(e.id))?.id;
if (!id) throw new Error("the brute didn't spawn");
const brute = async () => (await seen()).find((e) => e.id === id)!;
const heal = () => room.send("dev:heal");
/** Share of its health left (its level, and so its maximum, can change as it engages). */
const frac = (e: Seen) => Math.round((e.hp / e.hpMax) * 1000) / 1000;

room.send("dev:strike", { damage: 40, radius: 300 });
await wait(600);
let b = await brute();
check("a blow pulls it", b.target === me, `target ${b.target}, hp ${b.hp}/${b.hpMax}`);

// Step just past its leash range: it keeps coming.
room.send("dev:teleport", { x: home.x + LEASH + 90, y: home.y });
for (let i = 0; i < 6; i++) {
  heal();
  await wait(300);
}
b = await brute();
check("stepping just out of range doesn't shake it", b.target === me, `target ${b.target}, act ${b.act}`);

// Stay out of range: after a few seconds it gives up, but keeps its wounds on the way home.
for (let i = 0; i < 16; i++) {
  heal();
  await wait(300);
}
b = await brute();
const hurt = b.hp;
check("…but staying out of range, it eventually gives up", b.target === undefined && b.act === EAct.Leash, `target ${b.target}, act ${b.act}`);
check("…without healing on its way home", b.hp < b.hpMax, `hp ${b.hp}/${b.hpMax}`);

// Hit it on the way home: it turns and fights, and the blow lands.
await wait(300);
room.send("dev:strike", { damage: 30, radius: 2000 });
await wait(400);
b = await brute();
check("hitting it on its way home makes it turn and fight", b.target === me && b.act !== EAct.Leash, `target ${b.target}, act ${b.act}`);
check("…and the blow lands", b.hp < hurt, `${hurt} → ${b.hp}`);
const wounded = frac(b);

// Far beyond its reach: it lets you go at once.
room.send("dev:teleport", { x: home.x + LEASH * 1.9, y: home.y });
await wait(700);
b = await brute();
check("running far beyond its reach, it lets you go at once", b.target === undefined, `target ${b.target}, act ${b.act}`);

// It gets home still hurt, and only recovers after resting a while.
for (let i = 0; i < 40 && (await brute()).act === EAct.Leash; i++) await wait(250);
b = await brute();
check("it gets home still hurt", Math.hypot(b.x - b.hx, b.y - b.hy) < 20 && frac(b) === wounded, `${frac(b)} of its health (was ${wounded}), ${Math.round(Math.hypot(b.x - b.hx, b.y - b.hy))}px from home`);
await wait(4000);
const settled = frac(await brute());
check("it doesn't recover straight away", settled === wounded, `${settled} of its health`);
await wait(7000);
b = await brute();
check("…but after resting a while it slowly recovers", frac(b) > wounded && frac(b) < 1, `${wounded} → ${frac(b)} of its health`);

room.send("dev:killnear", 3000);
await Promise.race([room.leave().catch(() => {}), wait(1200)]);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
