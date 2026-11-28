"use client";

import { useState } from "react";

/**
 * The twelve most common ingredients in the corpus, as buttons.
 *
 * Measured rather than guessed: these are the canonical names the parser sees
 * most often, with salt and water dropped because they are assumed anyway.
 * Adding all twelve puts 72 recipes within reach and 229 within one
 * ingredient, which is the point -- a pantry is tedious to type and almost
 * everybody's starts with the same handful.
 *
 * Oats is here in place of "nuts", which the frequencies put twelfth. Nuts are
 * a garnish; oats are the difference between having oatmeal cookies available
 * and not, and a whole dish category is worth more than a topping.
 */
const COMMON = [
  "flour",
  "butter",
  "sugar",
  "brown sugar",
  "egg",
  "vanilla extract",
  "baking powder",
  "baking soda",
  "chocolate chips",
  "milk",
  "cinnamon",
  "oats",
];

/**
 * What you have in, as a list you keep rather than a query you retype.
 *
 * Collapsible, because the two states want different things from the page: an
 * empty pantry needs the input and the suggestions, and a full one mostly
 * needs to be out of the way while you read the answers it produced. Open by
 * default -- it is a section with a heading now, not a footnote, and hiding it
 * by default was the mistake it is a section to fix.
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
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const have = items ?? [];
  const suggestions = COMMON.filter((c) => !have.includes(c));

  return (
    <div className="mt-3 rounded-2xl border-2 border-line bg-paper">
      <div className="flex items-start justify-between gap-4 p-5 pb-0">
        <p className="text-sm text-ink-soft">
          {have.length === 0
            ? "Recipes you can make come first, then the ones you are one thing short of. Water and salt are assumed."
            : `Using ${have.length} ingredient${have.length === 1 ? "" : "s"}. Recipes you can make come first.`}
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="-mr-2 -mt-1 flex-none rounded-full px-3 py-2 text-xs font-semibold
                     text-clay-deep transition hover:bg-cream-deep"
        >
          {open ? "Hide" : "Edit"}
        </button>
      </div>

      {/* The list stays visible when collapsed. Hiding what you said you have
          along with the means of changing it would leave the ranking explained
          by nothing on screen. */}
      {have.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-5 pt-4">
          {have.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item}`}
                className="group inline-flex items-center gap-1.5 rounded-full bg-cream-deep
                           px-3 py-1.5 text-sm text-ink transition hover:brightness-95"
              >
                {item}
                <span aria-hidden className="text-ink-faint group-hover:text-clay-deep">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="px-5 pb-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAdd(draft);
              setDraft("");
            }}
            className="mt-4 flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="tahini, bananas, cream cheese…"
              aria-label="Add ingredients you have, separated by commas"
              className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-paper px-4 py-3 text-base
                         placeholder:text-ink-faint focus:border-clay-deep focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex-none rounded-2xl bg-clay-deep px-5 font-semibold text-paper
                         transition hover:brightness-90 disabled:opacity-40"
            >
              Add
            </button>
          </form>

          {/* The staples as buttons, because almost every pantry starts with
              the same handful and typing them is the dullest part of this. */}
          {suggestions.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Common
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => onAdd(item)}
                      className="rounded-full border-2 border-line bg-paper px-3 py-1.5 text-sm
                                 text-ink-soft transition hover:border-clay-deep hover:text-ink"
                    >
                      + {item}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {ready && have.length === 0 && (
            <p className="mt-4 text-xs text-ink-faint">
              Type several at once if you like, separated by commas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
