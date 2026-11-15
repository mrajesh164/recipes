import { getRecipes } from "@/lib/recipes";
import { Picker } from "@/components/Picker";

/**
 * Slice 4: the core task, end to end, on a live URL.
 *
 * The whole corpus is fetched once in a cached server component and handed to
 * the client, so choosing a texture is instant and needs no second request.
 * Styling is still deliberately plain -- the design pass is its own slice, and
 * the point of this one is that a stranger can actually complete the task.
 */
export default async function Page() {
  const recipes = await getRecipes();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">
        Chocolate chip cookies
      </h1>
      <p className="mt-2 max-w-prose text-sm text-neutral-600 dark:text-neutral-400">
        Recipes disagree about butter, sugar and flour on purpose, because the
        amounts decide how the cookie comes out. Say how you want yours and
        this picks one.
      </p>

      <div className="mt-10">
        <Picker recipes={recipes} />
      </div>

      <footer className="mt-20 border-t border-neutral-200 pt-6 text-xs text-neutral-500 dark:border-neutral-800">
        Measurements are read from each recipe&apos;s own structured data and
        converted to grams. The texture prediction is a heuristic from published
        baking science, not a measurement, which is why the reasoning is shown
        rather than just the answer.
      </footer>
    </main>
  );
}
