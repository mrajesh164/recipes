"use client";

import { useState } from "react";
import Image from "next/image";
import type { ScoredRecipe } from "@/lib/recipes";
import { CompareDialog } from "./CompareDialog";

/**
 * Every recipe, for the people who want to browse.
 *
 * Deliberately a separate page rather than part of the home page. The main
 * task is "tell me what you want and I'll pick one", and a wall of cookies
 * under that task competes with it -- at ~200 recipes it would be the
 * overwhelm the whole project exists to remove. Here it is a place you choose
 * to go instead.
 *
 * Cards open the compare dialog rather than linking straight out, because the
 * ratios are the thing this app knows that the source site doesn't.
 */
/**
 * How a browse list can be ordered.
 *
 * The list was already alphabetical, because the query orders by title, but
 * nothing on the page said so. An unlabelled order reads as no order, which is
 * what makes a wall of 325 feel arbitrary: you cannot tell whether the top of
 * the list means anything. Saying it is most of the fix. Being able to change
 * it costs almost nothing on top, because every recipe is already here in the
 * browser and sorting is not a new request.
 */
const SORTS = {
  title: { label: "A to Z", compare: (a: ScoredRecipe, b: ScoredRecipe) => a.title.localeCompare(b.title) },
  rating: {
    label: "Best rated",
    // Unrated last rather than first. A null is not a zero, and it is not a
    // five either.
    compare: (a: ScoredRecipe, b: ScoredRecipe) =>
      (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title),
  },
  dish: {
    label: "By kind",
    compare: (a: ScoredRecipe, b: ScoredRecipe) =>
      (a.dish_type ?? "").localeCompare(b.dish_type ?? "") || a.title.localeCompare(b.title),
  },
} as const;

type SortKey = keyof typeof SORTS;

export function RecipeGrid({ recipes }: { recipes: ScoredRecipe[] }) {
  const [compare, setCompare] = useState<ScoredRecipe | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("title");

  const q = filter.trim().toLowerCase();
  const matched = q
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.source_name.toLowerCase().includes(q),
      )
    : recipes;
  const shown = [...matched].sort(SORTS[sort].compare);

  return (
    <div>
      {/* Not the texture search -- that is the task on the home page. This
          just narrows a long list by name, which is what you want when you
          are scrolling rather than asking. */}
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by name or source…"
        aria-label="Filter recipes by name or source"
        className="w-full max-w-md rounded-2xl border-2 border-line bg-paper px-4 py-3
                   placeholder:text-ink-faint focus:border-clay-deep focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-ink-soft">
          {shown.length === recipes.length
            ? `${recipes.length} recipes`
            : `${shown.length} of ${recipes.length}`}
          , sorted{" "}
          <span className="font-semibold text-ink">{SORTS[sort].label.toLowerCase()}</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              aria-pressed={sort === k}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                sort === k
                  ? "border-clay-deep bg-clay-deep text-paper"
                  : "border-line bg-paper text-ink-soft hover:border-pink-deep hover:text-ink",
              ].join(" ")}
            >
              {SORTS[k].label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <p className="mt-10 text-sm text-ink-soft">
          Nothing matches &ldquo;{filter}&rdquo;.
        </p>
      )}

      {/* Denser than the recommendation. Browsing is a scanning task: at three
          columns 325 recipes was a very long scroll, and each tile was far
          bigger than the decision it supports. Two columns even on a phone,
          because a cookie photograph reads fine small. */}
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setCompare(r)}
              className="group block h-full w-full overflow-hidden rounded-2xl border border-line
                         bg-paper text-left transition-colors hover:border-pink-deep"
            >
              {r.image_url && (
                <div className="relative aspect-[4/3]">
                  <Image
                    src={r.image_url}
                    alt=""
                    fill
                    // Has to track the column count above, or the browser
                    // fetches a file for the wrong width and the tile is
                    // either soft or needlessly heavy.
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-3">
                <h2 className="text-sm font-bold leading-snug tracking-tight group-hover:text-clay-deep">
                  {r.title}
                </h2>
                <p className="mt-1 text-xs text-ink-faint">
                  {r.dish_type ? `${r.dish_type} · ` : ""}
                  {r.source_name}
                  {r.rating !== null && ` · ${r.rating}★`}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <CompareDialog recipe={compare} all={recipes} onClose={() => setCompare(null)} />
    </div>
  );
}
