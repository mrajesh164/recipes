/**
 * Fetch every URL in urls.txt, extract it, and write rows ready for seeding.
 *
 *   node --experimental-strip-types packages/corpus/src/run.ts
 *
 * Prints a per-site outcome and a parser-health number, which is one of the
 * two things the proposal promised to measure.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAll } from "./fetch.ts";
import { extractRecipe, titleMatches, type ExtractedRecipe } from "./extract.ts";
import { classifyDish, titleKeywordsFor, titleIsExcluded, type DishType } from "./dish.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");

export interface CorpusRecipe extends ExtractedRecipe {
  /** Which cookie this is. The corpus is mostly, but no longer only, chocolate chip. */
  dishType: DishType;
}

type Outcome =
  | { url: string; ok: true; recipe: CorpusRecipe }
  | { url: string; ok: false; reason: string };

function readUrls(): string[] {
  return readFileSync(join(PKG, "urls.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function host(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

/**
 * The identity of a recipe, for duplicate-spotting.
 *
 * Two URLs that differ only by a trailing slash, a ?utm_source, or http vs
 * https are one page. fetch.ts reports where a request actually landed, which
 * catches the redirect case; this catches the rest.
 */
function identity(u: string): string {
  try {
    const p = new URL(u);
    return `${p.hostname.replace(/^www\./, "")}${p.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return u;
  }
}

const requested = readUrls();
// Deduplicate before spending a request on it.
const urls = [...new Map(requested.map((u) => [identity(u), u])).values()];
if (urls.length !== requested.length) {
  console.log(`(${requested.length - urls.length} duplicate urls in urls.txt, skipped)`);
}
console.log(`fetching ${urls.length} urls, one at a time...\n`);

const results = await fetchAll(urls);

/**
 * Keyed on where the request *landed*, not where it was aimed.
 *
 * /recipes/chocolate-chip-cookies-recipe redirects to
 * /recipes/classic-chocolate-chip-cookies-recipe, and storing the requested
 * URL as the identity means the same recipe enters the corpus twice under two
 * keys -- which is how a duplicate first appeared. Two different requests that
 * land on the same page are one recipe, and the first one wins.
 */
const seen = new Map<string, string>();
let redirectDupes = 0;

const outcomes: Outcome[] = results.map((r) => {
  if (r.error) return { url: r.url, ok: false, reason: `network: ${r.error}` };
  if (r.status === 403) return { url: r.url, ok: false, reason: "403 blocked (bot protection)" };
  if (!r.html) return { url: r.url, ok: false, reason: `http ${r.status}` };

  const key = identity(r.finalUrl);
  const firstSeenAt = seen.get(key);
  if (firstSeenAt && firstSeenAt !== r.url) {
    redirectDupes++;
    return { url: r.url, ok: false, reason: `duplicate: redirects to ${r.finalUrl}` };
  }
  seen.set(key, r.url);

  const recipe = extractRecipe(r.html, r.finalUrl);
  if (!recipe) return { url: r.url, ok: false, reason: "no schema.org Recipe on the page" };

  // What did the URL promise? That is what the title has to deliver.
  const dishType = classifyDish(r.finalUrl) ?? classifyDish(r.url);
  if (!dishType) return { url: r.url, ok: false, reason: "url names no single dish" };

  // The page answered, but with what? A Food.com cookie URL returned
  // "Apricot Banana Bread" during the spike.
  if (!titleMatches(recipe.title, titleKeywordsFor(dishType))) {
    return { url: r.url, ok: false, reason: `title is not a ${dishType} cookie: "${recipe.title}"` };
  }
  // A slug can be kinder than the recipe: /chocolate-chip-cookies/ that turns
  // out to be "...Cookie Bars" is still a bar.
  const banned = titleIsExcluded(recipe.title);
  if (banned) {
    return { url: r.url, ok: false, reason: `title says "${banned}": "${recipe.title}"` };
  }

  return { url: r.url, ok: true, recipe: { ...recipe, dishType } };
});

// ------------------------------------------------------------- reporting --

const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
const good = outcomes.filter((o): o is Extract<Outcome, { ok: true }> => o.ok);
const bad = outcomes.filter((o): o is Extract<Outcome, { ok: false }> => !o.ok);

console.log(pad("SITE", 24), pad("RECIPE", 44), pad("DISH", 15), pad("g?", 8), "METHOD");
console.log("-".repeat(104));
for (const o of good) {
  const r = o.recipe;
  const withGrams = r.ingredients.filter((i) => i.grams !== null).length;
  console.log(
    pad(host(r.sourceUrl), 24), pad(r.title, 44), pad(r.dishType, 15),
    pad(`${withGrams}/${r.ingredients.length}`, 8), r.method ?? "-",
  );
}

if (bad.length) {
  console.log(`\n${bad.length} dropped:`);
  const byReason = new Map<string, number>();
  for (const o of bad) {
    const kind = o.reason.split(":")[0]!;
    byReason.set(kind, (byReason.get(kind) ?? 0) + 1);
  }
  for (const [kind, n] of [...byReason].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(kind, 36)} ${n}`);
  }
}

const bySite = new Map<string, number>();
const byDish = new Map<string, number>();
for (const o of good) {
  bySite.set(host(o.recipe.sourceUrl), (bySite.get(host(o.recipe.sourceUrl)) ?? 0) + 1);
  byDish.set(o.recipe.dishType, (byDish.get(o.recipe.dishType) ?? 0) + 1);
}
console.log(`\nby site:`);
for (const [s, n] of [...bySite].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(s, 30)} ${n}`);
console.log(`by dish:`);
for (const [d, n] of [...byDish].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(d, 30)} ${n}`);

const allIngredients = good.flatMap((o) => o.recipe.ingredients);
const converted = allIngredients.filter((i) => i.grams !== null);

/**
 * Per-recipe resolution, not just the global average.
 *
 * The global number hides the case that actually matters: one recipe where
 * half the lines failed is a bad row in the corpus, and it averages away
 * behind forty good ones.
 */
const weak = good
  .map((o) => {
    const t = o.recipe.ingredients.length;
    const g = o.recipe.ingredients.filter((i) => i.grams !== null).length;
    return { title: o.recipe.title, url: o.recipe.sourceUrl, g, t, rate: t ? g / t : 0 };
  })
  .filter((r) => r.rate < 0.8)
  .sort((a, b) => a.rate - b.rate);

console.log(`
pages:        ${good.length}/${outcomes.length} usable${redirectDupes ? ` (${redirectDupes} were redirect duplicates)` : ""}
ingredients:  ${converted.length}/${allIngredients.length} resolved to grams \
(${allIngredients.length ? Math.round((converted.length / allIngredients.length) * 100) : 0}%)
recipes under 80% resolved: ${weak.length}`);

for (const w of weak) console.log(`   ${w.g}/${w.t}  ${w.title}  ${w.url}`);

const unresolved = allIngredients.filter((i) => i.grams === null);
if (unresolved.length) {
  console.log(`\nnot resolved -- each one is a missing synonym or density, not a bad row:`);
  const counts = new Map<string, number>();
  for (const i of unresolved) counts.set(i.raw.trim(), (counts.get(i.raw.trim()) ?? 0) + 1);
  for (const [raw, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${n > 1 ? `${n}x ` : "   "}${raw}`);
  }
}

// ---------------------------------------------------------------- output --

mkdirSync(join(PKG, "out"), { recursive: true });
const outPath = join(PKG, "out", "recipes.json");
writeFileSync(outPath, JSON.stringify(good.map((o) => o.recipe), null, 2));
console.log(`\nwrote ${good.length} recipes to ${outPath}`);
