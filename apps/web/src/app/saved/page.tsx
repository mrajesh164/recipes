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
      {/* A shape, not a word. The saved list is per-user, so it cannot be
          prerendered and something has to stand in for it -- but "Looking…"
          announced a wait for data the reader thinks of as already theirs.
          Cards of the right size and position say the same thing without
          saying anything. */}
      <Suspense fallback={<SavedSkeleton />}>
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
  /**
   * Read in pages, like the corpus read does.
   *
   * PostgREST caps a response at 1,000 rows whatever is asked for, and does it
   * silently: the request succeeds, error is null, and the rows past the cap
   * are simply absent. That cap bit the app's read of the corpus and the seed's
   * cleanup on the same afternoon, both as wrong answers rather than errors.
   *
   * Nobody has a thousand saves, so this one has never been wrong. That is
   * exactly what the other two had going for them until the corpus grew -- the
   * failure is invisible until the table outgrows the cap, and then it is a
   * reader quietly missing their oldest saves.
   */
  const PAGE = 1000;
  type Row = { id: string; saved_for: string | null; created_at: string; recipe_id: string };
  const data: Row[] = [];
  let error: { message: string } | null = null;

  for (let from = 0; ; from += PAGE) {
    const res = await db
      .from("saved_recipes")
      .select("id, saved_for, created_at, recipe_id")
      .order("created_at", { ascending: false })
      // Ordered by id as well, because created_at is not unique -- two saves in
      // the same second could straddle a page boundary, and an unstable order
      // there returns one row twice and drops another.
      .order("id")
      .range(from, from + PAGE - 1);
    if (res.error) {
      error = res.error;
      break;
    }
    const page = (res.data ?? []) as Row[];
    data.push(...page);
    // A short page is the last page: asking past the cap does not raise, so the
    // length of what came back is the only signal there is.
    if (page.length < PAGE) break;
  }

  if (error) {
    return (
      <p className="mt-6 text-sm text-pink-deep">
        Couldn&apos;t load your saves: {error.message}
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-dashed border-line bg-paper px-6 py-10 text-center">
        <p className="font-semibold">Nothing saved yet.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Find a recipe you like and hit Save.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-clay-deep px-5 py-3 text-sm font-semibold text-paper transition hover:brightness-90"
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

function SavedSkeleton() {
  return (
    <ul className="mt-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-2" aria-hidden>
      {[0, 1].map((n) => (
        <li key={n} className="animate-pulse rounded-2xl border-2 border-line bg-paper">
          <div className="flex items-start gap-4 p-4">
            <div className="h-24 w-24 flex-none rounded-xl bg-cream-deep" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-3/4 rounded bg-cream-deep" />
              <div className="mt-2 h-3 w-1/2 rounded bg-cream-deep" />
              <div className="mt-3 h-5 w-32 rounded-full bg-cream-deep" />
            </div>
          </div>
          <div className="flex gap-3 border-t border-line-soft px-4 py-3">
            <div className="h-10 w-36 rounded-full bg-cream-deep" />
            <div className="h-10 w-24 rounded-full bg-cream-deep" />
          </div>
        </li>
      ))}
    </ul>
  );
}
