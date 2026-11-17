"use client";

import type { Interpretation, Texture } from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import { RangePlot } from "./RangePlot";

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
  all,
  interpretation,
  want,
  heading = true,
  only,
}: {
  recipe: ScoredRecipe;
  all: ScoredRecipe[];
  /** Null in the dialog, where nothing was asked -- then ratios are the default. */
  interpretation: Interpretation | null;
  want: Texture | null;
  heading?: boolean;
  /** Show only the first N plots. The signed-out preview shows one. */
  only?: number;
}) {
  const prefs = interpretation?.prefs;
  const askedEffort = Boolean(prefs?.quick || prefs?.easy || prefs?.popular);
  const askedTexture = want !== null;
  // With no query at all (the dialog), the ratios are the interesting thing.
  const showRatios = askedTexture || !askedEffort;

  const withRatios = all.filter((r) => r.scores.ratios !== null);
  const mine = recipe.scores.ratios;
  const grams = (n: number) => `${Math.round(n * 100)} g`;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div>
      {heading && (
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
          {askedEffort && !askedTexture
            ? "Why this one"
            : `Why this one, out of ${withRatios.length}`}
        </h3>
      )}

      {askedEffort && prefs && <EffortReasons recipe={recipe} prefs={prefs} />}

      {showRatios && mine && (
        <div className={askedEffort ? "mt-4 divide-y divide-line-soft" : "mt-1 divide-y divide-line-soft"}>
          <Fact
            label="Butter"
            value={
              recipe.method === "melted"
                ? "melted, not creamed"
                : recipe.method === "creamed"
                  ? "creamed, air beaten in"
                  : "not stated"
            }
            hint={
              recipe.method === "melted"
                ? "chewier"
                : recipe.method === "creamed"
                  ? "cakier"
                  : ""
            }
          />
          {only === undefined && recipe.chills_dough && (
            <Fact label="Dough" value="chilled before baking" hint="spreads less" />
          )}
          <RangePlot
            label="Butter per 100 g flour"
            hint="more = chewier"
            values={withRatios.map((r) => r.scores.ratios!.fatPerFlour)}
            picked={mine.fatPerFlour}
            format={grams}
          />
          {only === undefined && (
            <RangePlot
              label="Brown sugar"
              hint="more = chewier, softer"
              values={withRatios.map((r) => r.scores.ratios!.brownShare)}
              picked={mine.brownShare}
              format={pct}
            />
          )}
          {only === undefined && (
            <RangePlot
              label="Sugar per 100 g flour"
              hint="more = crispier"
              values={withRatios.map((r) => r.scores.ratios!.sugarPerFlour)}
              picked={mine.sugarPerFlour}
              format={grams}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A row shaped like a RangePlot, for the things that are not numbers.
 *
 * The butter method is the biggest texture lever that is not a ratio, so it
 * has to be on screen -- but it used to be a floating chip below the plots,
 * appearing for some recipes and not others with no heading. A set of badges
 * that comes and goes reads as decoration; the same fact as a labelled row in
 * the same list reads as evidence.
 */
function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm text-ink-soft">
        {value}
        {hint ? <span className="ml-2 text-xs italic text-ink-faint">{hint}</span> : null}
      </span>
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

  if (prefs.quick) {
    reasons.push(
      recipe.chills_dough
        ? { good: false, label: "Does need chilling" }
        : { good: true, label: "No chilling, straight in the oven" },
    );
    if (recipe.bake_minutes !== null) {
      reasons.push({
        good: recipe.bake_minutes <= 12,
        label: `${recipe.bake_minutes} minutes to bake`,
      });
    }
  }

  if (prefs.easy) {
    if (recipe.method === "melted") {
      reasons.push({ good: true, label: "Melted butter, no mixer needed" });
    } else if (recipe.method === "creamed") {
      reasons.push({ good: false, label: "Creamed butter, you'll want a mixer" });
    }
    reasons.push({
      good: recipe.ingredients.length <= 10,
      label: `${recipe.ingredients.length} ingredients`,
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
              "mt-[3px] grid h-4 w-4 flex-none place-items-center rounded-full text-[10px] font-bold",
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
