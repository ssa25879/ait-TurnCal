import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const [svgPath, outPath] = process.argv.slice(2);
const svg = readFileSync(svgPath, "utf8");
const b = await chromium.launch({ executablePath: process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
const p = await b.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
await p.locator("svg").screenshot({ path: outPath, omitBackground: false });
await b.close();
