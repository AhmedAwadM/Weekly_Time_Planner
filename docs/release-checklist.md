# Release checklist

Before each release:

- [ ] Export a JSON backup from the currently used app.
- [ ] Update the version in `CHANGELOG.md`.
- [ ] Update `CACHE_VERSION` in `service-worker.js`.
- [ ] Confirm `index.html` references the intended CSS and JS paths.
- [ ] Check `manifest.webmanifest` paths and icons.
- [ ] Run the manual regression checklist.
- [ ] Confirm no personal JSON, `.env`, token, or secret is staged (`git status`).
- [ ] Commit with a descriptive message and push.
- [ ] Wait for GitHub Pages deployment to complete.
- [ ] Test the live URL online and offline.
- [ ] Test an installed PWA after the update.
