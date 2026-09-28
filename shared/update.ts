import type { UpdateChannel } from "./release-channel.ts";

/** App updates are independent of the herdr daemon and its terminal sessions. */
export interface UpdateStatus {
  managed: boolean;
  auto_update: boolean;
  channel: UpdateChannel;
  current_tag: string | null;
  /** Selecting a channel pauses automatic installation until an explicit install succeeds. */
  channel_switch_pending: boolean;
  is_downgrade: boolean;
  phase: "idle" | "checking" | "building" | "restarting" | "error";
  /** Commit ids: what is running and what the latest release tag points at. */
  current_revision: string | null;
  latest_revision: string | null;
  /** Human versions: the active build's tag (legacy: package.json) and selected channel's latest tag, without v. */
  current_version: string | null;
  latest_version: string | null;
  available: boolean;
  checked_at: string | null;
  blocked_reason: string | null;
  error: string | null;
}

export type UpdateCommand = "check" | "install" | { channel: UpdateChannel };

export function unmanagedUpdateStatus(): UpdateStatus {
  return {
    managed: false, auto_update: false, channel: "stable", current_tag: null, channel_switch_pending: false, is_downgrade: false, phase: "idle", current_revision: null,
    latest_revision: null, current_version: null, latest_version: null, available: false, checked_at: null, error: null,
    blocked_reason: "Start with bun run start or the herdr plugin to enable updates.",
  };
}
