/*
 * Example of future public runtime configuration.
 * This file is NOT loaded by the current v3.6 app.
 *
 * When Supabase is added:
 * - SUPABASE_URL and the publishable/anon key may be public client config.
 * - Enable and test Row Level Security (RLS) on every user-owned table.
 * - NEVER put a Supabase service_role key or any secret in browser code.
 */
window.PLANNER_PUBLIC_CONFIG = Object.freeze({
  supabase: {
    url: "",
    publishableKey: ""
  }
});
