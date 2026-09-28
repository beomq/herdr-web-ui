import { expect, test } from "bun:test";
import { latestReleaseTag, parseReleaseTag } from "./release-channel.ts";

test("stable excludes every preview and bundle tag; channel ordering is numeric", () => {
  const tags = ["v0.9.0", "v0.10.0", "remote-v9", "v1.0.0-rc.2", "v1.0.0-rc.10", "v1.0.0-nightly.20260928030000.10.abcdef123456"];
  expect(latestReleaseTag(tags, "stable")?.tag).toBe("v0.10.0");
  expect(latestReleaseTag(tags, "rc")?.tag).toBe("v1.0.0-rc.10");
  expect(latestReleaseTag(tags, "nightly")?.channel).toBe("nightly");
  for (const tag of ["v01.0.0", "v1.0.0-rc1", "v1.0.0-rc.0", "v1.0.0-rc.01", "v1.0.0\n", "v1.0.0-nightly", "refs/tags/v1.0.0"]) expect(parseReleaseTag(tag)).toBeNull();
});
