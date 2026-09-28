/** Same entrypoint locally and in CI; each phase records the commit, commands, exits and logs. */
import { mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runCommand } from "../server/updater.ts";
const phases: Record<string, string[][]> = {
  fast: [["run", "generate:types", "--check"], ["run", "typecheck"], ["run", "build"], ["run", "test:unit"]],
  integration: [["run", "test:integration"]],
  browser: [["scripts/ui-regression.ts"], ["scripts/file-viewer-regression.ts"], ["scripts/update-browser-qa.ts"]],
};
const phase = process.argv[2] ?? "";
if (!(phase in phases)) throw new Error("Usage: bun scripts/release-harness.ts fast|integration|browser");
if (process.env.HERDR_TEST_LIVE === "1") throw new Error("Release validation must use an isolated herdr session");
const output = resolve(process.env.HARNESS_OUTPUT_DIR || "evidence/validation");
mkdirSync(output, { recursive: true });
const revision = await runCommand(process.cwd(), ["git", "rev-parse", "HEAD"]);
let dirty = !!await runCommand(process.cwd(), ["git", "status", "--porcelain"]);
const results: Array<{ command: string[]; exit_code: number; log: string; started_at: string; finished_at: string }> = [];
let failed = false;
try {
  for (const [index, args] of phases[phase]!.entries()) {
    const log = `${phase}-${index + 1}.log`;
    const fd = openSync(join(output, log), "w", 0o600);
    const started_at = new Date().toISOString();
    console.log(`[${phase}] bun ${args.join(" ")} → ${join(output, log)}`);
    let exit_code = 1;
    try {
      const child = Bun.spawn([process.execPath, ...args], { stdout: fd, stderr: fd, stdin: "ignore",
        env: { ...process.env, UI_EVIDENCE_DIR: join(output, "ui"), UPDATE_EVIDENCE_DIR: join(output, "updates") } });
      let force: ReturnType<typeof setTimeout> | undefined;
      const timer = setTimeout(() => { child.kill("SIGTERM"); force = setTimeout(() => child.kill("SIGKILL"), 5000); }, 12 * 60_000);
      try { exit_code = await child.exited; } finally { clearTimeout(timer); clearTimeout(force); }
    } finally { closeSync(fd); }
    results.push({ command: ["bun", ...args], exit_code, log, started_at, finished_at: new Date().toISOString() });
    if (exit_code !== 0) { failed = true; console.error(await Bun.file(join(output, log)).text()); break; }
  }
} finally {
  dirty ||= !!await runCommand(process.cwd(), ["git", "status", "--porcelain"]);
  dirty ||= revision !== await runCommand(process.cwd(), ["git", "rev-parse", "HEAD"]);
  writeFileSync(join(output, `${phase}.json`), JSON.stringify({ schema: 1, phase, revision, dirty,
    passed: !failed && results.length === phases[phase]!.length && results.every(r => r.exit_code === 0),
    environment: { platform: process.platform, arch: process.arch, bun: Bun.version, chrome: process.env.CHROME_PATH ?? "default" },
    results }, null, 2) + "\n");
}
if (failed) process.exit(1);
console.log(`PASS ${phase} (${revision.slice(0, 12)}${dirty ? "; working changes — not release evidence" : ""})`);
