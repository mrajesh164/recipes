"use client";

import { reviewQuotes, effortFor, type Interpretation, type Texture } from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import type { RatioDistribution } from "@/lib/ratios";
import { RangePlot, positionOf } from "./RangePlot";

/**
 * The evidence behind a recommendation, matched to what was actually asked.
 *
 * This used to always show ingredient ratios. But someone who types "quick, no
 * mixer" is not asking about butter-per-flour -- they are asking about effort,
 * and answering with a ratio plot answers a question they did not ask. So the
 * reasons shown follow the query: effort first when effort was asked about,
 * ratios when texture was, both when both.
 *
 * Shared by the recommendation, the signed-out example, and the compare dialog,
 * so all three explain themselves the same way and cannot drift apart.
 */

export function WhyThisOne({
  recipe,
  distribution,
  interpretation,
  want,
  heading = true,
}: {
  recipe: ScoredRecipe;
  /**
   * Three arrays of numbers, not the corpus. This is a client component, so
   * anything here is serialised into the page; the plots never needed more
   * than the ratios, and the corpus is 1,385 rows of everything else.
   */
  distribution: RatioDistribution;
  /** Null in the dialog, where nothing was asked -- then ratios are the default. */
  interpretation: Interpretation | null;
  want: Texture | null;
  heading?: boolean;
}) {
  const prefs = interpretation?.prefs;
  const askedEffort = Boolean(prefs?.quick || prefs?.easy || prefs?.popular);
  const askedTexture = want !== null;
  // With no query at all (the dialog), the ratios are the interesting thing.
  const showRatios = askedTexture || !askedEffort;

  const mine = recipe.scores.ratios;

  // Empty in the detail panel, where nothing was asked, so there is no word to
  // look for and nothing to quote.
  const quotes = interpretation ? reviewQuotes(recipe.reviews, interpretation, 3) : [];
  const grams = (n: number) => `${Math.round(n * 100)} g`;

  /**
   * The denominator is in the string, not assumed.
   *
   * The other two ratios carry theirs in the label: "Butter per 100 g flour",
   * and then "132 g" needs no explanation. Brown sugar had the label "Brown
   * sugar" and the value "79%", which left the obvious question unanswered,
   * 79% of what. It is 79% of the sugar in the recipe, and the only place that
   * fact can live is next to the number.
   */
  const shareOfSugar = (n: number) => `${Math.round(n * 100)}% of the sugar`;

  /**
   * One ratio, not three.
   *
   * Three stacked plots asked a reader to compare three things before learning
   * anything, and two of them are usually beside the point: a cookie that won
   * "chewy" won it on butter, and its sugar ratio sitting mid-range is not the
   * reason. The lead is whichever ratio this recipe is furthest from the
   * middle on, because that is the one with something to say. The other two
   * are a click away rather than gone, which is the same bargain the effort
   * reasons already strike.
   */
  const plots = mine
    ? [
        {
          label: "Butter per 100 g flour",
          hint: "more = chewier",
          values: distribution.fatPerFlour,
          picked: mine.fatPerFlour,
          format: grams,
        },
        {
          label: "Brown sugar",
          hint: "more = chewier, softer",
          values: distribution.brownShare,
          picked: mine.brownShare,
          format: shareOfSugar,
        },
        {
          label: "Sugar per 100 g flour",
          hint: "more = crispier",
          values: distribution.sugarPerFlour,
          picked: mine.sugarPerFlour,
          format: grams,
        },
      ]
    : [];

  const ranked = [...plots].sort(
    (a, b) =>
      Math.abs(positionOf(b.values, b.picked) - 50) -
      Math.abs(positionOf(a.values, a.picked) - 50),
  );
  const lead = ranked[0];
  const rest = ranked.slice(1);

  return (
    <div>
      {heading && (
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
          Why this one
        </h3>
      )}

      {/* A reviewer using the reader's own word, where one did.
 
          This leads, above the ratios, because it is the only evidence here
          that is not inferred. Everything else on this card is read off an
          ingredient list -- butter per flour, brown sugar share, creamed or
          melted -- and says what the recipe should do. A review says what it
          did, in the words of somebody who baked it.
 
          Only words the reader actually typed are matched, and a negated
          mention is skipped, so this cannot answer "chewy" with a review
          praising the crisp edges or one complaining there was no chew. */}
      {quotes.length > 0 && (
        <figure className="mb-3 rounded-xl bg-cream-deep px-4 py-3">
          {quotes.map((q) => {
            // Highlight the word that made this a reason, in the reviewer's
            // own sentence, so the match is visible rather than asserted.
            const at = q.text.toLowerCase().indexOf(q.word.toLowerCase());
            return (
              <blockquote
                key={q.text}
                className="text-sm leading-snug text-ink [&+&]:mt-2 [&+&]:border-t
                           [&+&]:border-line-soft [&+&]:pt-2"
              >
                &ldquo;{at >= 0 ? q.text.slice(0, at) : q.text}
                {at >= 0 && (
                  <strong className="font-bold text-clay-deep">
                    {q.text.slice(at, at + q.word.length)}
                  </strong>
                )}
                {at >= 0 ? q.text.slice(at + q.word.length) : ""}&rdquo;
              </blockquote>
            );
          })}
          <figcaption className="mt-1.5 text-xs text-ink-faint">
            {quotes.length === 1 ? "from a review of this recipe" : `from ${quotes.length} reviews of this recipe`}
          </figcaption>
        </figure>
      )}

      {askedEffort && prefs && <EffortReasons recipe={recipe} prefs={prefs} />}

      {showRatios && lead && (
        <div className={askedEffort ? "mt-3" : "mt-1"}>
          <RangePlot {...lead} />

          <details className="group mt-1 border-t border-line-soft">
            <summary
              className="-mx-2 cursor-pointer list-none rounded-lg px-2 py-2.5 text-xs
                         font-semibold text-clay-deep hover:bg-cream-deep
                         [&::-webkit-details-marker]:hidden"
            >
              <span className="group-open:hidden">Show the other two ratios</span>
              <span className="hidden group-open:inline">Hide them</span>
            </summary>
            <div className="divide-y divide-line-soft">
              {rest.map((pl) => (
                <RangePlot key={pl.label} {...pl} />
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * Effort answers: tools, time and faff.
 *
 * Honest in both directions. If you asked for quick and the pick still needs
 * chilling, that is said plainly rather than omitted -- it was still the best
 * match overall, and hiding the one drawback is how a recommendation stops
 * being trustworthy.
 */
function EffortReasons({
  recipe,
  prefs,
}: {
  recipe: ScoredRecipe;
  prefs: Interpretation["prefs"];
}) {
  const reasons: { good: boolean; label: string }[] = [];

  /**
   * Typical for this kind of thing, the same figures the ranking uses.
   *
   * These were two constants here, 12 ingredients and 18 minutes, measured
   * over the whole corpus. That was already better than the cookie-era bars
   * they replaced, but it still told a banana bread it took longer than most
   * when most banana breads take 55 minutes. The label and the ranking now
   * read the same per-dish medians, so they cannot disagree about what counts
   * as quick.
   */
  const typical = effortFor(recipe.dish_type);

  if (prefs.quick) {
    reasons.push(
      recipe.chills_dough
        ? { good: false, label: "Does need chilling" }
        : { good: true, label: "No chilling, straight in the oven" },
    );
    if (recipe.bake_minutes !== null) {
      const quick = recipe.bake_minutes <= typical.bakeMinutes;
      reasons.push({
        good: quick,
        label: quick
          ? `${recipe.bake_minutes} minutes to bake, on the quick side`
          : `${recipe.bake_minutes} minutes to bake, longer than most`,
      });
    }
  }

  if (prefs.easy) {
    if (recipe.method === "melted") {
      reasons.push({ good: true, label: "Melted butter, no mixer needed" });
    } else if (recipe.method === "creamed") {
      reasons.push({ good: false, label: "Creamed butter, you'll want a mixer" });
    }
    const n = recipe.ingredients.length;
    const short = n <= typical.ingredients;
    reasons.push({
      good: short,
      label: short
        ? `${n} ingredients, a short list`
        : `${n} ingredients, more than most`,
    });
  }

  if (prefs.popular && recipe.rating !== null) {
    reasons.push({
      good: recipe.rating >= 4,
      label: `${recipe.rating} stars${recipe.rating_count !== null ? ` from ${recipe.rating_count}` : ""}`,
    });
  }

  if (reasons.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {reasons.map((r) => (
        <li key={r.label} className="flex items-start gap-2.5 text-sm">
          <span
            aria-hidden
            className={[
              "mt-[3px] grid h-4 w-4 flex-none place-items-center rounded-full text-xs font-bold",
              // ink-soft, not ink-faint: faint on cream-deep is 4.11, under AA.
              r.good ? "bg-sage-deep text-paper" : "bg-cream-deep text-ink-soft",
            ].join(" ")}
          >
            {r.good ? "✓" : "!"}
          </span>
          <span className={r.good ? "" : "text-ink-soft"}>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
