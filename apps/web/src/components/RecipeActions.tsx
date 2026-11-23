"use client";

import type { ScoredRecipe } from "@/lib/recipes";
import { ExternalLinkIcon } from "./icons";
import { SaveButton } from "./SaveButton";

/**
 * What you can do with a recipe, in one place and one order.
 *
 * Before this the three surfaces disagreed. On the recommendation, the only
 * way out to the recipe was the title itself, underlined, with no button
 * anywhere; in the runners-up and the compare dialog it was a filled button at
 * the foot of the panel. So the primary card was the one place the primary
 * action did not look like an action, which is what "Open recipe gets lost"
 * was describing.
 *
 * Opening wins the filled button because it is the thing you came to do. Save
 * sits beside it, quieter, because it is what you do when you are not baking
 * today.
 */
export function RecipeActions({
  recipe,
  savedFor,
}: {
  recipe: ScoredRecipe;
  /** The query that produced this pick, stored with the save. */
  savedFor?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={recipe.source_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-clay-deep px-5 py-3
                   text-sm font-semibold text-paper transition-colors hover:bg-clay"
      >
        Open the recipe
        <ExternalLinkIcon />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <SaveButton recipeId={recipe.id} savedFor={savedFor} compact />
    </div>
  );
}
