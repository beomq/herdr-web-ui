/** Only workflows publish tags, after validation of the exact target commit. */
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { latestReleaseTag, parseReleaseTag, type UpdateChannel } from "../shared/release-channel.ts";
import { runCommand } from "../server/updater.ts";
import { releaseNotes } from "./release-notes.ts";
import { validateEvidence, type ReleaseEvidence } from "./release-policy.ts";

interface Plan {
  schema: 1; channel: UpdateChannel; tag: string; revision: string; version: string;
  candidate: string | null; evidence: ReleaseEvidence | null; notes: string;
}
const command = (...args: string[]) => runCommand(process.cwd(), args);
const git = (...args: string[]) => command("git", ...args);
const gh = (...args: string[]) => command("gh", ...args);
const output = (key: string, value: string) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};
async function unused(tag: string) {
  if (await git("tag", "--list", tag)) throw new Error(`${tag} already exists; tags are immutable`);
}
async function newerStable(tag: string) {
  const tags = (await git("tag", "--list", "v*")).split("\n");
  if (latestReleaseTag([...tags, tag], "stable")?.tag !== tag) throw new Error("Stable releases must advance the published version");
}
async function candidateRelease(tag: string, revision: string) {
  if (parseReleaseTag(tag)?.channel !== "rc") throw new Error("Expected an RC tag");
  if (await git("rev-parse", `${tag}^{commit}`) !== revision) throw new Error("RC tag changed");
  const release = JSON.parse(await gh("release", "view", tag, "--json", "tagName,isDraft,isPrerelease,publishedAt"));
  if (release.tagName !== tag || release.isDraft || !release.isPrerelease || !release.publishedAt) throw new Error("Candidate must be a published GitHub prerelease");
  return release as { publishedAt: string };
}
async function notes(revision: string, version: string) {
  return releaseNotes(version, JSON.parse(await git("show", `${revision}:package.json`)).version,
    await git("show", `${revision}:herdr-plugin.toml`), await git("show", `${revision}:CHANGELOG.md`));
}
export function validateReceipts(receipts: unknown[], revision: string) {
  for (const phase of ["fast", "integration", "browser"]) {
    const found = receipts.filter((value: any) => value?.phase === phase) as any[];
    if (found.length !== 1 || found[0].schema !== 1 || found[0].revision !== revision || found[0].dirty !== false || found[0].passed !== true ||
        !Array.isArray(found[0].results) || !found[0].results.length || found[0].results.some((result: any) => result.exit_code !== 0)) {
      throw new Error(`Missing clean, passing ${phase} receipt for ${revision}`);
    }
  }
}
function receiptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? receiptFiles(join(directory, entry.name)) : /^(fast|integration|browser)\.json$/.test(entry.name) ? [join(directory, entry.name)] : []);
}
async function plan(channel: string) {
  if (process.env.GITHUB_REF !== "refs/heads/main") throw new Error("Releases must be dispatched from main");
  if (!["stable", "nightly", "rc"].includes(channel)) throw new Error("Invalid release channel");
  await git("fetch", "origin", "main", "--tags");
  let revision = await git("rev-parse", "HEAD");
  if (revision !== process.env.GITHUB_SHA) throw new Error("Workflow checkout changed");
  let version = JSON.parse(readFileSync("package.json", "utf8")).version as string;
  if (parseReleaseTag(`v${version}`)?.channel !== "stable") throw new Error("package.json must carry a plain base version");
  const run = process.env.GITHUB_RUN_NUMBER ?? "";
  if (!/^[1-9]\d*$/.test(run)) throw new Error("Missing workflow run number");
  let tag: string, candidate: string | null = null, evidence: ReleaseEvidence | null = null, body: string;
  if (channel === "nightly") {
    const existing = (await git("tag", "--points-at", revision)).split("\n").find(tag => parseReleaseTag(tag)?.channel === "nightly");
    if (existing) { output("publish", "false"); console.log(`No changes since ${existing}`); return; }
    const date = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    tag = `v${version}-nightly.${date}.${run}.${revision.slice(0, 12)}`;
    body = "Opt-in Nightly build for early testing. Existing Stable installations do not follow this channel.\n\n";
  } else if (channel === "rc") {
    if (process.env.RELEASE_VERSION !== version) throw new Error("Prepare matching package, plugin and changelog versions in a PR first");
    await unused(`v${version}`);
    tag = `v${version}-rc.${run}`;
    body = `${await notes(revision, version)}\n\nRelease candidate: record native-agent, device, upgrade and 24-hour usage evidence before Stable promotion.\n\n`;
  } else {
    candidate = process.env.RELEASE_CANDIDATE ?? "";
    const parsed = parseReleaseTag(candidate);
    if (parsed?.channel !== "rc") throw new Error("Stable publication requires a versioned RC tag");
    version = parsed.base;
    tag = `v${version}`;
    await newerStable(tag);
    revision = await git("rev-parse", `${candidate}^{commit}`);
    const release = await candidateRelease(candidate, revision);
    evidence = JSON.parse(readFileSync(`docs/releases/${candidate}.json`, "utf8"));
    validateEvidence(evidence, candidate, revision, release.publishedAt);
    body = `${await notes(revision, version)}\n\nPromoted from ${candidate} after recorded device and 24-hour usage checks.\n\n`;
  }
  if (!parseReleaseTag(tag)) throw new Error("Invalid generated tag");
  await unused(tag);
  await git("merge-base", "--is-ancestor", revision, "origin/main");
  body += `Commit: ${revision}\n\nValidation: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}\n`;
  mkdirSync("evidence/release-plan", { recursive: true });
  const result: Plan = { schema: 1, channel: channel as UpdateChannel, tag, revision, version, candidate, evidence, notes: body };
  writeFileSync("evidence/release-plan/plan.json", JSON.stringify(result, null, 2));
  output("publish", "true"); output("revision", revision); output("tag", tag);
  console.log(`Validate ${tag} at ${revision} before publication`);
}
async function publish(path: string, artifacts: string) {
  const plan = JSON.parse(readFileSync(path, "utf8")) as Plan;
  if (plan.schema !== 1 || parseReleaseTag(plan.tag)?.channel !== plan.channel || !/^[0-9a-f]{40}$/.test(plan.revision)) throw new Error("Invalid release plan");
  if (process.env.GITHUB_REF !== "refs/heads/main") throw new Error("Publication requires main");
  await git("fetch", "origin", "main", "--tags");
  await git("merge-base", "--is-ancestor", plan.revision, "origin/main");
  await unused(plan.tag);
  const receipts = receiptFiles(artifacts).map(path => JSON.parse(readFileSync(path, "utf8")));
  validateReceipts(receipts, plan.revision);
  if (plan.channel === "stable") {
    if (parseReleaseTag(plan.candidate ?? "")?.base !== plan.version || plan.tag !== `v${plan.version}`) throw new Error("RC/version mismatch");
    const release = await candidateRelease(plan.candidate!, plan.revision);
    validateEvidence(plan.evidence, plan.candidate!, plan.revision, release.publishedAt);
    await notes(plan.revision, plan.version);
    await newerStable(plan.tag);
  }
  const directory = join(artifacts, "publication");
  mkdirSync(directory, { recursive: true });
  const manifest = join(directory, "validation-manifest.json");
  writeFileSync(manifest, JSON.stringify({ schema: 1, tag: plan.tag, revision: plan.revision, receipts, observations: plan.evidence }, null, 2) + "\n");
  const body = join(directory, "notes.md");
  writeFileSync(body, plan.notes);
  await gh("release", "create", plan.tag, manifest, "--target", plan.revision, "--title", `herdr web ui ${plan.tag}`,
    "--notes-file", body, ...(plan.channel === "stable" ? ["--latest"] : ["--prerelease", "--latest=false"]));
  console.log(`Published ${plan.tag} at ${plan.revision}`);
}
if (import.meta.main) {
  if (process.argv[2] === "plan") await plan(process.argv[3] ?? "");
  else if (process.argv[2] === "publish") await publish(process.argv[3] ?? "", process.argv[4] ?? "");
  else throw new Error("Usage: bun scripts/release.ts plan stable|rc|nightly OR publish plan.json artifacts-directory");
}
