/**
 * The three ratio distributions the plots are drawn against.
 *
 * WhyThisOne used to take the whole corpus and derive these itself. That was
 * wrong in two ways at once.
 *
 * It is a client component, so the corpus was serialised into the page to get
 * there -- 1,385 recipes with their titles, urls, image urls and scores, and
 * on a prerendered page that payload is embedded twice, once as HTML and once
 * as flight data for hydration. The public landing page was 3 MB of it, for a
 * visitor who had not signed in. The plots read three arrays of numbers.
 *
 * And Picker renders one WhyThisOne per result, each deriving the same three
 * arrays from the same 1,385 recipes, so the work was repeated per row for an
 * answer that cannot differ between rows.
 *
 * Computing it once, where the corpus already is, fixes both.
 */

export interface RatioDistribution {
  fatPerFlour: number[];
  brownShare: number[];
  sugarPerFlour: number[];
}

type HasRatios = {
  scores: {
    ratios: { fatPerFlour: number; brownShare: number; sugarPerFlour: number } | null;
  };
};

/**
 * Recipes whose ingredients could not be read have no ratios, and a null is
 * not a zero -- it is "unknown", and plotting it as the bottom of the range
 * would pull the whole distribution down. They are dropped, as before.
 */
export function ratioDistribution(recipes: readonly HasRatios[]): RatioDistribution {
  const withRatios = recipes.filter((r) => r.scores.ratios !== null);
  return {
    fatPerFlour: withRatios.map((r) => r.scores.ratios!.fatPerFlour),
    brownShare: withRatios.map((r) => r.scores.ratios!.brownShare),
    sugarPerFlour: withRatios.map((r) => r.scores.ratios!.sugarPerFlour),
  };
}
