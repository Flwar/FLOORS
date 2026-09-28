/** Player trading (npm run trade): request, offers, anti-switch readiness, atomic swap, walk-away cancel. */
import { Client, type Room } from "@colyseus/sdk";
import { SERVER_PORT } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

async function bot(name: string) {
  const room: Room<any, any> = await new Client(endpoint).joinOrCreate("world", { guest: name });
  const s = { room, inv: undefined as any, trade: undefined as any, msgs: [] as { type: string; m: any }[] };
  room.onMessage("*", (type, m) => {
    s.msgs.push({ type: String(type), m });
    if (type === "inv") s.inv = m;
    if (type === "trade") s.trade = m;
  });
  while (!room.state.players?.get(room.sessionId) || !s.inv) await wait(20);
  return s;
}
const count = (inv: any, key: string) => inv.inventory.filter((x: any) => x?.key === key).reduce((a: number, b: any) => a + b.qty, 0);

const suffix = Math.floor(Math.random() * 1e4);
const a = await bot(`Seller${suffix}`);
const b = await bot(`Buyer${suffix}`);
a.room.send("dev:teleport", { x: 1300, y: 2700 });
b.room.send("dev:teleport", { x: 1330, y: 2700 });
a.room.send("dev:give", { key: "charm_amber", rarity: 1 });
a.room.send("dev:give", { key: "key_ruins" });
b.room.send("dev:give", { gold: 200 });
await wait(700);

a.room.send("trade:request", b.room.sessionId);
await wait(300);
const req = b.msgs.find((x) => x.type === "tradeRequest");
check("trade request arrives", !!req, req ? `from ${req.m.name}` : "none");
b.room.send("trade:accept", a.room.sessionId);
await wait(300);
check("trade window opens for both", !!a.trade?.mine && !!b.trade?.mine, `partners: ${a.trade?.partner} / ${b.trade?.partner}`);

// Bound items can't be offered.
const key = a.inv.inventory.find((x: any) => x?.key === "key_ruins");
a.room.send("trade:offer", { uids: [key.uid], gold: 0 });
await wait(300);
check("bound quest items refused", a.msgs.some((x) => x.type === "notice" && /Bound/.test(x.m.text)) && a.trade.mine.items.length === 0, "rejected with a notice");

const amber = a.inv.inventory.find((x: any) => x?.key === "charm_amber");
a.room.send("trade:offer", { uids: [amber.uid], gold: 5 });
b.room.send("trade:offer", { uids: [], gold: 150 });
await wait(300);
b.room.send("trade:ready");
await wait(200);
// Seller tries to switch the offer after the buyer is ready: readiness must reset.
a.room.send("trade:offer", { uids: [], gold: 5 });
await wait(300);
check("changing an offer un-readies both", b.trade?.mine && !b.trade.mine.ready && !a.trade.mine.ready, `buyer ready ${b.trade?.mine?.ready}`);
a.room.send("trade:offer", { uids: [amber.uid], gold: 5 });
await wait(200);
const aGold = a.inv.gold;
const bGold = b.inv.gold;
a.room.send("trade:ready");
b.room.send("trade:ready");
await wait(600);
check("trade completes atomically", count(b.inv, "charm_amber") === 1 && count(a.inv, "charm_amber") === 0 && a.inv.gold === aGold - 5 + 150 && b.inv.gold === bGold - 150 + 5,
  `buyer amber ${count(b.inv, "charm_amber")}, seller gold ${aGold}→${a.inv.gold}, buyer gold ${bGold}→${b.inv.gold}`);

// Walking away cancels.
a.room.send("trade:request", b.room.sessionId);
await wait(200);
b.room.send("trade:accept", a.room.sessionId);
await wait(300);
b.room.send("dev:teleport", { x: 1800, y: 2700 });
await wait(900);
check("walking away cancels", a.msgs.some((x) => x.type === "trade" && x.m.closed && /apart/.test(x.m.reason ?? "")), "cancelled when too far apart");

await a.room.leave();
await b.room.leave();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
