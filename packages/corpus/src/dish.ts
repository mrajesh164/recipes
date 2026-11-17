/**
 * What dish is this URL promising, and is it one we want?
 *
 * This started life as two lists inside harvest.ts. It moved here, unchanged,
 * when run.ts needed the same knowledge: harvest.ts decides what to *fetch*
 * and run.ts decides what to *keep*, and those two answers drifting apart is
 * precisely the bug the lists were written to prevent. (Love and Lemons'
 * carrot-oat and pumpkin cookies got in the first time because two filters
 * disagreed.) One definition, imported by both.
 *
 * The corpus is chocolate chip cookies first. There are not 200 of those on
 * the handful of sites that answer an automated request, so it widens to
 * other *drop* cookies -- oatmeal, peanut butter, sugar, snickerdoodle --
 * which are mixed and scooped the same way and so have something comparable
 * to say about texture. It does not widen to bars, cut-outs or sandwich
 * cookies, which do not.
 */

import type { ExtractedRecipe } from "./extract.ts";

/**
 * Shared, because the same things disqualify a recipe whichever site it is on.
 * Keeping two lists in step by hand is how Love and Lemons' carrot-oat and
 * pumpkin cookies got through on the first run.
 */
export const NOT_THE_SAME_DISH = [
  "bars", "cake", "skillet", "ice-cream", "pie", "muffin", "scone",
  "bread", "blondie", "mandelbrot",
  // Not drop cookies: rolled, piped, pressed, filled or layered. They are
  // shaped by a different method, so their flour and butter ratios answer a
  // different question than "how chewy will this scoop bake up?".
  "cut-out", "cutout", "rolled", "sandwich", "thumbprint", "linzer",
  "spritz", "shortbread", "biscotti", "macaron", "madeleine", "pinwheel",
  "slice-and-bake", "icebox", "stamp", "crinkle", "no-bake", "wafer",
  "whoopie", "tart", "truffle", "fudge", "brownie", "meringue", "pizzelle",
  // Things made *of* cookies rather than things that are cookies. The first
  // pass over the widened corpus pulled in a Sugar Cookie Martini, a
  // Chocolate Chip Cookie Chocolate Lasagna and a Peach Sugar Cookie Crumble,
  // all of which published a perfectly valid schema.org Recipe.
  "martini", "cocktail", "latte", "smoothie", "milkshake", "shake",
  "lasagna", "crumble", "cobbler", "cluster", "parfait", "trifle",
  "cheesecake", "sundae", "bark", "dip", "crust", "pudding", "mousse",
  "cookie-butter", "dough-bites", "edible",
  // Shaped, finished or portioned some way other than scooped.
  "rollout", "roll-out", "piped", "iced", "frosted", "glazed", "decorated",
  "dipped", "stuffed-with", "cookie-cups", "cookie-cup", "in-a-mug", "mug",
  "pops", "cookie-balls", "cake-mix",
  // The thing you put *on* a cookie is not a cookie. "Easy Sugar Cookie
  // Icing" and "Sugar Cookie Buttercream Frosting" both publish a Recipe and
  // both name a dish this corpus collects.
  "icing", "frosting", "buttercream", "ganache",
];

/** Substitutes the very ingredients the texture scoring reads. */
export const SUBSTITUTES_THE_RATIOS = [
  "gluten-free", "vegan", "almond-flour", "self-rising", "baking-mix",
  "healthy", "keto", "paleo", "dairy-free", "egg-free", "flourless",
  "protein", "sugar-free", "low-carb", "whole30", "eggless",
];

/**
 * Additions and methods that dominate the texture for other reasons.
 *
 * Note what is no longer here: oatmeal and peanut butter. They moved to DISHES
 * below, because they are now dishes in their own right rather than
 * contaminants -- but only on their own. An oatmeal *chocolate chip* cookie
 * still matches two dishes at once and is still rejected, by the
 * exactly-one-dish rule in classifyDish().
 */
export const CONFOUNDING = [
  "zucchini", "carrot", "pistachio", "sourdough", "double-chocolate",
  "marbled", "cream-cheese", "high-altitude", "pumpkin", "banana",
  "lactation", "breakfast", "avocado", "cauliflower", "beet",
];

export const EXCLUDE = [...NOT_THE_SAME_DISH, ...SUBSTITUTES_THE_RATIOS, ...CONFOUNDING];

export type DishType =
  | "chocolate chip" | "oatmeal" | "peanut butter" | "sugar" | "snickerdoodle";

/**
 * A corpus row: what extract.ts could read off the page, plus which dish we
 * believe it is.
 *
 * It lives here rather than in run.ts because seed.ts needs it too, and
 * run.ts fetches the entire corpus at import time -- a type is not worth that
 * risk, even though `import type` is erased before it could happen.
 */
export interface CorpusRecipe extends ExtractedRecipe {
  dishType: DishType;
}

interface Dish {
  type: DishType;
  /** Recognises the dish in a URL slug (hyphenated) or a title (spaced). */
  slug: RegExp;
  /**
   * Words that must all appear in the title of the page we get back.
   * This is the Apricot Banana Bread guard, per dish.
   */
  title: string[];
}

/**
 * Ordered most specific first. "chocolate chip" is tested before "sugar" so a
 * chocolate chip cookie made with brown sugar is not read as a sugar cookie.
 */
export const DISHES: readonly Dish[] = [
  { type: "chocolate chip", slug: /chocolate[-\s]chip|choc[-\s]chip/i, title: ["chocolate", "chip"] },
  { type: "snickerdoodle", slug: /snickerdoodle/i, title: ["snickerdoodle"] },
  { type: "peanut butter", slug: /peanut[-\s]butter/i, title: ["peanut butter"] },
  { type: "oatmeal", slug: /oatmeal|\boat[-\s]/i, title: ["oat"] },
  { type: "sugar", slug: /sugar[-\s]cookie/i, title: ["sugar"] },
];

/**
 * Which dish, if any, this text is unambiguously about.
 *
 * Returns null when it matches none -- and, just as importantly, when it
 * matches more than one. "Oatmeal chocolate chip" is a real and popular
 * cookie, but it is not a clean member of either set: scoring it against the
 * chocolate chip recipes means the oats are read as flour that is not there.
 * Ambiguity is a reason to drop a candidate, not to pick a winner.
 */
export function classifyDish(text: string): DishType | null {
  const hits = DISHES.filter((d) => d.slug.test(text));
  return hits.length === 1 ? hits[0]!.type : null;
}

/** The title keywords a page must contain to be believed, for a given dish. */
export function titleKeywordsFor(type: DishType): string[] {
  const dish = DISHES.find((d) => d.type === type);
  // Every recipe in this corpus is a cookie, whatever else it is. A page that
  // does not say so in its own title is not the page we asked for.
  return [...(dish?.title ?? []), "cookie"];
}

/**
 * Does a title give the dish away as something excluded, even when the URL
 * looked fine?
 *
 * A slug is written by hand and is sometimes kinder than the recipe: Love and
 * Lemons' /chocolate-chip-cookies/ is a cookie, but a slug saying as much is
 * no promise. The title is what the page claims to be, so it gets the same
 * exclusion list the URL got.
 */
export function titleIsExcluded(title: string): string | null {
  // Hyphens on both sides become spaces first. The lists are written
  // slug-style ("gluten-free", "cut-out") and titles are written prose-style
  // ("Gluten-Free", "Cut Out") -- and sometimes the other way round. Matching
  // the two shapes against each other is how "Gluten-Free Chocolate Chip
  // Cookies" passed a filter that exists to catch exactly that.
  const t = title.toLowerCase().replace(/[-_]+/g, " ");
  for (const word of EXCLUDE) {
    const plain = word.replace(/-/g, " ");
    // Boundaries at BOTH ends, with the plural allowed explicitly.
    //
    // An open-ended match reads far more than it means to: "tart" fires on
    // "cream of tartar", and "Snickerdoodles Without Cream of Tartar" is a
    // real recipe title, not a tart. "pie" fires on "pieces". Anchoring the
    // end and spelling out the plural keeps "bar" matching "bars" without
    // letting it match "barley".
    const stem = plain.replace(/s$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${stem}(s|es)?\\b`, "i").test(t)) return plain;
  }
  return null;
}

/**
 * Does the method described actually drop off a spoon?
 *
 * The title and the slug are both unreliable here. "Valentine Sugar Cookies"
 * and "Easter Sugar Cookies" say nothing about shaping, and both turned out to
 * be rolled, cut and iced -- which is a different dough doing a different job,
 * stiffer and drier so it holds an edge. Its flour and butter ratio is not
 * answering the question this corpus asks.
 *
 * So the instructions get a vote. These phrases are unambiguous: you do not
 * reach for a cookie cutter or a rolling pin to make a drop cookie. Rolling
 * dough *into balls* is still a drop cookie and is deliberately not matched.
 */
const NOT_DROPPED = [
  /\bcookie cutters?\b/i,
  /\brolling pin\b/i,
  /\broll (?:the |out )?(?:dough )?out\b/i,
  /\broll out\b/i,
  /\bfloured surface\b/i,
  /\bcut into shapes?\b/i,
  /\bcut out (?:the )?(?:cookies|shapes)\b/i,
  /\bpiping bag\b/i,
  /\bpipe the (?:dough|batter)\b/i,
  /\bpress(?:ed)? into (?:a |the )?[^.]{0,24}\b(?:pan|dish|tin)\b/i,
  // A lined *pan* is a bar recipe. A lined *baking sheet* is every drop
  // cookie ever written, and a half sheet is 13x18 -- so this has to name the
  // pan, or it drops the corpus's own Tate's copycat.
  /\bline (?:a |the )?\d+\s*(?:x|by|×)\s*\d+[- ]?(?:inch )?\s*(?:baking )?(?:pan|dish|tin)\b/i,
];

/** Why this is not a drop cookie, or null if nothing says it isn't. */
export function notADropCookie(instructions: string): string | null {
  for (const re of NOT_DROPPED) {
    const m = instructions.match(re);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

/**
 * Is this built on a product rather than on ingredients?
 *
 * "1 pouch Betty Crocker sugar cookie mix" and "1 roll refrigerated cookie
 * dough" are real ingredient lines on real recipe pages that publish a
 * perfectly valid schema.org Recipe. But the flour, butter and sugar are
 * inside the pouch, so the recipe states no ratio at all -- the texture
 * scoring has nothing to read, and what it does read is wrong, because the
 * two tablespoons of butter stirred in look like the entire fat content.
 *
 * This is the same reason gluten-free and vegan versions are excluded: not
 * snobbery about the recipe, but that it cannot answer the question.
 */
const PREPARED_PRODUCT = [
  /\b(cookie|cake|brownie|muffin|pancake|biscuit)\s+mix\b/i,
  /\brefrigerated\b[^,]{0,30}\b(dough|cookies?)\b/i,
  /\bpouch\b[^,]{0,30}\bmix\b/i,
  /\bcalled for on\b.{0,20}\bpouch\b/i,
  /\bstore[- ]bought\b[^,]{0,20}\bdough\b/i,
];

/** The line that gives it away, or null. */
export function usesAPreparedMix(ingredientLines: string[]): string | null {
  for (const line of ingredientLines) {
    for (const re of PREPARED_PRODUCT) if (re.test(line)) return line;
  }
  return null;
}
