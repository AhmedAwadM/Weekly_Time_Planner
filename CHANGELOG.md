# Changelog

## v3.9 — Safer updates, safer sync, safer backups

- Service worker is now network-first for every same-origin file (cache is only the offline fallback), and CSS/JS links carry `?v=` so a new page can never run an old cached script. `updateViaCache: "none"` lets the service worker itself update promptly.
- Replaced the two inline base64 icons in `index.html` with the icon file (page size 56 KB → 12 KB) and added a Content-Security-Policy.
- Linked-file sync no longer asks "which copy?" when there is no real conflict: it writes your own pending edits silently, and adopts the file silently when it was edited elsewhere and nothing here is unsaved. A real conflict (both changed) still asks.
- The "Link Save File" dialog now also offers **Unlink** when a file is linked.
- Backups are reachable again through a quiet "Backups" row under the four main actions. Routine add/edit snapshots (last 10) and protected snapshots before delete/import/reset/restore/unreadable data (last 10) are trimmed separately, so routine edits can no longer push a protected snapshot out.
- The "leave this page?" warning now appears only when data is not safely stored (it no longer fires just because the linked file is waiting for permission).
- Mobile data menu is anchored under the header instead of a fixed pixel offset.
- Footer text updated for the hosted PWA.
- Added dependency-free automated checks under `tests/` (release consistency, storage/sync behaviour, service worker); see `tests/README.md`.

## v3.8 — Vertical week view and simplified data actions

- Fixed the week grid so all seven day cards always stack vertically, including when parallel tasks are present.
- Parallel task lanes remain inside their respective day card and no longer force the days into horizontal columns.
- Simplified the data menu to exactly four main actions: Import, Export, Link Save File, and Reset Tasks.
- Combined linking an existing JSON file and creating a new save file under one “Link Save File” action with a clear in-app choice.
- Kept the file-link action visible on browsers without File System Access support; it explains that manual JSON import/export is the available fallback.
- Bumped the service-worker cache version to ensure the new UI is fetched after deployment.

## v3.7 — GitHub Pages layout refresh

- Simplified the data menu to focus on the most useful actions: create data file, import, export, backup management, and reset to default tasks.
- Changed the mobile data menu presentation from a bottom sheet style to a top popup style closer to desktop behavior.
- Moved the weekly overview board beside the editor and moved the weekly task list directly under the add-task form.
- Switched the weekly board from side-by-side day columns to vertically stacked day cards for clearer reading when several days contain tasks.
- Updated week-board descriptive text and footer version label.

## v3.6 — GitHub Pages / PWA packaging



- Preserved the supplied v3.6 planner logic and visual styles by extracting the embedded CSS and JavaScript into `src/`.
- Added a web app manifest and icons using the original application icon.
- Added a service worker for app-shell caching and offline loading after the first successful online visit.
- Added GitHub Pages root-relative paths and `.nojekyll`.
- Added repository documentation, privacy guidance, and a manual regression checklist.
- Reserved `database/supabase/` for a future database phase; no Supabase client, schema, credentials, or cloud sync is active in this release.
- Added `.gitignore` rules to prevent personal JSON exports and local secrets from being committed.

This packaging release does not intentionally change the planner's task calculation or scheduling behavior.
