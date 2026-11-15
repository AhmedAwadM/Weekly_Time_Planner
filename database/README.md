# Database layer (future phase)

The current v3.8 release has no cloud database or server-side backend. User data remains in browser storage and can be moved with the app's JSON export/import feature.

The planned Supabase structure is reserved under `database/supabase/`:
- `migrations/`: versioned SQL schema changes.
- `seed/`: non-sensitive development/test seed data only.

Do not put exported personal planner JSON, production database dumps, passwords, access tokens, or service-role keys in this directory. The Supabase schema, authentication model, per-user ownership, and RLS policies will be designed and reviewed before connecting a real project.
