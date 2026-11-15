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

export interface TextureScores {
  chewy: number;
  cakey: number;
  crispy: number;
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

const FLOURS = ["flour", "bread flour", "cake flour", "whole wheat flour"];
const FATS = ["butter", "shortening", "oil", "peanut butter"];

export function scoreTexture(input: TextureInput): TextureScores {
  const { ingredients, method, chillsDough } = input;

  const flour = gramsOf(ingredients, FLOURS);
  const fat = gramsOf(ingredients, FATS);
  const brown = gramsOf(ingredients, ["brown sugar"]);
  const white = gramsOf(ingredients, ["sugar", "powdered sugar"]);
  const yolk = gramsOf(ingredients, ["egg yolk"]);
  const whiteEgg = gramsOf(ingredients, ["egg white"]);
  const wholeEgg = gramsOf(ingredients, ["egg"]);

  const sugar = brown + white;
  const egg = yolk + whiteEgg + wholeEgg;

  // Without flour there is no ratio to compute and nothing honest to say.
  if (flour === 0) {
    return { chewy: 0, cakey: 0, crispy: 0, signals: [], confidence: "low" };
  }

  const brownShare = sugar > 0 ? brown / sugar : 0;
  const fatRatio = fat / flour;
  const sugarRatio = sugar / flour;
  // A whole egg is about 36% yolk by weight, so a recipe with extra yolks
  // reads above that baseline.
  const yolkShare = egg > 0 ? (yolk + wholeEgg * 0.36) / egg : 0.36;

  // Ranges observed across chocolate chip cookie recipes. Anything outside
  // them clamps rather than extrapolating.
  const fatN = norm(fatRatio, 0.45, 0.95);
  const sugarN = norm(sugarRatio, 0.55, 1.15);

  const melted = method === "melted" ? 1 : 0;
  const creamed = method === "creamed" ? 1 : 0;

  const chewy = round2(
    0.30 * brownShare + 0.25 * melted + 0.25 * fatN + 0.20 * norm(yolkShare, 0.36, 0.7),
  );
  const cakey = round2(
    0.35 * creamed + 0.25 * (1 - brownShare) + 0.25 * (1 - fatN) + 0.15 * (1 - norm(yolkShare, 0.36, 0.7)),
  );
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
      label: "Extra yolks",
      value: `${pct(yolkShare)} yolk by weight`,
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

  return { chewy, cakey, crispy, signals, confidence };
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
