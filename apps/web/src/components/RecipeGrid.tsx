"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import type { ScoredRecipe } from "@/lib/recipes";
import { RecipeDetail } from "./RecipeDetail";
import { BackToTop } from "./BackToTop";

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
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("title");

  /**
   * How many tiles are rendered at once.
   *
   * The grid rendered every match, which at 1,385 recipes meant 1,385 tiles
   * and 1,385 requests to the image optimiser the moment the page opened. In
   * dev that burst is enough for some to time out, and a browser caches a
   * failed image, so tiles stayed broken until a hard reload even though every
   * url behind them was fine.
   *
   * 120 is five full rows at the widest breakpoint, so the grid still reads as
   * "lots" without fetching all of it.
   */
  const PAGE = 120;
  const [visible, setVisible] = useState(PAGE);
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  /** Where to hang the open panel, measured from the grid's own box. */
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  const q = filter.trim().toLowerCase();
  const matched = q
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.source_name.toLowerCase().includes(q) ||
          // The kind too, so "brownie" or "scone" filters. The box used to
          // say "name or source" and match only those; saying "keyword" and
          // then ignoring the most obvious keyword in the corpus would be
          // the label promising more than the filter does.
          (r.dish_type?.toLowerCase().includes(q) ?? false),
      )
    : recipes;
  const shown = [...matched].sort(SORTS[sort].compare);

  // Counted over what is shown, not the corpus: with a filter applied a header
  // reading "Brownie 269" above three tiles would be answering a question
  // nobody asked.
  const counts = new Map<string, number>();
  for (const r of shown) {
    const k = r.dish_type ?? "other";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // Insertion order is the sorted order, so this is also the order the
  // headers appear in down the page.
  const kinds = [...counts.keys()];

  // A new filter or a new order is a new list, so start from the top rather
  // than keeping however far the last one had been expanded.
  useEffect(() => setVisible(PAGE), [q, sort]);

  // A jump can be to a kind the window has not reached, so the click widens
  // the window and the scroll waits for the render that follows it.
  useEffect(() => {
    if (!jumpTo) return;
    const el = document.getElementById(`kind-${jumpTo.replace(/\s+/g, "-")}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setJumpTo(null);
  }, [jumpTo, visible]);

  // Escape, and a click anywhere that is not the panel or a tile.
  //
  // The panel floats over the grid with no backdrop behind it, so there is
  // nothing to click through to dismiss it -- without these the only way out
  // is the × or the same tile again, which is a dead end for anyone who
  // reaches for Escape first. Tiles are excluded so clicking a different one
  // switches recipes rather than closing and reopening.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-recipe-panel]") && !t?.closest("[aria-expanded]")) {
        setOpen(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const page = shown.slice(0, visible);
  const openRecipe = page.find((r) => r.id === open) ?? null;

  return (
    <div>
      {/* Not the texture search -- that is the task on the home page. This
          just narrows a long list by name, which is what you want when you
          are scrolling rather than asking. */}
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by name or keyword…"
        aria-label="Filter recipes by name or source"
        className="w-full max-w-md rounded-2xl border-2 border-line bg-paper px-4 py-3
                   placeholder:text-ink-faint focus:border-clay-deep focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-ink-soft">
          {shown.length === recipes.length
            ? `${recipes.length} recipes`
            : `${shown.length} of ${recipes.length}`}
        </p>

        <div className="flex flex-wrap gap-2">
          {/* No button for A to Z. It is the order the list is in when nothing
              has been asked for, not one of three choices -- with a button it
              read as a third option competing with the two that actually
              change something. The other two toggle, so pressing the one that
              is on is how you get back to alphabetical. */}
          {(Object.keys(SORTS) as SortKey[])
            .filter((k) => k !== "title")
            .map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort((cur) => (cur === k ? "title" : k))}
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
      {/* Somewhere to jump from. Eleven kinds down a page of 1,385 tiles is a
          lot of scrolling to reach the scones, and the headers alone only help
          once you have already arrived at one. Anchors rather than state: the
          browser does the scrolling, back works, and a link to a kind can be
          sent to somebody. */}
      {sort === "dish" && kinds.length > 1 && (
        <nav aria-label="Jump to a kind" className="mt-6 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <a
              key={k}
              href={`#kind-${k.replace(/\s+/g, "-")}`}
              onClick={(e) => {
                // Still a real link -- middle-click and copy-link behave -- but
                // the target may not be rendered yet, so this widens the window
                // and scrolls once React has caught up.
                e.preventDefault();
                const at = shown.findIndex((r) => (r.dish_type ?? "other") === k);
                if (at >= 0) setVisible((v) => Math.max(v, at + PAGE));
                setJumpTo(k);
              }}
              className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold
                         capitalize text-ink transition-colors hover:border-clay-deep
                         hover:text-clay-deep"
            >
              {k}{" "}
              <span className="font-medium text-ink-faint">{counts.get(k)}</span>
            </a>
          ))}
        </nav>
      )}

      <ul className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {page.map((r, i) => (
          <Fragment key={r.id}>
            {/* Sorting by kind put the groups in order and then gave no sign
                of where one ended, so five categories read as one long run of
                tiles that happened to rhyme. A header per group, spanning the
                full width of the grid, with how many are in it. Only for this
                sort: under A to Z or Best rated there are no groups to name. */}
            {sort === "dish" &&
              (i === 0 || (page[i - 1]?.dish_type ?? "") !== (r.dish_type ?? "")) && (
                <li
                  id={`kind-${(r.dish_type ?? "other").replace(/\s+/g, "-")}`}
                  className="col-span-full mt-6 scroll-mt-4 first:mt-0"
                >
                  <h2 className="flex items-baseline gap-2 border-b border-line-soft pb-2
                                 text-sm font-bold tracking-tight">
                    <span className="capitalize">{r.dish_type ?? "other"}</span>
                    <span className="text-xs font-medium text-ink-faint">
                      {counts.get(r.dish_type ?? "other")}
                    </span>
                  </h2>
                </li>
              )}
          <li>
            <button
              type="button"
              onClick={(e) => {
                // Where to hang the panel: the bottom of this tile's row,
                // measured rather than inferred, because the column count
                // changes with the breakpoint and the row height with the
                // longest title in it.
                const li = (e.currentTarget as HTMLElement).closest("li");
                const grid = li?.offsetParent as HTMLElement | null;
                if (li && grid) {
                  // Half the grid, but never narrower than a column's worth of
                  // reading -- at two columns on a phone, half of the grid is
                  // too thin for a plot with labelled ends.
                  const width = Math.min(grid.clientWidth, Math.max(380, grid.clientWidth / 2));
                  setAnchor({
                    top: li.offsetTop + li.offsetHeight + 12,
                    // Hangs from the tile that was clicked, pulled back inside
                    // the grid when that would push it off the right edge.
                    left: Math.max(0, Math.min(li.offsetLeft, grid.clientWidth - width)),
                    width,
                  });
                } else {
                  setAnchor(null);
                }
                setOpen(open === r.id ? null : r.id);
              }}
              aria-expanded={open === r.id}
              className="group block h-full w-full overflow-hidden rounded-2xl border border-line
                         bg-paper text-left transition-colors hover:border-pink-deep
                         aria-expanded:border-clay-deep"
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

          {/* Opened next to the tile, not under the grid.
 
              This used to render after the whole list. With thirteen recipes
              that was merely a short scroll; at 120 tiles a click on the first
              row opened a panel far below the fold, so the tile took the focus
              ring and nothing appeared to happen -- it read as "these don't
              open". col-span-full puts it on its own row directly beneath the
              one that was clicked. */}
          </Fragment>
        ))}

        {/* The open recipe, hanging over the grid rather than inside it.
 
            Two earlier tries were wrong. Rendering it after the list put it
            120 tiles below the fold, so clicking a tile looked like nothing
            happened. Rendering it as a full-width row inside the grid fixed
            that but pushed every tile below it down the page -- and a
            zero-height row with a negative margin did not help, because a
            margin cannot cancel a grid gap: measured, a tile twenty places
            down still moved 10px.
 
            So it is out of the grid's flow altogether: absolutely positioned
            against the <ul>, at a top measured from the clicked tile's own row
            when it was clicked. No row is created, no gap is added, nothing
            below it moves, and it covers the tiles underneath the way a
            dropdown should. */}
        {open && openRecipe && anchor !== null && (
          <li
            data-recipe-panel
            className="absolute z-30 drop-shadow-xl"
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
          >
            <RecipeDetail
              recipe={openRecipe}
              all={recipes}
              onClose={() => setOpen(null)}
            />
          </li>
        )}
      </ul>

      {visible < shown.length && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="rounded-full border-2 border-line bg-paper px-6 py-3 text-sm font-semibold
                       text-ink transition-colors hover:border-clay-deep hover:text-clay-deep"
          >
            Show more ({shown.length - visible} left)
          </button>
        </div>
      )}

      <BackToTop />

    </div>
  );
}
