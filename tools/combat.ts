/**
 * Headless combat verification against a running server (npm run combat).
 * Uses the same prediction stack as the browser client.
 *  1. Sword chain on a training dummy: four hits with the frame-data damage.
 *  2. Sparring Knight: perfect parry, normal parry, too-early parry, and dodging the
 *     unparryable sweep — each timed from the bot's own delayed view of the swing.
 */
import { Client, Predict } from "@colyseus/sdk";
import {
  Btn, buildFloor1, EAct, ENEMIES, impactMs, INTERP_DELAY, radToAim, SERVER_PORT, stepPlayer, TILE,
  WEAPONS, type PlayerSim,
} from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const map = buildFloor1();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const FIELDS = ["x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted", "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge", "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "potions"] as const;

async function main() {
  const room = await new Client(endpoint).joinOrCreate("world", { guest: "Duelist" });
  while (!room.state.players?.get(room.sessionId)) await wait(20);
  const player = room.state.players.get(room.sessionId);
  const predict = Predict.get(room, { mode: "lerp", delay: INTERP_DELAY });
  predict.attachAll("enemies", { fields: ["x", "y"], mode: "lerp" });
  const input = room.input({ mode: "reliable" });
  const bodies = () => {
    const out: { x: number; y: number; r: number }[] = [];
    room.state.enemies?.forEach((e: any) => out.push({ x: predict.value(e, "x"), y: predict.value(e, "y"), r: ENEMIES[e.def].radius }));
    return out;
  };
  const me = predict.reconciler(player as PlayerSim, {
    input, fields: FIELDS as never, step: (ctx, s, cmd) => stepPlayer(s, cmd as never, ctx.dt, map, bodies()),
  });

  const events: { type: string; msg: any; at: number }[] = [];
  room.onMessage("*", (type, msg) => events.push({ type: String(type), msg, at: performance.now() }));

  // Input driver: one frame per due step, with one-shot button presses.
  let mx = 0, my = 0, aim = 0, pending = 0;
  let running = true;
  (async () => {
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
  const press = (b: number) => { pending |= b; };
  const viewTime = () => room.clock.serverNow() - INTERP_DELAY - room.clock.smoothedRtt() / 2;
  const walkTo = async (x: number, y: number) => {
    for (let i = 0; i < 400; i++) {
      const dx = x - me.state.x, dy = y - me.state.y;
      if (Math.hypot(dx, dy) < 6) break;
      mx = Math.abs(dx) > 4 ? Math.sign(dx) : 0;
      my = Math.abs(dy) > 4 ? Math.sign(dy) : 0;
      await wait(16);
    }
    mx = my = 0;
  };

  // --- 1. Sword chain on a dummy ----------------------------------------------
  const dummySpawn = map.spawns.find((s) => s.id === "yard-dummy-a")!;
  room.send("dev:weapon", "sword");
  room.send("dev:teleport", { x: dummySpawn.x + 30, y: dummySpawn.y });
  await wait(600);
  let dummyId = "";
  room.state.enemies?.forEach((e: any, id: string) => {
    if (ENEMIES[e.def].key === "dummy" && Math.hypot(e.x - dummySpawn.x, e.y - dummySpawn.y) < 4) dummyId = id;
  });
  check("dummy present", !!dummyId, dummyId || "none found");
  aim = radToAim(Math.PI); // face west toward the dummy
  const t0 = events.length;
  for (let i = 0; i < 4; i++) {
    press(Btn.Light);
    await wait(290);
  }
  await wait(600);
  const dmg = events.slice(t0).filter((e) => e.type === "hit" && e.msg.t === dummyId).map((e) => e.msg.d);
  const expected = WEAPONS[0].lights.map((m) => m.damage);
  // Gear multiplies frame-data damage; every hit of the chain must share the same multiplier.
  const ratios = dmg.map((d: number, i: number) => d / expected[i]);
  const proportional = dmg.length === 4 && ratios.every((r: number) => Math.abs(r - ratios[0]) < 0.08) && ratios[0] > 1;
  check("sword 4-hit chain", proportional, `dummy took ${JSON.stringify(dmg)} (frame data ${JSON.stringify(expected)}, gear x${ratios[0]?.toFixed(2)})`);

  // --- 2. Sparring Knight -------------------------------------------------------
  const knightSpawn = map.spawns.find((s) => s.id === "yard-sparring")!;
  const post = { x: knightSpawn.x + 50, y: knightSpawn.y };
  room.send("dev:teleport", post);
  await wait(500);
  let knightId = "";
  room.state.enemies?.forEach((e: any, id: string) => { if (ENEMIES[e.def].key === "sparring") knightId = id; });
  const knight = room.state.enemies.get(knightId);
  const kdef = ENEMIES[knight.def];
  aim = radToAim(Math.PI);

  const seenCount = new Map<string, number>();
  const results: { attack: string; plan: string; got: string }[] = [];
  let lastStart = 0;
  let readySince = room.clock.serverNow();
  const deadline = performance.now() + 40000;
  while (performance.now() < deadline && results.length < 7) {
    await wait(5);
    if (knight.act !== EAct.Attack || knight.actStart === lastStart) continue;
    lastStart = knight.actStart;
    // Only judge swings that begin after we are back in position and able to act.
    if (!readySince || knight.actStart < readySince) continue;
    const atk = kdef.attacks[knight.atk];
    const H = knight.actStart + impactMs(atk, knight.flags);
    // A too-early press needs a windup long enough to see coming under lag.
    const cycle = atk.windup >= 30 ? ["early", "normal", "perfect"] : ["perfect", "normal"];
    const n = (seenCount.get(atk.name) ?? 0);
    seenCount.set(atk.name, n + 1);
    const plan: string = atk.parryable ? cycle[n % cycle.length] : "dodge";
    const lead = plan === "perfect" ? 50 : plan === "normal" ? 165 : plan === "early" ? 420 : 70;
    while (viewTime() < H - lead) await wait(1);
    const mark = events.length;
    if (process.env.DEBUG) console.log(`[bot] ${plan} ${atk.name} press view=${viewTime().toFixed(0)} H=${H.toFixed(0)} lead=${(H - viewTime()).toFixed(0)} rtt=${room.clock.smoothedRtt().toFixed(0)}`);
    if (plan === "dodge") {
      // Dodge *through* the knight so we stay inside the sweep: only i-frames can save us.
      mx = -1;
      press(Btn.Dodge);
      await wait(40);
      mx = 0;
    } else press(Btn.Parry);
    // Wait for the server's verdict on this swing.
    let got = "none";
    for (let i = 0; i < 120 && got === "none"; i++) {
      await wait(10);
      for (const ev of events.slice(mark)) {
        if (ev.type === "parry" && ev.msg.p === room.sessionId) got = ev.msg.perfect ? "perfect" : "parry";
        else if (ev.type === "practice" && ev.msg.p === room.sessionId) got = "hit";
        else if (ev.type === "evade" && ev.msg.p === room.sessionId) got = "evade";
      }
    }
    const dist = Math.hypot(me.state.x - knight.x, me.state.y - knight.y);
    if (got === "none" && dist > 90) got = "out of reach";
    results.push({ attack: atk.name, plan, got });
    readySince = 0;
    await wait(500);
    await walkTo(post.x, post.y);
    while (me.state.act !== 0) await wait(10);
    readySince = room.clock.serverNow();
  }
  const want: Record<string, string> = { perfect: "perfect", normal: "parry", early: "hit", dodge: "evade" };
  for (const r of results) if (r.got === "out of reach") console.log(`SKIP  ${r.attack} / ${r.plan} — bot was out of reach at impact`);
  for (const r of results.filter((x) => x.got !== "out of reach")) check(`${r.attack} / ${r.plan}`, r.got === want[r.plan], `expected ${want[r.plan]}, server said ${r.got}`);
  check("covered every case", new Set(results.map((r) => r.plan)).size === 4, `plans seen: ${[...new Set(results.map((r) => r.plan))].join(", ")}`);

  running = false;
  await room.leave();
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
void TILE;
