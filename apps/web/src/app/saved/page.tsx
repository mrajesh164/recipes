import { Suspense } from "react";
import Link from "next/link";
import { supabaseForUser } from "@/lib/supabase-server-user";
import { getRecipes } from "@/lib/recipes";
import { SavedGrid, type SavedItem } from "@/components/SavedGrid";

export const metadata = { title: "Saved recipes" };

/**
 * One person's list.
 *
 * Cache Components is on, so an uncached read needs a Suspense boundary --
 * and this read is per-user, so caching it would be actively wrong. The
 * boundary is the correct tool here rather than a workaround.
 */
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-6">
      <h1 className="font-script text-display font-bold text-clay-deep">Saved</h1>
      <Suspense fallback={<p className="mt-6 text-sm text-ink-soft">Looking…</p>}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  const db = await supabaseForUser();
  if (!db) {
    return <p className="mt-6 text-sm text-ink-soft">Sign in to see your saved recipes.</p>;
  }

  // Only the save itself is read per-user. The recipe behind it comes from
  // the cached corpus, which every other page already has in memory -- and it
  // carries the ingredients and scores the comparison needs, which the old
  // embedded select did not.
  const { data, error } = await db
    .from("saved_recipes")
    .select("id, saved_for, created_at, recipe_id")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="mt-6 text-sm text-pink-deep">
        Couldn&apos;t load your saves: {error.message}
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-dashed border-line bg-paper px-6 py-10 text-center">
        <p className="font-semibold">Nothing saved yet.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Find a recipe you like and hit Save.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-clay-deep px-5 py-3 text-sm font-semibold text-paper hover:bg-clay"
        >
          Find a recipe
        </Link>
      </div>
    );
  }

  const recipes = await getRecipes();
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const items: SavedItem[] = data
    .map((row) => {
      const recipe = byId.get(row.recipe_id);
      // A save whose recipe has left the corpus. Skipping it beats rendering
      // a card with no title; the row is harmless and the cascade will take
      // it if the recipe is ever really deleted.
      return recipe ? { id: row.id, savedFor: row.saved_for, recipe } : null;
    })
    .filter((x): x is SavedItem => x !== null);

  if (items.length === 0) {
    return (
      <p className="mt-6 text-sm text-ink-soft">
        Your saves point at recipes that aren&apos;t in the jar any more.
      </p>
    );
  }

  return <SavedGrid items={items} all={recipes} />;
}
