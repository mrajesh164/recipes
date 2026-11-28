"use client";

import { useState } from "react";

/**
 * What you have in, as a list you keep rather than a query you retype.
 *
 * This began as a disclosure under the search box, closed by default, on the
 * reasoning that the page is a search box and a pantry is a constraint rather
 * than a description of what is wanted. That reasoning was about the page; it
 * ignored the reader. Rendered as a line of small print, the pantry read as an
 * afterthought, when it is in fact the other half of the question -- "what
 * should I make" and "what can I make" are both reasonable things to arrive
 * wanting, and the page should not whisper one of them.
 *
 * So it is a section with a heading, the same weight as the box above it, and
 * it is always open. The heading in Picker labels it, which is why there is no
 * title here.
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
  const [draft, setDraft] = useState("");
  const have = items ?? [];

  return (
    <div className="mt-3 rounded-2xl border-2 border-line bg-paper p-5">
      <p className="text-sm text-ink-soft">
        Recipes you can make come first, then the ones you are one thing short
        of. Water and salt are assumed.
      </p>

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
          placeholder="flour, oats, chocolate chips…"
          aria-label="Add an ingredient you have"
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

      {/* The list is the state. Each item removes itself, because a pantry is
          edited one thing at a time -- you used the last egg, not all of them. */}
      {have.length > 0 && (
        <>
          <ul className="mt-4 flex flex-wrap gap-2">
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
          <p className="mt-3 text-xs text-ink-faint">
            {have.length} ingredient{have.length === 1 ? "" : "s"} in. Click one to take
            it out.
          </p>
        </>
      )}

      {/* Only once the list is known to be empty, rather than while it is
          still unknown -- "nothing in yet" is a claim, not a placeholder. */}
      {ready && have.length === 0 && (
        <p className="mt-4 text-sm text-ink-faint">
          Nothing in yet. Flour, butter, sugar and eggs are a good start.
        </p>
      )}
    </div>
  );
}
