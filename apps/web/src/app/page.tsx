import { Suspense } from "react";
import { Show } from "@clerk/nextjs";
import { getRecipes } from "@/lib/recipes";
import { Picker } from "@/components/Picker";
import { Example } from "@/components/Example";

export default async function Page() {
  const recipes = await getRecipes();

  return (
    <>
      <div className="scallop" aria-hidden />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <header className="max-w-2xl">
          <h1 className="font-script text-display font-bold text-clay-deep">
            The Perfect Batch
          </h1>
        </header>

        {/* Which half to draw is decided here, on the server, rather than by
            useAuth() in the browser.
 
            It used to be the client's call, and the cost was the whole page:
            <main> arrived holding 178 bytes -- the title and nothing else --
            and a new visitor looked at an empty page until the bundle hydrated
            and Clerk answered. The pitch they were waiting for does not depend
            on who they are, so there was nothing to wait for.
 
            The task stays behind sign-in. That is the point of the split: a
            visitor gets the real thing to look at immediately, and an account
            is what lets them drive it. */}
        <div className="mt-12">
          <Suspense fallback={<PageSkeleton />}>
            <Show when="signed-out">
              <Example recipes={recipes} />
            </Show>
            <Show when="signed-in">
              <Picker recipes={recipes} />
            </Show>
          </Suspense>
        </div>
      </main>
    </>
  );
}

/**
 * Holds the shape of the page while Clerk resolves, so the layout does not
 * jump once it does. Auth is runtime data and Cache Components will not
 * prerender a route that reads it outside a boundary, so the boundary is
 * required here rather than optional.
 */
function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-72 rounded-lg bg-cream-deep" />
      <div className="mt-5 h-16 w-full rounded-2xl bg-cream-deep" />
      <div className="mt-6 h-56 w-full rounded-3xl bg-cream-deep" />
    </div>
  );
}
