import Image from "next/image";
import type { Interpretation, Texture } from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import { SaveButton } from "./SaveButton";
import { WhyThisOne } from "./WhyThisOne";

/**
 * The answer: one recipe, and the evidence for it.
 *
 * Deliberately NOT marked "use client", though it renders two components that
 * are. That lets the signed-out example render on the server -- where it is
 * the only thing a new visitor has to look at -- while the signed-in picker
 * still imports it into the browser bundle for instant re-ranking. A component
 * with no hooks and no event handlers of its own can live in both worlds, and
 * this one has neither.
 */
export function Recommendation({
  recipe,
  want,
  all,
  query,
  interpretation,
  compact = false,
}: {
  recipe: ScoredRecipe;
  /** Null when the query was only about effort, e.g. "quick". */
  want: Texture | null;
  all: ScoredRecipe[];
  /** Stored with the save: a better reminder than the title alone. */
  query: string;
  /** Drives which evidence is shown. Null in the signed-out example. */
  interpretation: Interpretation | null;
  /** The signed-out example: a preview, not the real thing. */
  compact?: boolean;
}) {
  const withRatios = all.filter((r) => r.scores.ratios !== null);
  const mine = recipe.scores.ratios;

  const grams = (n: number) => `${Math.round(n * 100)} g`;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <article className="mt-8 overflow-hidden rounded-3xl border-2 border-clay-deep bg-paper">
      <div
        className={
          compact
            ? "grid gap-0 md:grid-cols-[14rem_minmax(0,1fr)]"
            : "grid gap-0 md:grid-cols-[minmax(0,1fr)_1.15fr]"
        }
      >
        {recipe.image_url && (
          <div
            className={
              compact
                ? "relative aspect-[4/3] md:aspect-auto"
                : "relative aspect-[4/3] md:aspect-auto md:min-h-[22rem]"
            }
          >
            <Image
              src={recipe.image_url}
              alt=""
              fill
              // Must match what it actually renders at, or Next picks a file
              // too small and the browser upscales it. The compact preview is
              // a 14rem column; the full card is ~40% of a 64rem page.
              sizes={compact ? "(max-width: 768px) 100vw, 224px" : "(max-width: 768px) 100vw, 420px"}
              quality={90}
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* A fixed viewport at md+, scrolling inside. Opening Ingredients used
            to add its height to the card -- capping it at 16rem only made the
            growth smaller, not absent. Now the card is always the height of
            its photograph and the content scrolls within. Stacked on mobile,
            where a fixed height would be wrong. */}
        <div
          className={
            compact
              ? "p-5"
              : "p-6 md:h-[22rem] md:overflow-y-auto md:p-8"
          }
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-clay-deep">
            {compact ? "For example" : "Make this one"}
          </p>

          <h2 className={compact ? "mt-2 text-lg font-bold leading-tight tracking-tight" : "mt-2 text-2xl font-bold leading-tight tracking-tight"}>
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-pink decoration-2 underline-offset-4 hover:decoration-clay-deep"
            >
              {recipe.title}
            </a>
          </h2>

          {!compact && (
            <div className="mt-4">
              <SaveButton recipeId={recipe.id} savedFor={query.trim() || undefined} />
            </div>
          )}

          {recipe.dish_type && (
            <p className="mt-3 inline-block rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-ink-soft">
              {recipe.dish_type}
            </p>
          )}

          <p className="mt-4 text-sm text-ink-soft">
            {recipe.source_name}
            {recipe.rating !== null && ` · ${recipe.rating}★`}
            {recipe.rating_count !== null && ` (${recipe.rating_count})`}
            {recipe.yield_count !== null && ` · makes ${recipe.yield_count}`}
          </p>

          <div className="mt-6">
            <WhyThisOne
              recipe={recipe}
              all={all}
              interpretation={interpretation}
              want={want}
              only={compact ? 1 : undefined}
            />
          </div>

          {recipe.scores.confidence === "low" && (
            <p className="mt-4 text-xs text-ink-faint">
              Much of this ingredient list couldn&apos;t be read, so this is a
              weaker guess.
            </p>
          )}

          {!compact && (
          <details className="mt-6">
            {/* py-3 gets this to a 44px tap target. The proposal's own words:
                "That rules out small tap targets" -- and a 20px summary in a
                kitchen is exactly that. */}
            <summary className="-mx-2 cursor-pointer rounded-lg px-2 py-3 text-sm font-medium text-clay-deep hover:bg-cream-deep">
              Ingredients
            </summary>
            {/* Bounded, with its own scroll. Twenty ingredient rows used to
                grow the card by their full height. Top-aligning the columns
                stopped that but left dead space beside a taller content
                column, so the image stretches as before and the cap is what
                keeps the growth in hand. */}
            <div className="mt-3 max-h-64 overflow-y-auto pr-1">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {recipe.ingredients.map((i) => (
                  <tr key={i.position} className="border-b border-line-soft last:border-0">
                    <td className="py-1.5 pr-3">{i.raw_text}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-soft">
                      {/* null is not zero. An unconvertible ingredient has no
                          weight; it must not read as weighing nothing. */}
                      {i.grams === null ? "—" : `${i.grams} g`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>
          )}
        </div>
      </div>
    </article>
  );
}
