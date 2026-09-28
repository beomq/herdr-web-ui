/** Real temporary Git history, with a local gh recorder: never creates a remote release. */
import { test, expect } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "../server/updater.ts";
import { evidenceTemplate } from "./release-policy.ts";

test("release planning pins the observed RC despite newer main, and publishing rejects missing or dirty receipts", async () => {
  const root = mkdtempSync(join(tmpdir(), "herdr-release-flow-"));
  const remote = join(root, "remote"), checkout = join(root, "checkout"), bin = join(root, "bin");
  mkdirSync(remote); mkdirSync(bin);
  const git = (cwd: string, ...args: string[]) => runCommand(cwd, ["git", ...args]);
  try {
    await git(remote, "init", "-q", "-b", "main");
    await git(remote, "config", "user.email", "fixture@example.invalid");
    await git(remote, "config", "user.name", "Release fixture");
    writeFileSync(join(remote, "package.json"), '{"version":"1.2.3"}');
    writeFileSync(join(remote, "herdr-plugin.toml"), 'version = "1.2.3"\n');
    writeFileSync(join(remote, "CHANGELOG.md"), '## [1.2.3]\n\n- Fixture fix.\n');
    writeFileSync(join(remote, ".gitignore"), 'evidence/\n');
    await git(remote, "add", "."); await git(remote, "commit", "-qm", "candidate");
    const revision = await git(remote, "rev-parse", "HEAD"), candidate = "v1.2.3-rc.5";
    await git(remote, "tag", candidate);
    const evidence = evidenceTemplate(candidate, revision);
    evidence.observed_from = "2020-01-01T00:00:00Z";
    evidence.observed_until = "2020-01-02T00:00:00Z";
    evidence.observations = evidence.observations.map(row => ({ ...row, result: "pass", tester: "test fixture only", environment: "test fixture", evidence: "test fixture" }));
    mkdirSync(join(remote, "docs/releases"), { recursive: true });
    writeFileSync(join(remote, `docs/releases/${candidate}.json`), JSON.stringify(evidence));
    await git(remote, "add", "."); await git(remote, "commit", "-qm", "reviewed evidence (fixture)");
    const head = await git(remote, "rev-parse", "HEAD");
    await git(root, "clone", "-q", remote, checkout);
    const capture = join(root, "gh-create.json");
    writeFileSync(join(bin, "gh"), `#!/usr/bin/env bun\nconst args = process.argv.slice(2);\nif (args[0] === 'release' && args[1] === 'view') console.log(JSON.stringify({tagName: ${JSON.stringify(candidate)}, isDraft: false, isPrerelease: true, publishedAt: '2020-01-01T00:00:00Z'}));\nelse if (args[0] === 'release' && args[1] === 'create') await Bun.write(${JSON.stringify(capture)}, JSON.stringify(args));\nelse process.exit(1);\n`, { mode: 0o700 });
    const cli = async (...args: string[]) => {
      const processHandle = Bun.spawn([process.execPath, join(import.meta.dir, "release.ts"), ...args], { cwd: checkout, stdout: "pipe", stderr: "pipe",
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_REF: "refs/heads/main", GITHUB_SHA: head,
          GITHUB_OUTPUT: join(root, "workflow-output"), GH_TOKEN: "fixture", GH_REPO: "fixture/fixture",
          GITHUB_RUN_NUMBER: "6", GITHUB_RUN_ID: "123", GITHUB_REPOSITORY: "fixture/fixture", RELEASE_CANDIDATE: candidate } });
      const [code, stdout, stderr] = await Promise.all([processHandle.exited, new Response(processHandle.stdout).text(), new Response(processHandle.stderr).text()]);
      return { code, output: stdout + stderr };
    };
    const planned = await cli("plan", "stable");
    expect(planned.code).toBe(0);
    const planPath = join(checkout, "evidence/release-plan/plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    expect(plan.revision).toBe(revision);
    expect(plan.revision).not.toBe(head);
    expect(plan.tag).toBe("v1.2.3");
    const artifacts = join(checkout, "evidence/receipts"); mkdirSync(artifacts);
    expect((await cli("publish", planPath, artifacts)).code).not.toBe(0);
    for (const phase of ["fast", "integration", "browser"]) writeFileSync(join(artifacts, `${phase}.json`), JSON.stringify({ schema: 1, phase, revision, dirty: false, passed: true, results: [{ exit_code: 0 }] }));
    const result = await cli("publish", planPath, artifacts);
    expect(result.code).toBe(0);
    const args = JSON.parse(readFileSync(capture, "utf8")) as string[];
    expect(args[args.indexOf("--target") + 1]).toBe(revision);
    expect(args).toContain("--latest");
    expect(args).not.toContain("--prerelease");
    const receipt = join(artifacts, "browser.json");
    writeFileSync(receipt, JSON.stringify({ ...JSON.parse(readFileSync(receipt, "utf8")), dirty: true }));
    expect((await cli("publish", planPath, artifacts)).code).not.toBe(0);
    expect((await cli("plan", "nightly")).code).toBe(0);
    expect(JSON.parse(readFileSync(planPath, "utf8")).revision).toBe(head);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15_000);
