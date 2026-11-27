import { getRecipes } from "@/lib/recipes";
import { Picker } from "@/components/Picker";

export const metadata = { title: "Find a recipe · The Perfect Batch" };

/**
 * The core task, on its own route.
 *
 * It used to live on "/", with the landing content and the search competing
 * for the same page. Splitting them means the front door can explain what the
 * app does, which matters more as there are more things it does, and this page
 * can be only the tool.
 *
 * No Suspense and no <Show> here. proxy.ts allows "/" and the sign-in routes
 * and protects everything else, so a signed-out request never reaches this
 * page: it is redirected to sign-in. The gate does the work the auth check
 * used to do inline.
 */
export default async function Page() {
  const recipes = await getRecipes();

  return (
    <>
      <div className="scallop" aria-hidden />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-10">
        <Picker recipes={recipes} />
      </main>
    </>
  );
}
