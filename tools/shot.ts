/**
 * Headless browser screenshots via the installed Edge (no browser download).
 *   npx tsx tools/shot.ts [url] [out.png] [waitMs] [--eval "js to run before shot"]
 */
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5173/?name=Shot";
const out = process.argv[3] ?? "shot.png";
const waitMs = Number(process.argv[4] ?? 2500);
const evalIdx = process.argv.indexOf("--eval");
const script = evalIdx > 0 ? process.argv[evalIdx + 1] : undefined;

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs: string[] = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(waitMs);
if (script) {
  const result = await page.evaluate(`(async () => { ${script} })()`);
  if (result !== undefined) console.log("eval:", JSON.stringify(result));
}
await page.screenshot({ path: out });
console.log(`saved ${out}`);
if (logs.length) console.log(logs.join("\n"));
await browser.close();
