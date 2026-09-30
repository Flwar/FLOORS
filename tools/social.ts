/**
 * Social and comfort (npm run social): sit on benches or the ground and rest faster,
 * stand up by moving, speech bubbles know who spoke, emotes and chat commands.
 */
import { Client, type Room } from "@colyseus/sdk";
import { buildFloor1, SERVER_PORT, seatPoint, SEAT_PROPS } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
interface Bot {
  room: Room;
  msgs: { type: string; m: any }[];
  input: ReturnType<Room["input"]>;
}
async function join(name: string): Promise<Bot> {
  const room = await new Client(endpoint).joinOrCreate("world", { guest: name });
  const b: Bot = { room, msgs: [], input: room.input({ mode: "reliable" }) };
  room.onMessage("*", (type, m) => b.msgs.push({ type: String(type), m }));
  for (let i = 0; i < 100 && !room.state.players?.get(room.sessionId); i++) await wait(30);
  await wait(300);
  return b;
}
const me = (b: Bot) => b.room.state.players.get(b.room.sessionId);
async function waitFor<T>(fn: () => T | undefined | false, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(40);
  }
  return undefined;
}
const tag = Math.floor(Math.random() * 1e5);
const map = buildFloor1();
const benchIdx = map.props.findIndex((p) => SEAT_PROPS[p.kind] === "bench");
const seat = seatPoint(map.props[benchIdx]);

const a = await join(`Rester${tag}`);
const b = await join(`Talker${tag}`);
a.room.send("dev:teleport", { x: seat.x + 20, y: seat.y + 16 });
b.room.send("dev:teleport", { x: seat.x + 60, y: seat.y + 30 });
await wait(300);

// Sit on the bench: you're moved onto it.
a.room.send("sit", { seat: benchIdx });
const onBench = await waitFor(() => me(a)?.sit === 2 || undefined);
check("sitting on a bench", !!onBench && Math.hypot(me(a).x - seat.x, me(a).y - seat.y) < 2, `sit ${me(a)?.sit} at ${Math.round(me(a)?.x)},${Math.round(me(a)?.y)}`);
check("others see you sitting", b.room.state.players.get(a.room.sessionId)?.sit === 2, `sit ${b.room.state.players.get(a.room.sessionId)?.sit}`);

// Resting heals faster than standing.
const regen = async (sitting: boolean) => {
  if (sitting) a.room.send("sit", {});
  a.room.send("dev:hurt", 40);
  await wait(150);
  const pl = me(a);
  const start = pl.hp;
  await wait(2000);
  return me(a).hp - start;
};
a.room.send("sit", {}); // stand
await wait(200);
a.room.send("dev:hurt", 60);
await wait(300);
const standing = await regen(false);
const sitting = await regen(true);
check("resting heals faster than standing", sitting > standing * 1.8, `standing +${standing}, sitting +${sitting} over 2s`);

// Moving stands you up.
for (let i = 0; i < 12; i++) {
  a.input.data.mx = 1;
  a.input.data.my = 0;
  a.input.data.aim = 0;
  a.input.data.btn = 0;
  a.input.send();
  await wait(1000 / 60);
}
a.input.data.mx = 0;
a.input.send();
const up = await waitFor(() => me(a)?.sit === 0 || undefined);
check("moving stands you up", !!up, `sit ${me(a)?.sit}`);

// Chat carries who spoke (for the bubble); emotes reach people nearby.
let mark = b.msgs.length;
a.room.send("chat", { text: "anyone for a rest?", channel: "say" });
const said = await waitFor(() => b.msgs.slice(mark).find((x) => x.type === "chat" && x.m.text === "anyone for a rest?"));
check("chat says who spoke, for the speech bubble", said?.m.p === a.room.sessionId, JSON.stringify(said?.m ?? ""));
mark = b.msgs.length;
a.room.send("chat", { text: "/wave", channel: "say" });
const waved = await waitFor(() => b.msgs.slice(mark).find((x) => x.type === "emote"));
check("/wave reaches players nearby", waved?.m.e === "wave" && waved.m.p === a.room.sessionId, JSON.stringify(waved?.m ?? ""));
check("and isn't sent as chat text", !b.msgs.slice(mark).some((x) => x.type === "chat" && x.m.text === "/wave"), "");
mark = b.msgs.length;
a.room.send("chat", { text: "/roll", channel: "say" });
const rolled = await waitFor(() => b.msgs.slice(mark).find((x) => x.type === "chat" && /rolls \d+/.test(x.m.text)));
check("/roll", !!rolled, rolled?.m.text ?? "nothing");
mark = a.msgs.length;
a.room.send("chat", { text: "/who", channel: "say" });
const who = await waitFor(() => a.msgs.slice(mark).find((x) => x.type === "notice" && String(x.m.text).includes("online")));
check("/who lists who's online", !!who && String(who.m.text).includes(`Talker${tag}`), who?.m.text ?? "nothing");
mark = a.msgs.length;
a.room.send("chat", { text: "/nonsense", channel: "say" });
const help = await waitFor(() => a.msgs.slice(mark).find((x) => x.type === "notice" && String(x.m.text).includes("/wave")));
check("unknown commands list what's available", !!help, help?.m.text ?? "nothing");

// Ground sit anywhere; not in a fight.
a.room.send("sit", {});
const ground = await waitFor(() => me(a)?.sit === 1 || undefined);
check("sitting on the ground", !!ground, `sit ${me(a)?.sit}`);
a.room.send("sit", {});
await wait(200);
a.room.send("dev:hurt", { amount: 5, combat: true });
await wait(200);
mark = a.msgs.length;
a.room.send("sit", {});
const refused = await waitFor(() => a.msgs.slice(mark).find((x) => x.type === "notice" && String(x.m.text).includes("Not while")) || me(a)?.sit);
check("no sitting down mid-fight", typeof refused === "object" && me(a)?.sit === 0, typeof refused === "object" ? refused.m.text : `sit ${me(a)?.sit}`);

for (const x of [a, b]) await Promise.race([x.room.leave().catch(() => {}), wait(800)]);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
