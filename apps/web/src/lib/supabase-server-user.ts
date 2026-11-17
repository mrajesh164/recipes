import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** The server-side twin of useSupabaseUser. Same reasoning, same token. */
export async function supabaseForUser(): Promise<SupabaseClient | null> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { accessToken: async () => token });
}
