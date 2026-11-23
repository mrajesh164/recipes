"use client";

import { useState } from "react";
import Image from "next/image";
import type { ScoredRecipe } from "@/lib/recipes";
import { CompareDialog } from "./CompareDialog";

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
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setCompare(item.recipe)}
              className="group block h-full w-full overflow-hidden rounded-2xl border border-line
                         bg-paper text-left transition-colors hover:border-pink-deep"
            >
              {item.recipe.image_url && (
                <div className="relative aspect-[4/3]">
                  <Image
                    src={item.recipe.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-3">
                <h2 className="text-sm font-bold leading-snug tracking-tight group-hover:text-clay-deep">
                  {item.recipe.title}
                </h2>
                <p className="mt-1 text-xs text-ink-faint">
                  {item.recipe.source_name}
                  {item.recipe.rating !== null && ` · ${item.recipe.rating}★`}
                </p>
                {item.savedFor && (
                  <p className="mt-2 inline-block rounded-full bg-cream-deep px-2.5 py-0.5 text-xs text-ink-soft">
                    saved for &ldquo;{item.savedFor}&rdquo;
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <CompareDialog recipe={compare} all={all} onClose={() => setCompare(null)} />
    </div>
  );
}
