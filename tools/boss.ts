/**
 * Floor Boss verification (npm run boss): a bot enters the Undercroft arena and fights
 * Aurelion — parrying gold glints, dodging red ones — while dev commands skip HP to each
 * phase. Checks the intro, the sealed gate, every phase and special mechanic, victory,
 * the Ascent to Floor 2, and that the unlock persists.
 */
import { Client, Predict, type Room } from "@colyseus/sdk";
import {
  Btn, buildUndercroft, EAct, ENEMIES, HazardKind, impactMs, INTERP_DELAY, radToAim, SERVER_PORT, stepPlayer, TILE, UNDERCROFT_ROOMS,
  type PlayerSim,
} from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const umap = buildUndercroft();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const FIELDS = ["x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted", "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge", "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "potions"];

async function main() {
  const client = new Client(endpoint);
  const name = `Keeperbane${Math.floor(Math.random() * 1000)}`;
  // Build up the character in the world first (dev), then enter a fresh instance.
  const world = await client.joinOrCreate("world", { username: name, password: "hunter22", register: true });
  let token = "";
  world.onMessage("session", (m: { token: string }) => (token = m.token));
  world.onMessage("*", () => {});
  while (!world.state.players?.get(world.sessionId)) await wait(20);
  world.send("dev:weapon", "sword");
  world.send("dev:give", { xp: 40000 });
  world.send("dev:give", { key: "armor_plate", rarity: 3 });
  await wait(800);
  await world.leave(true);
  await wait(300);

  const room: Room<any, any> = await client.create("dungeon", { token });
  const msgs: { type: string; m: any; at: number }[] = [];
  room.onMessage("*", (type, m) => msgs.push({ type: String(type), m, at: performance.now() }));
  while (!room.state.players?.get(room.sessionId)) await wait(20);
  const player = room.state.players.get(room.sessionId);
  const predict = Predict.get(room, { mode: "lerp", delay: INTERP_DELAY });
  predict.attachAll("enemies", { fields: ["x", "y"], mode: "lerp" });
  const input = room.input({ mode: "reliable" });
  const me = predict.reconciler(player as PlayerSim, { input, fields: FIELDS as never, step: (ctx, s, cmd) => stepPlayer(s, cmd as never, ctx.dt, umap) });
  let mx = 0, my = 0, aim = 64, pending = 0, running = true;
  void (async () => {
    while (running) {
      const n = predict.tick(performance.now());
      for (let i = 0; i < n; i++) {
        input.data.mx = mx;
        input.data.my = my;
        input.data.aim = aim;
        input.data.btn = pending;
        pending = 0;
        input.send();
      }
      await wait(8);
    }
  })();
  const teleport = async (x: number, y: number) => {
    room.send("dev:teleport", { x, y });
    await wait(400);
  };
  const seen = (type: string) => msgs.filter((x) => x.type === type);
  check("level and gear for the fight", player.level >= 8, `level ${player.level}, hp ${player.hpMax}`);

  // Enemies only arrive once they're in view: approach the antechamber first.
  room.send("dev:teleport", { x: 45 * TILE + 16, y: 31 * TILE });
  for (let i = 0; i < 100 && !room.state.enemies?.size; i++) await wait(50);
  let bossId = "";
  room.state.enemies?.forEach((e: any, id: string) => { if (ENEMIES[e.def].key === "aurelion") bossId = id; });
  // Entities are re-created when they leave and re-enter view, so always look the boss up by id.
  let boss = room.state.enemies.get(bossId);
  const refresh = () => (boss = room.state.enemies?.get(bossId) ?? boss);
  check("Aurelion waits in the arena", !!boss, `hp ${boss?.hpMax}`);

  // Walk in: the intro plays and the gate seals behind us.
  const R = UNDERCROFT_ROOMS.boss;
  await teleport(R.cx * TILE + 16, (R.cy + 7) * TILE);
  await wait(3200);
  check("boss intro", seen("bossIntro").length === 1 && room.state.bossActive, `intro ${seen("bossIntro").length}, active ${room.state.bossActive}`);
  check("the gate seals", (room.state.gates & (1 << 4)) === 0, `gates ${room.state.gates.toString(2)}`);

  // A wipe resets the Keeper and reopens the gate; stepping back in starts the fight again.
  room.send("dev:bosshp", { frac: 0.8 });
  await wait(200);
  room.send("dev:kill");
  await wait(4500);
  check("party wipe resets the boss", !room.state.bossActive && (room.state.gates & (1 << 4)) !== 0 && boss.hp === boss.hpMax, `active ${room.state.bossActive}, gate open ${(room.state.gates & (1 << 4)) !== 0}, hp ${boss.hp}/${boss.hpMax}`);
  room.send("respawnNow");
  await wait(1500);
  await teleport(R.cx * TILE + 16, (R.cy + 7) * TILE);
  await wait(3200);
  refresh();
  check("the fight restarts", room.state.bossActive && (room.state.gates & (1 << 4)) === 0, `active ${room.state.bossActive}`);

  // Fight: react to what we see, skip HP between phases.
  const hazardKinds = new Set<number>();
  let bladeProjectiles = 0;
  let lastStart = 0;
  let parries = 0;
  let evades = 0;
  let hits = 0;
  let shelters = 0;
  const attacksSeen = new Set<string>();
  const view = () => room.clock.serverNow() - INTERP_DELAY - room.clock.smoothedRtt() / 2;
  const fight = async (ms: number) => {
    const end = performance.now() + ms;
    while (performance.now() < end && refresh().act !== EAct.Dead) {
      await wait(10);
      room.state.hazards?.forEach((h: any) => hazardKinds.add(h.kind));
      room.state.projectiles?.forEach((p: any) => { if (p.kind === 4) bladeProjectiles++; });
      if (player.hp < player.hpMax * 0.5) room.send("dev:heal");
      const bx = predict.value(boss, "x");
      const by = predict.value(boss, "y");
      aim = radToAim(Math.atan2(by - me.state.y, bx - me.state.x));
      // Stand in a safe glyph during the Judgement.
      let glyph: any;
      room.state.hazards?.forEach((h: any) => { if (h.kind === HazardKind.Glyph) glyph = h; });
      if (glyph) {
        const d = Math.hypot(glyph.x - me.state.x, glyph.y - me.state.y);
        mx = d > 12 ? Math.sign(Math.round(((glyph.x - me.state.x) / d) * 2)) : 0;
        my = d > 12 ? Math.sign(Math.round(((glyph.y - me.state.y) / d) * 2)) : 0;
        continue;
      }
      if (boss.act === EAct.Attack && boss.actStart !== lastStart) {
        lastStart = boss.actStart;
        const atk = ENEMIES[boss.def].attacks[boss.atk];
        attacksSeen.add(atk.name);
        // The Judgement isn't dodged or parried: the glyph logic above walks us to shelter.
        if (atk.special === "judgement" || atk.special === "sigils" || atk.special === "bladestorm") continue;
        const H = boss.actStart + impactMs(atk, boss.flags);
        while (view() < H - 55 && boss.act === EAct.Attack) await wait(1);
        if (atk.parryable) pending |= Btn.Parry;
        else {
          mx = Math.random() < 0.5 ? 1 : -1;
          pending |= Btn.Dodge;
          await wait(50);
          mx = 0;
        }
        continue;
      }
      const d = Math.hypot(bx - me.state.x, by - me.state.y);
      mx = d > 70 ? Math.sign(Math.round(((bx - me.state.x) / d) * 2)) : 0;
      my = d > 70 ? Math.sign(Math.round(((by - me.state.y) / d) * 2)) : 0;
      if (d < 90 && boss.act !== EAct.Attack) pending |= Btn.Light;
    }
    for (const x of msgs) {
      if (x.type === "evade" && x.m.glyph) shelters++;
      if (x.type === "parry") parries++;
      if (x.type === "evade") evades++;
      if (x.type === "hit" && x.m.t === bossId) hits++;
    }
    msgs.length = 0;
  };

  await fight(15000);
  check("phase 1 fought", hits > 0, `hits on boss ${hits}, parries ${parries}, evades ${evades}, attacks: ${[...attacksSeen].join(", ")}`);
  room.send("dev:bosshp", { frac: 0.69 });
  await wait(300);
  const p1 = seen("phase").length;
  // Phase-2 attacks are picked at random: keep fighting until one of its signatures shows up.
  for (let t = 0; t < 45000 && !(bladeProjectiles > 0 || hazardKinds.has(HazardKind.Sigil)); t += 5000) await fight(5000);
  check("phase 2 begins", p1 >= 1 || [...attacksSeen].some((a) => a === "Blade Storm" || a === "Sigils of Binding"), `phase events ${p1}, attacks: ${[...attacksSeen].join(", ")}`);
  check("Blade Storm / Sigils appear", bladeProjectiles > 0 || hazardKinds.has(HazardKind.Sigil), `blade projectiles seen ${bladeProjectiles}, sigils ${hazardKinds.has(HazardKind.Sigil)}`);
  room.send("dev:bosshp", { frac: 0.34 });
  await wait(300);
  await fight(12000);
  // The Judgement: glyphs appear; standing in one shelters you from the arena-wide blast.
  while (boss.act === EAct.Stagger) await wait(50);
  const sheltersBefore = shelters;
  // A posture break can legitimately cut the channel short; allow one retry.
  for (let attempt = 0; attempt < 2 && shelters === sheltersBefore; attempt++) {
    while (refresh().act === EAct.Stagger) await wait(50);
    room.send("dev:bossatk", "Judgement of the Gate");
    await fight(5500);
  }
  const sheltered = shelters > sheltersBefore;
  check("Judgement with safe glyphs", hazardKinds.has(HazardKind.Glyph) && hazardKinds.has(HazardKind.Judgement), `glyph ${hazardKinds.has(HazardKind.Glyph)}, judgement ${hazardKinds.has(HazardKind.Judgement)}`);
  check("standing in a glyph shelters you", sheltered || parries + evades >= 0 && seen("evade").some((x) => x.m.glyph), sheltered ? "Sheltered" : "took the blast");
  await fight(8000);
  check("all phase attacks used", attacksSeen.size >= 6, [...attacksSeen].join(", "));

  // Finish him.
  room.send("dev:bosshp", { frac: 0.01 });
  const victoryAt = performance.now();
  while (refresh().act !== EAct.Dead && performance.now() - victoryAt < 20000) await fight(2000);
  await wait(800);
  check("Aurelion falls", boss.act === EAct.Dead || !room.state.enemies.get(bossId), `stage "${room.state.stage}"`);
  check("the First Gate opens", room.state.stage === "cleared" && (room.state.gates & (1 << 4)) !== 0, `stage ${room.state.stage}, gates ${room.state.gates.toString(2)}`);

  // Ascend.
  const ascent = umap.object("ascent")!;
  mx = my = 0;
  await teleport(ascent.x, ascent.y + 20);
  const travelP = new Promise<any>((res) => room.onMessage("travel", res));
  room.send("interact", "ascent");
  const travel = await Promise.race([travelP, wait(4000).then(() => undefined)]);
  check("the Ascent leads to Floor 2", travel?.room === "floor2", JSON.stringify(travel ?? null));
  running = false;
  await room.leave(true);
  await wait(400);
  const f2 = await client.joinOrCreate("floor2", { token });
  let inv: any;
  let bounced = false;
  f2.onMessage("inv", (m) => (inv = m));
  f2.onMessage("travel", () => (bounced = true));
  f2.onMessage("*", () => {});
  await wait(1500);
  check("Floor 2 unlocked and saved", inv?.floor >= 2 && !bounced && inv?.bossKills?.includes("aurelion"), `floor ${inv?.floor}, bossKills ${inv?.bossKills}`);
  await f2.leave(true);
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
