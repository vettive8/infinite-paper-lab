import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const beforeUrl = argument("--before-url");
const afterUrl = argument("--after-url");
const outputDir = path.resolve(argument("--output-dir", "test-results/folder-comparison"));
const headed = process.argv.includes("--headed");
const slowMo = Number(argument("--slow-mo", "250")) || 0;

if (!beforeUrl || !afterUrl) {
  throw new Error("Usage: node tools/capture-folder-comparison.mjs --before-url URL --after-url URL [--output-dir DIR] [--headed]");
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: !headed, slowMo });
const context = await browser.newContext({
  viewport: { width: 1320, height: 900 },
  colorScheme: "dark",
});

async function capture(label, url, fileName) {
  console.log(`[${label}] Opening ${url}`);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#paper", { timeout: 10000 });
  await page.keyboard.press("Shift+Tab");
  await page.waitForSelector(".board-overlay:not([hidden])", { timeout: 5000 });
  await page.waitForTimeout(700);
  const destination = path.join(outputDir, fileName);
  await page.screenshot({ path: destination, fullPage: false });
  console.log(`[${label}] Saved ${destination}`);
  await page.close();
  return destination;
}

const before = await capture("BEFORE", beforeUrl, "before-board-folders.png");
const after = await capture("AFTER", afterUrl, "after-board-folders.png");
await browser.close();

const manifest = {
  capturedAt: new Date().toISOString(),
  before: { url: beforeUrl, screenshot: before },
  after: { url: afterUrl, screenshot: after },
};
await fs.writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);
console.log("Folder comparison capture complete.");
