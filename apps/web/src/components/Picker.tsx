"use client";

import { useState } from "react";
import Image from "next/image";
import { SignUpButton, useAuth } from "@clerk/nextjs";
import { SaveButton } from "./SaveButton";
import {
  interpret, matchScore, dominantTexture,
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
  "cakey and tall",
  "quick, no mixer",
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

  const ranked = asked
    ? [...recipes].sort(
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
          placeholder="chewy, thick, crispy edges, quick…"
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

      <Reading query={query} interpretation={interpretation} count={recipes.length} />

      {best && (
        <Recommendation
          recipe={best}
          want={want}
          all={recipes}
          query={query}
          interpretation={interpretation}
        />
      )}

      {asked && ranked.length > 1 && (
        <CloseMatches matches={ranked.slice(1, 5)} best={best!} all={recipes} />
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
 * the near misses are shown, and each says the one way it differs from the
 * pick -- which is the only reason to look at a runner-up at all.
 *
 * Fixed at four, so the page is the same height whether the corpus holds
 * thirteen recipes or a thousand.
 */
function CloseMatches({
  matches,
  best,
  all,
}: {
  matches: ScoredRecipe[];
  best: ScoredRecipe;
  all: ScoredRecipe[];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
        Close behind
      </h2>
      <ul className="mt-3 divide-y divide-line-soft">
        {matches.map((r) => (
          <li key={r.id}>
            {/* Native <details> rather than a dialog: several can be open at
                once, which is the point -- you are comparing. It also brings
                keyboard support and independent toggling with no state. */}
            <details className="group">
              <summary
                className="flex cursor-pointer list-none items-center gap-4 py-3
                           [&::-webkit-details-marker]:hidden"
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
                <span className="flex-none text-right text-xs text-ink-soft">
                  {differenceFrom(r, best)}
                </span>
                <span
                  aria-hidden
                  className="flex-none text-ink-faint transition-transform group-open:rotate-90"
                >
                  ›
                </span>
              </summary>

              <div className="pb-5 pl-[4.5rem] pr-2">
                <WhyThisOne recipe={r} all={all} interpretation={null} want={null} heading={false} />
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-clay-deep underline underline-offset-4"
                >
                  Open the recipe
                </a>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The single most useful thing to say about a runner-up: how it differs from
 * the one being recommended. Picks whichever ratio differs most, so the line
 * is never filler.
 */
function differenceFrom(r: ScoredRecipe, best: ScoredRecipe): string {
  const a = r.scores.ratios;
  const b = best.scores.ratios;
  if (!a || !b) return "";
  if (r.method !== best.method && r.method && r.method !== "other") {
    return `${r.method} butter`;
  }
  const diffs: [string, number, string][] = [
    ["butter", a.fatPerFlour - b.fatPerFlour, `${Math.round(Math.abs(a.fatPerFlour - b.fatPerFlour) * 100)} g`],
    ["brown sugar", a.brownShare - b.brownShare, `${Math.round(Math.abs(a.brownShare - b.brownShare) * 100)}%`],
    ["sugar", a.sugarPerFlour - b.sugarPerFlour, `${Math.round(Math.abs(a.sugarPerFlour - b.sugarPerFlour) * 100)} g`],
  ];
  const [label, delta, amount] = diffs.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0]!;
  if (Math.abs(delta) < 0.02) return "almost identical";
  return `${delta > 0 ? "+" : "−"}${amount} ${label}`;
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
          <li>
            <span className="font-semibold text-ink">You get one, and why.</span>{" "}
            Where it sits on butter, sugar and flour against all the others.
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
}: {
  query: string;
  interpretation: Interpretation;
  /** Corpus size, shown in the empty state. */
  count: number;
}) {
  if (query.trim().length === 0) {
    // Was "Or just scroll. Everything is below." -- written when a grid of
    // every recipe sat underneath. Nothing is below any more, so it was
    // pointing at thin air. The replacement also states the corpus size,
    // which nothing else on the page does now the grid has gone.
    return (
      <p className="mt-6 text-sm text-ink-soft">
        <span className="font-semibold text-ink">{count}</span> recipes in the
        jar. Say the word and I&apos;ll pick one.
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
          Try chewy, cakey, crispy, thin or fudgy. Or quick, no mixer.
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
            ? "grid gap-0 md:grid-cols-[14rem_minmax(0,1fr)] md:items-start"
            : "grid gap-0 md:grid-cols-[minmax(0,1fr)_1.15fr] md:items-start"
        }
      >
        {recipe.image_url && (
          <div
            className={
              compact
                ? "relative aspect-[4/3] md:aspect-auto md:h-[13rem]"
                : "relative aspect-[4/3] md:aspect-auto md:h-[22rem]"
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

        <div className={compact ? "p-5" : "p-6 md:p-8"}>
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
            {/* Bounded, with its own scroll. Fifteen ingredient rows used to
                grow the whole card -- and with the grid stretching, the
                photograph alongside it too. */}
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
