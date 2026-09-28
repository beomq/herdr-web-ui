import { mkdirSync, writeFileSync } from "node:fs";
import { evidenceTemplate } from "./release-policy.ts";
import { runCommand } from "../server/updater.ts";
const candidate = process.argv[2] ?? "";
// Validate before passing a ref to Git.
evidenceTemplate(candidate, "0".repeat(40));
const revision = await runCommand(process.cwd(), ["git", "rev-parse", `${candidate}^{commit}`]);
mkdirSync("docs/releases", { recursive: true });
const path = `docs/releases/${candidate}.json`;
writeFileSync(path, JSON.stringify(evidenceTemplate(candidate, revision), null, 2) + "\n", { flag: "wx" });
console.log(`Created ${path}. All observations are pending; record actual results before promotion.`);
