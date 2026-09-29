/**
 * Core mechanics (npm run mechanics): gear set bonuses (two pieces: health and defense;
 * three: the set's power) and elite affixes (Frenzied, Warded, Volatile, Packleader).
 * inn meals (a timed buff from the innkeeper). Perfect dodges are covered by npm run combat.
 */
import { Client, type Room } from "@colyseus/sdk";
import { Affix, AFFIXES, buildFloor1, EAct, EFlag, ENEMIES, GEAR_SETS, HazardKind, SERVER_PORT } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

const c = new Client(endpoint);
const room: Room = await c.joinOrCreate("world", { guest: `Tinker${Math.floor(Math.random() * 1e5)}` });
let inv: any;
const msgs: { type: string; m: any }[] = [];
room.onMessage("*", (type, m) => {
  msgs.push({ type: String(type), m });
  if (type === "inv") inv = m;
});
for (let i = 0; i < 200 && (!room.state.players?.get(room.sessionId) || !inv); i++) await wait(25);
room.send("dev:give", { key: "", xp: 5_000_000 });
await wait(400);

// --- Gear sets -----------------------------------------------------------------------------
const wear = async (m: { weapon?: string; armor?: string; helm?: string }) => {
  room.send("dev:wear", { ...m, rarity: 1 });
  await wait(450);
  return { ...inv.derived };
};
const two = await wear({ weapon: "sword_void", armor: "armor_eclipse", helm: "" });
const one = await wear({ weapon: "sword_rime", armor: "armor_eclipse", helm: "" });
const set = GEAR_SETS.find((s) => s.id === "void")!;
check("two Eclipse pieces add health and defense", two.hpMax - one.hpMax === set.two.hp && two.defense - one.defense === set.two.defense, `+${two.hpMax - one.hpMax} health, +${two.defense - one.defense} defense`);
check("…but not the set's power", !two.effects?.includes("setVoid"), (two.effects ?? []).join(",") || "none");
const three = await wear({ weapon: "sword_void", armor: "armor_eclipse", helm: "helm_eclipse" });
check("all three Eclipse pieces grant its power", three.effects?.includes("setVoid"), (three.effects ?? []).join(","));
const mixed = await wear({ weapon: "sword_void", armor: "armor_rime", helm: "helm_rimecrown" });
check("two Frostforged pieces with an Eclipse blade: Frostforged's two-piece bonus only", !mixed.effects?.some((e: string) => e.startsWith("set")), (mixed.effects ?? []).join(",") || "none");

// --- Elite affixes -------------------------------------------------------------------------
const enemyNear = (key: string, affix: number) => {
  let found: { id: string; e: any } | undefined;
  room.state.enemies?.forEach((e: any, id: string) => {
    if (ENEMIES[e.def]?.key === key && e.affix === affix && e.act !== EAct.Dead) found = { id, e };
  });
  return found;
};
room.send("dev:teleport", { x: 1500, y: 1500 });
await wait(300);
for (const [name, affix] of Object.entries(Affix)) {
  if (!affix) continue;
  room.send("dev:killnear", 700);
  await wait(300);
  room.send("dev:heal");
  room.send("dev:spawn", { key: "goblin", elite: true, level: 6, affix });
  // Newly risen enemies can not be hurt for half a second.
  await wait(1000);
  const found = enemyNear("goblin", affix);
  check(`a ${AFFIXES[affix].name} elite carries its affix`, !!found, name);
  if (!found) continue;
  if (affix === Affix.Frenzied) check("Frenzied elites are always enraged", (found.e.flags & EFlag.Enraged) !== 0, `flags ${found.e.flags}`);
  if (affix === Affix.Volatile) {
    room.send("dev:killnear", 400);
    let blast = false;
    for (let i = 0; i < 20 && !blast; i++) {
      await wait(50);
      room.state.hazards?.forEach((h: any) => {
        if (h.kind === HazardKind.Meteor && h.team === 1 && Math.hypot(h.x - found.e.x, h.y - found.e.y) < 40) blast = true;
      });
    }
    check("Volatile elites explode after they die", blast, blast ? "a blast is coming" : `no blast (act ${found.e.act}, hazards ${room.state.hazards?.size})`);
    room.send("dev:teleport", { x: 1500, y: 1900 });
    await wait(1400);
    room.send("dev:teleport", { x: 1500, y: 1500 });
  }
  if (affix === Affix.Packleader) {
    let before = 0;
    room.state.enemies?.forEach((e: any) => {
      if (ENEMIES[e.def]?.key === "goblin" && e.act !== EAct.Dead) before++;
    });
    room.send("dev:hitnear", { frac: 0.45 });
    await wait(600);
    let after = 0;
    room.state.enemies?.forEach((e: any) => {
      if (ENEMIES[e.def]?.key === "goblin" && e.act !== EAct.Dead) after++;
    });
    check("a hurt Packleader calls its pack", after >= before + 1, `${before} → ${after} goblins`);
  }
}
room.send("dev:killnear", 700);

// --- Inn meals -----------------------------------------------------------------------------
const inn = buildFloor1().npcs.find((n) => n.id === "innkeep")!;
room.send("dev:give", { key: "", gold: 1000 });
await wait(300);
const hpBefore = inv.derived.hpMax;
const goldBefore = inv.gold;
room.send("dev:teleport", { x: inn.x, y: inn.y + 30 });
await wait(400);
room.send("inn:eat", { npc: "innkeep", meal: "stew" });
await wait(600);
check("a Hearty Stew at the inn adds 12% health", inv.meal?.id === "stew" && Math.abs(inv.derived.hpMax / hpBefore - 1.12) < 0.02, `${hpBefore} → ${inv.derived.hpMax}`);
check("…and costs gold", inv.gold < goldBefore, `${goldBefore} → ${inv.gold}`);
room.send("inn:eat", { npc: "innkeep", meal: "skewers" });
await wait(600);
check("another meal replaces it", inv.meal?.id === "skewers" && inv.derived.hpMax === hpBefore && inv.derived.atk > 0, `meal ${inv.meal?.id}, health ${inv.derived.hpMax}`);
room.send("dev:teleport", { x: 1500, y: 1500 });
await wait(300);
const far = inv.meal?.until;
room.send("inn:eat", { npc: "innkeep", meal: "stew" });
await wait(500);
check("you can only order at the inn", inv.meal?.id === "skewers" && inv.meal?.until === far, inv.meal?.id ?? "none");
await Promise.race([room.leave().catch(() => {}), wait(1200)]);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
