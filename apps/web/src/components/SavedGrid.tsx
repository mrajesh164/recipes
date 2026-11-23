"use client";

import { useState } from "react";
import Image from "next/image";
import type { ScoredRecipe } from "@/lib/recipes";
import { CompareDialog } from "./CompareDialog";
import { RecipeActions } from "./RecipeActions";

export interface SavedItem {
  /** The row in saved_recipes, not the recipe. */
  id: string;
  /** What was typed when it was saved. A better reminder than the title. */
  savedFor: string | null;
  recipe: ScoredRecipe;
}

/**
 * The saved list, with the same popup the browse page has.
 *
 * These cards used to link straight out to the source site, which made Saved
 * the one page where you could not see the ratios -- exactly the place you
 * would want them, since a save is a decision you are coming back to. Clicking
 * opens the comparison; the link out is inside it.
 */
export function SavedGrid({
  items,
  all,
}: {
  items: SavedItem[];
  /** The corpus, for the plots to compare against. */
  all: ScoredRecipe[];
}) {
  const [compare, setCompare] = useState<ScoredRecipe | null>(null);

  return (
    <div>
      {/* Rows, not a four-across grid of tiles.
 
          A saved recipe had no visible action on it at all: the whole card was
          one click target that opened the comparison, and you had to already
          know that. But you saved it in order to bake it, so opening it is the
          primary thing and it belongs on the card, in the same place on every
          card. Two across at most, because a tile narrow enough to fit four
          cannot hold a button as well. */}
      <ul className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="overflow-hidden rounded-2xl border border-line bg-paper"
          >
            <div className="flex gap-4 p-4">
              {item.recipe.image_url && (
                <button
                  type="button"
                  onClick={() => setCompare(item.recipe)}
                  aria-label={`Compare ${item.recipe.title} with the others`}
                  className="group relative h-24 w-24 flex-none overflow-hidden rounded-xl"
                >
                  <Image
                    src={item.recipe.image_url}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              )}

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold leading-snug tracking-tight">
                  {item.recipe.title}
                </h2>
                <p className="mt-1 text-xs text-ink-faint">
                  {item.recipe.dish_type ? `${item.recipe.dish_type} · ` : ""}
                  {item.recipe.source_name}
                  {item.recipe.rating !== null && ` · ${item.recipe.rating}★`}
                </p>
                {item.savedFor && (
                  <p className="mt-2 inline-block rounded-full bg-cream-deep px-2.5 py-0.5 text-xs text-ink-soft">
                    saved for &ldquo;{item.savedFor}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* The action row, same component and same order as everywhere
                else, on a ruled footer so it is in one place on every row. */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3">
              <RecipeActions recipe={item.recipe} savedFor={item.savedFor ?? undefined} />
              <button
                type="button"
                onClick={() => setCompare(item.recipe)}
                className="rounded-full px-3 py-2 text-xs font-semibold text-clay-deep hover:bg-cream-deep"
              >
                Compare
              </button>
            </div>
          </li>
        ))}
      </ul>

      <CompareDialog recipe={compare} all={all} onClose={() => setCompare(null)} />
    </div>
  );
}
