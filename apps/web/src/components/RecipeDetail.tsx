"use client";

import Image from "next/image";
import type { ScoredRecipe } from "@/lib/recipes";
import { RecipeActions } from "./RecipeActions";
import { WhyThisOne } from "./WhyThisOne";
import { ratioDistribution } from "@/lib/ratios";

/**
 * A recipe's ratios, opened in place under the thing you clicked.
 *
 * This was a modal dialog. A modal is the right tool when a decision has to be
 * finished before anything else can happen, and looking at a cookie's ratios
 * is not that: it covered the list you were comparing against, which is the
 * one thing you wanted to stay visible.
 *
 * The layout had two faults, both from putting identity in a side column
 * beside a tall image. The title had roughly half the width and wrapped to
 * four lines -- "Chocolate / Toffee / Oatmeal / Cookies" -- and the ratios,
 * the only thing this panel exists to show, were pushed into the same narrow
 * column underneath it. Identity now runs across the top, on one compact row,
 * and the ratios get the full width.
 *
 * `identify` is the other half of it. In Saved this opens inside a row that
 * already carries the thumbnail, the title, the source and both actions, so
 * repeating all of it was the panel's largest element and its least useful:
 * two identical button pairs a few hundred pixels apart. There the panel is
 * the ratios and nothing else. On the browse grid it opens under the whole
 * grid rather than beside the tile, and those tiles carry no actions, so it
 * has to say what it is.
 */
export function RecipeDetail({
  recipe,
  all,
  onClose,
  identify = true,
}: {
  recipe: ScoredRecipe;
  /** The corpus. Narrowed to the same dish below. */
  all: ScoredRecipe[];
  onClose: () => void;
  /**
   * Whether the panel has to name the recipe. False where the surface around
   * it already does.
   */
  identify?: boolean;
}) {
  // Against its own kind, not the whole corpus. A peanut butter cookie plotted
  // against five different kinds of cookie mostly shows the difference between
  // peanut butter and oatmeal, which is not news.
  const peers = recipe.dish_type
    ? all.filter((r) => r.dish_type === recipe.dish_type)
    : all;

  const ratios = (
    <>
      <p className="text-sm text-ink-soft">
        Where it sits among the {peers.length}{" "}
        {recipe.dish_type ?? "cookie"} recipes:
      </p>
      <div className="mt-1">
        <WhyThisOne
          recipe={recipe}
          distribution={ratioDistribution(peers)}
          interpretation={null}
          want={null}
          heading={false}
        />
      </div>
    </>
  );

  // No card of its own. It sits inside a bordered row that is already a card,
  // and a second heavy border inside the first read as a box in a box.
  if (!identify) return <div>{ratios}</div>;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-clay-deep bg-paper">
      {/* One row, not a column. A square thumbnail rather than a tall panel:
          the photograph is here to confirm which recipe this is, which a
          96px square does, and the 224px-wide version was taking width the
          title needed. */}
      <div className="flex items-start gap-4 border-b border-line-soft p-4 md:p-5">
        {recipe.image_url && (
          <div className="relative h-20 w-20 flex-none overflow-hidden rounded-xl sm:h-24 sm:w-24">
            <Image
              src={recipe.image_url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-tight tracking-tight">
            {recipe.title}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            {recipe.dish_type ? `${recipe.dish_type} · ` : ""}
            {recipe.source_name}
            {recipe.rating !== null && ` · ${recipe.rating}★`}
            {recipe.yield_count !== null && ` · makes ${recipe.yield_count}`}
          </p>
          <div className="mt-4">
            <RecipeActions recipe={recipe} />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 grid h-10 w-10 flex-none place-items-center rounded-full
                     text-xl text-ink-faint hover:bg-cream-deep hover:text-ink"
        >
          ×
        </button>
      </div>

      <div className="p-4 md:p-5">{ratios}</div>
    </div>
  );
}
