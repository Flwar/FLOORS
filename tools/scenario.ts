/**
 * Scripted visual scenarios in headless Edge, capturing screenshots at key moments.
 *   npx tsx tools/scenario.ts <scenario> <outDir>
 * Scenarios: yard (combo + sparring knight parry), fields (fight in the wild).
 */
import { chromium, type Page } from "playwright-core";

const scenario = process.argv[2] ?? "yard";
const outDir = process.argv[3] ?? ".";
const base = process.env.URL ?? "http://localhost:5173";

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(`[console] ${m.text()}`); });

await page.goto(`${base}/?guest=${scenario === "yard" ? "Sable" : "Wren"}`);
await page.waitForFunction(() => (window as any).__floors?.debug?.me, null, { timeout: 15000 });
await page.waitForTimeout(800);

const shot = async (name: string) => {
  await page.screenshot({ path: `${outDir}/${scenario}-${name}.png` });
  console.log(`saved ${scenario}-${name}.png`);
};
/** Close-up around the local player (2.5x magnified crop). */
const zoom = async (name: string) => {
  const c = (await page.evaluate(`(() => { const W = window.__floors; const cam = W.cameras.main; const s = W.debug.me.state; return { x: (s.x - cam.worldView.x) * cam.zoom, y: (s.y - cam.worldView.y) * cam.zoom }; })()`)) as { x: number; y: number };
  await page.screenshot({ path: `${outDir}/${scenario}-${name}.png`, clip: { x: Math.max(0, c.x - 160), y: Math.max(0, c.y - 130), width: 320, height: 220 } });
  console.log(`saved ${scenario}-${name}.png`);
};
const run = <T>(fn: string) => page.evaluate(`(async () => { const W = window.__floors; const D = W.debug; ${fn} })()`) as Promise<T>;

async function yard(p: Page) {
  // Face the dummy and run the sword chain.
  await run(`D.room.send("dev:weapon", "sword"); D.room.send("dev:teleport", { x: 720 + 30, y: 2448 });`);
  await p.waitForTimeout(700);
  await run(`D.controls.script({ aim: 128 }, 1600); D.controls.tap(1);`);
  await p.waitForTimeout(150);
  await zoom("combo-1-zoom");
  await run(`D.controls.tap(1);`);
  await p.waitForTimeout(280);
  await run(`D.controls.tap(1);`);
  await p.waitForTimeout(280);
  await run(`D.controls.tap(1);`);
  await p.waitForTimeout(210);
  await shot("combo-finisher");
  await p.waitForTimeout(900);

  // Sparring knight: wait for a windup glint, then parry into it.
  await run(`D.room.send("dev:teleport", { x: 880 + 48, y: 2512 });`);
  await p.waitForTimeout(600);
  const res = await run<string>(`
    const deadline = performance.now() + 12000;
    while (performance.now() < deadline) {
      await new Promise(r => requestAnimationFrame(r));
      let found = null;
      D.room.state.enemies?.forEach((e) => { if (e.act === 2) found = e; });
      if (!found) continue;
      const defs = ${JSON.stringify(null)};
      const view = D.room.clock.serverNow() - 100 - D.room.clock.smoothedRtt() / 2;
      const W2 = window.__floors;
      return JSON.stringify({ atk: found.atk, start: found.actStart, view });
    }
    return "none";
  `);
  console.log("knight attack:", res);
  await p.waitForTimeout(120);
  await zoom("knight-windup-zoom");
  await shot("knight-windup");
  // Parry and capture the flash.
  await run(`D.controls.script({ aim: 128 }, 800); D.controls.tap(8);`);
  await p.waitForTimeout(260);
  await shot("parry");
  await p.waitForTimeout(1200);
  await shot("after");
}

async function fields(p: Page) {
  await run(`D.room.send("dev:weapon", "greatsword"); D.room.send("dev:teleport", { x: 62 * 32, y: 36 * 32 });`);
  await p.waitForTimeout(1500);
  await shot("approach");
  for (let i = 0; i < 6; i++) {
    await run(`
      let best = null, bd = 1e9; const me = D.me.state;
      D.room.state.enemies?.forEach((e) => { if (e.act === 5) return; const d = Math.hypot(e.x - me.x, e.y - me.y); if (d < bd) { bd = d; best = e; } });
      if (!best) return;
      const a = Math.atan2(best.y - me.y, best.x - me.x);
      const aim = ((Math.round(a / (Math.PI * 2) * 256) % 256) + 256) % 256;
      const mx = bd > 40 ? Math.sign(Math.round(Math.cos(a) * 2)) : 0, my = bd > 40 ? Math.sign(Math.round(Math.sin(a) * 2)) : 0;
      D.controls.script({ aim, mx, my }, 500);
      if (bd < 60) D.controls.tap(1);
    `);
    await p.waitForTimeout(500);
    if (i === 2) await shot("brawl");
  }
  await shot("end");
}

async function tour(p: Page) {
  const spots: [string, number, number][] = [
    ["town-guild", 34, 70], ["yard", 25, 79], ["fields", 84, 70], ["forest", 62, 26], ["camp", 110, 26], ["den", 26, 23],
    ["ruins", 150, 60], ["court", 170, 63], ["caves", 100, 128], ["deep", 176, 132], ["rim", 124, 104],
  ];
  for (const [name, tx, ty] of spots) {
    await run(`D.room.send("dev:teleport", { x: ${tx * 32 + 16}, y: ${ty * 32 + 16} });`);
    await p.waitForTimeout(1800);
    await shot(name);
  }
}

async function dungeon(p: Page) {
  await run(`await W.travelTo("dungeon");`);
  await p.waitForFunction(() => (window as any).__floors?.debug?.me && (window as any).__floors.kind === "dungeon", null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  await shot("entrance");
  const spots: [string, number, number][] = [["traps", 45, 116], ["hall", 45, 100], ["puzzle", 45, 72], ["warden", 45, 50], ["ante", 45, 31], ["arena", 45, 18]];
  for (const [name, tx, ty] of spots) {
    await run(`D.room.send("dev:teleport", { x: ${tx * 32 + 16}, y: ${ty * 32 + 16} });`);
    await p.waitForTimeout(2000);
    await shot(name);
  }
}

async function floor2(p: Page) {
  await run(`await W.travelTo("floor2");`);
  await p.waitForTimeout(3500);
  await shot("landing");
}

async function ui(p: Page) {
  // Give the character some things to show.
  await run(`D.room.send("dev:give", { key: "sword_emberbrand" }); D.room.send("dev:give", { key: "charm_duelist", rarity: 2 }); D.room.send("dev:give", { key: "mat_pelt", qty: 3 }); D.room.send("dev:give", { xp: 700, gold: 240 });`);
  await p.waitForTimeout(800);
  for (const [key, name] of [["KeyI", "inventory"], ["KeyC", "character"], ["KeyJ", "quests"], ["KeyM", "map"], ["KeyP", "party"], ["Escape", "settings"]] as const) {
    await p.keyboard.press(key);
    await p.waitForTimeout(500);
    if (name === "inventory") {
      const cell = await p.$(".grid .slot-cell:not(.empty)");
      if (cell) await cell.hover();
      await p.waitForTimeout(300);
    }
    await shot(`ui-${name}`);
    await p.keyboard.press(name === "settings" ? "Escape" : key);
    await p.waitForTimeout(300);
  }
  // Talk to the guildmaster.
  await run(`D.room.send("dev:teleport", { x: 34 * 32 + 16, y: 68 * 32 + 16 });`);
  await p.waitForTimeout(900);
  await p.keyboard.press("KeyF");
  await p.waitForTimeout(700);
  await shot("ui-dialog");
  // The smith's shop.
  await p.keyboard.press("Escape");
  await run(`D.room.send("dev:teleport", { x: 24 * 32 + 16, y: 69 * 32 + 16 });`);
  await p.waitForTimeout(900);
  await p.keyboard.press("KeyF");
  await p.waitForTimeout(600);
  await p.click("text=Buy");
  await p.waitForTimeout(500);
  await shot("ui-shop");
}

async function bossfight(p: Page) {
  await run(`D.room.send("dev:weapon", "greatsword"); D.room.send("dev:give", { xp: 40000 });`);
  await p.waitForTimeout(600);
  await run(`await W.travelTo("dungeon");`);
  await p.waitForFunction(() => (window as any).__floors?.kind === "dungeon" && (window as any).__floors?.debug?.me, null, { timeout: 15000 });
  await p.waitForTimeout(1200);
  await run(`D.room.send("dev:teleport", { x: 45 * 32 + 16, y: 20 * 32 });`);
  // Screenshot capture, not a skill test: keep the character alive so the mechanics stay on screen.
  await run(`window.__heal = setInterval(() => D.room.send("dev:heal"), 300);`);
  await p.waitForTimeout(1500);
  await shot("intro");
  await p.waitForTimeout(1600);
  await shot("fight-1");
  await run(`D.room.send("dev:bossatk", "Sigils of Binding");`);
  await p.waitForTimeout(900);
  await shot("sigils");
  await p.waitForTimeout(1800);
  await run(`D.room.send("dev:heal"); D.room.send("dev:bosshp", { frac: 0.3 }); D.room.send("dev:bossatk", "Blade Storm");`);
  await p.waitForTimeout(1200);
  await shot("bladestorm");
  await p.waitForTimeout(2500);
  await run(`D.room.send("dev:heal"); D.room.send("dev:bossatk", "Judgement of the Gate");`);
  await p.waitForTimeout(1400);
  await shot("judgement");
  await p.waitForTimeout(2600);
  await run(`D.room.send("dev:heal"); D.room.send("dev:bosshp", { frac: 0.01 });`);
  await run(`D.controls.script({ aim: 192 }, 3000); D.controls.tap(1);`);
  for (let i = 0; i < 8; i++) {
    await run(`const me = D.me.state; let b; D.room.state.enemies?.forEach(e => { if (e.hpMax > 3000) b = e; }); if (b) { const a = Math.atan2(b.y - me.y, b.x - me.x); D.controls.script({ aim: ((Math.round(a / (Math.PI*2) * 256) % 256) + 256) % 256, mx: Math.sign(Math.round(Math.cos(a)*2)), my: Math.sign(Math.round(Math.sin(a)*2)) }, 300); D.controls.tap(1); }`);
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(1500);
  await shot("victory");
}

async function telegraph(p: Page) {
  await run(`D.room.send("dev:teleport", { x: 84 * 32, y: 72 * 32 }); window.__heal = setInterval(() => D.room.send("dev:heal"), 300);`);
  await p.waitForTimeout(1200);
  await run(`D.room.send("dev:spawn", { key: "brute", level: 2 }); D.room.send("dev:spawn", { key: "archer", level: 1 });`);
  await p.waitForTimeout(1500);
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(450);
    const attacking = await run<boolean>(`let a = false; D.room.state.enemies?.forEach(e => { if (e.act === 2) a = true; }); return a;`);
    if (attacking) await shot(`t${i}`);
  }
}

if (scenario === "yard") await yard(page);
else if (scenario === "telegraph") await telegraph(page);
else if (scenario === "ui") await ui(page);
else if (scenario === "bossfight") await bossfight(page);
else if (scenario === "tour") await tour(page);
else if (scenario === "dungeon") await dungeon(page);
else if (scenario === "floor2") await floor2(page);
else await fields(page);

if (errors.length) console.log(errors.join("\n"));
await browser.close();
