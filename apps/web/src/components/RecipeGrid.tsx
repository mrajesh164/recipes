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
export function RecipeGrid({ recipes }: { recipes: ScoredRecipe[] }) {
  const [compare, setCompare] = useState<ScoredRecipe | null>(null);
  const [filter, setFilter] = useState("");

  const q = filter.trim().toLowerCase();
  const shown = q
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.source_name.toLowerCase().includes(q),
      )
    : recipes;

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

      <p className="mt-3 text-sm text-ink-soft">
        {shown.length === recipes.length
          ? `${recipes.length} recipes`
          : `${shown.length} of ${recipes.length}`}
      </p>

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
