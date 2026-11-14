# Configuration

The current v3.6 application does not require runtime configuration.

`app-config.example.js` is a documented placeholder for the later Supabase phase. It is not loaded by the app yet.

GitHub Pages serves client-side files publicly. Any value placed in a JavaScript config file is visible to visitors. A Supabase publishable/anon key can be used in a browser only when database access is protected with correctly configured Row Level Security (RLS). Never put a service-role key, database password, or other secret here.
