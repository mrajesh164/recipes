import { getRecipes } from "@/lib/recipes";
import { RecipeGrid } from "@/components/RecipeGrid";

export const metadata = { title: "All recipes · The Perfect Batch" };

export default async function Page() {
  const recipes = await getRecipes();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-6">
      <h1 className="font-script text-display font-bold text-clay-deep">
        All recipes
      </h1>
      <p className="mt-3 max-w-prose text-sm text-ink-soft">
        Every one is a real published recipe. Open any to see where it sits
        against the others.
      </p>

      <div className="mt-8">
        <RecipeGrid recipes={recipes} />
      </div>
    </main>
  );
}
