# Changelog

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
