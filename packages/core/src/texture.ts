/**
 * Ratios plus mixing method, to a predicted texture.
 *
 * This is a heuristic, not a measurement, and the app must never pretend
 * otherwise. The levers below are consistent across King Arthur, America's
 * Test Kitchen and Preppy Kitchen, but the sources openly disagree on some of
 * them -- bread flour's effect on chew is contested, with plenty of bakers
 * reporting no difference in side-by-side trials. So this returns the signals
 * it used alongside the scores, and the interface shows them. A baker who can
 * see "all brown sugar, melted butter" can disagree with the conclusion; a
 * baker shown only "chewy: 0.81" cannot.
 *
 * Scores are 0-1 and are NOT probabilities. They rank recipes against each
 * other within a corpus. Comparing a score across different dishes would be
 * meaningless.
 */

import type { ParsedIngredient } from "./units.ts";
import { DISH_WINDOWS, OVERALL_WINDOW, type Window } from "./windows.ts";

export type Texture = "chewy" | "cakey" | "crispy";
export type Method = "melted" | "creamed" | "other";

export interface Signal {
  /** Shown to a person, so it has to read as a sentence fragment. */
  label: string;
  value: string;
  leans: Texture;
  /** 0-1. How hard this signal pushes. Drives ordering in the UI. */
  strength: number;
}

/**
 * The ratios the scoring ran on, handed back so the interface can plot where
 * one recipe sits among the others. Null when there was no flour to divide by.
 *
 * Everything is per gram of flour, which is the only way thirteen recipes at
 * different yields become comparable at all -- a recipe making 24 cookies and
 * one making 60 are not comparable by absolute grams of butter.
 */
export interface Ratios {
  fatPerFlour: number;
  sugarPerFlour: number;
  /** Brown as a fraction of all sugar, 0-1. */
  brownShare: number;
}

export interface TextureScores {
  chewy: number;
  cakey: number;
  crispy: number;
  ratios: Ratios | null;
  signals: Signal[];
  /**
   * "low" when the ingredient list was too incomplete to say much. A low
   * confidence recipe should not be recommended over a high confidence one on
   * a hair's-breadth score difference.
   */
  confidence: "high" | "low";
}

export interface TextureInput {
  ingredients: ParsedIngredient[];
  method: Method | null;
  chillsDough: boolean;
  /**
   * Which kind of thing this is. Decides the range the ratios are scored
   * against; see windowFor. Omitted means the whole corpus, which is what the
   * pipeline uses before a dish has been classified.
   */
  dishType?: string | null;
}

/**
 * How much a category's own window is trusted, in recipes.
 *
 * A category with K recipes is trusted half its own way and half the corpus's.
 * 30 puts chocolate chip at 84% its own, oatmeal 70%, peanut butter 61%, sugar
 * 50%, snickerdoodle 25%, which matches how stable each one measured: relative
 * to its own span, the ceiling moves 0.4% for chocolate chip and 13% for sugar
 * when you resample half of it.
 */
const TRUST = 30;

/**
 * The range this recipe's ratios are scored across.
 *
 * One global window was wrong in a way that showed: measured over everything it
 * is 0.54 to 1.26 of fat per flour, but chocolate chip actually runs 0.50 to
 * 0.95 and peanut butter 0.69 to 1.72. So a chocolate chip recipe could never
 * reach a high fat score, because the ceiling it was measured against belonged
 * to a different cookie.
 *
 * Per-category windows alone are not the answer either: a 10th-to-90th
 * percentile taken over ten snickerdoodles is mostly noise. So a category's
 * window is shrunk toward the corpus-wide one in proportion to how many
 * recipes it was measured over, which needs no threshold and improves on its
 * own as the corpus grows.
 *
 * The levers themselves do not change. More fat per flour still means chewier
 * everywhere; this only decides what counts as "more" for the kind of thing
 * you are baking, which is the part that is not universal.
 */
function windowFor(dishType: string | null | undefined): Window {
  const own = dishType ? DISH_WINDOWS[dishType] : undefined;
  if (!own) return OVERALL_WINDOW;

  const w = own.n / (own.n + TRUST);
  const blend = (a: number, b: number) => w * a + (1 - w) * b;
  return {
    n: own.n,
    fat: [blend(own.fat[0], OVERALL_WINDOW.fat[0]), blend(own.fat[1], OVERALL_WINDOW.fat[1])],
    sugar: [
      blend(own.sugar[0], OVERALL_WINDOW.sugar[0]),
      blend(own.sugar[1], OVERALL_WINDOW.sugar[1]),
    ],
  };
}

/** Clamp v into 0-1 across the range lo..hi. */
function norm(v: number, lo: number, hi: number): number {
  if (hi === lo) return 0;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Total grams for a set of canonical names. Nulls are skipped, not zeroed. */
function gramsOf(ings: ParsedIngredient[], names: string[]): number {
  let total = 0;
  for (const i of ings) {
    if (i.grams === null || i.canonicalName === null) continue;
    if (names.includes(i.canonicalName)) total += i.grams;
  }
  return total;
}

/** Fats, each counted at how much of it behaves like butter. */
function fatEquivalentGrams(ings: ParsedIngredient[]): number {
  let total = 0;
  for (const i of ings) {
    if (i.grams === null || i.canonicalName === null) continue;
    const weight = FAT_EQUIVALENT[i.canonicalName];
    if (weight !== undefined) total += i.grams * weight;
  }
  return total;
}

const FLOURS = ["flour", "bread flour", "cake flour", "whole wheat flour"];

/**
 * How much of each fat is actually fat.
 *
 * Peanut butter was counted at its full weight, like butter, and that is what
 * put a recipe on the signed-out page claiming 263 g of butter per 100 g of
 * flour -- off the end of an axis that stops at 230. Commercial peanut butter
 * is around half fat by weight; the rest is protein, fibre and sugar, which
 * behave more like the dry side of the recipe than like shortening. Counting
 * all 202 g of it as fat makes a peanut butter cookie incomparable with a
 * butter cookie, and that is how one came to win a "chewy" query against 313
 * recipes that actually are buttery.
 *
 * Butter, oil, shortening and margarine stay at 1. Butter really is only
 * about 81% fat, but the ratio is read as "butter per 100 g flour" and the
 * scale below is calibrated in those terms, so butter is the unit rather than
 * pure fat. The number this produces is butter-equivalent, not lipid.
 *
 * Deliberately not reassigning peanut butter's other half to the flour side.
 * It would arguably be more accurate -- the protein does some of flour's
 * structural work -- but "arguably" is doing a lot of work in that sentence,
 * and this file already says it is a heuristic. Halving the fat fixes a
 * number that was plainly wrong; the rest is a guess about baking chemistry I
 * cannot check against the corpus.
 */
const FAT_EQUIVALENT: Record<string, number> = {
  butter: 1,
  margarine: 1,
  shortening: 1,
  oil: 1,
  "peanut butter": 0.5,
  // Biscoff is about 30% fat; the rest is biscuit, which is to say flour and
  // sugar that have already been baked once.
  "cookie butter": 0.3,
};

// Not here, deliberately: "peanut butter chips" and "chocolate chips". They
// are inclusions. A cookie studded with peanut butter chips is not a fattier
// cookie, it is a cookie with sweets in it, and the dough around them is
// whatever the dough is.

export function scoreTexture(input: TextureInput): TextureScores {
  const { ingredients, method, chillsDough, dishType } = input;

  const flour = gramsOf(ingredients, FLOURS);
  const fat = fatEquivalentGrams(ingredients);
  const brown = gramsOf(ingredients, ["brown sugar"]);
  const white = gramsOf(ingredients, ["sugar", "powdered sugar"]);
  const yolk = gramsOf(ingredients, ["egg yolk"]);
  const whiteEgg = gramsOf(ingredients, ["egg white"]);
  const wholeEgg = gramsOf(ingredients, ["egg"]);

  const sugar = brown + white;
  const egg = yolk + whiteEgg + wholeEgg;

  // Without flour there is no ratio to compute and nothing honest to say.
  if (flour === 0) {
    return { chewy: 0, cakey: 0, crispy: 0, ratios: null, signals: [], confidence: "low" };
  }

  const brownShare = sugar > 0 ? brown / sugar : 0;
  const fatRatio = fat / flour;
  const sugarRatio = sugar / flour;
  // A whole egg is about 36% yolk by weight, so a recipe with extra yolks
  // reads above that baseline.
  const yolkShare = egg > 0 ? (yolk + wholeEgg * 0.36) / egg : 0.36;

  // The window comes from windows.ts, measured over the corpus, shrunk toward
  // the corpus-wide one for a thin category. See windowFor. It used to be two
  // hard-coded pairs here, re-measured by hand each time the corpus moved,
  // which is how they came to be wrong twice.
  const window = windowFor(dishType);
  const fatN = norm(fatRatio, window.fat[0], window.fat[1]);
  const sugarN = norm(sugarRatio, window.sugar[0], window.sugar[1]);

  const melted = method === "melted" ? 1 : 0;
  const creamed = method === "creamed" ? 1 : 0;

  /**
   * Two changes here, both from measuring what the terms actually paid out.
   *
   * "NOT yolks" is gone. It gave cakey 0.15 for every recipe without extra
   * yolks, which is most of them, and the absence of evidence for chewiness is
   * not evidence for cakeyness. Its median contribution was the full 0.15
   * while the matching chewy term's was 0.000.
   *
   * And the method weights are nearly swapped. Creaming is what you do unless
   * you decided otherwise: 74% of this corpus creams, so it is weak evidence,
   * and at 0.35 it handed three quarters of the corpus the largest single term
   * in the formula. Melting is a decision, 14% of the corpus, so it is strong
   * evidence and was underweighted at 0.25. The freed weight goes to the two
   * cakey terms that are real signals rather than absences: a cookie low in
   * brown sugar and low in fat genuinely is cakier.
   *
   * Together these took the median cakey score from 0.72 against chewy's 0.31.
   */
  const yolkN = norm(yolkShare, 0.36, 0.7);
  const chewy = round2(0.30 * brownShare + 0.30 * melted + 0.25 * fatN + 0.15 * yolkN);
  const cakey = round2(0.15 * creamed + 0.45 * (1 - brownShare) + 0.40 * (1 - fatN));
  const crispy = round2(
    0.30 * (1 - brownShare) + 0.30 * sugarN + 0.25 * fatN + 0.15 * (chillsDough ? 0 : 1),
  );

  // Ordered strongest first, so the interface can show the top two or three
  // and drop the rest without choosing arbitrarily.
  const signals: Signal[] = [];

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (sugar > 0) {
    signals.push(
      brownShare >= 0.5
        ? {
            label: "Brown sugar",
            value: `${pct(brownShare)} of the sugar`,
            leans: "chewy",
            strength: brownShare,
          }
        : {
            label: "White sugar",
            value: `${pct(1 - brownShare)} of the sugar`,
            leans: "crispy",
            strength: 1 - brownShare,
          },
    );
  }

  if (method === "melted") {
    signals.push({
      label: "Melted butter",
      value: "no creaming",
      leans: "chewy",
      strength: 0.8,
    });
  } else if (method === "creamed") {
    signals.push({
      label: "Creamed butter",
      value: "air beaten in",
      leans: "cakey",
      strength: 0.8,
    });
  }

  signals.push({
    label: "Fat to flour",
    value: `${fatRatio.toFixed(2)} to 1`,
    leans: fatN >= 0.5 ? "chewy" : "cakey",
    strength: Math.abs(fatN - 0.5) * 2,
  });

  signals.push({
    label: "Sugar to flour",
    value: `${sugarRatio.toFixed(2)} to 1`,
    leans: sugarN >= 0.5 ? "crispy" : "cakey",
    strength: Math.abs(sugarN - 0.5) * 2,
  });

  if (yolkShare > 0.45) {
    signals.push({
      // Every other signal says what the thing does to the cookie -- "air
      // beaten in", "spreads less", "no creaming". "53% yolk by weight" was
      // a number with no feel to it, so it read as noise beside them.
      label: "Extra yolks",
      value: "richer, more chew",
      leans: "chewy",
      strength: norm(yolkShare, 0.36, 0.7),
    });
  }

  if (chillsDough) {
    signals.push({
      label: "Dough is chilled",
      value: "spreads less",
      leans: "cakey",
      strength: 0.5,
    });
  }

  signals.sort((a, b) => b.strength - a.strength);

  // Enough of the list has to have resolved for the ratios to mean anything.
  const resolved = ingredients.filter((i) => i.grams !== null).length;
  const confidence: "high" | "low" =
    ingredients.length > 0 && resolved / ingredients.length >= 0.8 && fat > 0 && sugar > 0
      ? "high"
      : "low";

  return {
    chewy, cakey, crispy, signals, confidence,
    ratios: { fatPerFlour: fatRatio, sugarPerFlour: sugarRatio, brownShare },
  };
}

/**
 * Rank a corpus for a wanted texture.
 *
 * Confidence beats a narrow score win: a recipe whose ingredients barely
 * parsed should not out-rank a fully resolved one on 0.02 of score, because
 * that 0.02 is noise from the missing data rather than a real difference.
 */
export function rankFor<T extends { scores: TextureScores }>(
  items: T[],
  want: Texture,
): T[] {
  return [...items].sort((a, b) => {
    if (a.scores.confidence !== b.scores.confidence) {
      return a.scores.confidence === "high" ? -1 : 1;
    }
    return b.scores[want] - a.scores[want];
  });
}
