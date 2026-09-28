import { expect, test } from "bun:test";
import { evidenceTemplate, MIN_SOAK_MS, validateEvidence } from "./release-policy.ts";
const candidate = "v1.2.3-rc.1", revision = "a".repeat(40), published = "2026-09-25T00:00:00Z";
const now = Date.parse(published) + MIN_SOAK_MS;
const passing = () => ({ ...evidenceTemplate(candidate, revision), observed_from: published, observed_until: new Date(now).toISOString(),
  observations: evidenceTemplate(candidate, revision).observations.map(row => ({ ...row, result: "pass" as const, tester: "fixture tester", environment: "fixture device", evidence: "fixture observation" })) });
test("only complete observations of the exact RC after a full soak qualify", () => {
  expect(() => validateEvidence(passing(), candidate, revision, published, now)).not.toThrow();
  const cases: unknown[] = [null, {}, evidenceTemplate(candidate, revision), { ...passing(), revision: "b".repeat(40) },
    { ...passing(), candidate: "v1.2.3-rc.2" }, { ...passing(), observed_until: published },
    { ...passing(), observed_from: "2026-09-24T00:00:00Z" }, { ...passing(), observed_until: "2026-10-01T00:00:00Z" },
    { ...passing(), observations: [] }, { ...passing(), observations: passing().observations.map(row => ({ ...row, evidence: "" })) }];
  for (const value of cases) expect(() => validateEvidence(value, candidate, revision, published, now)).toThrow();
  expect(() => validateEvidence({ ...passing(), observations: passing().observations.map(row => ({ ...row, result: "fail" })) }, candidate, revision, published, now)).toThrow();
});
