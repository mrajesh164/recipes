/**
 * What someone typed, turned into something rankable.
 *
 * The danger with a free-text box over a fixed set of presets is silent
 * coercion: a person types "gooey", the app quietly decides that means chewy,
 * and they never find out their word wasn't understood. So this returns what
 * it recognised and what it didn't, and the interface shows both. A search box
 * that admits "I don't know what 'nutty' means here" is more trustworthy than
 * one that pretends everything landed.
 *
 * Deliberately keyword-based rather than a model. The project defers AI, a
 * model call would need a spending cap before the link is shared, and -- more
 * to the point -- this has to work instantly and offline in a kitchen. The
 * cost is that the vocabulary is finite, which is exactly why unrecognised
 * words are reported rather than swallowed.
 *
 * Three kinds of word are read, and they do different jobs:
 *
 *   texture  ("chewy")   ranks the corpus along a continuum
 *   effort   ("quick")   nudges the ranking
 *   dish     ("oat")     narrows which recipes are candidates at all
 *
 * The dish is a filter and the other two are not, because a dish is a category
 * rather than a dial. "chewy, oat" returning a chewy peanut butter cookie is
 * not a near miss -- it is the wrong cookie. Asking for chewy and getting the
 * second-chewiest is a near miss.
 */

import type { Texture } from "./texture.ts";

/**
 * The dishes in the corpus, spelled exactly as `recipes.dish_type` holds them
 * so a match can be compared against a row without a lookup table.
 */
export type DishName =
  | "chocolate chip"
  | "oatmeal"
  | "peanut butter"
  | "sugar"
  | "snickerdoodle"
  | "brownie"
  | "blondie"
  | "muffin"
  | "banana bread"
  | "scone";

export interface Preferences {
  /** No chilling, short bake. */
  quick: boolean;
  /** Melted butter needs no mixer; fewer ingredients is less work. */
  easy: boolean;
  /** Lean on the crowd. */
  popular: boolean;
}

export interface Interpretation {
  /** Weight per texture, 0-1. All zero when no texture word was found. */
  textures: Record<Texture, number>;
  prefs: Preferences;
  /** Dishes named. Empty means "any dish", not "no dishes". */
  dishes: DishName[];
  /** Phrases recognised, in the user's own words, to show back to them. */
  understood: string[];
  /** Words that meant nothing here. Shown so the gap is visible. */
  unrecognised: string[];
  /**
   * Textures ruled out. "not cakey" removes the cookies that are mainly
   * cakey rather than trying to rank away from cakey, which cannot be done:
   * the opposite of cakey is two different textures and inverting the score
   * would pick a denser cookie and a crispier one with equal confidence.
   */
  excluded: Texture[];
  /** The words that produced those exclusions, in the user's own words. */
  refused: string[];
  /**
   * Near-misses: a word that was not understood, paired with the vocabulary
   * word it is probably a misspelling of. The interface offers these rather
   * than applying them, because guessing silently is the thing this module
   * exists not to do.
   */
  suggestions: { typed: string; meant: string }[];
  /** Nothing at all was understood. */
  empty: boolean;
}

/* ----------------------------------------------------------- vocabulary -- */

const TEXTURE_WORDS: ReadonlyArray<readonly [string, Partial<Record<Texture, number>>]> = [
  // Phrases. These are matched before their parts, so "thick and chewy" never
  // also fires "thick" on its own.
  ["soft baked", { chewy: 0.7, cakey: 0.3 }],
  ["thick and chewy", { chewy: 0.8, cakey: 0.2 }],
  ["soft and chewy", { chewy: 0.9 }],
  ["crispy edges", { crispy: 0.6, chewy: 0.4 }],
  ["crunchy edges", { crispy: 0.6, chewy: 0.4 }],
  ["crispy outside", { crispy: 0.6, chewy: 0.4 }],
  ["soft middle", { chewy: 0.7, cakey: 0.3 }],
  ["soft centre", { chewy: 0.7, cakey: 0.3 }],
  ["soft center", { chewy: 0.7, cakey: 0.3 }],
  ["gooey middle", { chewy: 0.9 }],
  // Named because it is the single strongest chew lever in the scoring, and
  // bakers ask for it by name. It also has to be consumed before the dish
  // vocabulary sees a bare "sugar".
  ["brown sugar", { chewy: 0.8 }],
  ["melted butter", { chewy: 0.75 }],
  ["bakery style", { chewy: 0.8, cakey: 0.2 }],
  ["levain style", { chewy: 0.85 }],

  // Chewy family.
  ["chewy", { chewy: 1 }],
  ["chew", { chewy: 1 }],
  ["fudgy", { chewy: 0.9 }],
  ["gooey", { chewy: 0.9 }],
  ["doughy", { chewy: 0.85 }],
  ["underbaked", { chewy: 0.85 }],
  ["dense", { chewy: 0.8 }],
  ["bendy", { chewy: 0.8 }],
  ["stretchy", { chewy: 0.8 }],
  ["molten", { chewy: 0.8 }],
  ["moist", { chewy: 0.6 }],
  ["rich", { chewy: 0.6 }],

  // Cakey family.
  ["cakey", { cakey: 1 }],
  ["cake like", { cakey: 1 }],
  ["fluffy", { cakey: 0.9 }],
  ["airy", { cakey: 0.9 }],
  ["pillowy", { cakey: 0.9 }],
  ["puffy", { cakey: 0.8 }],
  ["domed", { cakey: 0.8 }],
  ["muffin top", { cakey: 0.8 }],
  ["tall", { cakey: 0.7 }],
  ["thick", { cakey: 0.6, chewy: 0.4 }],
  ["light", { cakey: 0.7 }],
  ["tender", { cakey: 0.6 }],
  ["crumbly", { cakey: 0.7 }],

  // Crispy family.
  ["crispy", { crispy: 1 }],
  ["crisp", { crispy: 1 }],
  ["crunchy", { crispy: 1 }],
  ["crunch", { crispy: 1 }],
  ["snappy", { crispy: 0.9 }],
  ["crackly", { crispy: 0.7 }],
  ["crinkly", { crispy: 0.7 }],
  ["crinkle top", { crispy: 0.7 }],
  ["snap", { crispy: 0.9 }],
  ["brittle", { crispy: 0.8 }],
  ["thin", { crispy: 0.8 }],
  ["lacy", { crispy: 0.85 }],
  ["wafer", { crispy: 0.85 }],
  ["flat", { crispy: 0.7 }],
  ["spread", { crispy: 0.6 }],
  ["toasty", { crispy: 0.6 }],

  // "soft" last in its family: it is the most ambiguous word a baker uses,
  // meaning chewy to some and cakey to others. Split rather than guess.
  ["soft", { chewy: 0.5, cakey: 0.5 }],
];

const PREF_WORDS: ReadonlyArray<readonly [string, keyof Preferences]> = [
  ["no chill", "quick"],
  ["no chilling", "quick"],
  ["without chilling", "quick"],
  ["dont want to chill", "quick"],
  ["in a hurry", "quick"],
  ["last minute", "quick"],
  ["short notice", "quick"],
  ["no time", "quick"],
  ["right now", "quick"],
  ["same day", "quick"],
  ["quick", "quick"],
  ["quickly", "quick"],
  ["fast", "quick"],
  ["speedy", "quick"],
  ["tonight", "quick"],
  ["asap", "quick"],
  ["rushed", "quick"],

  ["no mixer", "easy"],
  ["without a mixer", "easy"],
  ["no stand mixer", "easy"],
  ["no electric mixer", "easy"],
  ["hand mixed", "easy"],
  ["by hand", "easy"],
  ["one bowl", "easy"],
  ["single bowl", "easy"],
  ["few ingredients", "easy"],
  ["fewest ingredients", "easy"],
  ["minimal effort", "easy"],
  ["low effort", "easy"],
  ["no fuss", "easy"],
  ["fuss free", "easy"],
  ["easy", "easy"],
  ["easiest", "easy"],
  ["simple", "easy"],
  ["simplest", "easy"],
  ["beginner", "easy"],
  ["basic", "easy"],
  ["foolproof", "easy"],
  ["lazy", "easy"],

  ["highly rated", "popular"],
  ["high rated", "popular"],
  ["top rated", "popular"],
  ["best rated", "popular"],
  ["well reviewed", "popular"],
  ["most reviewed", "popular"],
  ["crowd pleaser", "popular"],
  ["tried and true", "popular"],
  ["tried and tested", "popular"],
  ["most loved", "popular"],
  ["popular", "popular"],
  ["best", "popular"],
  ["favourite", "popular"],
  ["favorite", "popular"],
  ["famous", "popular"],
  ["classic", "popular"],
  ["reliable", "popular"],
  ["proven", "popular"],
];

/**
 * Dish words, mapped to the `dish_type` they narrow to.
 *
 * "chocolate" and "chip" used to sit in the stop-list, which meant a person
 * typing "chewy chocolate chip" had two thirds of their query silently thrown
 * away and was told nothing -- the worst case for a box whose entire promise
 * is that it says what it understood.
 */
const DISH_WORDS: ReadonlyArray<readonly [string, DishName]> = [
  ["chocolate chip", "chocolate chip"],
  ["choc chip", "chocolate chip"],
  ["chocolatechip", "chocolate chip"],
  ["chocolate", "chocolate chip"],
  ["choc", "chocolate chip"],
  ["chocolatey", "chocolate chip"],

  ["oatmeal raisin", "oatmeal"],
  ["oatmeal", "oatmeal"],
  ["oaty", "oatmeal"],
  ["oat", "oatmeal"],
  ["porridge", "oatmeal"],
  ["flapjack", "oatmeal"],

  ["peanut butter", "peanut butter"],
  ["peanutbutter", "peanut butter"],
  ["peanut", "peanut butter"],
  ["pb", "peanut butter"],

  // Before the bare "sugar" below, or a snickerdoodle query lands on sugar
  // cookies -- which is a different cookie with no cinnamon in it.
  ["cinnamon sugar", "snickerdoodle"],
  ["snickerdoodle", "snickerdoodle"],
  ["snicker doodle", "snickerdoodle"],
  ["cinnamon", "snickerdoodle"],

  ["sugar cookie", "sugar"],
  ["plain", "sugar"],
  ["vanilla", "sugar"],
  ["sugar", "sugar"],

  // Beyond cookies. "brownie" has to come before the bare "chocolate" above
  // would ever be reached for it, which it does: the list is matched in order
  // and a brownie page says brownie.
  ["brownies", "brownie"],
  ["brownie", "brownie"],
  ["fudgy brownie", "brownie"],
  ["blondies", "blondie"],
  ["blondie", "blondie"],
  ["muffins", "muffin"],
  ["muffin", "muffin"],
  ["banana bread", "banana bread"],
  ["bananabread", "banana bread"],
  ["quick bread", "banana bread"],
  ["loaf", "banana bread"],
  ["scones", "scone"],
  ["scone", "scone"],
];

/**
 * Words that carry no information *here* and should not be reported as
 * unknown.
 *
 * The second group is positions. "chewy middle", "crispy bottom", "soft all
 * the way through" -- the position is real to the baker, but this app scores a
 * cookie as a whole and has no notion of where in it a texture sits. Reporting
 * "I don't know what middle means" would be true and useless; reading "chewy
 * middle" as chewy is the honest answer, and the reading line still shows
 * chewy as what drove the pick.
 */
const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "with", "without", "some",
  "i", "want", "would", "like", "need", "me", "my", "for",
  "that", "is", "are", "be", "to", "of", "in", "on", "it", "them", "please",
  "cookie", "cookies", "recipe", "recipes", "make", "making", "bake", "baking",
  "not", "too", "less", "kind", "sort", "something", "anything",
  "give", "show", "find", "looking", "got", "any", "one", "ones", "good",
  "nice", "type", "sorts", "kinds", "bit", "little", "lot", "lots",

  // Positions.
  "middle", "middles", "centre", "center", "centres", "centers",
  "edge", "edges", "outside", "inside", "out", "bottom", "bottoms",
  "top", "tops", "rim", "rims", "exterior", "interior", "throughout",
  "through", "way", "all", "around", "corner", "corners", "side", "sides",
]);

/**
 * Words that turn a texture up rather than naming one.
 *
 * "extra crispy" is not a different texture from crispy, it is more of it. The
 * intensifier is removed and the word it modifies is boosted, which means this
 * works with every texture word in the vocabulary -- present and future --
 * rather than needing "extra crispy", "super crispy" and "really crispy" as
 * three more entries.
 */
const INTENSIFIERS = new Set([
  "extra", "super", "ultra", "very", "really", "so", "mega", "max",
  "maximum", "seriously", "insanely", "crazy", "deeply", "properly",
  "well", "more", "most", "hella", "wicked", "truly", "genuinely",
  "incredibly", "ridiculously", "absurdly", "proper",
]);

/** How much an intensifier lifts a weight. Capped at 1 by the caller. */
const BOOST = 1.3;

/**
 * Negation, handled as an exclusion over the candidates.
 *
 * "not cakey" first read as *cakey*, because "not" sat in the stop-list and
 * was thrown away, which is the one failure mode this module exists to avoid.
 * Then it was refused: understood, dropped, and reported as dropped. Honest,
 * and a dead end for a reasonable request.
 *
 * It now removes candidates. Not a direction in the ranking, because there is
 * no such direction: the opposite of cakey is two different textures, and
 * inverting the score would pick a denser cookie and a crispier one with equal
 * confidence. A recipe is dropped when the negated texture is the one it
 * scores highest on, which needs no threshold and can be said in a sentence.
 * On this corpus "not cakey" removes 202 of 325, which is a lot, and is what
 * the phrase means.
 */
const NEGATORS = ["not", "no", "non", "isnt", "aint", "never", "anti"];

/* ------------------------------------------------------------ near misses -- */

/**
 * Edit distance, capped. Anything further apart than `max` is not a typo and
 * the exact number stops mattering, so the rows bail early.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length]!;
}

/**
 * Every single word the vocabulary knows, for matching misspellings against.
 *
 * Single words only. A typo in a phrase is still a typo in one of its words,
 * and comparing "chewey" against "thick and chewy" as a whole string finds
 * nothing useful.
 */
const SINGLE_WORDS: readonly string[] = [
  ...new Set(
    [
      ...TEXTURE_WORDS.map(([p]) => p),
      ...PREF_WORDS.map(([p]) => p),
      ...DISH_WORDS.map(([p]) => p),
    ].filter((p) => !/[\s-]/.test(p)),
  ),
];

/**
 * The vocabulary word an unrecognised word is probably a misspelling of.
 *
 * Tight on purpose. One edit for a short word, two for a long one, and nothing
 * for a word of three characters or fewer, where one edit reaches half the
 * dictionary. "chewey" finds chewy; "nutty" finds nothing, which is correct,
 * because nutty is a real word this app genuinely does not model.
 */
export function nearestWord(word: string): string | null {
  if (word.length < 4) return null;
  const max = word.length <= 5 ? 1 : 2;
  let best: string | null = null;
  let bestDistance = max + 1;
  for (const candidate of SINGLE_WORDS) {
    if (candidate === word) return null;
    const d = editDistance(word, candidate, max);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  return bestDistance <= max ? best : null;
}

/* -------------------------------------------------------------- matching -- */

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * The forms of a word a person might actually type.
 *
 * Only the last word of a phrase is inflected, which is how English works:
 * "crispy edges" pluralises to "crispy edges", never "crispies edges". Covers
 * plurals (oat/oats), comparatives (thick/thicker/thickest, chewy/chewier) and
 * the consonant doubling in thin/thinner, since a vocabulary that knows
 * "chewy" but not "chewier" fails on a phrase most bakers would type.
 */
function inflections(word: string): string[] {
  const w = word.replace(ESCAPE, "\\$&");
  const forms = new Set([w]);
  if (/y$/.test(word)) {
    const stem = w.slice(0, -1);
    forms.add(`${stem}ier`).add(`${stem}iest`).add(`${stem}ies`);
  } else {
    forms.add(`${w}s`).add(`${w}es`).add(`${w}er`).add(`${w}est`);
    // thin -> thinner, flat -> flatter: consonant-vowel-consonant doubles.
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(word)) {
      const last = word.at(-1)!;
      forms.add(`${w}${last}er`).add(`${w}${last}est`);
    }
  }
  // Longest first, so the regex prefers "thickest" over "thick".
  return [...forms].sort((a, b) => b.length - a.length);
}

/**
 * A phrase, tolerant of how it is written.
 *
 * Words may be separated by spaces or hyphens, so "soft baked", "soft-baked"
 * and "no-mixer" need no separate entries. Anchored on the spaces that pad the
 * working string rather than \b, so "oat" cannot match inside "oatmeal" when
 * "oatmeal" is the longer entry that should have won.
 */
function phraseBody(phrase: string): string {
  const words = phrase.split(/[\s-]+/);
  return words
    .slice(0, -1)
    .map((w) => w.replace(ESCAPE, "\\$&"))
    .concat(`(?:${inflections(words.at(-1)!).join("|")})`)
    .join("[\\s-]+");
}

function phraseRegex(phrase: string): RegExp {
  return new RegExp(`(?<= )${phraseBody(phrase)}(?= )`, "g");
}

/**
 * The same phrase with any negator in front of it.
 *
 * A filler is allowed in between, because "not too thin" is how people write
 * this and requiring the negator to be adjacent let that one through as a
 * request *for* thin. Intensifiers need no mention here -- they have already
 * been lifted out by the time this runs, so "not very thin" arrives as
 * "not thin".
 */
const NEGATION_FILLER = ["too", "that", "overly", "all", "quite", "massively"];

function negatedRegex(phrase: string): RegExp {
  const filler = `(?:(?:${NEGATION_FILLER.join("|")})[\\s-]+)?`;
  return new RegExp(
    `(?<= )(?:${NEGATORS.join("|")})[\\s-]+${filler}${phraseBody(phrase)}(?= )`,
    "g",
  );
}

/** Built once: compiling ~200 regexes per keystroke would be wasteful. */
const COMPILED = {
  textures: TEXTURE_WORDS.map(([p, w]) => [phraseRegex(p), p, w] as const),
  // The same phrases with a negator in front, matched first so "not chewy"
  // never reaches the plain "chewy" pass.
  negated: TEXTURE_WORDS.map(([p, w]) => [negatedRegex(p), p, w] as const),
  prefs: PREF_WORDS.map(([p, k]) => [phraseRegex(p), p, k] as const),
  dishes: DISH_WORDS.map(([p, d]) => [phraseRegex(p), p, d] as const),
};

/**
 * Pull the intensifiers out, remembering what each one was modifying.
 *
 * Returns the text without them, and a map from the modified word to the
 * intensifier -- so the reading line can say "extra crispy" back rather than
 * just "crispy", which is the difference between being understood and being
 * approximately understood.
 */
function liftIntensifiers(padded: string): { text: string; boosted: Map<string, string> } {
  const boosted = new Map<string, string>();
  const words = padded.trim().split(/[\s-]+/).filter(Boolean);
  const kept: string[] = [];
  for (let n = 0; n < words.length; n++) {
    const w = words[n]!;
    const next = words[n + 1];
    if (INTENSIFIERS.has(w) && next !== undefined && !INTENSIFIERS.has(next)) {
      boosted.set(next, w);
      continue; // dropped: the boost it carries is recorded above
    }
    kept.push(w);
  }
  return { text: ` ${kept.join(" ")} `, boosted };
}

export function interpret(input: string): Interpretation {
  const text = input.toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();

  const textures: Record<Texture, number> = { chewy: 0, cakey: 0, crispy: 0 };
  const prefs: Preferences = { quick: false, easy: false, popular: false };
  const dishes: DishName[] = [];
  const understood: string[] = [];
  const refused: string[] = [];

  const lifted = liftIntensifiers(` ${text} `);

  // Matched phrases are consumed, so a word is never counted twice and
  // whatever is left over is genuinely unrecognised.
  let remaining = lifted.text;
  const take = (re: RegExp): boolean => {
    re.lastIndex = 0;
    if (!re.test(remaining)) return false;
    remaining = remaining.replace(re, " ");
    return true;
  };

  // Negations first, so the word they cancel is gone before the pass that
  // would have credited it.
  for (const [re, phrase] of COMPILED.negated) {
    if (take(re)) refused.push(phrase);
  }

  for (const [re, phrase, weights] of COMPILED.textures) {
    if (!take(re)) continue;
    const head = phrase.split(/[\s-]/)[0]!;
    const intensifier = lifted.boosted.get(head);
    const scale = intensifier ? BOOST : 1;
    for (const [k, v] of Object.entries(weights)) {
      textures[k as Texture] = Math.max(textures[k as Texture], Math.min(1, v * scale));
    }
    understood.push(intensifier ? `${intensifier} ${phrase}` : phrase);
  }

  for (const [re, phrase, key] of COMPILED.prefs) {
    if (!take(re)) continue;
    prefs[key] = true;
    understood.push(phrase);
  }

  for (const [re, phrase, dish] of COMPILED.dishes) {
    if (!take(re)) continue;
    // Two words for one dish ("choc chip cookies" after "chocolate chip" has
    // already matched) must not narrow twice or be listed twice.
    if (!dishes.includes(dish)) {
      dishes.push(dish);
      understood.push(phrase);
    }
  }

  const unrecognised = remaining
    .split(/[\s-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w) && !INTENSIFIERS.has(w));

  // A negation on its own is understood. It says which cookies you do not
  // want, which is less than a texture but is not nothing, and the empty
  // state should not claim otherwise.
  const empty = understood.length === 0 && refused.length === 0;
  const unique = [...new Set(unrecognised)];

  const excluded = [...new Set(refused.map((phrase) => {
    const weights = TEXTURE_WORDS.find(([p]) => p === phrase)?.[1] ?? {};
    const top = (Object.entries(weights) as [Texture, number][])
      .sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? null;
  }).filter((t): t is Texture => t !== null))];

  const suggestions = unique
    .map((typed) => ({ typed, meant: nearestWord(typed) }))
    .filter((s): s is { typed: string; meant: string } => s.meant !== null);

  return {
    textures, prefs, dishes, understood, refused, excluded, suggestions,
    unrecognised: unique,
    empty,
  };
}

/**
 * The texture the interpretation leans toward most, for the places that still
 * need a single one -- highlighting which signals agree, for instance.
 */
export function dominantTexture(i: Interpretation): Texture | null {
  const entries = Object.entries(i.textures) as [Texture, number][];
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return top[1] > 0 ? top[0] : null;
}

/**
 * The recipes a query is even asking about.
 *
 * Separate from scoring on purpose: a dish is a category, so naming one
 * removes candidates rather than reordering them. Naming none, or naming one
 * the corpus has never heard of, leaves everything in -- an empty result is
 * never the right answer to a word this app failed to understand.
 */
export function candidatesFor<
  T extends {
    dish_type: string | null;
    scores: { chewy: number; cakey: number; crispy: number };
  },
>(recipes: T[], i: Interpretation): T[] {
  let kept = recipes;

  if (i.dishes.length > 0) {
    const wanted = new Set<string>(i.dishes);
    const byDish = kept.filter((r) => r.dish_type !== null && wanted.has(r.dish_type));
    // A dish the corpus has none of must not empty the list.
    if (byDish.length > 0) kept = byDish;
  }

  if (i.excluded.length > 0) {
    // Excluded by rank within that texture, not by comparing textures.
    //
    // This used to drop a recipe when the negated texture was the one it
    // scored highest on, which reads naturally and is not a comparison these
    // scores support: texture.ts says plainly that they are not probabilities
    // and that they rank recipes against each other *within* a corpus. Across
    // textures they are not on one scale. Measured, the median recipe scores
    // 0.31 chewy and 0.72 cakey, because two of cakey's four terms pay out in
    // full to a typical recipe, so "mainly cakey" meant 62% of the corpus and
    // "not cakey" removed nearly two thirds of it for the wrong reason.
    //
    // Ranking inside one texture is exactly what the scores are for. "not
    // cakey" now drops the third of the candidates that score highest on
    // cakey, whatever that score happens to be worth.
    const EXCLUDE_TOP = 1 / 3;
    for (const texture of i.excluded) {
      if (kept.length < 6) break;
      const sorted = [...kept].sort((a, b) => b.scores[texture] - a.scores[texture]);
      const cut = Math.floor(kept.length * EXCLUDE_TOP);
      const dropped = new Set(sorted.slice(0, cut));
      const remaining = kept.filter((r) => !dropped.has(r));
      if (remaining.length > 0) kept = remaining;
    }
  }

  return kept;
}

export interface Rankable {
  scores: { chewy: number; cakey: number; crispy: number; confidence: "high" | "low" };
  method: "melted" | "creamed" | "other" | null;
  chills_dough: boolean;
  bake_minutes: number | null;
  rating: number | null;
  /** How many people that rating is from. One rating is not evidence. */
  ratingCount: number | null;
  ingredientCount: number;
}

/**
 * Score a recipe against an interpretation.
 *
 * Texture dominates; the preferences are deliberately small nudges rather than
 * filters. Someone asking for "quick chewy cookies" wants a chewy cookie
 * first -- returning a fast cakey one because it skips chilling would be
 * answering a question they didn't ask.
 *
 * The dish is not scored here at all. It has already decided which recipes
 * reached this function; see candidatesFor.
 */
/**
 * A rating pulled toward the corpus mean by how little is behind it.
 *
 * The ranking used the rating as published, so five stars from one person
 * scored exactly as well as five stars from five hundred -- and better than
 * 4.9 from four hundred. "Best snickerdoodle" put a 5-from-1 above a 5-from-2
 * and there was no sense to be made of it, because the two were in fact tied
 * and the order came from somewhere else.
 *
 * Measured on the corpus this is not an edge case: 916 recipes carry a rating,
 * the mean is 4.73, and of the 276 that are a perfect 5.0, 118 have two
 * ratings or fewer. Taking those at face value hands the top of every
 * popularity query to whichever recipe nobody has reviewed yet.
 *
 * Same shrinkage as the dish windows: weight = n / (n + K), the rest of the
 * weight going to the prior. K is 15, the median number of ratings in the
 * corpus, so a recipe with a typical amount of evidence is halfway trusted.
 */
const RATING_PRIOR = 4.73;
const RATING_TRUST = 15;

export function confidentRating(rating: number | null, count: number | null): number | null {
  if (rating === null) return null;
  const n = count ?? 0;
  const w = n / (n + RATING_TRUST);
  return w * rating + (1 - w) * RATING_PRIOR;
}

export function matchScore(r: Rankable, i: Interpretation): number {
  let score =
    i.textures.chewy * r.scores.chewy +
    i.textures.cakey * r.scores.cakey +
    i.textures.crispy * r.scores.crispy;

  if (i.prefs.quick) {
    if (!r.chills_dough) score += 0.12;
    if (r.bake_minutes !== null && r.bake_minutes <= 11) score += 0.05;
  }
  if (i.prefs.easy) {
    if (r.method === "melted") score += 0.12; // no mixer needed
    if (r.ingredientCount <= 9) score += 0.05;
  }
  if (i.prefs.popular) {
    const rated = confidentRating(r.rating, r.ratingCount);
    if (rated !== null) score += (rated / 5) * 0.15;
  }

  // "oatmeal" on its own is a real query, and it says nothing about texture or
  // effort -- so every candidate would score an identical zero and the pick
  // would be whichever row the database happened to return first. Rating is
  // the only honest tiebreak left.
  const askedTexture = i.textures.chewy + i.textures.cakey + i.textures.crispy > 0;
  const askedEffort = i.prefs.quick || i.prefs.easy || i.prefs.popular;
  if (!askedTexture && !askedEffort) {
    const rated = confidentRating(r.rating, r.ratingCount);
    if (rated !== null) score += (rated / 5) * 0.2;
  }

  // Same rule as rankFor: a recipe whose ingredients barely parsed should not
  // win on a margin that is really just missing data.
  if (r.scores.confidence === "low") score -= 0.1;

  return score;
}
