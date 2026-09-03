/**
 * Export 1080×1920 PNG of /leadnet/social for Instagram Stories / Reels.
 *
 * Usage:
 *   npm run dev          (in another terminal)
 *   node scripts/export-leadnet-social.mjs
 *
 * Or against production:
 *   node scripts/export-leadnet-social.mjs https://www.intentrev.net/leadnet/social
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "social");
const outFile = join(outDir, "leadnet-them-vs-us-9x16.png");

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const targetUrl = `${baseUrl.replace(/\/$/, "")}/leadnet/social`;

async function waitForServer(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not reachable at ${url}`);
}

async function runPlaywrightScreenshot() {
  const script = `
    const { chromium } = require('playwright');
    (async () => {
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
      await page.goto(${JSON.stringify(targetUrl)}, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const el = page.locator('[style*="width: 1080"]').first();
      await el.screenshot({ path: ${JSON.stringify(outFile)}, type: 'png' });
      await browser.close();
    })();
  `;

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["--yes", "playwright", "install", "chromium"], {
      cwd: root,
      shell: true,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("playwright install failed"));
        return;
      }
      const shot = spawn("node", ["-e", script], { cwd: root, shell: true, stdio: "inherit" });
      shot.on("close", (c) => (c === 0 ? resolve() : reject(new Error("screenshot failed"))));
    });
  });
}

async function main() {
  if (baseUrl.includes("localhost")) {
    console.log("Waiting for dev server...");
    await waitForServer(baseUrl);
  }

  await mkdir(outDir, { recursive: true });
  console.log(`Capturing ${targetUrl} → ${outFile}`);

  try {
    await runPlaywrightScreenshot();
    console.log("Done:", outFile);
  } catch (err) {
    console.error(err);
    console.log("\nFallback: open in browser and screenshot 1080×1920:");
    console.log(targetUrl);
    process.exit(1);
  }
}

main();
