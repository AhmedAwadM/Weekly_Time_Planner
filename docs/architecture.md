# Architecture — v3.6 baseline

## Current runtime

```text
GitHub Pages (static hosting)
        |
        v
index.html
  |-- src/css/app.css
  |-- src/js/app.js             Existing planner logic
  |-- src/js/pwa-register.js    Service Worker registration
  |
  +--> service-worker.js        App-shell cache / offline fallback
  +--> manifest.webmanifest     Install metadata
  +--> assets/icons/*           PWA icons

Browser storage
  |-- IndexedDB / local browser storage used by the current app
  +-- JSON export/import        Manual backup and device transfer
```

## Boundaries

- Git/GitHub stores source code and release history.
- GitHub Pages serves static application files. It does not run server-side application code.
- The current app has no Supabase connection and no central user database.
- Each browser/origin has its own local storage. Moving from a local `file://` copy to GitHub Pages creates a different storage origin; export/import JSON is required to move existing data.
- The service worker caches the application shell. It does not cache or synchronize private planner data as a GitHub repository file.

## Future Supabase boundary

When approved, add:
- Authentication and user identity.
- Tables with an owner/user ID.
- RLS policies for every user-owned table.
- A sync layer with retry, conflict resolution, and offline queue.
- A tested export/import fallback.

Do not put privileged database credentials in client-side files.
