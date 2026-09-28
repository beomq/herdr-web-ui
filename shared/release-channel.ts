/** Tags are the update protocol: GitHub's prerelease checkbox is not an install boundary. */
export const UPDATE_CHANNELS = ["stable", "nightly", "rc"] as const;
export type UpdateChannel = typeof UPDATE_CHANNELS[number];
export const isUpdateChannel = (value: unknown): value is UpdateChannel =>
  typeof value === "string" && (UPDATE_CHANNELS as readonly string[]).includes(value);

const number = "(0|[1-9]\\d*)";
const tagPattern = new RegExp(`^v${number}\\.${number}\\.${number}(?:-(rc)\\.([1-9]\\d*)|-(nightly)\\.(\\d{14})\\.([1-9]\\d*)\\.([0-9a-f]{12}))?$`);
export interface ReleaseTag { tag: string; version: string; base: string; channel: UpdateChannel; order: bigint[] }
export function parseReleaseTag(tag: string): ReleaseTag | null {
  const match = tagPattern.exec(tag);
  if (!match || match[0] !== tag) return null;
  const channel: UpdateChannel = match[4] ? "rc" : match[6] ? "nightly" : "stable";
  return { tag, version: tag.slice(1), base: match.slice(1, 4).join("."), channel,
    order: [BigInt(match[1]!), BigInt(match[2]!), BigInt(match[3]!), BigInt(match[5] ?? match[7] ?? 0), BigInt(match[8] ?? 0)] };
}
export function latestReleaseTag(tags: string[], channel: UpdateChannel): ReleaseTag | null {
  return tags.map(parseReleaseTag).filter((tag): tag is ReleaseTag => tag?.channel === channel)
    .sort((a, b) => {
      for (let i = 0; i < a.order.length; i++) {
        if (a.order[i]! !== b.order[i]!) return a.order[i]! > b.order[i]! ? -1 : 1;
      }
      return b.tag.localeCompare(a.tag);
    })[0] ?? null;
}
