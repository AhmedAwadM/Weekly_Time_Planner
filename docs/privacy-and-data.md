# Privacy and data handling

## Current release

- The app is static and has no cloud database connection.
- Planner data is stored in the browser's own storage according to the current app implementation.
- JSON export/import is the supported manual backup and transfer mechanism.
- GitHub receives committed project files only. It does not receive local browser data automatically.

## Never commit

- Personal planner JSON exports.
- Real schedules or personal task lists.
- Browser profile data.
- Passwords, API secrets, Supabase service-role keys, database passwords, or private tokens.

The repository `.gitignore` excludes JSON files under `data/`, `backups/`, and `exports/`. Still inspect `git status` before every commit.

## GitHub Pages visibility

Assume the deployed site and its static files are publicly reachable. Do not place confidential content in the app source or public configuration.

## Supabase (future phase)

Before enabling cloud storage:
1. Define the user and planner data model.
2. Require authentication.
3. Add an owner ID to every user-owned record.
4. Enable RLS and write policies that restrict reads/writes to the authenticated owner.
5. Test with two separate accounts to prove that one user cannot read or modify another user's records.
6. Keep service-role credentials on a trusted server only; never in the browser.
