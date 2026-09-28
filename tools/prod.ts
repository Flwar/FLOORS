/**
 * Production check (npm run build, then start a server with `npm start`, then
 * `npx tsx tools/prod.ts [url] [outDir]`): the built client loads from the game server,
 * an account can be created and plays, dev guests are refused and cheat commands do nothing.
 */
import { randomBytes } from "node:crypto";
import { Client } from "@colyseus/sdk";
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:2600";
const out = process.argv[3];
let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) failures++;
};

// Throwaway test account on the local test database (never printed).
const user = `T${randomBytes(4).toString("hex")}`.slice(0, 12);
const pass = randomBytes(12).toString("base64url");

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${url}/?guest=Cheater`);
await page.waitForSelector("#login:not(.hidden)", { timeout: 20000 });
check("guest links ignored in production", true, "login screen shown");
await page.fill("#login-user", user);
await page.fill("#login-pass", pass);
await page.click("#login-create");
await page.waitForFunction(() => !!document.querySelector("#login.hidden") && !!document.querySelector("canvas"), null, { timeout: 20000 });
await page.waitForTimeout(2500);
const hud = await page.locator("#vitals").isVisible().catch(() => false);
check("account created and in the world", hud, "HUD visible");
if (out) await page.screenshot({ path: `${out}/prod.png` });
check("no page errors", errors.length === 0, errors.join(" | ") || "none");
const token = await page.evaluate(`localStorage.getItem("floors.session")`);
check("session stored", typeof token === "string" && (token as string).length > 10, "token present");
await browser.close();

// Cheats: a client sending dev commands on a production server gets nothing.
const endpoint = url.replace(/^http/, "ws");
const guestTry = await new Client(endpoint).joinOrCreate("world", { guest: "Cheater" }).then(
  () => "joined",
  (e: Error) => e.message,
);
check("guest login refused", guestTry !== "joined", guestTry);
const room = await new Client(endpoint).joinOrCreate("world", { token });
let inv: any;
room.onMessage("*", (type, m) => {
  if (type === "inv") inv = m;
});
for (let i = 0; i < 100 && !inv; i++) await new Promise((r) => setTimeout(r, 50));
const gold0 = inv?.gold;
room.send("dev:give", { key: "sword_dawnbreaker" });
room.send("dev:wear", { weapon: "sword_dawnbreaker", armor: "armor_dawn", helm: "helm_keeper" });
await new Promise((r) => setTimeout(r, 800));
const me = room.state.players.get(room.sessionId);
check("dev commands disabled", inv?.equipment?.weapon?.key !== "sword_dawnbreaker" && me?.armorLook === 1 && inv?.gold === gold0, `weapon ${inv?.equipment?.weapon?.key}, armor look ${me?.armorLook}`);
await Promise.race([room.leave().catch(() => {}), new Promise((r) => setTimeout(r, 1000))]);

// Password guessing is slowed down: after 8 wrong tries the name is locked for a while,
// even for the right password.
let last = "";
for (let i = 0; i < 9; i++) {
  last = await new Client(endpoint).joinOrCreate("world", { username: user, password: `wrong${i}` }).then(
    () => "joined",
    (e: Error) => e.message,
  );
}
const right = await new Client(endpoint).joinOrCreate("world", { username: user, password: pass }).then(
  async (r) => {
    await Promise.race([r.leave().catch(() => {}), new Promise((res) => setTimeout(res, 500))]);
    return "joined";
  },
  (e: Error) => e.message,
);
check("login attempts limited", /Too many attempts/.test(last) && /Too many attempts/.test(right), `9th wrong: "${last}", then right password: "${right}"`);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
