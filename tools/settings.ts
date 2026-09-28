/**
 * Settings (npx tsx tools/settings.ts [outDir]): rebind keys in the Settings panel, use the
 * new binding in combat, zoom with the wheel, then reload with this browser's cache wiped
 * and check everything came back from the server.
 */
import { chromium } from "playwright-core";
import { Act } from "@floors/shared";

const out = process.argv[2];
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};
const guest = `Keys${Math.floor(Math.random() * 1e5)}`;
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
// SERVER=ws://host:port points the page at another game server (the dev page defaults to :2567).
const url = `http://localhost:5173/?guest=${guest}${process.env.SERVER ? `&server=${encodeURIComponent(process.env.SERVER)}` : ""}`;
const ready = () => page.waitForFunction(() => (window as any).__floors?.debug?.me, null, { timeout: 20000 });
const S = (expr: string) => page.evaluate(`window.__floors.debug.settings.value.${expr}`);

await page.goto(url);
await ready();
await page.evaluate(`window.__floors.debug.settings.resetBindings(); window.__floors.debug.settings.set({ zoom: 1.15 })`);
await page.waitForTimeout(1000);

// Open Settings and rebind "Attack" slot 2 to L.
await page.keyboard.press("Escape");
await page.waitForSelector('.panel[data-id="settings"]');
const bindBtn = (action: number, slot: number) => page.locator(".binds button.bind").nth(action * 2 + slot);
const LIGHT = 5; // index in BIND_ACTIONS
await bindBtn(LIGHT, 1).click();
check("button waits for a key", (await bindBtn(LIGHT, 1).textContent())?.includes("Press") ?? false, String(await bindBtn(LIGHT, 1).textContent()));
if (out) await page.locator('.panel[data-id="settings"]').screenshot({ path: `${out}/settings.png` });
await page.keyboard.press("KeyL");
check("L bound to attack", ((await S("bindings.light")) as string[]).includes("KeyL"), JSON.stringify(await S("bindings.light")));

// Taking a key from another action: bind J (Quests) to Dodge.
const DODGE = 7;
await bindBtn(DODGE, 1).click();
await page.keyboard.press("KeyJ");
const quests = (await S("bindings.quests")) as string[];
check("a key does one thing", ((await S("bindings.dodge")) as string[]).includes("KeyJ") && !quests.includes("KeyJ"), `dodge ${JSON.stringify(await S("bindings.dodge"))}, quests ${JSON.stringify(quests)}`);

// Menu actions refuse mouse buttons; Esc cancels without closing Settings.
const PACK = 13;
await bindBtn(PACK, 1).click();
await page.mouse.click(640, 360, { button: "middle" });
await page.keyboard.press("Escape");
check("menus take keys only", !((await S("bindings.pack")) as string[]).some((c) => c.startsWith("Mouse")), JSON.stringify(await S("bindings.pack")));
check("Esc cancels capture, not the panel", (await page.$('.panel[data-id="settings"]')) !== null, "settings still open");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Use the new binding in combat.
await page.keyboard.press("KeyL");
await page.waitForTimeout(90);
const act = await page.evaluate(`window.__floors.debug.me.state.act`);
check("new key attacks", act === Act.Light, `act ${act}`);
await page.waitForTimeout(800);

// J no longer opens Quests.
await page.keyboard.press("KeyJ");
await page.waitForTimeout(200);
check("old quest key freed", (await page.$('.panel[data-id="quests"]')) === null, "no quests panel on J");

// Wheel zoom.
const z0 = (await S("zoom")) as number;
await page.mouse.move(640, 360);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(700);
const z1 = (await S("zoom")) as number;
const camZ = (await page.evaluate(`window.__floors.cameras.main.zoom`)) as number;
check("wheel zooms in", z1 > z0 * 1.05, `setting ${z0.toFixed(2)} → ${z1.toFixed(2)}, camera ${camZ.toFixed(2)}`);

// Reload with this browser's cache wiped: settings must come back from the character.
await page.waitForTimeout(1500);
await page.evaluate(`localStorage.removeItem("floors.settings"); localStorage.removeItem("floors.volume")`);
await page.reload();
await ready();
await page.waitForTimeout(1200);
const light = (await S("bindings.light")) as string[];
const z2 = (await S("zoom")) as number;
check("settings saved to the character", light.includes("KeyL") && Math.abs(z2 - z1) < 0.01, `light ${JSON.stringify(light)}, zoom ${z2.toFixed(2)}`);
const potionKey = await page.locator("#slot-potion .key").textContent();
check("HUD slots show bindings", potionKey === "R", `tonic slot key: ${potionKey}`);

await page.evaluate(`window.__floors.debug.settings.resetBindings(); window.__floors.debug.settings.set({ zoom: 1.15 })`);
await page.waitForTimeout(1000);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
