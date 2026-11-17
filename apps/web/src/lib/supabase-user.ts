"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client carrying the signed-in person's Clerk token.
 *
 * Deliberately not the service role. That key bypasses every policy, and the
 * whole point of saved_recipes is that the policies are the only thing keeping
 * one person's list out of another's. Passing the caller's own token means a
 * bug here can still only touch rows that caller could touch anyway.
 *
 * Supabase verifies the Clerk token directly through its third-party auth
 * integration, which is what makes auth.jwt() ->> 'sub' resolve to the Clerk
 * user id inside the policies.
 */
export function useSupabaseUser(): SupabaseClient | null {
  const { session } = useSession();

  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !session) return null;
    return createClient(url, key, {
      accessToken: async () => (await session.getToken()) ?? null,
    });
  }, [session]);
}
