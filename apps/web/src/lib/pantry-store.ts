"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSupabaseUser } from "@/lib/supabase-user";

/**
 * The reader's pantry, loaded once and edited in place.
 *
 * Optimistic like SaveButton, and for the same reason: adding "oats" should
 * put oats on the list now, not after a round trip. The cost of being briefly
 * wrong is a list that re-sorts itself, and the rollback puts it right.
 *
 * Items are stored lowercased and trimmed so "Flour" and "flour " are the same
 * row -- the unique constraint is on the stored text, so normalising here is
 * what makes adding the same thing twice idempotent rather than an error.
 */
export function usePantry() {
  const { userId } = useAuth();
  const supabase = useSupabaseUser();
  const [items, setItems] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !userId) {
      setItems(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("item")
        .order("item");
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setItems([]);
        return;
      }
      setItems((data ?? []).map((r) => r.item as string));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  /**
   * Splits on commas, because the box asks for a list.
   *
   * The placeholder reads "flour, oats, chocolate chips…" and the first
   * version stored that whole string as one row: typing three things gave one
   * chip reading "flour, butter, oats" and a count of 1. The affordance was
   * promising a list and the code was taking a value, which is the kind of lie
   * a reader has no way to see until it has already happened.
   */
  const add = useCallback(
    async (raw: string) => {
      const wanted = raw
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean)
        .filter((p, n, all) => all.indexOf(p) === n)
        .filter((p) => !items?.includes(p));
      if (wanted.length === 0 || !supabase || !userId) return;

      setItems((cur) => [...(cur ?? []), ...wanted].sort());
      const { error } = await supabase
        .from("pantry_items")
        .insert(wanted.map((item) => ({ user_id: userId, item })));
      if (error) {
        setError(error.message);
        setItems((cur) => (cur ?? []).filter((i) => !wanted.includes(i)));
      }
    },
    [supabase, userId, items],
  );

  const remove = useCallback(
    async (item: string) => {
      if (!supabase || !userId) return;
      const before = items ?? [];
      setItems(before.filter((i) => i !== item));
      const { error } = await supabase.from("pantry_items").delete().eq("item", item);
      if (error) {
        setError(error.message);
        setItems(before);
      }
    },
    [supabase, userId, items],
  );

  return { items, add, remove, error, ready: items !== null };
}
