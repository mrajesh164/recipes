/**
 * What you could make with what you have.
 *
 * The recommendation this drives is not "these 19 recipes match exactly" --
 * measured on the corpus, a pantry of staples makes 19 recipes outright and
 * leaves 76 one ingredient short, and the second list is the more useful
 * answer. So this reports the shortfall rather than a yes or no, and the
 * ranking prefers a small one.
 */

import type { ParsedIngredient } from "./units.ts";

export interface PantryFit {
  /** Ingredient lines that had to be matched, after the exclusions below. */
  required: number;
  /** How many of them you have. */
  have: number;
  /** What to buy, in the recipe's own words, deduplicated and in order. */
  missing: string[];
}

/**
 * Taken as given rather than asked for.
 *
 * "Missing: water" is not advice. Salt is the same: every recipe here wants a
 * pinch and nobody is out of it. Keeping these out of the shortfall is the
 * difference between a list you act on and a list you skim past.
 */
const ASSUMED = ["water", "salt", "kosher salt", "sea salt"];

/**
 * Lines that are not a requirement.
 *
 * A topping named "optional" is not something to go shopping for, and
 * counting it would make almost every recipe short by one. Same words the
 * review extractor leans on, for the same reason: this is the recipe telling
 * you it does not matter.
 */
const NOT_REQUIRED =
  /\boptional\b|\bto taste\b|\bif desired\b|\bas needed\b|for (?:sprinkling|dusting|garnish|topping|brushing|serving|rolling|finishing)|for the top\b|\bgarnish\b/i;

function hasWord(haystack: string, needle: string): boolean {
  const parts = needle.trim().toLowerCase().split(/\s+/).map(escapeRe);
  // The last word takes an optional plural, because a pantry is written in the
  // singular and a recipe is not: "banana" has to find "3 ripe bananas".
  const last = parts.pop()!;
  const body = [...parts, `${last}(?:e?s)?`].join("[\\s-]+");
  // Word boundaries both ends, which is what keeps "butter" out of
  // "buttermilk" and "oat" out of "oatmeal".
  return new RegExp(`\\b${body}\\b`, "i").test(haystack);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Does this pantry cover this ingredient line?
 *
 * canonicalName is consulted first because it is the parser's judgement of
 * what the line *is*, and that is what settles the hard case: "1 tsp cream of
 * tartar" contains the word cream, so having cream in the pantry would match
 * it on raw text alone. Its canonical name is "cream of tartar", which a
 * pantry holding "cream" does not cover. Falling back to the raw text matters
 * too -- 11% of lines have no canonical name, and that 11% is where the
 * bananas and the tahini live.
 */
function covered(pantry: readonly string[], ing: ParsedIngredient): boolean {
  const name = ing.canonicalName?.toLowerCase();
  if (name) {
    // Exactly the name, and nothing looser.
    //
    // Two looser rules were tried and both failed on the same pair. A word
    // match let "cream" match "cream of tartar" because the word is in there.
    // A head rule -- the pantry item being the start of the name -- let it
    // through too, because "cream of tartar" and "chocolate chips" are the
    // same shape: the pantry word followed by more words. English does not
    // mark the difference positionally, so no rule over the string can tell
    // that chips are chocolate and tartar is not cream.
    //
    // So where the parser has named the line, that name is authoritative and
    // the pantry has to say it. A reader with chocolate chips writes
    // "chocolate chips", which is what is on the packet anyway.
    return pantry.some((p) => p.trim().toLowerCase() === name);
  }
  // No name, so the raw text is all there is -- and this is the 11% of lines
  // where the bananas and the tahini live, so it matters more than it looks.
  return pantry.some((p) => hasWord(ing.raw, p));
}

export function pantryFit(
  pantry: readonly string[],
  ingredients: readonly ParsedIngredient[],
): PantryFit {
  const items = [...pantry, ...ASSUMED].map((p) => p.trim()).filter(Boolean);
  const missing: string[] = [];
  let required = 0;
  let have = 0;

  for (const ing of ingredients) {
    if (NOT_REQUIRED.test(ing.raw)) continue;
    required++;
    if (covered(items, ing)) {
      have++;
    } else {
      const label = ing.canonicalName ?? shortLabel(ing.raw);
      if (!missing.includes(label)) missing.push(label);
    }
  }
  return { required, have, missing };
}

/**
 * An unparsed line, shortened to the thing you would write on a list.
 *
 * "1 1/2 cups (190g) all-purpose flour, sifted" is not a shopping list entry.
 * The quantity goes, the parenthetical goes, and anything after the first
 * comma goes, because that is where recipes put the preparation.
 */
function shortLabel(raw: string): string {
  let s = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[\s\d¼½¾⅓⅔⅛\/.-]+/, "")
    .split(",")[0]!
    .replace(/\s+/g, " ")
    .trim();
  const UNITS =
    /^(?:cups?|teaspoons?|tablespoons?|tsp|tbsp|ounces?|oz|pounds?|lbs?|grams?|g|sticks?|cans?|packages?|pkg|large|medium|small)\b\s*/i;
  while (UNITS.test(s)) s = s.replace(UNITS, "");
  return s.toLowerCase();
}

/** Everything missing, so the UI can say "one away" without recounting. */
export function shortfall(fit: PantryFit): number {
  return fit.missing.length;
}
