"use client";

import { useState } from "react";
import Image from "next/image";
import {
  interpret, matchScore, dominantTexture,
  type Texture, type Interpretation, type Rankable,
} from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";
import { RangePlot } from "./RangePlot";

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
  const rest = asked ? ranked.slice(1) : recipes;
  const want = dominantTexture(interpretation);

  return (
    <div>
      <label htmlFor="q" className="block font-semibold">
        What are you after?
      </label>
      <p className="mt-1 text-sm text-ink-soft">
        Describe the cookie you want. Texture, or how much effort you feel like.
      </p>

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

      {best && <Recommendation recipe={best} want={want} all={recipes} />}

      {rest.length > 0 && (
        <section className="mt-16">
          <div className="dotted-rule" aria-hidden />
          <h2 className="mt-6 text-xl font-bold tracking-tight">
            {asked ? "The rest of them" : "All of them"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Every one is a real published recipe. Nothing here is averaged together.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((r) => (
              <li key={r.id}>
                <Card recipe={r} />
              </li>
            ))}
          </ul>
        </section>
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
        Or just scroll — everything is below.
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
          Try a texture — chewy, cakey, crispy, thin, thick, fudgy — or something
          about effort, like &ldquo;quick&rdquo; or &ldquo;no mixer&rdquo;.
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
}: {
  recipe: ScoredRecipe;
  /** Null when the query was only about effort, e.g. "quick". */
  want: Texture | null;
  all: ScoredRecipe[];
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

          <p className="mt-2 text-sm text-ink-soft">
            {recipe.source_name}
            {recipe.rating !== null && ` · ${recipe.rating}★`}
            {recipe.rating_count !== null && ` (${recipe.rating_count})`}
            {recipe.yield_count !== null && ` · makes ${recipe.yield_count}`}
          </p>

          {mine && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                Why this one, out of {withRatios.length}
              </h3>
              <div className="mt-1 divide-y divide-line-soft">
                <RangePlot
                  label="Butter per 100 g flour"
                  hint="more = chewier"
                  values={withRatios.map((r) => r.scores.ratios!.fatPerFlour)}
                  picked={mine.fatPerFlour}
                  format={grams}
                />
                <RangePlot
                  label="Brown sugar"
                  hint="more = chewier, softer"
                  values={withRatios.map((r) => r.scores.ratios!.brownShare)}
                  picked={mine.brownShare}
                  format={pct}
                />
                <RangePlot
                  label="Sugar per 100 g flour"
                  hint="more = crispier"
                  values={withRatios.map((r) => r.scores.ratios!.sugarPerFlour)}
                  picked={mine.sugarPerFlour}
                  format={grams}
                />
              </div>
            </div>
          )}

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
              Not much of this recipe&apos;s ingredient list could be read, so this is a
              weaker guess than usual.
            </p>
          )}

          <details className="mt-6">
            {/* py-3 gets this to a 44px tap target. The proposal's own words:
                "That rules out small tap targets" -- and a 20px summary in a
                kitchen is exactly that. */}
            <summary className="-mx-2 cursor-pointer rounded-lg px-2 py-3 text-sm font-medium text-clay-deep hover:bg-cream-deep">
              Ingredients, in grams
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

function Card({ recipe }: { recipe: ScoredRecipe }) {
  return (
    <a
      href={recipe.source_url}
      target="_blank"
      rel="noreferrer"
      className="group block h-full overflow-hidden rounded-2xl border border-line bg-paper transition-colors hover:border-pink-deep"
    >
      {recipe.image_url && (
        <div className="relative aspect-[4/3]">
          <Image
            src={recipe.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-bold leading-snug tracking-tight group-hover:text-clay-deep">
          {recipe.title}
        </h3>
        <p className="mt-1 text-xs text-ink-faint">
          {recipe.source_name}
          {recipe.rating !== null && ` · ${recipe.rating}★`}
        </p>
        {recipe.method && recipe.method !== "other" && (
          <p className="mt-2 inline-block rounded-full bg-cream-deep px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
            {recipe.method} butter
          </p>
        )}
      </div>
    </a>
  );
}
