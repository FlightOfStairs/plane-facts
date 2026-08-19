// Screenshot chart pages from the built site for visual verification.
// Usage: node tools/screenshot.mjs [chartId ...]   (default: all in CHARTS)
// Serves packages/website/dist via vite preview, captures one PNG per chart
// into tools/digitize/out/qa/ui-<chartId>.png
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium } from "playwright";

const DIST = new URL("../packages/website/dist", import.meta.url).pathname;
const OUT = new URL("./digitize/out/qa", import.meta.url).pathname;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff" };

const server = createServer((req, res) => {
  let path = join(DIST, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  try {
    statSync(path);
  } catch {
    path = join(DIST, "index.html");
  }
  res.setHeader("content-type", MIME[extname(path)] ?? "application/octet-stream");
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(4199, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
await page.goto("http://localhost:4199/");
await page.waitForTimeout(800);

const ids = process.argv.slice(2);
const capture = async (label) => {
  const file = join(OUT, `ui-${label.replaceAll(/[^a-z0-9-]+/gi, "_")}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("captured", file);
};

// Open select, enumerate options
await page.click("div[role=combobox]");
await page.waitForTimeout(300);
const labels = await page.$$eval("li[role=option]", (els) => els.map((e) => ({ text: e.textContent, value: e.dataset.value })));
await page.keyboard.press("Escape");
for (const { text, value } of labels) {
  if (ids.length && !ids.includes(value)) continue;
  await page.click("div[role=combobox]");
  await page.click(`li[role=option][data-value="${value}"]`);
  await page.waitForTimeout(500);
  await capture(value ?? text);
}
await browser.close();
server.close();
