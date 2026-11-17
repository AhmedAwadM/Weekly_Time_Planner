# Automated checks (no dependencies — just Node)

```bash
node tests/check-release.js   # versions match, no inline icons, CSP present, no personal JSON in the repo folder
node tests/sync-test.js       # real storage/sync code: pending edits, external file edits, conflicts, backups
node tests/sw-test.js         # service worker: precache, network-first, offline fallback, old-cache cleanup
```

Run all three before every release. `sync-test.js` extracts code from `src/js/app.js` between the markers
`// ===== Storage & file sync` and `function element(`; keep those markers if you refactor.
Browser-only behaviour (file picker permission prompts, install prompt, layout) is still covered by `manual-regression-checklist.md`.
