"use client";

import { useState } from "react";
import Image from "next/image";
import { rankFor, type Texture } from "@recipes/core";
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

const TEXTURES: { key: Texture; label: string; blurb: string }[] = [
  { key: "chewy", label: "Chewy", blurb: "soft, dense middle" },
  { key: "cakey", label: "Cakey", blurb: "taller, lighter crumb" },
  { key: "crispy", label: "Crispy", blurb: "thin and snappy" },
];

export function Picker({ recipes }: { recipes: ScoredRecipe[] }) {
  const [want, setWant] = useState<Texture | null>(null);

  const ranked = want ? rankFor(recipes, want) : [];
  const best = ranked[0];
  const rest = want ? ranked.slice(1) : recipes;

  return (
    <div>
      <fieldset className="border-0 p-0">
        <legend className="font-semibold">How do you want them to come out?</legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {TEXTURES.map((t) => {
            const active = want === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => setWant(t.key)}
                className={[
                  // Generous hit area: this gets tapped with floury hands.
                  "min-w-[9.5rem] rounded-2xl border-2 px-5 py-3 text-left transition-colors",
                  active
                    ? "border-clay-deep bg-clay-deep text-paper"
                    : "border-line bg-paper hover:border-pink-deep",
                ].join(" ")}
              >
                <span className="block text-lg font-bold tracking-tight">{t.label}</span>
                <span className={active ? "block text-xs opacity-85" : "block text-xs text-ink-faint"}>
                  {t.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {!want && (
        <p className="mt-6 text-sm text-ink-soft">
          Pick one and I&apos;ll tell you which of these {recipes.length} to make.
        </p>
      )}

      {best && want && <Recommendation recipe={best} want={want} all={recipes} />}

      {rest.length > 0 && (
        <section className="mt-16">
          <div className="dotted-rule" aria-hidden />
          <h2 className="mt-6 text-xl font-bold tracking-tight">
            {want ? "The rest of them" : "All of them"}
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

/* ------------------------------------------------------------ the answer -- */

function Recommendation({
  recipe,
  want,
  all,
}: {
  recipe: ScoredRecipe;
  want: Texture;
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
