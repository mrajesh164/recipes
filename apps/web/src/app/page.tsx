import { getRecipes } from "@/lib/recipes";
import { Picker } from "@/components/Picker";

export default async function Page() {
  const recipes = await getRecipes();

  return (
    <>
      <div className="scallop" aria-hidden />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <header className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink-deep">
            Chocolate chip cookies
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Which recipe should you actually bake?
          </h1>
          <p className="mt-4 text-ink-soft">
            Recipes disagree about butter, sugar and flour on purpose, because
            those amounts decide how the cookie turns out. Say how you want yours
            and this picks one, and shows you why.
          </p>
        </header>

        <div className="mt-12">
          <Picker recipes={recipes} />
        </div>

        <footer className="mt-24">
          <div className="dotted-rule" aria-hidden />
          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink-faint">
            Measurements are read from each recipe&apos;s own structured data and
            converted to grams, so thirteen recipes at different yields can be
            compared at all. The texture prediction is a heuristic drawn from
            published baking science, not a measurement — which is why the
            reasoning is shown rather than just the answer. Every recipe links
            back to the person who wrote it.
          </p>
        </footer>
      </main>
    </>
  );
}
