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

      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-bold leading-snug tracking-tight group-hover:text-clay-deep">
                  {r.title}
                </h2>
                <p className="mt-1 text-xs text-ink-faint">
                  {r.source_name}
                  {r.rating !== null && ` · ${r.rating}★`}
                </p>
                {r.method && r.method !== "other" && (
                  <p className="mt-2 inline-block rounded-full bg-cream-deep px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                    {r.method} butter
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <CompareDialog recipe={compare} all={recipes} onClose={() => setCompare(null)} />
    </div>
  );
}
