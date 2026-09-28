import { expect, test } from "bun:test";
import { validateReceipts } from "./release.ts";
const revision = "a".repeat(40);
const passing = () => ["fast", "integration", "browser"].map(phase => ({ schema: 1, phase, revision, dirty: false, passed: true, results: [{ exit_code: 0 }] }));
test("publication requires all three successful clean receipts for the exact commit", () => {
  expect(() => validateReceipts(passing(), revision)).not.toThrow();
  for (const receipts of [[], passing().slice(1), [...passing(), passing()[0]],
    passing().map(row => ({ ...row, dirty: true })), passing().map(row => ({ ...row, revision: "b".repeat(40) })),
    passing().map(row => ({ ...row, passed: false })), passing().map(row => ({ ...row, results: [{ exit_code: 1 }] }))]) {
    expect(() => validateReceipts(receipts, revision)).toThrow();
  }
});
