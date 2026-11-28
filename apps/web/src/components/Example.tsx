import { SignUpButton } from "@clerk/nextjs";
import { interpret, matchScore, candidatesFor } from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import { ratioDistribution } from "@/lib/ratios";
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
  /**
   * Filtered before ranked, exactly as the real tool does it.
   *
   * This sorted the whole corpus and took the top row, skipping the dish
   * filter that Picker applies first -- so a demo query naming a dish got an
   * answer from the wrong one. "chewy oatmeal" returned Baklava Blondies here
   * and Oatmeal Cookies in the tool. The comment above says the demo cannot
   * drift from the thing it demonstrates; that was true of the rendering and
   * not of the ranking.
   */
  const best = [...candidatesFor(recipes, demo)].sort(
    (a, b) => matchScore(asRankable(b), demo) - matchScore(asRankable(a), demo),
  )[0];

  /**
   * Three arrays of numbers, not 1,385 recipes.
   *
   * This page is public and renders a real recommendation, which needs the
   * rest of the corpus to say where the picked recipe sits -- but only its
   * ratios. Emptying each recipe's ingredient list got this page from 4.6 MB
   * to 1.5 MB; sending the ratios alone and nothing else gets it to a few
   * hundred kilobytes, because the 1,385 rows of metadata go too.
   */
  const distribution = ratioDistribution(recipes);

  return (
    <div>
      <div className="rounded-3xl border-2 border-clay-deep bg-paper px-6 py-5 md:px-8">
        <h2 className="text-xl font-bold leading-snug tracking-tight">
          Every recipe is a little different. This helps you find yours.
        </h2>
        <ol className="mt-4 space-y-2 text-sm text-ink-soft">
          <li>
            <span className="font-semibold text-ink">Say how you want it.</span>{" "}
            Chewy, cakey, crispy edges, quick, no mixer.
          </li>
        </ol>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="mt-4 rounded-full bg-clay-deep px-6 py-3 font-semibold text-paper transition hover:brightness-90"
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
          distribution={distribution}
          query="chewy"
          interpretation={demo}
          compact
        />
      )}
    </div>
  );
}
