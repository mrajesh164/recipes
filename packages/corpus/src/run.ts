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

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");

/** Every recipe in this corpus should be one of these. */
const EXPECTED = ["chocolate", "chip"];

type Outcome =
  | { url: string; ok: true; recipe: ExtractedRecipe; warning: string | null }
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

const urls = readUrls();
console.log(`fetching ${urls.length} urls, one at a time...\n`);

const results = await fetchAll(urls);
const outcomes: Outcome[] = results.map((r) => {
  if (r.error) return { url: r.url, ok: false, reason: `network: ${r.error}` };
  if (r.status === 403) return { url: r.url, ok: false, reason: "403 blocked (bot protection)" };
  if (!r.html) return { url: r.url, ok: false, reason: `http ${r.status}` };

  const recipe = extractRecipe(r.html, r.finalUrl);
  if (!recipe) return { url: r.url, ok: false, reason: "no schema.org Recipe on the page" };

  // The page answered, but with what? A Food.com cookie URL returned
  // "Apricot Banana Bread" during the spike.
  const warning = titleMatches(recipe.title, EXPECTED)
    ? null
    : `title does not look like the dish asked for: "${recipe.title}"`;
  return { url: r.url, ok: true, recipe, warning };
});

// ------------------------------------------------------------- reporting --

const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
console.log(pad("SITE", 24), pad("RECIPE", 38), pad("ING", 5), pad("g?", 7), "METHOD");
console.log("-".repeat(92));

for (const o of outcomes) {
  if (!o.ok) {
    console.log(pad(host(o.url), 24), `-- ${o.reason}`);
    continue;
  }
  const r = o.recipe;
  const withGrams = r.ingredients.filter((i) => i.grams !== null).length;
  console.log(
    pad(host(o.url), 24),
    pad(r.title, 38),
    pad(String(r.ingredients.length), 5),
    pad(`${withGrams}/${r.ingredients.length}`, 7),
    r.method ?? "-",
  );
  if (o.warning) console.log(" ".repeat(24), `!! ${o.warning}`);
}

const good = outcomes.filter((o): o is Extract<Outcome, { ok: true }> => o.ok && !o.warning);
const allIngredients = good.flatMap((o) => o.recipe.ingredients);
const converted = allIngredients.filter((i) => i.grams !== null);

console.log(`
pages:        ${good.length}/${outcomes.length} usable
ingredients:  ${converted.length}/${allIngredients.length} resolved to grams \
(${allIngredients.length ? Math.round((converted.length / allIngredients.length) * 100) : 0}%)`);

const unresolved = allIngredients.filter((i) => i.grams === null);
if (unresolved.length) {
  console.log(`\nnot resolved -- each one is a missing synonym or density, not a bad row:`);
  for (const i of unresolved) console.log(`   ${i.raw}`);
}

// ---------------------------------------------------------------- output --

mkdirSync(join(PKG, "out"), { recursive: true });
const outPath = join(PKG, "out", "recipes.json");
writeFileSync(outPath, JSON.stringify(good.map((o) => o.recipe), null, 2));
console.log(`\nwrote ${good.length} recipes to ${outPath}`);
