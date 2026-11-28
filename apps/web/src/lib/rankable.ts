import type { Rankable } from "@recipes/core";
import type { ScoredRecipe } from "./recipes.ts";

/**
 * A corpus row, reduced to what the ranking actually reads.
 *
 * Shared because the signed-out example and the signed-in picker rank the
 * same way -- the example is a real recommendation for a real query, and it
 * would stop being one the moment it got its own scoring path.
 */
export function asRankable(r: ScoredRecipe): Rankable {
  return {
    scores: {
      chewy: r.scores.chewy, cakey: r.scores.cakey, crispy: r.scores.crispy,
      confidence: r.scores.confidence,
    },
    method: r.method,
    chills_dough: r.chills_dough,
    bake_minutes: r.bake_minutes,
    rating: r.rating,
    ratingCount: r.rating_count,
    reviews: r.reviews,
    ingredientCount: r.ingredients.length,
  };
}
