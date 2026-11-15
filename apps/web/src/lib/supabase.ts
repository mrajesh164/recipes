import { createClient } from "@supabase/supabase-js";

/**
 * Read-only client, publishable key.
 *
 * Safe to use anywhere: the tables carry select policies and nothing else, so
 * there is no write path through this key even if it leaks. The service-role
 * key is deliberately absent from this app and from Vercel -- seeding runs
 * from a laptop.
 */
export function supabaseRead() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
