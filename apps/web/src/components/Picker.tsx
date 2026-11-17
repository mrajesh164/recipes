"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SignUpButton, useAuth } from "@clerk/nextjs";
import { SaveButton } from "./SaveButton";
import {
  interpret, matchScore, dominantTexture, candidatesFor,
  type Texture, type Interpretation, type Rankable,
} from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import { WhyThisOne } from "./WhyThisOne";

/**
 * Pick a texture, get one recipe, then browse the rest if you want to.
 *
 * The one recommendation comes first and the wall of cookies comes after,
 * deliberately in that order. Landing on thirteen recipes with conflicting
 * numbers is the overwhelm this project exists to remove; landing on an answer
 * and then choosing to look further is not the same thing.
 *
 * Ranking happens in the browser because the whole corpus arrives with the
 * page, so changing texture is instant with no second request.
 */

/** Clicking one fills the box, so the vocabulary is discoverable. */
const EXAMPLES = [
  "chewy",
  "crispy edges, soft middle",
  "extra thick oatmeal",
  "peanut butter, no mixer",
  "best snickerdoodle",
];

function asRankable(r: ScoredRecipe): Rankable {
  return {
    scores: {
      chewy: r.scores.chewy, cakey: r.scores.cakey, crispy: r.scores.crispy,
      confidence: r.scores.confidence,
    },
    method: r.method,
    chills_dough: r.chills_dough,
    bake_minutes: r.bake_minutes,
    rating: r.rating,
    ingredientCount: r.ingredients.length,
  };
}

export function Picker({ recipes }: { recipes: ScoredRecipe[] }) {
  // `draft` is what is in the box; `query` is what has been submitted.
  // Interpreting every keystroke meant "very cri" flashed "I couldn't read
  // anything in that" mid-word and the whole page rearranged under the
  // cursor. Nothing happens now until you finish and press Enter.
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  // Clerk Core 3 removed <SignedIn>/<SignedOut>; its replacement <Show> is an
  // async server component, so a client component asks the hook instead.
  // isLoaded matters: without it the sign-up pitch flashes for a signed-in
  // person on every load.
  const { isSignedIn, isLoaded } = useAuth();

  const interpretation = interpret(query);
  const asked = query.trim().length > 0 && !interpretation.empty;

  // Naming a dish removes candidates rather than reordering them, so the
  // filter happens before the ranking and the filtered pool is what every
  // comparison below is made against. Asking for oatmeal and then being shown
  // where the pick sits among 325 cookies of five different kinds would be
  // answering a wider question than the one asked.
  const pool = candidatesFor(recipes, interpretation);

  const ranked = asked
    ? [...pool].sort(
        (a, b) =>
          matchScore(asRankable(b), interpretation) -
          matchScore(asRankable(a), interpretation),
      )
    : [];

  const best = ranked[0];
  const want = dominantTexture(interpretation);

  return (
    <div>
      {/* The task is behind sign-in, as asked. The page around it is not --
          a visitor still sees what this is and what it has before being
          asked for an account, which is the difference between a gate and a
          dead end. */}
      {isLoaded && !isSignedIn && <Example recipes={recipes} />}

      {isSignedIn && (
      <>
      <label htmlFor="q" className="block font-semibold">
        What are you after?
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          id="q"
          type="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Clearing the box (the native ×, or select-all-delete) should
            // clear the answer too, rather than leaving a stale one behind.
            if (e.target.value === "") setQuery("");
          }}
          placeholder="extra chewy oatmeal, crispy edges, quick…"
          autoComplete="off"
          className="w-full rounded-2xl border-2 border-line bg-paper px-5 py-4 text-lg
                     placeholder:text-ink-faint focus:border-clay-deep focus:outline-none"
        />
        <button
          type="submit"
          disabled={draft.trim() === ""}
          className="flex-none rounded-2xl bg-clay-deep px-6 font-semibold text-paper
                     hover:bg-clay disabled:opacity-40"
        >
          Find
        </button>
      </form>

      <ul className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <li key={e}>
            <button
              type="button"
              onClick={() => {
                setDraft(e);
                setQuery(e);
              }}
              className="rounded-full border border-line bg-paper px-3 py-2 text-xs text-ink-soft
                         hover:border-pink-deep hover:text-ink"
            >
              {e}
            </button>
          </li>
        ))}
      </ul>

      <Reading
        query={query}
        interpretation={interpretation}
        count={recipes.length}
        poolCount={pool.length}
      />

      {/* Nothing asked yet: offer the two places to go, rather than a screen
          of background. */}
      {query.trim() === "" && <Shortcuts recipes={recipes} />}

      {best && (
        <Recommendation
          recipe={best}
          want={want}
          all={pool}
          query={query}
          interpretation={interpretation}
        />
      )}

      {asked && ranked.length > 1 && (
        <CloseMatches
          matches={ranked.slice(1, 5)}
          all={pool}
          interpretation={interpretation}
          want={want}
        />
      )}
      </>
      )}
    </div>
  );
}

/**
 * The next few matches, as rows rather than a wall.
 *
 * A grid of every recipe stopped making sense the moment the corpus passed a
 * couple of dozen: scrolling two hundred photographs to find a cookie is the
 * overwhelm this project exists to remove, just with better pictures. So only
 * the near misses are shown.
 *
 * Each row used to end with the one ratio it differed most on -- "-84 g
 * sugar", "-62% brown sugar". It was precise and nobody asked for it: a list
 * of runners-up is scanned, not studied, and four rows of signed arithmetic
 * read as noise. The same numbers are a click away, in context, as plots.
 *
 * Fixed at four, so the page is the same height whether the corpus holds
 * thirteen recipes or a thousand.
 */
function CloseMatches({
  matches,
  all,
  interpretation,
  want,
}: {
  matches: ScoredRecipe[];
  all: ScoredRecipe[];
  /** The same query the pick was judged on, so a runner-up answers it too. */
  interpretation: Interpretation;
  want: Texture | null;
}) {
  return (
    <section className="mt-10">
      {/* Darker and a size up than the labels inside the cards. Those sit on
          opaque paper; this one sits directly on the sprinkles, and faint
          grey small-caps over a field of coloured dots is the one place on
          the page where the background wins. */}
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink">
        Close behind
      </h2>
      {/* On paper, like everything else that carries detail. These rows used
          to sit straight on the sprinkles, with thumbnails and small grey
          type competing against a field of coloured dots. */}
      <ul className="mt-3 divide-y divide-line-soft overflow-hidden rounded-3xl border-2 border-line bg-paper">
        {matches.map((r) => (
          <li key={r.id}>
            {/* Native <details> rather than a dialog: several can be open at
                once, which is the point -- you are comparing. It also brings
                keyboard support and independent toggling with no state. */}
            <details className="group">
              <summary
                className="flex cursor-pointer list-none items-center gap-4 px-4 py-3
                           hover:bg-cream-deep [&::-webkit-details-marker]:hidden"
              >
                {r.image_url && (
                  <span className="relative block h-14 w-14 flex-none overflow-hidden rounded-xl">
                    <Image src={r.image_url} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold group-open:text-clay-deep">
                    {r.title}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {r.dish_type ? `${r.dish_type} · ` : ""}
                    {r.source_name}
                    {r.rating !== null && ` · ${r.rating}★`}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex-none text-ink-faint transition-transform group-open:rotate-90"
                >
                  ›
                </span>
              </summary>

              {/* No card of its own any more: the list around it is already
                  paper, so a second bordered box inside it was a box in a
                  box. */}
              <div className="ml-[4.5rem] mr-4 pb-5">
                {/* The real interpretation, not null. These rows used to show
                    ratio plots whatever was asked, so someone who typed
                    "quick, no mixer" got butter-per-flour four times over and
                    never found out that two of the runners-up also skip the
                    chilling. A runner-up has to answer the question the pick
                    was answering, or there is no comparing them. */}
                <WhyThisOne
                  recipe={r}
                  all={all}
                  interpretation={interpretation}
                  want={want}
                  label="Why it's close"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-clay-deep px-4 py-2.5 text-sm font-semibold text-paper hover:bg-clay"
                  >
                    Open the recipe
                  </a>
                  <SaveButton recipeId={r.id} compact />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What a signed-out visitor sees.
 *
 * Previously this was a pitch and then a wall of cookie photographs, which
 * showed that the app has recipes but not what it does with them. The ratios
 * are the actual product, so they go here: a real recommendation for a real
 * query, rendered by the same component the signed-in page uses, so the demo
 * cannot drift from the thing it is demonstrating.
 */
function Example({ recipes }: { recipes: ScoredRecipe[] }) {
  const demo = interpret("chewy");
  const best = [...recipes].sort(
    (a, b) => matchScore(asRankable(b), demo) - matchScore(asRankable(a), demo),
  )[0];

  return (
    <div>
      <div className="rounded-3xl border-2 border-clay-deep bg-paper px-6 py-5 md:px-8">
        <h2 className="text-xl font-bold leading-snug tracking-tight">
          Every cookie recipe is a little different. This helps you find yours.
        </h2>
        <ol className="mt-4 space-y-2 text-sm text-ink-soft">
          <li>
            <span className="font-semibold text-ink">Say how you want them.</span>{" "}
            Chewy, cakey, crispy edges, quick, no mixer.
          </li>
        </ol>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="mt-4 rounded-full bg-clay-deep px-6 py-3 font-semibold text-paper hover:bg-clay"
          >
            Sign up to try it
          </button>
        </SignUpButton>
      </div>

      <p className="mt-8 text-sm font-medium text-ink-soft">
        For instance, if you say &ldquo;chewy&rdquo;:
      </p>

      {best && (
        <Recommendation
          recipe={best}
          want="chewy"
          all={recipes}
          query="chewy"
          interpretation={demo}
          compact
        />
      )}
    </div>
  );
}

/**
 * What the box understood, said out loud.
 *
 * This is the whole reason a search box is allowed to replace three buttons.
 * Presets can't be misread; free text can, and silently. Showing the reading
 * back -- including the words that meant nothing -- is what keeps it honest,
 * and it teaches the vocabulary without a help page.
 */
function Reading({
  query,
  interpretation: i,
  count,
  poolCount,
}: {
  query: string;
  interpretation: Interpretation;
  /** Corpus size, shown in the empty state. */
  count: number;
  /** How many recipes survived the dish filter. */
  poolCount: number;
}) {
  if (query.trim().length === 0) {
    // Was "Or just scroll. Everything is below." -- written when a grid of
    // every recipe sat underneath. Nothing is below any more, so it was
    // pointing at thin air. The replacement also states the corpus size,
    // which nothing else on the page does now the grid has gone.
    return (
      <p className="mt-6 text-base text-ink">
        <span className="font-bold">{count}</span> recipes in the jar. Say the
        word and I&apos;ll pick one.
      </p>
    );
  }

  if (i.empty) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-pink bg-paper px-5 py-4">
        <p className="text-sm font-semibold">
          I couldn&apos;t read anything in that.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Try a texture (chewy, cakey, extra crispy, thin, fudgy), a kind
          (oatmeal, peanut butter, snickerdoodle) or how much work you want
          (quick, no mixer).
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 text-sm">
      <p>
        <span className="text-ink-soft">Reading that as: </span>
        {i.understood.map((u, n) => (
          <span key={u}>
            {n > 0 && <span className="text-ink-faint">, </span>}
            <span className="font-semibold">{u}</span>
          </span>
        ))}
      </p>
      {i.dishes.length > 0 && (
        <p className="mt-1 text-ink-soft">
          Looking at <span className="font-semibold text-ink">{poolCount}</span>{" "}
          {i.dishes.join(" and ")} recipes.
        </p>
      )}

      {/* A negated word is dropped rather than inverted, so it has to be said
          out loud -- "not cakey" quietly doing nothing is the same silent
          failure as a word that was never understood. */}
      {i.refused.length > 0 && (
        <p className="mt-1 text-ink-faint">
          I can rank <span className="italic">toward</span> a texture but not
          away from one, so{" "}
          {i.refused.map((w, n) => (
            <span key={w}>
              {n > 0 && (n === i.refused.length - 1 ? " and " : ", ")}
              <span className="italic">not {w}</span>
            </span>
          ))}{" "}
          {i.refused.length === 1 ? "was" : "were"} left out.
        </p>
      )}

      {i.unrecognised.length > 0 && (
        <p className="mt-1 text-ink-faint">
          I don&apos;t know what{" "}
          {i.unrecognised.map((w, n) => (
            <span key={w}>
              {/* Oxford-less list: "a", "a and b", "a, b and c". */}
              {n > 0 && (n === i.unrecognised.length - 1 ? " and " : ", ")}
              <span className="italic">{w}</span>
            </span>
          ))}{" "}
          {i.unrecognised.length === 1 ? "means" : "mean"} here, so{" "}
          {i.unrecognised.length === 1 ? "it was" : "they were"} ignored.
        </p>
      )}
    </div>
  );
}

/**
 * Where to go when you have not asked for anything yet.
 *
 * This replaced a panel comparing three recipes' butter ratios. The idea was
 * to show the project's premise -- that recipes disagree -- but the percentile
 * picks included a giant single cookie, so "same cookie, nearly twice the
 * butter" read as a contradiction rather than an argument. The evidence
 * belongs beside a recommendation, where there is a recipe to explain; on an
 * empty page it was a chart asking to be studied before anything was asked.
 *
 * So: the two places you can actually go, as photographs rather than as the
 * small text links in the header.
 */
function Shortcuts({ recipes }: { recipes: ScoredRecipe[] }) {
  // Deterministic, so the tile does not reshuffle on every render. Sorted by
  // id rather than picked at random for the same reason.
  const photos = recipes
    .filter((r) => r.image_url !== null)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 4);

  if (photos.length < 4) return null;

  return (
    <section className="mt-10 grid gap-4 md:grid-cols-[1.6fr_1fr]">
      <Link
        href="/recipes"
        className="group overflow-hidden rounded-3xl border-2 border-line bg-paper
                   transition-colors hover:border-pink-deep"
      >
        <div className="grid grid-cols-4">
          {photos.map((r) => (
            <div key={r.id} className="relative aspect-square">
              <Image
                src={r.image_url!}
                alt=""
                fill
                sizes="(max-width: 768px) 25vw, 120px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        <div className="p-5">
          <h2 className="text-lg font-bold tracking-tight group-hover:text-clay-deep">
            All recipes
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Scroll all {recipes.length}, or filter by name.
          </p>
        </div>
      </Link>

      {/* No photograph here on purpose. Any cookie put on this tile would look
          like something you had already saved, and on a new account that is a
          promise the page cannot keep. */}
      <Link
        href="/saved"
        className="group flex flex-col justify-between overflow-hidden rounded-3xl border-2
                   border-line bg-cream-deep p-5 transition-colors hover:border-pink-deep"
      >
        {/* A drawn mark rather than an emoji: the colour emoji ships Apple's
            palette, which is nothing like this one, and it reads as a sticker
            dropped on the page. */}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-9 w-9 text-clay-deep"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4.2-7 4.2v-16a1 1 0 0 1 1-1Z" />
        </svg>
        <span className="mt-8">
          <span className="block text-lg font-bold tracking-tight group-hover:text-clay-deep">
            Saved
          </span>
          <span className="mt-1 block text-sm text-ink-soft">
            The ones you kept.
          </span>
        </span>
      </Link>
    </section>
  );
}

/* ------------------------------------------------------------ the answer -- */

function Recommendation({
  recipe,
  want,
  all,
  query,
  interpretation,
  compact = false,
}: {
  recipe: ScoredRecipe;
  /** Null when the query was only about effort, e.g. "quick". */
  want: Texture | null;
  all: ScoredRecipe[];
  /** Stored with the save: a better reminder than the title alone. */
  query: string;
  /** Drives which evidence is shown. Null in the signed-out example. */
  interpretation: Interpretation | null;
  /** The signed-out example: a preview, not the real thing. */
  compact?: boolean;
}) {
  const withRatios = all.filter((r) => r.scores.ratios !== null);
  const mine = recipe.scores.ratios;

  const grams = (n: number) => `${Math.round(n * 100)} g`;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <article className="mt-8 overflow-hidden rounded-3xl border-2 border-clay-deep bg-paper">
      <div
        className={
          compact
            ? "grid gap-0 md:grid-cols-[14rem_minmax(0,1fr)]"
            : "grid gap-0 md:grid-cols-[minmax(0,1fr)_1.15fr]"
        }
      >
        {recipe.image_url && (
          <div
            className={
              compact
                ? "relative aspect-[4/3] md:aspect-auto"
                : "relative aspect-[4/3] md:aspect-auto md:min-h-[22rem]"
            }
          >
            <Image
              src={recipe.image_url}
              alt=""
              fill
              // Must match what it actually renders at, or Next picks a file
              // too small and the browser upscales it. The compact preview is
              // a 14rem column; the full card is ~40% of a 64rem page.
              sizes={compact ? "(max-width: 768px) 100vw, 224px" : "(max-width: 768px) 100vw, 420px"}
              quality={90}
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* A fixed viewport at md+, scrolling inside. Opening Ingredients used
            to add its height to the card -- capping it at 16rem only made the
            growth smaller, not absent. Now the card is always the height of
            its photograph and the content scrolls within. Stacked on mobile,
            where a fixed height would be wrong. */}
        <div
          className={
            compact
              ? "p-5"
              : "p-6 md:h-[22rem] md:overflow-y-auto md:p-8"
          }
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-clay-deep">
            {compact ? "For example" : "Make this one"}
          </p>

          <h2 className={compact ? "mt-2 text-lg font-bold leading-tight tracking-tight" : "mt-2 text-2xl font-bold leading-tight tracking-tight"}>
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-pink decoration-2 underline-offset-4 hover:decoration-clay-deep"
            >
              {recipe.title}
            </a>
          </h2>

          {!compact && (
            <div className="mt-4">
              <SaveButton recipeId={recipe.id} savedFor={query.trim() || undefined} />
            </div>
          )}

          {recipe.dish_type && (
            <p className="mt-3 inline-block rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-ink-soft">
              {recipe.dish_type}
            </p>
          )}

          <p className="mt-4 text-sm text-ink-soft">
            {recipe.source_name}
            {recipe.rating !== null && ` · ${recipe.rating}★`}
            {recipe.rating_count !== null && ` (${recipe.rating_count})`}
            {recipe.yield_count !== null && ` · makes ${recipe.yield_count}`}
          </p>

          <div className="mt-6">
            <WhyThisOne
              recipe={recipe}
              all={all}
              interpretation={interpretation}
              want={want}
              only={compact ? 1 : undefined}
            />
          </div>

          {recipe.scores.confidence === "low" && (
            <p className="mt-4 text-xs text-ink-faint">
              Much of this ingredient list couldn&apos;t be read, so this is a
              weaker guess.
            </p>
          )}

          {!compact && (
          <details className="mt-6">
            {/* py-3 gets this to a 44px tap target. The proposal's own words:
                "That rules out small tap targets" -- and a 20px summary in a
                kitchen is exactly that. */}
            <summary className="-mx-2 cursor-pointer rounded-lg px-2 py-3 text-sm font-medium text-clay-deep hover:bg-cream-deep">
              Ingredients
            </summary>
            {/* Bounded, with its own scroll. Twenty ingredient rows used to
                grow the card by their full height. Top-aligning the columns
                stopped that but left dead space beside a taller content
                column, so the image stretches as before and the cap is what
                keeps the growth in hand. */}
            <div className="mt-3 max-h-64 overflow-y-auto pr-1">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {recipe.ingredients.map((i) => (
                  <tr key={i.position} className="border-b border-line-soft last:border-0">
                    <td className="py-1.5 pr-3">{i.raw_text}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-soft">
                      {/* null is not zero. An unconvertible ingredient has no
                          weight; it must not read as weighing nothing. */}
                      {i.grams === null ? "—" : `${i.grams} g`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>
          )}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------- the wall -- */
