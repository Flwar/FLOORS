/**
 * Progress systems (npm run progress): the smith's Salvage and Temper, walking over loot to
 * gather it, Hunter's Lore, enemies crying out for help, and the Thorned and Shielded affixes.
 */
import { Client, type Room } from "@colyseus/sdk";
import { Affix, buildFloor1, EFlag, ENEMIES, EAct, HUNT_BONUS, salvageYield, SERVER_PORT, temperCost } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const map = buildFloor1();
const smith = map.npcs.find((n) => n.role === "smith")!;

const room: Room = await new Client(endpoint).joinOrCreate("world", { guest: `Smithy${Math.floor(Math.random() * 1e5)}` });
let inv: any;
const msgs: { type: string; m: any }[] = [];
room.onMessage("*", (type, m) => {
  msgs.push({ type: String(type), m });
  if (type === "inv") inv = m;
});
for (let i = 0; i < 200 && !(room.state.players?.get(room.sessionId) && inv); i++) await wait(25);
const me = () => room.state.players.get(room.sessionId) as any;
const count = (key: string) => (inv.inventory as any[]).reduce((n, x) => n + (x?.key === key ? x.qty : 0), 0);
const find = (key: string) => (inv.inventory as any[]).find((x) => x?.key === key);
type Seen = { id: string; key: string; target?: string; hp: number; hpMax: number; act: number; x: number; y: number };
const seen = async (radius = 1200): Promise<Seen[]> => {
  const mark = msgs.length;
  room.send("dev:targets", radius);
  for (let i = 0; i < 40; i++) {
    const t = msgs.slice(mark).find((x) => x.type === "targets");
    if (t) return t.m;
    await wait(25);
  }
  return [];
};

// --- The smith: salvage and temper ------------------------------------------------------
room.send("dev:give", { key: "", xp: 3_000_000, gold: 50_000 });
room.send("dev:give", { key: "sword_iron", rarity: 2 });
room.send("dev:give", { key: "helm_iron", rarity: 0 });
room.send("dev:teleport", { x: smith.x, y: smith.y + 34 });
await wait(800);
const rare = find("sword_iron");
const expect = salvageYield(rare)!;
const before = Object.fromEntries(expect.map((y) => [y.key, count(y.key)]));
room.send("smith:salvage", rare.uid);
await wait(600);
check("salvaging a Rare sword gives its floor's material and Arcane Essence", !find("sword_iron") && expect.every((y) => count(y.key) === before[y.key] + y.qty), expect.map((y) => `${y.key} ${before[y.key]} → ${count(y.key)}`).join(", "));

const helm = find("helm_iron");
const tc = temperCost(helm)!;
room.send("dev:give", { key: "mat_essence", qty: 20 });
await wait(300);
const essence = count("mat_essence");
room.send("smith:temper", helm.uid);
await wait(600);
const tempered = (inv.inventory as any[]).find((x) => x?.uid === helm.uid);
check("tempering raises an item one rarity and costs essence", tempered?.rarity === 1 && count("mat_essence") === essence - tc.essence && (tempered?.bonus?.defense ?? 0) > 0, `rarity ${tempered?.rarity}, essence ${essence} → ${count("mat_essence")}`);
room.send("smith:temper", helm.uid);
room.send("smith:temper", helm.uid);
room.send("smith:temper", helm.uid);
room.send("dev:give", { key: "mat_essence", qty: 50 });
room.send("smith:temper", helm.uid);
room.send("smith:temper", helm.uid);
await wait(800);
const top = (inv.inventory as any[]).find((x) => x?.uid === helm.uid);
check("tempering stops at Epic (Legendaries are only found)", top?.rarity === 3, `rarity ${top?.rarity}`);
room.send("dev:teleport", { x: 1500, y: 1500 });
await wait(300);
const far = count("mat_essence");
room.send("dev:give", { key: "helm_iron" });
await wait(300);
room.send("smith:salvage", find("helm_iron")?.uid);
await wait(400);
check("only at the smith", !!find("helm_iron") && count("mat_essence") === far, "away from the forge nothing happens");

// --- Walking over loot -----------------------------------------------------------------
room.send("dev:killnear", 800);
const pelts = count("mat_pelt");
room.send("dev:drop", { key: "mat_pelt", qty: 3, dx: 70 });
await wait(400);
check("loot on the ground waits to be walked over", count("mat_pelt") === pelts, `${count("mat_pelt")}`);
room.send("dev:teleport", { x: me().x + 70, y: me().y });
await wait(500);
check("walking over materials gathers them", count("mat_pelt") === pelts + 3, `${pelts} → ${count("mat_pelt")}`);
room.send("dev:drop", { key: "sword_rusty", dx: 0 });
await wait(500);
check("…but gear still waits for a press", !find("sword_rusty"), find("sword_rusty") ? "picked up" : "still on the ground");
const pelt = find("mat_pelt");
room.send("discard", pelt.uid);
await wait(600);
check("what you put down yourself stays put", count("mat_pelt") === pelts, `${count("mat_pelt")}`);

// --- Hunter's Lore ------------------------------------------------------------------------
const strikeOnce = async (kills: number) => {
  room.send("dev:killnear", 800);
  room.send("dev:hunts", { key: "brute", kills });
  await wait(300);
  const ids = new Set((await seen()).map((e) => e.id));
  room.send("dev:spawn", { key: "brute", level: 10 });
  await wait(1200);
  const e = (await seen()).find((x) => x.key === "brute" && !ids.has(x.id))!;
  room.send("dev:strike", { damage: 60, radius: 300 });
  await wait(300);
  const after = (await seen()).find((x) => x.id === e.id)!;
  return e.hp - after.hp;
};
room.send("dev:teleport", { x: 1500, y: 1500 });
await wait(300);
const plain = await strikeOnce(0);
const master = await strikeOnce(300);
check(`a Master hunter (300 slain) hits that kind ${Math.round(HUNT_BONUS[3] * 100)}% harder`, Math.abs(master / plain - (1 + HUNT_BONUS[3])) < 0.03, `${plain} → ${master}`);
room.send("dev:hunts", { key: "brute", kills: 24 });
await wait(300);
const mark = msgs.length;
room.send("dev:killnear", 800);
await wait(700);
const rank = msgs.slice(mark).find((x) => x.type === "hunt");
check("every kill counts, and a new rank is announced", inv.hunts?.brute === 25 && rank?.m.rank === 1, `${inv.hunts?.brute} slain, ${JSON.stringify(rank?.m)}`);

// --- A cry for help -----------------------------------------------------------------------
room.send("dev:killnear", 900);
await wait(300);
// (An open stretch of the fields, so nothing stands between them.)
const clear = (x: number, y: number) => !map.boxBlocked(x, y, 14, 10) && !map.zoneAt(x, y)?.safe;
let lane: { x: number; y: number } | undefined;
for (let y = 1200; y < map.outdoorHeight * 32 - 400 && !lane; y += 64) {
  for (let x = 600; x < map.width * 32 - 800 && !lane; x += 64) {
    let ok = true;
    for (let dx = -300; dx <= 260 && ok; dx += 16) for (const dy of [-30, 0, 30]) ok &&= clear(x + dx, y + dy);
    if (ok) lane = { x, y };
  }
}
const x0 = lane!.x;
const y0 = lane!.y;
room.send("dev:teleport", { x: x0 - 90, y: y0 });
await wait(250);
room.send("dev:spawn", { key: "goblin", level: 6 });
room.send("dev:teleport", { x: x0 + 60, y: y0 });
await wait(250);
room.send("dev:spawn", { key: "goblin", level: 6 });
room.send("dev:teleport", { x: x0 - 250, y: y0 });
await wait(1500);
let gobs = (await seen()).filter((e) => e.key === "goblin").sort((a, b) => a.x - b.x);
const [near, other] = gobs;
check("two goblins, neither yet aware of you", gobs.length === 2 && !near.target && !other.target, gobs.map((g) => `${Math.round(g.x)}:${g.target}`).join(" "));
room.send("dev:hitnear", { frac: 0.4, radius: 300 });
await wait(1200);
gobs = await seen();
const o2 = gobs.find((e) => e.id === other.id);
const n2 = gobs.find((e) => e.id === near.id);
check("a badly hurt enemy cries out, and its ally comes", !!n2 && n2.hp < n2.hpMax / 2 && !!o2?.target, `hurt ${n2?.hp}/${n2?.hpMax}, ally targets ${o2?.target}`);

// --- Thorned and Shielded -------------------------------------------------------------------
const elite = async (affix: number) => {
  room.send("dev:killnear", 900);
  room.send("dev:teleport", { x: 1500, y: 1500 });
  await wait(300);
  const ids = new Set((await seen()).map((e) => e.id));
  room.send("dev:spawn", { key: "brute", elite: true, level: 10, affix });
  await wait(1200);
  room.send("dev:heal");
  await wait(150);
  return (await seen()).find((x) => x.key === "brute" && !ids.has(x.id))!;
};
const th = await elite(Affix.Thorned);
const hp0 = me().hp;
room.send("dev:strike", { damage: 150, radius: 300 });
await wait(150);
check("striking a Thorned elite up close hurts you too", me().hp < hp0, `${hp0} → ${me().hp}`);

const sh = await elite(Affix.Shielded);
let flags = 0;
room.state.enemies?.forEach((e: any, id: string) => {
  if (id === sh.id) flags = e.flags;
});
check("a Shielded elite wears its ward", (flags & EFlag.Shielded) !== 0, `flags ${flags}`);
room.send("dev:strike", { damage: 4, radius: 300 });
await wait(300);
const s1 = (await seen()).find((e) => e.id === sh.id)!;
check("…which soaks the first blows", s1.hp === sh.hp, `${sh.hp} → ${s1.hp}`);
for (let i = 0; i < 4; i++) {
  room.send("dev:strike", { damage: 120, radius: 300 });
  room.send("dev:heal");
  await wait(200);
}
await wait(300);
const s2 = (await seen()).find((e) => e.id === sh.id);
room.state.enemies?.forEach((e: any, id: string) => {
  if (id === sh.id) flags = e.flags;
});
check("…until it breaks", !!s2 && s2.hp < sh.hp && (flags & EFlag.Shielded) === 0, `hp ${sh.hp} → ${s2?.hp}, flags ${flags}`);

// --- Rested experience -------------------------------------------------------------------
const killFor = async () => {
  room.send("dev:killnear", 900);
  await wait(300);
  room.send("dev:spawn", { key: "wolf", level: 3 });
  await wait(1100);
  const mark = msgs.length;
  room.send("dev:killnear", 400);
  await wait(500);
  return msgs.slice(mark).find((x) => x.type === "xp")?.m as { amount: number; rested?: number } | undefined;
};
room.send("dev:rested", 0);
const normal = await killFor();
room.send("dev:rested", 100000);
await wait(200);
const doubled = await killFor();
check("rested, a kill pays double", !!normal && !!doubled && doubled.amount === normal.amount * 2 && doubled.rested === normal.amount, `${normal?.amount} → ${doubled?.amount} (rested ${doubled?.rested})`);
check("…and spends the rested pool", inv.rested === 100000 - (doubled?.rested ?? 0), `pool ${inv.rested}`);
room.send("dev:rested", 0);

room.send("dev:killnear", 900);
void ENEMIES;
void EAct;
await Promise.race([room.leave().catch(() => {}), wait(1200)]);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
