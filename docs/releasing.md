# Release channels and regression prevention

PRs merge into protected `main`. Branch separation alone cannot catch differences in
native agent versions, retained browser state or physical mobile devices. Automated
regressions, opt-in previews and observations of a fixed candidate cover those boundaries.

## Channels

| Channel | Tags | Audience and publication |
| --- | --- | --- |
| Stable | `vX.Y.Z` | Default for existing users. Publish only by promoting an observed RC. |
| Nightly | `vX.Y.Z-nightly.YYYYMMDDHHMMSS.RUN.SHA12` | Explicit early testers. Daily at 18:17 UTC / 03:17 KST, only when main changed; full CI first. |
| RC | `vX.Y.Z-rc.RUN` | Testers validating one frozen candidate before Stable. Manually dispatched; full CI first. |

The preview suffix identifies the build even while package.json contains the plain
base version. Tags are immutable; there is no moving `nightly` tag. GitHub previews
are also marked prerelease and excluded from Latest, but installed updaters use tags,
not GitHub's prerelease flag. Never create a plain stable tag for an unverified build.

Settings → Updates → Update channel affects the **server and all connected devices**.
Selecting a channel persists the choice and checks availability, without installing.
Automatic installation pauses until **Update and restart** succeeds. Each channel
follows only its own tags; RC users choose Stable after promotion. For a preview
newer than Stable, choosing Stable offers **Return and restart**. This is an explicit
backwards installation, built and health checked like an upgrade. Failed builds/boots
retain the serving version and leave the switch pending. Preserve backwards-compatible
state formats while a preview can return to Stable. An older Stable may lack channel
controls; install a Stable version containing this feature to opt in again.

## Validation harness

```sh
bun install --frozen-lockfile
bun run verify:fast
bun run verify:integration
bun run verify:browser
```

`verify:fast` builds the frontend first. Integration/browser require herdr and Chrome
(`CHROME_PATH` when not at the default). Use a unique `HERDR_TEST_SESSION` when running
independent checkouts. Never use `HERDR_TEST_LIVE=1`. The CI jobs stop their owned session;
local runs reuse the isolated test session, which can be stopped after work.

Each phase records `evidence/validation/<phase>.json` and command logs. Browser captures
are under that directory. Receipts include the exact commit, dirty-worktree flag,
environment, command exit codes and timestamps. Local dirty checks help development;
only clean receipts for the candidate SHA authorize publication. CI uploads receipts
and logs even on failure, and releases attach `validation-manifest.json`.

| Boundary | Automatic evidence | Additional RC observation |
| --- | --- | --- |
| Types/build/protocol | Fast harness: generated schema, typecheck, build, unit tests | None |
| Native transcript binding | Integration: isolated Claude/Codex/omo/omp/GJC contracts, ambiguous/same-cwd cases | Installed omo/omp/GJC versions and OS, actual sessions, resume and existing history |
| Chat/composer/mobile interaction | Browser: UI regression and file viewer/back navigation | Galaxy hardware Back returns to chat, chat layout intact |
| Existing installation | Browser: real v0.3.29 → candidate, supervisor handover and failed-boot rollback | User's prior stable version → RC, without losing settings or queued messages |
| Browser persistence/PWA | Controlled service worker, old tab during restart, settings and multiple held messages retained across reload | Existing installed PWA, refresh and reopening |
| Channel isolation | Real Git/build tests plus browser Stable → Nightly → Stable | Observe normal use of the exact candidate |

`UPGRADE_BASE_REF` can select a different plain stable tag for the browser upgrade test;
CI deliberately pins v0.3.29 as the first compatibility baseline. Advance/add baselines
in a reviewed PR. A synthetic agent process or Chromium viewport is **not** evidence
that the actual agent or Galaxy passed. Android and macOS observations cannot be
filled in by a Linux-only CI run.

## Publish a Nightly

The schedule starts after this workflow is merged into the default branch. For an
on-demand preview, after CI and PR merge:

```sh
gh workflow run prerelease.yml --ref main -f channel=nightly
```

The workflow checks for an existing Nightly at that commit, skips unchanged builds,
validates the exact SHA, then publishes. A failed validation creates no tag.

## Prepare and observe an RC

1. In a PR, bump package.json and herdr-plugin.toml to the same **plain** `X.Y.Z` and
   add a matching nonempty CHANGELOG.md section. Merge after required CI succeeds.
2. Dispatch `gh workflow run prerelease.yml --ref main -f channel=rc -f version=X.Y.Z`.
   Use the returned `vX.Y.Z-rc.RUN` tag; RUN is the workflow's run number.
3. Opt test installations into RC and explicitly install. Start observation after
   publication, on that exact commit. Use owned sessions and non-sensitive test data.
4. Fetch tags, then run `bun run release:evidence vX.Y.Z-rc.RUN`. It creates
   `docs/releases/vX.Y.Z-rc.RUN.json` with every check **pending**, not passed.
5. Record results, tester, exact OS/device/browser and agent versions, and a specific
   observation or evidence link/path for each row. Keep transcripts and credentials
   private; link redacted screenshots/logs when needed. Required checks:
   - native-omo, native-omp: existing history, new turn, resume, correct session identity.
   - native-gjc-linux, native-gjc-macos: same checks with each platform's resolver.
   - android-back: link preview → device Back → chat; app remains open.
   - existing-install: Stable upgrade, settings and multiple queued messages retained;
     reconnect/reload never sends messages by itself.
   - pwa-refresh: existing installed PWA and stale tab show the current styled chat after reload.
   - daily-use: at least 24 hours of observation, including reconnects and session switching.
6. Set observed_from/observed_until to the actual observation interval (at least
   24 hours, beginning after RC publication). Submit the evidence in a PR and merge.
   A failed/pending check blocks Stable. Product fixes require a new RC and new evidence.

The machine gate verifies identity, timing and completeness. Maintainer review checks
that the observations are credible; it cannot prove a physical test happened.
The evidence commit is newer than the RC. It records results without changing the
product that users will receive.

## Promote Stable

```sh
gh workflow run release.yml --ref main -f candidate=vX.Y.Z-rc.RUN
```

The workflow reads reviewed evidence from main, resolves the published candidate tag,
requires the full observation interval and all passing rows, and runs the complete
harness **on the RC commit**. Immediately before publication it verifies the same tag,
SHA, evidence and receipts again. It creates `vX.Y.Z` targeting that RC SHA, even if
main has advanced. Version metadata was already prepared before the RC.

Verify the workflow conclusion, release URL and tag SHA. Do not claim all users have
updated: installation follows their selected channel and auto-update preference.
No automatic timer promotes a candidate merely because it is old enough.

If publication fails after tag creation, inspect the validated SHA and repair the
release record; never move/delete/reuse the tag. If a released version regresses,
fix it in a new PR, add the failing scenario to the harness and prepare a new patch RC.
A request for urgency does not silently waive the published release gates.

## Agent and reviewer responsibilities

[AGENTS.md](../AGENTS.md) contains repository-wide rules, with scoped rules in src,
server and scripts. [The PR template](../.github/pull_request_template.md) records
which boundaries changed, regression evidence and remaining device checks.

For a release incident, write down the first failing scenario and affected versions;
retain the failing log; turn it into a regression; check adjacent agent versions and
retained user state; then follow the same preview/promotion flow. A passing retry alone
is not a diagnosis. Never fill missing observation fields with an assumed pass.
