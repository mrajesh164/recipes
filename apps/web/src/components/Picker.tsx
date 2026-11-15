"use client";

import { useState } from "react";
import { rankFor, type Texture } from "@recipes/core";
import type { ScoredRecipe } from "@/lib/recipes";

/**
 * The core task, start to finish: pick a texture, get one recipe.
 *
 * Client-side because the whole corpus arrives with the page and ranking it is
 * a sort over a few dozen rows. Choosing a texture is then instant, with no
 * navigation and no second request -- which matters for a tool someone opens
 * with floury hands.
 *
 * One recommendation is shown by default, with the runner-up behind a toggle.
 * Five recipes side by side is the overwhelm this project exists to remove.
 */

const TEXTURES: { key: Texture; label: string; blurb: string }[] = [
  { key: "chewy", label: "Chewy", blurb: "soft and dense in the middle" },
  { key: "cakey", label: "Cakey", blurb: "taller, lighter, more crumb" },
  { key: "crispy", label: "Crispy", blurb: "thin, snappy, spread out" },
];

export function Picker({ recipes }: { recipes: ScoredRecipe[] }) {
  const [want, setWant] = useState<Texture | null>(null);
  const [showRunnerUp, setShowRunnerUp] = useState(false);

  const ranked = want ? rankFor(recipes, want) : [];
  const best = ranked[0];
  const runnerUp = ranked[1];

  return (
    <div>
      <fieldset>
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          How do you want them to come out?
        </legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {TEXTURES.map((t) => {
            const active = want === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setWant(t.key);
                  setShowRunnerUp(false);
                }}
                className={[
                  "rounded-lg border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500",
                ].join(" ")}
              >
                <span className="block font-medium">{t.label}</span>
                <span
                  className={[
                    "block text-xs",
                    active ? "opacity-80" : "text-neutral-500",
                  ].join(" ")}
                >
                  {t.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {want === null && (
        <p className="mt-8 text-sm text-neutral-500">
          Pick one and I&apos;ll tell you which of the {recipes.length} recipes to use.
        </p>
      )}

      {want !== null && !best && (
        <p className="mt-8 text-sm text-neutral-500">
          Nothing in the corpus yet. Seed some recipes first.
        </p>
      )}

      {best && <Recommendation recipe={best} want={want!} primary />}

      {runnerUp && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowRunnerUp((v) => !v)}
            className="text-sm underline underline-offset-4 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {showRunnerUp ? "Hide the second option" : "Show me a second option"}
          </button>
          {showRunnerUp && <Recommendation recipe={runnerUp} want={want!} />}
        </div>
      )}
    </div>
  );
}

function Recommendation({
  recipe,
  want,
  primary = false,
}: {
  recipe: ScoredRecipe;
  want: Texture;
  primary?: boolean;
}) {
  // Top three only. The rest are real but weak, and showing nine signals is
  // the same overwhelm in a different shape.
  const signals = recipe.scores.signals.slice(0, 3);

  return (
    <article
      className={[
        "mt-6 rounded-xl border p-5",
        primary
          ? "border-neutral-900 dark:border-neutral-100"
          : "border-neutral-300 dark:border-neutral-700",
      ].join(" ")}
    >
      {primary && (
        <p className="text-xs uppercase tracking-wider text-neutral-500">
          Make this one
        </p>
      )}

      <h2 className="mt-1 text-xl font-semibold">
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-900 dark:decoration-neutral-600 dark:hover:decoration-neutral-100"
        >
          {recipe.title}
        </a>
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        {recipe.source_name}
        {recipe.rating !== null && ` · ${recipe.rating}★`}
        {recipe.rating_count !== null && ` from ${recipe.rating_count}`}
        {recipe.yield_count !== null && ` · makes ${recipe.yield_count}`}
      </p>

      <h3 className="mt-5 text-xs uppercase tracking-wider text-neutral-500">
        Why this one
      </h3>
      <ul className="mt-2 space-y-1.5">
        {signals.map((s) => (
          <li key={s.label} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{s.label}</span>
            <span className="text-neutral-500">{s.value}</span>
            <span
              className={[
                "rounded px-1.5 py-0.5 text-xs",
                s.leans === want
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
              ].join(" ")}
            >
              leans {s.leans}
            </span>
          </li>
        ))}
      </ul>

      {/* Said plainly rather than hidden. The scoring is a heuristic and the
          sources genuinely disagree about some of these levers. */}
      {recipe.scores.confidence === "low" && (
        <p className="mt-4 text-xs text-neutral-500">
          Not much of this recipe&apos;s ingredient list could be read, so this is a
          weaker guess than usual.
        </p>
      )}

      <details className="mt-5">
        <summary className="cursor-pointer text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          Ingredients, in grams
        </summary>
        <table className="mt-3 w-full border-collapse text-sm">
          <tbody>
            {recipe.ingredients.map((i) => (
              <tr
                key={i.position}
                className="border-b border-neutral-200 last:border-0 dark:border-neutral-800"
              >
                <td className="py-1.5 pr-3">{i.raw_text}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {/* null is not zero. An ingredient we could not convert has
                      no weight, and must not read as weighing nothing. */}
                  {i.grams === null ? "—" : `${i.grams} g`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}
