"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Recommendation } from "./Recommendation";
import { asRankable } from "@/lib/rankable";
import {
  interpret, matchScore, dominantTexture, candidatesFor,
  type Texture, type Interpretation, type Rankable,
} from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import { BookmarkIcon } from "./icons";
import { RecipeActions } from "./RecipeActions";
import { WhyThisOne } from "./WhyThisOne";
import { readUnknownWords, type Guess, type Inference } from "@/lib/semantic";

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

export function Picker({ recipes }: { recipes: ScoredRecipe[] }) {
  // `draft` is what is in the box; `query` is what has been submitted.
  // Interpreting every keystroke meant "very cri" flashed "I couldn't read
  // anything in that" mid-word and the whole page rearranged under the
  // cursor. Nothing happens now until you finish and press Enter.
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  /**
   * Words the vocabulary did not know, read as the nearest thing it does.
   *
   * Only runs when the keyword and misspelling tiers both came up empty, so a
   * query made of words the box already knows never loads the model and never
   * waits. See lib/semantic.ts for why the result is shown rather than applied
   * silently.
   */
  const [inferences, setInferences] = useState<Inference[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    setInferences([]);
    setGuesses([]);
    const first = interpret(query);
    if (query.trim() === "" || first.unrecognised.length === 0) return;

    let cancelled = false;
    setReading(true);
    readUnknownWords(first.unrecognised)
      .then((found) => {
        if (cancelled) return;
        setInferences(found.inferences);
        setGuesses(found.guesses);
      })
      // A failed model load must not break the search. The keyword tiers have
      // already produced an answer; this one only ever adds to it.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Substituting and re-interpreting, rather than scoring the inference
  // separately. An inferred word takes the weights its match already carries,
  // so there is one scoring path and the rest of the app cannot tell which
  // tier answered.
  const resolved = inferences.reduce(
    (q, i) => q.replace(new RegExp(`\\b${i.typed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), i.meant),
    query,
  );
  const interpretation = interpret(resolved);
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
        inferences={inferences}
        guesses={guesses}
        reading={reading}
        onTry={(phrase) => {
          setDraft(phrase);
          setQuery(phrase);
        }}
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
                <div className="mb-5">
                  <RecipeActions recipe={r} />
                </div>

                <WhyThisOne
                  recipe={r}
                  all={all}
                  interpretation={interpretation}
                  want={want}
                  label="Why it's close"
                />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
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
  inferences,
  guesses,
  reading,
  onTry,
}: {
  query: string;
  interpretation: Interpretation;
  /** Corpus size, shown in the empty state. */
  count: number;
  /** How many recipes survived the dish filter. */
  poolCount: number;
  /** Words read as something else, shown so a wrong read is correctable. */
  inferences: Inference[];
  /** Words too uncertain to read, offered as a question instead. */
  guesses: Guess[];
  /** The model is still loading or still thinking. */
  reading: boolean;
  /** Search one of the offered words instead. */
  onTry: (phrase: string) => void;
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

  if (i.empty && reading) {
    return (
      <p className="mt-6 text-sm text-ink-soft">
        Reading that&hellip;{" "}
        <span className="text-ink-faint">
          working out what those words mean, the first time takes a moment
        </span>
      </p>
    );
  }

  if (i.empty) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-pink bg-paper px-5 py-4">
        {guesses.length > 0 ? (
          <>
            {/* Not a dead end. The words that were too uncertain to act on are
                still the best lead available, so they are offered as a
                question rather than thrown away. */}
            <p className="text-sm font-semibold">
              I&apos;m not sure about{" "}
              {guesses.map((g, n) => (
                <span key={g.typed}>
                  {n > 0 && (n === guesses.length - 1 ? " or " : ", ")}
                  <span className="italic">{g.typed}</span>
                </span>
              ))}
              . Did you mean one of these?
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[...new Set(guesses.flatMap((g) => g.options))].map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => onTry(option)}
                    className="rounded-full border border-line bg-paper px-3 py-2 text-xs
                               font-semibold text-ink-soft transition-colors
                               hover:border-pink-deep hover:text-ink"
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">
              I couldn&apos;t read anything in that.
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Try a texture (chewy, cakey, extra crispy, thin, fudgy), a kind
              (oatmeal, peanut butter, snickerdoodle) or how much work you want
              (quick, no mixer).
            </p>
          </>
        )}
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
      {inferences.length > 0 && (
        <p className="mt-1 text-ink-soft">
          {inferences.map((inf, n) => (
            <span key={inf.typed}>
              {n > 0 && ", "}
              read <span className="italic">{inf.typed}</span> as{" "}
              <span className="font-semibold text-ink">{inf.meant}</span>
            </span>
          ))}
          .
        </p>
      )}

      {i.dishes.length > 0 && (
        <p className="mt-1 text-ink-soft">
          Looking at <span className="font-semibold text-ink">{poolCount}</span>{" "}
          {i.dishes.join(" and ")} recipes.
        </p>
      )}

      {/* A negation is acted on now, so it is reported as an action rather
          than as an apology. It used to say "I can rank toward a texture but
          not away from one", which was true when the word was being dropped
          and became a lie the moment it was not. */}
      {i.refused.length > 0 && (
        <p className="mt-1 text-ink-soft">
          Left out the ones that are mainly{" "}
          {i.refused.map((w, n) => (
            <span key={w}>
              {n > 0 && (n === i.refused.length - 1 ? " or " : ", ")}
              <span className="font-semibold text-ink">{w}</span>
            </span>
          ))}
          .
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
        <BookmarkIcon className="h-9 w-9 text-clay-deep" />
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

/* -------------------------------------------------------------- the wall -- */
