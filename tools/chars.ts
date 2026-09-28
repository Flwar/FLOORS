import { chromium } from "playwright-core";
const out = process.argv[2];
const b = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
p.on("pageerror", (e) => console.log("[pageerror]", e.message));
await p.goto("http://localhost:5173/?guest=Looks");
await p.waitForFunction(() => (window as any).__floors?.debug?.me, null, { timeout: 15000 });
await p.evaluate(`window.__floors.debug.room.send("dev:teleport", { x: 40 * 32, y: 86 * 32 })`);
await p.waitForTimeout(1200);
const crop = async (name: string) => {
  const c = (await p.evaluate(`(() => { const W = window.__floors; const cam = W.cameras.main; const s = W.debug.me.state; return { x: (s.x - cam.worldView.x) * cam.zoom, y: (s.y - cam.worldView.y) * cam.zoom }; })()`)) as { x: number; y: number };
  await p.screenshot({ path: `${out}/c-${name}.png`, clip: { x: c.x - 60, y: c.y - 80, width: 120, height: 100 } });
};
const dirs: [string, number, number][] = [["S", 0, 1], ["E", 1, 0], ["N", 0, -1], ["W", -1, 0], ["SE", 1, 1], ["NW", -1, -1]];
for (const [n, mx, my] of dirs) {
  await p.evaluate(`window.__floors.debug.controls.script({ mx: ${mx}, my: ${my}, aim: ${Math.round(((Math.atan2(my, mx) / (Math.PI * 2)) * 256 + 256) % 256)} }, 250)`);
  await p.waitForTimeout(700);
  await crop(`idle-${n}`);
}
await p.evaluate(`window.__floors.debug.controls.script({ mx: 1, my: 0, aim: 0 }, 2000)`);
await p.waitForTimeout(400);
await crop("walk-E");
await p.waitForTimeout(1800);
await p.evaluate(`window.__floors.debug.controls.script({ aim: 0 }, 1500); window.__floors.debug.controls.tap(1)`);
await p.waitForTimeout(140);
await crop("attack-E");
await b.close();
