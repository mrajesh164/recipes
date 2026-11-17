import { getRecipes } from "@/lib/recipes";
import { Picker } from "@/components/Picker";

export default async function Page() {
  const recipes = await getRecipes();

  return (
    <>
      <div className="scallop" aria-hidden />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <header className="max-w-2xl">
          <h1 className="font-script text-6xl font-bold leading-[1.05] text-clay-deep sm:text-7xl">
            The Perfect Batch
          </h1>
        </header>

        <div className="mt-12">
          <Picker recipes={recipes} />
        </div>

      </main>
    </>
  );
}
