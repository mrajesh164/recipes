"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { ScoredRecipe } from "@/lib/recipes";
import { ExternalLinkIcon } from "./icons";
import { WhyThisOne } from "./WhyThisOne";
import { SaveButton } from "./SaveButton";

/**
 * Where any recipe sits among the others.
 *
 * The grid used to link straight out to the source site, which meant the one
 * thing this app knows that the source does not -- how this recipe compares to
 * twelve others -- was unreachable for every recipe except the recommendation.
 * Clicking a card now opens this instead, and the link out is still here.
 *
 * Native <dialog> rather than a div: it gives focus trapping, Escape, inert
 * background and the top layer for free, and all four are easy to get wrong by
 * hand.
 */
export function CompareDialog({
  recipe,
  all,
  onClose,
}: {
  recipe: ScoredRecipe | null;
  all: ScoredRecipe[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (recipe && !el.open) el.showModal();
    if (!recipe && el.open) el.close();
  }, [recipe]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clicking the backdrop closes it. The backdrop is the dialog element
      // itself, so compare the target rather than trusting the bubble.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="w-[min(40rem,calc(100vw-2rem))] rounded-3xl border-2 border-line bg-paper p-0
                 backdrop:bg-ink/35 open:animate-none"
    >
      {recipe && (
        <Body recipe={recipe} all={all} onClose={onClose} />
      )}
    </dialog>
  );
}

/**
 * Split out so the peer pool can be computed with hooks-free plain code at
 * the point where `recipe` is known to exist, rather than guarded everywhere.
 */
function Body({
  recipe,
  all,
  onClose,
}: {
  recipe: ScoredRecipe;
  all: ScoredRecipe[];
  onClose: () => void;
}) {
  const peers = recipe.dish_type
    ? all.filter((r) => r.dish_type === recipe.dish_type)
    : all;

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      {recipe.image_url && (
        <div className="relative aspect-[16/9]">
          <Image
            src={recipe.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 40rem"
            className="object-cover"
          />
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold leading-tight tracking-tight">
              {recipe.title}
            </h2>
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
            className="-mr-1 -mt-1 grid h-11 w-11 flex-none place-items-center rounded-full
                       text-xl text-ink-faint hover:bg-cream-deep hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-6">
          {/* No "Why this one" heading here. Nothing was asked -- you
              clicked a cookie -- so there is no "why", and the heading
              claimed a recommendation that never happened.

              The pool is the same dish, not the whole corpus. A peanut
              butter cookie plotted against 313 cookies of five different
              kinds is a picture of the difference between peanut butter
              and oatmeal, which is not news. Against the other peanut
              butter recipes it says something: this one is at the buttery
              end of its own kind. */}
          <p className="text-sm text-ink-soft">
            Where it sits among the {peers.length}{" "}
            {recipe.dish_type ?? "cookie"} recipes:
          </p>
          <div className="mt-1">
            <WhyThisOne
              recipe={recipe}
              all={peers}
              interpretation={null}
              want={null}
              heading={false}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-clay-deep px-5 py-3 text-sm font-semibold text-paper hover:bg-clay"
          >
            Open the recipe
            <ExternalLinkIcon />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <SaveButton recipeId={recipe.id} compact />
        </div>

        <details className="mt-6">
          <summary className="-mx-2 cursor-pointer rounded-lg px-2 py-3 text-sm font-medium text-clay-deep hover:bg-cream-deep">
            Ingredients
          </summary>
          <table className="mt-2 w-full border-collapse text-sm">
            <tbody>
              {recipe.ingredients.map((i) => (
                <tr key={i.position} className="border-b border-line-soft last:border-0">
                  <td className="py-1.5 pr-3">{i.raw_text}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink-soft">
                    {i.grams === null ? "—" : `${i.grams} g`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </div>
  );
}
