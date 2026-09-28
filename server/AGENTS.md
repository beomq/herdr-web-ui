# Server rules

- Preserve the HTTP/WS contract and error envelope. Test endpoints through createServer
  with a temporary stateDir; importing it must not start updater or deployment operations.
- Only the supervisor discovers/builds/installs releases. Keep the launcher small.
  Build a private checkout, verify the exact bridge boot ID, restore the prior build
  on failure and hand over to the active release's supervisor after success.
- Default channel is Stable. Parse tags using shared/release-channel.ts. Reject tag
  movement, targets outside upstream main, and unrelated histories. Returning to an
  older release requires an explicit switch from a known preview plus manual install.
  Corrupt channel preferences block unattended updates until explicitly repaired.
- Persist channel intent across restarts. Auto-update cannot act on a pending channel
  switch. Browser/API callers may select only stable/nightly/rc, never arbitrary refs,
  repositories, executable paths or commands. Retain authentication and CSRF checks.
- For transcript resolver changes, cover same-cwd sibling sessions, fresh/stale
  breadcrumbs, directory-only descriptors, ambiguity, path escapes and process ownership.
  Preserve source=scrollback as an explicit limitation rather than guessing ownership.
- A client detaching while PTY attachment creation is pending cancels its claim.
  Share one attachment and release it after the last client; observe never resizes.
- Tests write only to their own isolated herdr panes. Never import or call a real agent
  with user credentials to satisfy a release gate; record native observations separately.
