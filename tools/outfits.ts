/**
 * Equipment lineup (npx tsx tools/outfits.ts <outDir>): bots wear every armour, helm and
 * weapon style and stand in rows; a headless browser photographs them from the front,
 * back and side, then opens the paper doll in the Pack.
 */
import { Client } from "@colyseus/sdk";
import { chromium } from "playwright-core";
import { SERVER_PORT, TICK_MS } from "@floors/shared";

const out = process.argv[2] ?? ".";
const endpoint = process.env.SERVER ?? `ws://localhost:${SERVER_PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OUTFITS: { weapon: string; armor: string; helm: string }[] = [
  { weapon: "sword_rusty", armor: "", helm: "" },
  { weapon: "sword_iron", armor: "armor_padded", helm: "helm_cap" },
  { weapon: "daggers_twin", armor: "armor_leather", helm: "helm_hood" },
  { weapon: "spear_hunting", armor: "armor_ranger", helm: "helm_hood" },
  { weapon: "greatsword_iron", armor: "armor_chain", helm: "helm_iron" },
  { weapon: "staff_oak", armor: "armor_robes", helm: "helm_circlet" },
  { weapon: "greatsword_bandit", armor: "armor_plate", helm: "helm_horned" },
  { weapon: "greatsword_warden", armor: "armor_warden", helm: "helm_iron" },
  { weapon: "sword_dawnbreaker", armor: "armor_dawn", helm: "helm_keeper" },
  { weapon: "daggers_stalker", armor: "armor_leather", helm: "helm_cap" },
  { weapon: "spear_iron", armor: "armor_chain", helm: "helm_horned" },
  { weapon: "sword_emberbrand", armor: "armor_plate", helm: "helm_iron" },
  { weapon: "staff_ember", armor: "armor_robes", helm: "helm_hood" },
];

const X0 = 33 * 32;
const Y0 = 81 * 32;
const COLS = 7;
const DX = 38;
const DY = 70;

const bots = [];
for (const [i, o] of OUTFITS.entries()) {
  const room = await new Client(endpoint).joinOrCreate("world", { guest: `Model${i}` });
  while (!room.state.players?.get(room.sessionId)) await wait(20);
  room.send("dev:teleport", { x: X0 + (i % COLS) * DX, y: Y0 + Math.floor(i / COLS) * DY });
  room.send("dev:wear", { ...o, rarity: i % 5 });
  bots.push({ room, input: room.input({ mode: "reliable" }) });
}
/** Turn every bot to face a direction by stepping once. */
async function face(mx: number, my: number) {
  for (let t = 0; t < 2; t++) {
    for (const b of bots) {
      Object.assign(b.input.data, { mx, my, btn: 0, aim: 64 });
      b.input.send();
    }
    await wait(TICK_MS);
  }
  for (const b of bots) {
    Object.assign(b.input.data, { mx: 0, my: 0, btn: 0, aim: 64 });
    b.input.send();
  }
  await wait(900);
}

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:5173/?guest=Viewer");
await page.waitForFunction(() => (window as any).__floors?.debug?.me, null, { timeout: 15000 });
const midX = X0 + ((COLS - 1) * DX) / 2;
await page.evaluate(`window.__floors.debug.room.send("dev:wear", { weapon: "sword_dawnbreaker", armor: "armor_dawn", helm: "helm_keeper", rarity: 4 })`);
await page.waitForTimeout(1500);

// Close camera; photograph one row at a time with the viewer standing just below it.
await page.evaluate(`window.__floors.fitZoom = 3.6 / 1.15`);
const rows = Math.ceil(OUTFITS.length / COLS);
for (let r = 0; r < rows; r++) {
  const rowY = Y0 + r * DY;
  await page.evaluate(`window.__floors.debug.room.send("dev:teleport", { x: ${midX}, y: ${rowY + 52} })`);
  await page.waitForTimeout(1500);
  for (const [name, mx, my] of [["front", 0, 100], ["back", 0, -100], ["side", 100, 0]] as const) {
    await face(mx, my);
    const c = (await page.evaluate(`(() => { const W = window.__floors; const cam = W.cameras.main; return { x: (${X0} - cam.worldView.x) * cam.zoom, y: (${rowY} - cam.worldView.y) * cam.zoom, z: cam.zoom }; })()`)) as { x: number; y: number; z: number };
    await page.screenshot({ path: `${out}/row${r}-${name}.png`, clip: { x: Math.max(0, c.x - 24 * c.z), y: Math.max(0, c.y - 46 * c.z), width: ((COLS - 1) * DX + 48) * c.z, height: 62 * c.z } });
  }
}
await face(0, 100);

// The Pack's paper doll.
await page.keyboard.press("i");
await page.waitForTimeout(600);
const panel = await page.$('.panel[data-id="inventory"]');
if (panel) await panel.screenshot({ path: `${out}/pack.png` });
else console.log("no inventory panel");
await page.keyboard.press("i");

// Inspecting another player shows their outfit too.
await page.evaluate(`window.__floors.debug.room.send("inspect", "${bots[7].room.sessionId}")`);
await page.waitForTimeout(600);
const insp = await page.$(".inspect");
if (insp) await insp.screenshot({ path: `${out}/inspect.png` });
else console.log("no inspect panel");

await browser.close();
for (const b of bots) await b.room.leave();
process.exit(0);
