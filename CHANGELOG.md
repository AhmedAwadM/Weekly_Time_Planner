# Changelog

## v3.6 — GitHub Pages / PWA packaging

- Preserved the supplied v3.6 planner logic and visual styles by extracting the embedded CSS and JavaScript into `src/`.
- Added a web app manifest and icons using the original application icon.
- Added a service worker for app-shell caching and offline loading after the first successful online visit.
- Added GitHub Pages root-relative paths and `.nojekyll`.
- Added repository documentation, privacy guidance, and a manual regression checklist.
- Reserved `database/supabase/` for a future database phase; no Supabase client, schema, credentials, or cloud sync is active in this release.
- Added `.gitignore` rules to prevent personal JSON exports and local secrets from being committed.

This packaging release does not intentionally change the planner's task calculation or scheduling behavior.
