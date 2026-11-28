"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSupabaseUser } from "@/lib/supabase-user";

/**
 * Save a recipe, or unsave it.
 *
 * Optimistic: the label flips immediately and rolls back if the write fails.
 * Waiting on a round trip to acknowledge a bookmark makes the whole app feel
 * slow, and the cost of being briefly wrong here is nil.
 *
 * `saved_for` records what was typed when it was saved. "quick, no mixer" is a
 * better reminder of why a recipe is on the list than its title, and it is the
 * raw material for recommending from history later.
 */
export function SaveButton({
  recipeId,
  savedFor,
  compact = false,
}: {
  recipeId: string;
  savedFor?: string;
  compact?: boolean;
}) {
  const { isSignedIn, userId } = useAuth();
  const supabase = useSupabaseUser();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !userId) {
      setSaved(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("saved_recipes")
        .select("id")
        .eq("recipe_id", recipeId)
        .maybeSingle();
      if (!cancelled) setSaved(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, recipeId]);

  if (!isSignedIn) return null;

  async function toggle() {
    if (!supabase || !userId) return;
    const next = !saved;
    setSaved(next); // optimistic
    setError(null);

    const { error: err } = next
      ? await supabase
          .from("saved_recipes")
          // user_id is set here rather than defaulted in the database, and the
          // insert policy checks it against the JWT subject -- so a client
          // sending someone else's id is rejected, not trusted.
          .insert({ user_id: userId, recipe_id: recipeId, saved_for: savedFor ?? null })
      : await supabase.from("saved_recipes").delete().eq("recipe_id", recipeId);

    if (err) {
      setSaved(!next); // roll back
      setError(err.message);
    }
  }

  const label = saved ? "Saved" : "Save";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved === true}
        disabled={saved === null}
        className={[
          compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
          // transition, not transition-colors: the hover darkens with a filter,
          // which transition-colors does not animate.
          "rounded-full border-2 font-semibold transition disabled:opacity-50",
          saved
            // Darkened rather than lightened. paper on sage is 2.39 and fails
            // AA outright, so the obvious "lighten on hover" would have made
            // the label unreadable; brightness-90 takes sage-deep from 4.55 to
            // 5.45 instead, so the cue improves the contrast rather than
            // spending it.
            ? "border-sage-deep bg-sage-deep text-paper hover:brightness-90"
            // The outline state had a hover on its border only, which is easy
            // to miss on a 2px edge. The fill moves too now.
            : "border-line bg-paper hover:border-clay-deep hover:bg-cream-deep",
        ].join(" ")}
      >
        {saved === null ? "…" : label}
      </button>
      {error && <span className="text-xs text-pink-deep">Couldn&apos;t save: {error}</span>}
    </span>
  );
}
