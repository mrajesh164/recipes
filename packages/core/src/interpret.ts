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
 */

import type { Texture } from "./texture.ts";

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
  /** Phrases recognised, in the user's own words, to show back to them. */
  understood: string[];
  /** Words that meant nothing here. Shown so the gap is visible. */
  unrecognised: string[];
  /** Nothing at all was understood. */
  empty: boolean;
}

/**
 * Longest phrases first, so "soft baked" is read before "soft" and
 * "crispy edges" before "crispy".
 */
const TEXTURE_WORDS: ReadonlyArray<readonly [string, Partial<Record<Texture, number>>]> = [
  // Multi-word first.
  ["soft baked", { chewy: 0.7, cakey: 0.3 }],
  ["soft-baked", { chewy: 0.7, cakey: 0.3 }],
  ["crispy edges", { crispy: 0.6, chewy: 0.4 }],
  ["crunchy edges", { crispy: 0.6, chewy: 0.4 }],
  ["thick and chewy", { chewy: 0.8, cakey: 0.2 }],

  // Chewy family.
  ["chewy", { chewy: 1 }],
  ["chew", { chewy: 1 }],
  ["fudgy", { chewy: 0.9 }],
  ["gooey", { chewy: 0.9 }],
  ["dense", { chewy: 0.8 }],
  ["bendy", { chewy: 0.8 }],
  ["moist", { chewy: 0.6 }],

  // Cakey family.
  ["cakey", { cakey: 1 }],
  ["cake-like", { cakey: 1 }],
  ["fluffy", { cakey: 0.9 }],
  ["airy", { cakey: 0.9 }],
  ["puffy", { cakey: 0.8 }],
  ["tall", { cakey: 0.7 }],
  ["thick", { cakey: 0.6, chewy: 0.4 }],
  ["light", { cakey: 0.7 }],

  // Crispy family.
  ["crispy", { crispy: 1 }],
  ["crisp", { crispy: 1 }],
  ["crunchy", { crispy: 1 }],
  ["crunch", { crispy: 1 }],
  ["snappy", { crispy: 0.9 }],
  ["thin", { crispy: 0.8 }],
  ["flat", { crispy: 0.7 }],
  ["brittle", { crispy: 0.8 }],

  // "soft" last in its family: it is the most ambiguous word a baker uses,
  // meaning chewy to some and cakey to others. Split rather than guess.
  ["soft", { chewy: 0.5, cakey: 0.5 }],
];

const PREF_WORDS: ReadonlyArray<readonly [string, keyof Preferences]> = [
  ["no chill", "quick"],
  ["without chilling", "quick"],
  ["quick", "quick"],
  ["fast", "quick"],
  ["in a hurry", "quick"],
  ["tonight", "quick"],
  ["right now", "quick"],

  ["no mixer", "easy"],
  ["without a mixer", "easy"],
  ["by hand", "easy"],
  ["easy", "easy"],
  ["simple", "easy"],
  ["few ingredients", "easy"],
  ["beginner", "easy"],

  ["popular", "popular"],
  ["best", "popular"],
  ["highly rated", "popular"],
  ["well reviewed", "popular"],
  ["favourite", "popular"],
  ["favorite", "popular"],
];

/** Words that carry no information and should not be reported as unknown. */
const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "with", "without", "some", "very",
  "really", "quite", "i", "want", "would", "like", "need", "me", "my", "for",
  "that", "is", "are", "be", "to", "of", "in", "on", "it", "them", "please",
  "cookie", "cookies", "recipe", "recipes", "make", "making", "bake", "baking",
  "chocolate", "chip", "chips", "not", "too", "more", "less", "kind", "sort",
]);

export function interpret(input: string): Interpretation {
  const text = input.toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();

  const textures: Record<Texture, number> = { chewy: 0, cakey: 0, crispy: 0 };
  const prefs: Preferences = { quick: false, easy: false, popular: false };
  const understood: string[] = [];

  // Consume matched phrases so a word is not counted twice -- "thick and
  // chewy" must not also fire "thick" and "chewy" separately.
  let remaining = ` ${text} `;
  const consume = (phrase: string) => {
    remaining = remaining.replaceAll(` ${phrase} `, "  ");
  };

  for (const [phrase, weights] of TEXTURE_WORDS) {
    if (!remaining.includes(` ${phrase} `)) continue;
    for (const [k, v] of Object.entries(weights)) {
      textures[k as Texture] = Math.max(textures[k as Texture], v);
    }
    understood.push(phrase);
    consume(phrase);
  }

  for (const [phrase, key] of PREF_WORDS) {
    if (!remaining.includes(` ${phrase} `)) continue;
    prefs[key] = true;
    understood.push(phrase);
    consume(phrase);
  }

  const unrecognised = remaining
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w));

  const empty =
    understood.length === 0 &&
    !prefs.quick && !prefs.easy && !prefs.popular;

  return { textures, prefs, understood, unrecognised: [...new Set(unrecognised)], empty };
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

export interface Rankable {
  scores: { chewy: number; cakey: number; crispy: number; confidence: "high" | "low" };
  method: "melted" | "creamed" | "other" | null;
  chills_dough: boolean;
  bake_minutes: number | null;
  rating: number | null;
  ingredientCount: number;
}

/**
 * Score a recipe against an interpretation.
 *
 * Texture dominates; the preferences are deliberately small nudges rather than
 * filters. Someone asking for "quick chewy cookies" wants a chewy cookie
 * first -- returning a fast cakey one because it skips chilling would be
 * answering a question they didn't ask.
 */
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
  if (i.prefs.popular && r.rating !== null) {
    score += (r.rating / 5) * 0.15;
  }

  // Same rule as rankFor: a recipe whose ingredients barely parsed should not
  // win on a margin that is really just missing data.
  if (r.scores.confidence === "low") score -= 0.1;

  return score;
}
