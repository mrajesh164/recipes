import { SignUpButton } from "@clerk/nextjs";
import { interpret, matchScore } from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import { asRankable } from "@/lib/rankable";
import { Recommendation } from "./Recommendation";

/**
 * What a signed-out visitor sees.
 *
 * Previously this was a pitch and then a wall of cookie photographs, which
 * showed that the app has recipes but not what it does with them. The ratios
 * are the actual product, so they go here: a real recommendation for a real
 * query, rendered by the same component the signed-in page uses, so the demo
 * cannot drift from the thing it is demonstrating.
 */
export function Example({ recipes }: { recipes: ScoredRecipe[] }) {
  const demo = interpret("chewy");
  const best = [...recipes].sort(
    (a, b) => matchScore(asRankable(b), demo) - matchScore(asRankable(a), demo),
  )[0];

  return (
    <div>
      <div className="rounded-3xl border-2 border-clay-deep bg-paper px-6 py-5 md:px-8">
        <h2 className="text-xl font-bold leading-snug tracking-tight">
          Every cookie recipe is a little different. This helps you find yours.
        </h2>
        <ol className="mt-4 space-y-2 text-sm text-ink-soft">
          <li>
            <span className="font-semibold text-ink">Say how you want them.</span>{" "}
            Chewy, cakey, crispy edges, quick, no mixer.
          </li>
        </ol>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="mt-4 rounded-full bg-clay-deep px-6 py-3 font-semibold text-paper hover:bg-clay"
          >
            Sign up to try it
          </button>
        </SignUpButton>
      </div>

      <p className="mt-8 text-sm font-medium text-ink-soft">
        For instance, if you say &ldquo;chewy&rdquo;:
      </p>

      {best && (
        <Recommendation
          recipe={best}
          want="chewy"
          all={recipes}
          query="chewy"
          interpretation={demo}
          compact
        />
      )}
    </div>
  );
}
