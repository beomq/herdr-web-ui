# Validation and publication tooling

- release-harness.ts is shared by local validation and CI. Preserve command exits,
  exact commit, dirty-worktree flag, phase receipts and failure logs. Partial, dirty,
  failed or wrong-commit receipts cannot authorize publication.
- All browser harnesses use disposable app state and owned herdr workspaces; cleanup
  belongs in finally. Do not select the user's focused pane or a running app's port.
- update-browser-qa.ts starts from a real stable tag. Keep the controlled service
  worker, settings, multiple held messages, old frontend during restart, Nightly
  opt-in, Stable return, and failed-boot recovery assertions.
- release-evidence.ts creates pending observations only. Only a person or agent who
  actually performed a check may record its result, exact environment and evidence.
- Release workflows validate before creating tags. Stable promotion revalidates the
  RC SHA, evidence and age immediately before publishing. No unvalidated emergency path.
- Keep release commands in argument arrays or structured inputs; never interpolate
  user-supplied tags, versions or evidence into executable shell code.
