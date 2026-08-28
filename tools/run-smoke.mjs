import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { config, run, setup, teardown } from "../tests/smoke.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const headed = process.argv.includes("--headed");
const slowMo = Number(process.env.PLAYWRIGHT_LIVE_SLOWMO ?? (headed ? 300 : 0));
const stepPauseMs = Number(process.env.PLAYWRIGHT_STEP_PAUSE_MS ?? (headed ? config.stepPauseMs : 0));
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const artifacts = path.join(root, "test-results", `smoke-${stamp}`);
fs.mkdirSync(artifacts, { recursive: true });

let server;
let browser;
let context;
let page;

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  const deadline = Date.now() + config.readyTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(config.url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become ready at ${config.url}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

async function main() {
  setup();
  server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, ...config.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  await waitForServer();

  browser = await chromium.launch({ headless: !headed, slowMo });
  context = await browser.newContext({
    permissions: config.permissions,
    recordVideo: { dir: artifacts, size: { width: 1280, height: 800 } },
    viewport: { width: 1280, height: 800 },
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = await context.newPage();

  let stepNumber = 0;
  const step = async (name, action) => {
    stepNumber += 1;
    const label = String(stepNumber).padStart(2, "0");
    process.stdout.write(`\n[${label}] ${name}\n`);
    await action();
    if (headed) {
      await page.screenshot({
        path: path.join(artifacts, `${label}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`),
      });
    }
    if (stepPauseMs) await page.waitForTimeout(stepPauseMs);
    process.stdout.write(`[${label}] PASS\n`);
  };

  await run({ page, step, expect, config });
  await context.tracing.stop({ path: path.join(artifacts, "trace.zip") });
  process.stdout.write(`\nAll browser checks passed. Artifacts: ${artifacts}\n`);
}

async function cleanup(failed = false) {
  if (failed && page) {
    await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
    await context?.tracing.stop({ path: path.join(artifacts, "trace.zip") }).catch(() => {});
  }
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await stopServer();
  teardown();
}

process.once("SIGINT", async () => {
  await cleanup(true);
  process.exit(130);
});

main()
  .then(() => cleanup(false))
  .catch(async (error) => {
    console.error(`\nBrowser test failed: ${error.stack || error.message}`);
    await cleanup(true);
    process.exitCode = 1;
  });
