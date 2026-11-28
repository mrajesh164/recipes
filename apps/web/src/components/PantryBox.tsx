"use client";

import { useState } from "react";

/**
 * What you have in, as a list you keep rather than a query you retype.
 *
 * Closed by default, and that is the point. This page is a search box: you say
 * how you want it to turn out and it answers. A pantry is a different kind of
 * thing -- a constraint on what is possible rather than a description of what
 * is wanted -- and if it sat open beside the box the page would stop being a
 * search and become a form, which is the shape the whole design has avoided.
 *
 * So it is one line of text until you want it, and once there is something in
 * it the line says so, because a filter that silently changes your results is
 * worse than no filter.
 */
export function PantryBox({
  items,
  ready,
  onAdd,
  onRemove,
}: {
  items: string[] | null;
  ready: boolean;
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const have = items ?? [];

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-full px-3 py-2 text-xs font-semibold text-clay-deep
                   transition hover:bg-cream-deep"
      >
        {have.length === 0
          ? "Cooking from what you have?"
          : `Using your ${have.length} ingredient${have.length === 1 ? "" : "s"}`}
        <span aria-hidden className="ml-1 inline-block">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border-2 border-line bg-paper p-4">
          <p className="text-sm text-ink-soft">
            Add what you have in. Recipes you can make come first, then the ones
            you are one thing short of.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAdd(draft);
              setDraft("");
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="flour, oats, chocolate chips…"
              aria-label="Add an ingredient you have"
              className="min-w-0 flex-1 rounded-full border-2 border-line bg-paper px-4 py-2 text-sm
                         placeholder:text-ink-faint focus:border-clay-deep focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-full border-2 border-clay-deep bg-clay-deep px-4 py-2 text-sm
                         font-semibold text-paper transition hover:brightness-90
                         disabled:opacity-40"
            >
              Add
            </button>
          </form>

          {/* The list is the state. Each item removes itself, because a pantry
              is edited one thing at a time -- you used the last egg, not all of
              them. */}
          {have.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {have.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    aria-label={`Remove ${item}`}
                    className="group inline-flex items-center gap-1.5 rounded-full bg-cream-deep
                               px-3 py-1.5 text-xs text-ink transition hover:brightness-95"
                  >
                    {item}
                    <span aria-hidden className="text-ink-faint group-hover:text-clay-deep">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {ready && have.length === 0 && (
            <p className="mt-3 text-xs text-ink-faint">
              Nothing in yet. Flour, butter, sugar and eggs are a good start --
              water and salt are assumed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
