import "./test-herdr.ts";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { createServer } from "../server/index.ts";
import { paneSendText, workspaceCreate, workspaceClose } from "../server/herdr/client.ts";

const cwd = process.cwd();
const shortUri = "file:///etc/hosts";
const workspace = await workspaceCreate({ cwd, label: "herdr-web-ui-test-file-links" });
const pane = workspace.root_pane.pane_id;
const server = createServer({ port: 0, hostname: "127.0.0.1", token: "" });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/chromium"),
  headless: true,
});
try {
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
    await context.close();
  }
} finally {
  await browser.close();
  server.stop(true);
  await workspaceClose(workspace.workspace.workspace_id);
}
