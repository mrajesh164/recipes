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
import { CompareDialog } from "./CompareDialog";

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
  const [query, setQuery] = useState("");
  const [compare, setCompare] = useState<ScoredRecipe | null>(null);
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
      <input
        id="q"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="chewy, thick, crispy edges, quick…"
        autoComplete="off"
        className="mt-3 w-full rounded-2xl border-2 border-line bg-paper px-5 py-4 text-lg
                   placeholder:text-ink-faint focus:border-clay-deep focus:outline-none"
      />

      <ul className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <li key={e}>
            <button
              type="button"
              onClick={() => setQuery(e)}
              className="rounded-full border border-line bg-paper px-3 py-2 text-xs text-ink-soft
                         hover:border-pink-deep hover:text-ink"
            >
              {e}
            </button>
          </li>
        ))}
      </ul>

      <Reading query={query} interpretation={interpretation} />

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
        <CloseMatches
          matches={ranked.slice(1, 5)}
          best={best!}
          onOpen={setCompare}
        />
      )}
      </>
      )}

      <CompareDialog recipe={compare} all={recipes} onClose={() => setCompare(null)} />
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
  onOpen,
}: {
  matches: ScoredRecipe[];
  best: ScoredRecipe;
  onOpen: (r: ScoredRecipe) => void;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
        Close behind
      </h2>
      <ul className="mt-3 divide-y divide-line-soft">
        {matches.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              className="group flex w-full items-center gap-4 py-3 text-left"
            >
              {r.image_url && (
                <span className="relative block h-14 w-14 flex-none overflow-hidden rounded-xl">
                  <Image src={r.image_url} alt="" fill sizes="56px" className="object-cover" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold group-hover:text-clay-deep">
                  {r.title}
                </span>
                <span className="block text-xs text-ink-faint">
                  {r.source_name}
                  {r.rating !== null && ` · ${r.rating}★`}
                </span>
              </span>
              <span className="flex-none text-right text-xs text-ink-soft">
                {differenceFrom(r, best)}
              </span>
            </button>
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
        <h2 className="text-xl font-bold tracking-tight">
          Say what you want. Get one recipe, and the reason.
        </h2>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="mt-4 rounded-full bg-clay-deep px-6 py-3 font-semibold text-paper hover:bg-clay"
          >
            Sign up to try it
          </button>
        </SignUpButton>
      </div>

      <p className="mt-8 text-sm text-ink-soft">
        Here is what &ldquo;chewy&rdquo; gives you, across {recipes.length} real recipes.
      </p>

      {best && (
        <Recommendation
          recipe={best}
          want="chewy"
          all={recipes}
          query="chewy"
          interpretation={demo}
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
}: {
  query: string;
  interpretation: Interpretation;
}) {
  if (query.trim().length === 0) {
    return (
      <p className="mt-6 text-sm text-ink-soft">
        Or just scroll. Everything is below.
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
}: {
  recipe: ScoredRecipe;
  /** Null when the query was only about effort, e.g. "quick". */
  want: Texture | null;
  all: ScoredRecipe[];
  /** Stored with the save: a better reminder than the title alone. */
  query: string;
  /** Drives which evidence is shown. Null in the signed-out example. */
  interpretation: Interpretation | null;
}) {
  const withRatios = all.filter((r) => r.scores.ratios !== null);
  const mine = recipe.scores.ratios;

  const grams = (n: number) => `${Math.round(n * 100)} g`;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <article className="mt-8 overflow-hidden rounded-3xl border-2 border-clay-deep bg-paper">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_1.15fr]">
        {recipe.image_url && (
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[22rem]">
            <Image
              src={recipe.image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-clay-deep">
            Make this one
          </p>

          <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-pink decoration-2 underline-offset-4 hover:decoration-clay-deep"
            >
              {recipe.title}
            </a>
          </h2>

          <div className="mt-4">
            <SaveButton recipeId={recipe.id} savedFor={query.trim() || undefined} />
          </div>

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
            />
          </div>

          <ul className="mt-5 flex flex-wrap gap-2">
            {recipe.scores.signals.slice(0, 3).map((s) => (
              <li
                key={s.label}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium",
                  s.leans === want
                    ? "bg-sage-deep text-paper"
                    : "bg-cream-deep text-ink-soft",
                ].join(" ")}
              >
                {s.label} · {s.value}
              </li>
            ))}
          </ul>

          {recipe.scores.confidence === "low" && (
            <p className="mt-4 text-xs text-ink-faint">
              Much of this ingredient list couldn&apos;t be read, so this is a
              weaker guess.
            </p>
          )}

          <details className="mt-6">
            {/* py-3 gets this to a 44px tap target. The proposal's own words:
                "That rules out small tap targets" -- and a 20px summary in a
                kitchen is exactly that. */}
            <summary className="-mx-2 cursor-pointer rounded-lg px-2 py-3 text-sm font-medium text-clay-deep hover:bg-cream-deep">
              Ingredients
            </summary>
            <table className="mt-3 w-full border-collapse text-sm">
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
          </details>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------- the wall -- */
