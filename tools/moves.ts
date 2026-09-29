/**
 * Moveset verification (npm run moves): every weapon's light chain, heavy, combo heavy
 * and every skill — its own and the universal ones every weapon can use — are used on a
 * training dummy; checks each connects (or fires its projectile / special) with the server.
 */
import { Client, Predict } from "@colyseus/sdk";
import { Btn, buildFloor1, EFlag, ENEMIES, radToAim, SERVER_PORT, stepPlayer, UNIVERSAL_BASE, UNIVERSAL_SKILLS, WEAPONS, type MoveDef, type PlayerSim, type WeaponDef } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const map = buildFloor1();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const FIELDS = ["x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted", "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge", "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "potions"];

const room = await new Client(endpoint).joinOrCreate("world", { guest: "Armsmaster" });
const msgs: { type: string; m: any }[] = [];
room.onMessage("*", (type, m) => msgs.push({ type: String(type), m }));
while (!room.state.players?.get(room.sessionId)) await wait(20);
const player = room.state.players.get(room.sessionId);
const predict = Predict.get(room, { mode: "lerp", delay: 100 });
predict.attachAll("enemies", { fields: ["x", "y"], mode: "lerp" });
const input = room.input({ mode: "reliable" });
const me = predict.reconciler(player as PlayerSim, { input, fields: FIELDS as never, step: (ctx, s, cmd) => stepPlayer(s, cmd as never, ctx.dt, map) });
let aim = 128, pending = 0;
void (async () => {
  for (;;) {
    const n = predict.tick(performance.now());
    for (let i = 0; i < n; i++) {
      input.data.mx = 0;
      input.data.my = 0;
      input.data.aim = aim;
      input.data.btn = pending;
      pending = 0;
      input.send();
    }
    await wait(8);
  }
})();

const dummySpawn = map.spawns.find((s) => s.id === "yard-dummy-a")!;
let dummyId = "";
const findDummy = () => room.state.enemies?.forEach((e: any, id: string) => { if (ENEMIES[e.def].key === "dummy" && Math.hypot(e.x - dummySpawn.x, e.y - dummySpawn.y) < 4) dummyId = id; });
const idle = async () => {
  for (let i = 0; i < 200 && me.state.act !== 0; i++) await wait(10);
  await wait(250);
};
const place = async (dist: number) => {
  room.send("dev:teleport", { x: dummySpawn.x + dist, y: dummySpawn.y });
  await wait(300);
  aim = radToAim(Math.PI);
};
const hitsSince = (mark: number) => msgs.slice(mark).filter((x) => x.type === "hit" && x.m.t === dummyId).length;

for (const w of WEAPONS) {
  room.send("dev:weapon", w.key);
  await wait(500);
  room.send("dev:heal");
  findDummy();
  const ranged = w.key === "staff";
  const dist = ranged ? 90 : w.key === "spear" ? 44 : 26;

  // Light chain: press through every hit.
  await place(dist);
  let mark = msgs.length;
  for (let i = 0; i < w.lights.length; i++) {
    pending |= Btn.Light;
    const m = w.lights[i];
    await wait(((m.comboFrom + 1) / 60) * 1000 + 30);
  }
  await wait(700);
  const chainHits = hitsSince(mark);
  check(`${w.name}: light chain`, chainHits >= w.lights.length, `${chainHits}/${w.lights.length} hits`);
  await idle();

  // Heavy (the Staff's Arcane Nova bursts around the caster, so stand close).
  await place(w.key === "staff" ? 40 : dist);
  mark = msgs.length;
  pending |= Btn.Heavy;
  await wait(120);
  if (process.env.DEBUG) console.log(`  [heavy] act=${me.state.act} move=${me.state.actMove} st=${me.state.stamina.toFixed(0)} ex=${me.state.exhausted} x=${me.state.x.toFixed(0)} dummyX=${dummySpawn.x}`);
  await wait(980);
  if (process.env.DEBUG) console.log(`  [heavy-end] x=${me.state.x.toFixed(0)} hitsTotal=${msgs.slice(mark).filter((x) => x.type === "hit").map((x) => x.m.t + ":" + x.m.d).join(",")}`);
  check(`${w.name}: ${w.heavy.name}`, hitsSince(mark) >= 1, `${hitsSince(mark)} hit(s)`);
  await idle();

  // Combo heavy: light then heavy inside the chain window.
  await place(dist);
  mark = msgs.length;
  pending |= Btn.Light;
  await wait(((w.lights[0].comboFrom + 1) / 60) * 1000 + 30);
  pending |= Btn.Heavy;
  await wait(1100);
  check(`${w.name}: ${w.comboHeavy.name}`, hitsSince(mark) >= 2, `${hitsSince(mark)} hit(s) incl. the opener`);
  await idle();

  // Skills: every skill in the weapon's pool, equipped into slot 1 (cooldowns reset between).
  for (const [i, sk] of w.skills.entries()) await trySkill(w, i, sk, dist);
}

// Universal skills (including every floor's own abilities), with a sword in hand.
room.send("dev:learn", "all");
await wait(200);
for (const [i, sk] of UNIVERSAL_SKILLS.entries()) await trySkill(WEAPONS[0], UNIVERSAL_BASE + i, sk, 26);

async function trySkill(w: WeaponDef, i: number, sk: MoveDef, dist: number) {
  let mark = 0;
  {
    room.send("dev:weapon", w.key);
    await wait(150);
    room.send("skills:equip", { weapon: w.key, slot: 0, index: i });
    const off = sk.shape?.kind === "circle" ? sk.shape.offset : 0;
    await place(sk.special === "meteor" ? 170 : off > 60 ? off : sk.lunge > 100 ? 150 : sk.shape?.kind === "line" && sk.shape.length > 100 ? 90 : dist);
    await wait(200);
    // Healing skills need a wound to show their healing.
    if (sk.special === "drain" || sk.special === "bloodlust") {
      room.send("dev:hurt", 50);
      await wait(150);
    }
    mark = msgs.length;
    const seqBefore = me.state.actSeq;
    if (process.env.DEBUG) console.log(`  [skill${i}] before act=${me.state.act} st=${me.state.stamina.toFixed(0)} ex=${me.state.exhausted} cd=${me.state.cd1},${me.state.cd2} mods=${me.state.mods}`);
    pending |= Btn.Skill1;
    await wait(1600);
    const used = me.state.actSeq !== seqBefore;
    const hits = hitsSince(mark);
    const fx = msgs.slice(mark).filter((x) => x.type === "fx").map((x) => x.m.k);
    const utility = sk.special === "counterStance" || sk.special === "vault" || (sk.special === "shadowstep" && !sk.shape);
    const ok = used && (utility || hits > 0 || fx.length > 0);
    check(`${w.name}: ${sk.name}`, ok, `${used ? "used" : "NOT used"}, ${hits} hit(s)${fx.length ? `, fx ${fx.join(",")}` : ""}`);
    const heals = () => msgs.slice(mark).filter((x) => x.type === "heal" && x.m.p === room.sessionId);
    if (sk.special === "drain") check(`${w.name}: ${sk.name} heals you`, heals().length > 0, `${heals().map((x) => "+" + x.m.d).join(" ")}`);
    if (sk.special === "mark") {
      const d = room.state.enemies?.get(dummyId);
      check(`${w.name}: ${sk.name} marks the target`, !!d && (d.flags & 128) !== 0, `flags ${d?.flags}`);
    }
    if (sk.special === "burn" || sk.special === "meteors") {
      const burned = msgs.slice(mark).some((x) => x.type === "hit" && x.m.t === dummyId && x.m.dot) || ((room.state.enemies?.get(dummyId)?.flags ?? 0) & EFlag.Burning) !== 0;
      check(`${w.name}: ${sk.name} sets the target burning`, burned, burned ? "burning" : "no burn");
    }
    if (sk.special === "chill" || sk.special === "hailstorm") {
      const chilled = ((room.state.enemies?.get(dummyId)?.flags ?? 0) & EFlag.Chilled) !== 0 || msgs.slice(mark).some((x) => x.type === "fx" && x.m.k === "iceburst");
      check(`${w.name}: ${sk.name} chills the target`, chilled, chilled ? "chilled" : "not chilled");
    }
    if (sk.curse || sk.special === "curse" || sk.special === "voidrift") {
      const cursed = ((room.state.enemies?.get(dummyId)?.flags ?? 0) & EFlag.Cursed) !== 0 || msgs.slice(mark).some((x) => x.type === "fx" && (x.m.k === "cursed" || x.m.k === "voidburst"));
      check(`${w.name}: ${sk.name} curses the target`, cursed, cursed ? "cursed" : "not cursed");
    }
    if (sk.special === "empower") check(`${w.name}: ${sk.name} empowers`, fx.includes("empower"), fx.join(",") || "no fx");
    if (sk.special === "bloodlust") {
      await idle();
      pending |= Btn.Light;
      await wait(900);
      check(`${w.name}: ${sk.name} makes hits heal`, heals().length > 0, `${heals().map((x) => "+" + x.m.d).join(" ") || "no heals"}`);
    }
    await idle();
  }
}

await room.leave();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
