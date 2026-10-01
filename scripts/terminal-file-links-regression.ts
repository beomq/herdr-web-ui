import "./test-herdr.ts";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "../server/index.ts";
import { paneSendText, workspaceCreate, workspaceClose } from "../server/herdr/client.ts";

const cwd = process.cwd();
const shortUri = "file:///etc/hosts";
const workspace = await workspaceCreate({ cwd, label: "herdr-web-ui-test-file-links" });
const pane = workspace.root_pane.pane_id;
// its own state dir: the default is the user's real devices and push registry
const stateDir = mkdtempSync(join(tmpdir(), "herdr-file-links-"));
let server: ReturnType<typeof createServer> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  server = createServer({ port: 0, hostname: "127.0.0.1", token: "", stateDir });
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/opt/google/chrome/chrome",
    headless: true,
  });
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: width === 390, isMobile: width === 390 });
    await context.addInitScript((id) => localStorage.setItem(`herdr-web-ui:view:${id}`, "terminal"), pane);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.goto(`http://127.0.0.1:${server.port}/?pane=${encodeURIComponent(pane)}`);
    await page.locator(".conn-live").waitFor();
    await paneSendText(pane, `printf '\\033[2J\\033[HFILELINK ${shortUri}\\n'\r`);
    const row = page.locator(".xterm-rows > div", { hasText: /^FILELINK file:\/\// }).first();
    await row.waitFor();
    await page.waitForFunction(() => document.querySelector(".xterm-rows")?.textContent?.includes("file:///etc/hosts"));
    const span = row.locator("span").filter({ hasText: "file://" }).first();
    const box = await span.boundingBox();
    assert.ok(box);
    // The output's prefix is nine cells; xterm links use character-cell coordinates.
    const rowBox = await row.boundingBox();
    assert.ok(rowBox);
    const cols = await row.evaluate((el) => el.textContent?.length ?? 0);
    assert.ok(cols > 0);
    const cellWidth = await row.evaluate((el) => {
      const range = document.createRange();
      const text = el.querySelector("span")?.firstChild;
      if (!text) throw new Error("missing terminal text");
      range.setStart(text, 0); range.setEnd(text, 1);
      return range.getBoundingClientRect().width;
    });
    if (width === 390) {
      await page.touchscreen.tap(rowBox.x + cellWidth * 12.5, rowBox.y + rowBox.height / 2);
    } else {
      await page.mouse.move(rowBox.x + cellWidth * 12.5, rowBox.y + rowBox.height / 2);
      await page.waitForFunction(() => document.querySelector(".xterm-cursor-pointer") !== null);
      await page.mouse.click(rowBox.x + cellWidth * 12.5, rowBox.y + rowBox.height / 2);
    }
    await page.locator(".file-viewer").waitFor();
    console.log(`VIEWER ${width}: ${await page.locator(".file-viewer").innerText()}`);
    await page.locator(".file-viewer-text").waitFor();
    assert.match(await page.locator(".file-viewer-text").innerText(), /localhost/);
    if (process.env.UI_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.UI_EVIDENCE_DIR}/terminal-file-link-${width}.png` });
    console.log(`PASS terminal file click opens viewer at ${width}px`);
    await page.locator(".file-viewer-header button").last().click();
    await page.locator(".file-viewer").waitFor({ state: "hidden" });
    const press = async (label: RegExp, cell: number) => {
      const line = page.locator(".xterm-rows > div", { hasText: label }).first();
      await line.waitFor();
      const lineBox = await line.boundingBox();
      assert.ok(lineBox);
      const x = lineBox.x + cellWidth * cell;
      const y = lineBox.y + lineBox.height / 2;
      if (width === 390) await page.touchscreen.tap(x, y);
      else { await page.mouse.move(x, y); await page.mouse.click(x, y); }
    };
    await paneSendText(pane, `printf '\\033[2J\\033[HBARENAME README.md\\nPATHNAME scripts/test-herdr.ts\\n'\r`);
    // A bare name is what a terminal is full of: pressing it opens nothing. Were it a link, the
    // viewer would cover the terminal and the press on the path below would land on the viewer.
    await press(/^BARENAME README\.md/, 12.5);
    await press(/^PATHNAME scripts\//, 12.5);
    await page.locator(".file-viewer-text").waitFor();
    assert.match(await page.locator(".file-viewer").innerText(), /test-herdr\.ts/);
    assert.doesNotMatch(await page.locator(".file-viewer").innerText(), /README\.md/);
    console.log(`PASS a bare name stays text and a path with a folder opens at ${width}px`);
    await context.close();
  }
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      server?.stop();
    } finally {
      await workspaceClose(workspace.workspace.workspace_id);
      rmSync(stateDir, { recursive: true, force: true });
    }
  }
}
