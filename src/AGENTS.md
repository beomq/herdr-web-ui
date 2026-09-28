# Client rules

- Keep existing React/xterm lifecycles. Reset terminals only on pane changes; themes
  update options without remounting. Input goes through the established submission path.
- MachineContext owns the target. Drafts, held queues and asynchronous acknowledgements
  stay bound to their original PC/pane; a channel/server restart must never send them.
- Test updater UI against an existing browser profile as well as a fresh page.
  Preserve settings, queue data and service-worker-controlled tabs. Reload is explicit.
- Update channel selection is server-wide. Explain it in Settings, default to Stable,
  label previews and require an explicit install after selection. Retain old-server
  compatibility while users still have the previous frontend loaded.
- Chat regressions need transcript content assertions, not only a nonempty container.
  Verify structured history and explicit fallback separately; check blocked/working turns.
- Mobile fixes need narrow-layout/browser coverage plus recorded real-device RC evidence.
- Colocate CSS, use theme tokens and existing lucide icons; no literal colors or !important.
  main.tsx imports base styles before App/component styles. Translate new UI text in i18n.ko.ts.
