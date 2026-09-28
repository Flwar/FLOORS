import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "msedge", headless: true, args: (process.env.GPU ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]) });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("http://localhost:5173/?guest=Fps");
await p.waitForFunction(() => (window as any).__floors?.debug?.me, null, { timeout: 15000 });
const fps = async (label: string) => {
  await p.waitForTimeout(1500);
  const f0 = await p.evaluate(`window.__floors.game.loop.frame`) as number;
  await p.waitForTimeout(2000);
  const f1 = await p.evaluate(`window.__floors.game.loop.frame`) as number;
  const prof = await p.evaluate(`(() => { const t0 = performance.now(); for (let i = 0; i < 20; i++) window.__floors.update(0, 16); return ((performance.now() - t0) / 20).toFixed(2); })()`);
  console.log(label, "fps", ((f1 - f0) / 2).toFixed(1), "scene.update ms", prof);
};
await fps("town");
await p.evaluate(`window.__floors.debug.room.send("dev:teleport", { x: 62 * 32, y: 26 * 32 })`);
await fps("forest");
await p.evaluate(`window.__floors.debug.room.send("dev:teleport", { x: 100 * 32, y: 128 * 32 })`);
await fps("caves(dark)");
await b.close();
