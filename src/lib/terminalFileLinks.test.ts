import { describe, expect, it } from "bun:test";
import { Terminal } from "@xterm/xterm";
import { fileUriPath, terminalFileLinks } from "./terminalFileLinks.ts";

describe("terminal file links", () => {
  it("excludes sentence punctuation but preserves encoded filename punctuation", async () => {
    const term = new Terminal({ cols: 150, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write("file:///tmp/a.md: file:///tmp/a.md! file:///tmp/a.md? file:///tmp/a%21.md", resolve));
    const opened: string[] = [];
    const links = terminalFileLinks(term.buffer.active, 1, (path) => opened.push(path));
    expect(links.map((link) => link.text)).toEqual(["file:///tmp/a.md", "file:///tmp/a.md", "file:///tmp/a.md", "file:///tmp/a%21.md"]);
    for (const link of links) link.activate();
    expect(opened).toEqual(["/tmp/a.md", "/tmp/a.md", "/tmp/a.md", "/tmp/a!.md"]);
    term.dispose();
  });
  it("does not append an unrelated hard row after a full-width URI", async () => {
    const uri = "file:///tmp/README.md";
    const term = new Terminal({ cols: uri.length, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write(uri + "\r\nPASS unrelated output", resolve));
    const opened: string[] = [];
    const links = terminalFileLinks(term.buffer.active, 1, (path) => opened.push(path));
    links[0]?.activate();
    expect(opened).toEqual(["/tmp/README.md"]);
    term.dispose();
  });
  it("does not link method calls or dotted identifiers", async () => {
    const term = new Terminal({ cols: 160, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write("tool.monitor({}) display(await tool.read({})) Math.random process.env example.com README.md src/custom.monitor", resolve));
    expect(terminalFileLinks(term.buffer.active, 1, () => {}).map((link) => link.text)).toEqual(["README.md", "src/custom.monitor"]);
    term.dispose();
  });
  it("opens a wrapped file URI with encoded Korean and spaces", async () => {
    const term = new Terminal({ cols: 40, allowProposedApi: true });
    const uri = "file:///tmp/%ED%95%9C%EA%B8%80%20sheet.png";
    await new Promise<void>((resolve) => term.write(uri, resolve));
    const opened: string[] = [];
    const links = terminalFileLinks(term.buffer.active, 1, (path) => opened.push(path));
    expect(links.map((link) => link.text)).toEqual([uri]);
    links[0]?.activate();
    expect(opened).toEqual(["/tmp/한글 sheet.png"]);
    term.dispose();
  });

  it("rejects malformed or nonlocal file URIs", () => {
    for (const uri of ["file://host/tmp/a.png", "file:///tmp/%zz", "file:///tmp/%00", "https://example.com/a.png"])
      expect(fileUriPath(uri)).toBeNull();
  });
  it("opens the full path when a wide character wraps from the last column", async () => {
    const term = new Terminal({ cols: 40, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write("check: ".padEnd(30) + "src/abc한글.ts", resolve));
    const opened: string[] = [];
    const links = terminalFileLinks(term.buffer.active, 2, (path) => opened.push(path));
    expect(links.map((link) => link.text)).toEqual(["src/abc한글.ts"]);
    links[0]?.activate();
    expect(opened).toEqual(["src/abc한글.ts"]);
    term.dispose();
  });
  it("recognizes files with line and column suffixes", async () => {
    const term = new Terminal({ cols: 100, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write("see src/app.ts:42:3 and README.md", resolve));
    const links = terminalFileLinks(term.buffer.active, 1, () => {});
    expect(links.map((link) => link.text)).toEqual(["src/app.ts:42:3", "README.md"]);
    term.dispose();
  });

  it("keeps cell coordinates after Korean text and across wrapped lines", async () => {
    const term = new Terminal({ cols: 20, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write("확인 src/폴더/example.ts", resolve));
    const links = terminalFileLinks(term.buffer.active, 2, () => {});
    expect(links.map((link) => link.text)).toEqual(["src/폴더/example.ts"]);
    expect(links[0]?.range).toEqual({ start: { x: 6, y: 1 }, end: { x: 4, y: 2 } });
    term.dispose();
  });

  it("does not turn URLs, versions or ordinary words into file links", async () => {
    const term = new Terminal({ cols: 150, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write("https://example.com/src/app.ts v1.2.3 1.2.3 and/or", resolve));
    expect(terminalFileLinks(term.buffer.active, 1, () => {})).toEqual([]);
    term.dispose();
  });
});
