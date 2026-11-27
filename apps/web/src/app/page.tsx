import { Suspense } from "react";
import { Show } from "@clerk/nextjs";
import { getRecipes } from "@/lib/recipes";
import { Example } from "@/components/Example";
import { FeatureCards } from "@/components/FeatureCards";

/**
 * The front door, and the only page that says the name.
 *
 * The search used to live here, which meant this page had to be both the
 * explanation and the tool, and the name appeared twice because the header
 * wordmark said it as well. The tool moved to /find and the wordmark became a
 * "Home" link, so the name is said once, here, at full size.
 *
 * This page stays public. proxy.ts protects everything except "/" and the
 * sign-in routes, so a visitor can read what the app does and see a real
 * recommendation before being asked for an account, and the task itself is
 * still behind the gate.
 */
export default async function Page() {
  const recipes = await getRecipes();

  return (
    <>
      <div className="scallop" aria-hidden />

      {/* The textured band is its own full-bleed element, outside <main>.
 
          It used to be a child of <main> with -mx-6 to break out sideways,
          which could not work: <main> is a centred max-w-5xl box with px-6 and
          pt-12, so the band inherited a 48px cream strip above it and, on any
          viewport wider than the measure, cream down both sides. That is a
          bare border around the title on all four sides, and no change to the
          tile can reach it -- the gap is outside the element the tile paints.
          Here the band spans the viewport and sits flush under the scallop,
          and the measure is restored by an inner centred box, so the padding
          that keeps the title off the edges is inside the texture rather than
          carved out of it. */}
      <div className="sprinkled-field">
        <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-10">
          <h1 className="font-script text-hero font-bold text-clay-deep">
            The Perfect Batch
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-ink-soft">
            Every cookie recipe is a little different, on purpose. This weighs{" "}
            {recipes.length} of them in grams so they can be compared at all,
            and picks the one you asked for.
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
        <div className="dotted-rule" aria-hidden />

        <FeatureCards recipes={recipes} />

        {/* A visitor gets a real recommendation to look at before signing up,
            rendered by the same component the tool uses so the demo cannot
            drift from the thing it demonstrates. */}
        <Suspense fallback={<ExampleSkeleton />}>
          <Show when="signed-out">
            <div className="mt-14">
              <Example recipes={recipes} />
            </div>
          </Show>
        </Suspense>
      </main>
    </>
  );
}

function ExampleSkeleton() {
  return (
    <div className="mt-14 animate-pulse">
      <div className="h-7 w-72 rounded-lg bg-cream-deep" />
      <div className="mt-6 h-56 w-full rounded-3xl bg-cream-deep" />
    </div>
  );
}
