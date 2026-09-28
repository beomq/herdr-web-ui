# Working on herdr web UI

React 18/xterm client (`src/`), Bun bridge (`server/`), shared HTTP/WS contracts
(`shared/`). herdr owns PTYs and agent sessions. Read scoped AGENTS.md before editing.

## Delivery rules

- Work on a feature/fix branch and open a PR to `main`. Main requires up-to-date
  branches, Fast checks, and Integration and browser. Squash only. CodeRabbit is
  advisory; address concrete failures, not every suggestion automatically.
- For a user-visible bug, identify its trigger and add a regression that fails on
  the previous behavior. Check both a fresh install and retained user state when
  updating persistence, chat binding, caches, or the managed updater.
- Match checks to the affected boundary using [the release runbook](docs/releasing.md).
  Run `bun run verify:fast`, `bun run verify:integration`, and `bun run verify:browser`
  for release candidates. Keep receipts/logs, disclose failures and untested platforms.
- A fixture is not a native-agent check; Chromium emulation is not a Galaxy device;
  a build is not a successful upgrade. Never label these as equivalent evidence.
- Never retry until green without investigating a failure. Preserve the first log,
  explain the cause, and rerun the affected checks after the fix.
- Do not weaken tests, age limits, or evidence requirements to finish a release.
  Missing physical-device or native-agent evidence remains pending. Request the
  missing observations while completing independent code/tests.

## Release rules

- Keep `main`; do not introduce a permanent dev branch. Nightly and RC are opt-in
  channels. Existing installs default to Stable. Changing channels never installs
  by itself, including when automatic updates are enabled.
- Read [docs/releasing.md](docs/releasing.md) before publishing. Nightly/RC use
  `prerelease.yml`. Stable uses `release.yml` with a published RC tag, at least
  24 hours of actual observation and a reviewed `docs/releases/<rc-tag>.json`.
- Prepare package.json, herdr-plugin.toml and CHANGELOG.md together in a PR before
  an RC. Stable promotes the exact RC commit, not the newer evidence commit on main.
  Changed product code needs another RC and new observations.
- Never manually push, move, reuse or delete version tags. Tags are visible to
  installed updaters even without a GitHub Release. A prerelease checkbox alone
  does not protect Stable users; tag suffixes define the channel.
- No invented passing device results, fabricated timestamps, or prefilled attestations.
  Evidence templates intentionally start pending. Do not publish a stable release
  merely because CI is green. An explicitly authorized release still needs its checks.
- Report the PR URL, tested commit, checks, missing evidence and whether anything was
  actually published. Do not claim an installed service was upgraded without verifying it.

## Runtime and test invariants

- Never write to, close, resize, or attach a user's live pane for QA. Use owned
  `herdr-web-ui-test-*` workspaces in the isolated session from scripts/test-herdr.ts.
  Never use `HERDR_TEST_LIVE=1` in the release harness. Every test createServer gets
  a temporary stateDir; preserve real push keys, subscriptions and agent credentials.
- Never use `herdr terminal attach --takeover`. Keep node-pty in the Node sidecar,
  xterm scrollback at zero, and output append-only. Use the RPC socket for attaches too.
- Fresh socket per herdr RPC; only subscriptions persist. Observe roles cannot
  write or resize. Release the shared attachment when its final client leaves.
- Terminal input never replays after reconnect. Held messages require Send now,
  remain bound to PC/pane and survive switching, updates and reloads.
- Transcript ownership requires native metadata, descriptors, or supported explicit
  fallback evidence; never pick another session by recency to make the UI look healthy.
  Missing native history must remain a labelled fallback.
- Never rotate malformed VAPID keys or hide a push notification in the service worker.
- Explicit .ts/.tsx imports. Generate shared/herdr-api.generated.ts; never edit it.
  HTTP/WS errors use the shared envelope. CSS uses DESIGN.md/src/styles.css tokens.
- Preserve user files and unrelated edits. Do not restart the installed app as part
  of a source change unless deployment is authorized.
