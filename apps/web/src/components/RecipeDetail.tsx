"use client";

import Image from "next/image";
import type { ScoredRecipe } from "@/lib/recipes";
import { RecipeActions } from "./RecipeActions";
import { WhyThisOne } from "./WhyThisOne";
import { ratioDistribution } from "@/lib/ratios";

/**
 * A recipe opened in place, under the thing you clicked.
 *
 * This was a modal dialog. A modal is the right tool when a decision has to be
 * finished before anything else can happen, and looking at a cookie's ratios
 * is not that: it covered the list you were comparing against, which is the
 * one thing you wanted to stay visible. Close behind already expanded in place
 * rather than opening a dialog, so this is the pattern the app had already
 * settled on in the place it was working best.
 */
export function RecipeDetail({
  recipe,
  all,
  onClose,
}: {
  recipe: ScoredRecipe;
  /** The corpus. Narrowed to the same dish below. */
  all: ScoredRecipe[];
  onClose: () => void;
}) {
  // Against its own kind, not the whole corpus. A peanut butter cookie plotted
  // against five different kinds of cookie mostly shows the difference between
  // peanut butter and oatmeal, which is not news.
  const peers = recipe.dish_type
    ? all.filter((r) => r.dish_type === recipe.dish_type)
    : all;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-clay-deep bg-paper">
      <div className="grid gap-0 md:grid-cols-[14rem_minmax(0,1fr)]">
        {recipe.image_url && (
          <div className="relative aspect-[4/3] md:aspect-auto">
            <Image
              src={recipe.image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 224px"
              className="object-cover"
            />
          </div>
        )}

        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight tracking-tight">
                {recipe.title}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {recipe.dish_type ? `${recipe.dish_type} · ` : ""}
                {recipe.source_name}
                {recipe.rating !== null && ` · ${recipe.rating}★`}
                {recipe.yield_count !== null && ` · makes ${recipe.yield_count}`}
              </p>
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

          <div className="mt-5">
            <RecipeActions recipe={recipe} />
          </div>

          <div className="mt-5">
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
          </div>
        </div>
      </div>
    </div>
  );
}
