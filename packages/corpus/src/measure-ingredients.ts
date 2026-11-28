/**
 * Measure the ingredient vocabulary the corpus actually uses.
 *
 *   node --experimental-strip-types packages/corpus/src/measure-ingredients.ts
 *
 * Writes packages/core/src/ingredients.ts, which is generated and committed,
 * the same arrangement as windows.ts and for the same reason: this is a
 * property of the data, so it is wrong the moment the corpus changes and has to
 * be re-measured rather than maintained by hand.
 *
 * The point is that the interpreter should not hold a list of ingredients
 * somebody typed out. "no coconut" is a reasonable thing to ask and coconut is
 * not a texture, a dish or a preference -- but 65 recipes mention it, so the
 * corpus can answer for itself whether a word is an ingredient.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

const recipes = JSON.parse(
  readFileSync(join(ROOT, "packages/corpus/out/recipes.json"), "utf8"),
) as { ingredients: { raw: string; canonicalName: string | null }[] }[];

/**
 * Words that appear in an ingredient line without being an ingredient.
 *
 * Units, quantities, preparation and packaging. Not a list of what counts --
 * that would be the hand-maintained vocabulary this exists to avoid -- but a
 * list of what is definitely scaffolding, which is a much more stable thing to
 * write down: "cups" will never become an ingredient.
 */
const SCAFFOLD = new Set(
  (
    "cup cups teaspoon teaspoons tablespoon tablespoons tsp tbsp ounce ounces oz " +
    "pound pounds lb lbs gram grams g kg ml liter litre quart pint stick sticks " +
    "can cans package packages pkg box jar bag container bottle " +
    "and or the for plus about approximately each per into from with without " +
    "room temperature divided optional large medium small extra " +
    "softened melted packed sifted chopped finely coarsely freshly fresh " +
    "ground grated shredded sliced diced halved quartered crushed toasted " +
    "lightly heaping scant level rounded generous pinch dash " +
    "more than less light dark pure all purpose unsalted salted granulated " +
    "plain whole half full low fat free reduced " +
    "cut used use your you can taste needed note notes see below recipe recipes " +
    "warm cold hot cool room if desired about good quality best " +
    "very well very much any some few several " +
    "king arthur land lakes brand " +
    // Fragments of compound names. "baking" is in 1,157 recipes and is never
    // what somebody means on its own -- "no baking" would empty the corpus.
    "baking powder soda extract purpose all-purpose " +
    // Instruction and qualifier words that live in ingredient lines without
    // being ingredients. Still a denylist of scaffolding rather than an
    // allowlist of ingredients: "measuring" will never become a thing to bake
    // with, whereas the set of real ingredients keeps growing with the corpus.
    "may measuring substituted leveled leveled-off other okay like recommended " +
    "above called hands handful big over two one soft top pan inch flavor " +
    "flavoring spray cooking blend food raw regular prepared add-ins batter " +
    "wash sandwich skin melting bar mix bowl sheet rack oven degrees minutes " +
    "hours overnight thick thin round square deep shallow"
  ).split(/\s+/),
);

const inRecipes = new Map<string, number>();
for (const r of recipes) {
  const words = new Set<string>();
  for (const i of r.ingredients) {
    for (const w of i.raw.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (!SCAFFOLD.has(w)) words.add(w);
    }
    // The parser's own name counts too, as a phrase, so "cream of tartar" and
    // "brown sugar" are askable as the things they are.
    if (i.canonicalName) words.add(i.canonicalName.toLowerCase());
  }
  for (const w of words) inRecipes.set(w, (inRecipes.get(w) ?? 0) + 1);
}

/**
 * Kept if at least five recipes use it.
 *
 * Below that a word is usually a brand, a typo or one baker's flourish, and
 * answering "4 recipes use chambord" is not useful enough to be worth matching
 * on. It is a floor on evidence, not a judgement about the word.
 */
const FLOOR = 5;
const vocab = [...inRecipes.entries()]
  .filter(([, n]) => n >= FLOOR)
  .sort((a, b) => b[1] - a[1]);

const out = `/**
 * GENERATED. Re-make with:
 *   node --experimental-strip-types packages/corpus/src/measure-ingredients.ts
 *
 * Every word the corpus's ingredient lines use, with how many recipes use it,
 * for words at least ${FLOOR} recipes deep. Scaffolding -- units, quantities,
 * preparation -- is excluded.
 *
 * This is here so the interpreter does not need a list of ingredients written
 * out by hand. A word it does not otherwise recognise can be looked up: if the
 * corpus uses it, it is an ingredient and can be asked for or ruled out; if it
 * does not, the honest answer is that nothing here uses it, which is a
 * different thing from not understanding the word.
 */

export const INGREDIENT_WORDS: Readonly<Record<string, number>> = ${JSON.stringify(
  Object.fromEntries(vocab),
  null,
  0,
)};

/** How many recipes use this word, or 0 if none do. */
export function recipesUsing(word: string): number {
  return INGREDIENT_WORDS[word.trim().toLowerCase()] ?? 0;
}
`;

const path = join(ROOT, "packages/core/src/ingredients.ts");
writeFileSync(path, out);
console.log(`${vocab.length} ingredient words at ${FLOOR}+ recipes`);
console.log("top:", vocab.slice(0, 18).map(([w, n]) => `${w} ${n}`).join(", "));
console.log(`\nwrote ${path}`);
