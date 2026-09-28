/** Human observations are separate from CI. A green harness never invents device evidence. */
import { parseReleaseTag } from "../shared/release-channel.ts";
export const REQUIRED_OBSERVATIONS = [
  "native-omo", "native-omp", "native-gjc-linux", "native-gjc-macos",
  "android-back", "existing-install", "pwa-refresh", "daily-use",
] as const;
export const MIN_SOAK_MS = 24 * 60 * 60 * 1000;
export interface ReleaseEvidence {
  schema: 1; candidate: string; revision: string;
  observed_from: string | null; observed_until: string | null;
  observations: Array<{ id: string; result: "pending" | "pass" | "fail"; tester: string; environment: string; evidence: string }>;
}
export function evidenceTemplate(candidate: string, revision: string): ReleaseEvidence {
  if (parseReleaseTag(candidate)?.channel !== "rc" || !/^[a-f0-9]{40}$/.test(revision)) throw new Error("Expected an RC tag and exact commit SHA");
  return { schema: 1, candidate, revision, observed_from: null, observed_until: null,
    observations: REQUIRED_OBSERVATIONS.map(id => ({ id, result: "pending", tester: "", environment: "", evidence: "" })) };
}
export function validateEvidence(value: unknown, candidate: string, revision: string, publishedAt: string, now = Date.now()): asserts value is ReleaseEvidence {
  const evidence = value as ReleaseEvidence | null;
  if (!evidence || evidence.schema !== 1 || evidence.candidate !== candidate || evidence.revision !== revision) throw new Error("Evidence must name the exact RC tag and commit");
  if (parseReleaseTag(candidate)?.channel !== "rc" || !/^[a-f0-9]{40}$/.test(revision)) throw new Error("Invalid candidate identity");
  const start = Date.parse(evidence.observed_from ?? ""), end = Date.parse(evidence.observed_until ?? ""), published = Date.parse(publishedAt);
  if (![start, end, published].every(Number.isFinite) || start < published || end > now || end - start < MIN_SOAK_MS) {
    throw new Error("Record at least 24 hours of observation after RC publication; future timestamps are invalid");
  }
  if (!Array.isArray(evidence.observations) || evidence.observations.length !== REQUIRED_OBSERVATIONS.length) throw new Error("Record every required observation exactly once");
  for (const id of REQUIRED_OBSERVATIONS) {
    const rows = evidence.observations.filter(row => row?.id === id);
    const row = rows[0];
    if (rows.length !== 1 || row?.result !== "pass" || [row.tester, row.environment, row.evidence].some(text => typeof text !== "string" || !text.trim())) {
      throw new Error(`Missing passing observation with tester, environment and evidence: ${id}`);
    }
  }
}
