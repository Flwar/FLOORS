/**
 * Prediction-under-latency test. Start a server with simulated lag first:
 *   COLYSEUS_LATENCY=150 PORT=2568 npx tsx server/src/index.ts
 *   SERVER=ws://localhost:2568 npm run latency
 *
 * Runs the same Predict + Reconciler + shared step the browser uses, walks a
 * route with turns and a wall hit, and checks the local player responds on the
 * first frame and never snaps backwards when server corrections arrive.
 */
import { Client, Predict } from "@colyseus/sdk";
import { buildFloor1, SERVER_PORT, stepPlayer, type PlayerSim } from "@floors/shared";

const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const map = buildFloor1();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

async function main() {
  const room = await new Client(endpoint).joinOrCreate("world", { guest: "LagBot" });
  while (!room.state.players?.get(room.sessionId)) await wait(20);
  const player = room.state.players.get(room.sessionId);
  const predict = Predict.get(room, { mode: "lerp", delay: 100 });
  const input = room.input({ mode: "reliable" });
  const me = predict.reconciler(player as PlayerSim, {
    input,
    fields: ["x", "y", "dir", "gait", "aim", "stamina", "staminaMax", "staminaDelay", "exhausted", "act", "actTick", "actMove", "actAim", "actSeq", "combo", "comboTimer", "buf", "bufAim", "bufAge", "dodgeDx", "dodgeDy", "kbx", "kby", "hurtDur", "weapon", "mods", "parryOk", "cd1", "cd2", "potions"],
    step: (ctx, s, cmd) => stepPlayer(s, cmd as never, ctx.dt, map),
    smoothMs: 60,
  });

  // Route: east, south, west, then north into a building (forces a wall correction case).
  const route = [
    { mx: 1, my: 0, ms: 800 },
    { mx: 0, my: 1, ms: 500 },
    { mx: -1, my: 0, ms: 700 },
    { mx: 0, my: -1, ms: 2500 },
    { mx: 0, my: 0, ms: 800 },
  ];

  let maxBackstep = 0;
  let firstFrameMoved = true;
  let prev = { x: me.value("x"), y: me.value("y") };
  const frameMs = 1000 / 60;

  for (const leg of route) {
    const legStart = { x: me.state.x, y: me.state.y };
    let frame = 0;
    for (let t = 0; t < leg.ms; t += frameMs, frame++) {
      const n = predict.tick(performance.now());
      for (let i = 0; i < n; i++) {
        input.data.mx = leg.mx;
        input.data.my = leg.my;
        input.data.btn = 0;
        input.data.aim = 64;
        input.send();
      }
      // Responsiveness: prediction must react within the first couple of frames, not after a round trip.
      if (frame === 3 && (leg.mx || leg.my)) {
        const reacted = me.state.x !== legStart.x || me.state.y !== legStart.y;
        if (!reacted) firstFrameMoved = false;
      }
      // Smoothness: rendered position should never move opposite to the held direction.
      const x = me.value("x");
      const y = me.value("y");
      const back = -((x - prev.x) * leg.mx + (y - prev.y) * leg.my);
      if (leg.mx || leg.my) maxBackstep = Math.max(maxBackstep, back);
      prev = { x, y };
      await wait(frameMs);
    }
  }

  await wait(600);
  predict.tick(performance.now());
  const rtt = room.clock.smoothedRtt();
  check("measured latency", rtt > 100, `smoothed RTT ${rtt.toFixed(0)} ms`);
  check("instant response", firstFrameMoved, "local player moved within 3 frames of each new direction");
  check("no rubber-banding", maxBackstep < 1, `largest backwards render step ${maxBackstep.toFixed(2)} px`);
  const drift = Math.hypot(me.state.x - player.x, me.state.y - player.y);
  check("converges to server", drift < 0.01, `prediction vs server after settling: ${drift.toFixed(4)} px`);

  await room.leave();
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
