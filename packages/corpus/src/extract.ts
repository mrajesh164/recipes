/**
 * HTML in, a recipe row out.
 *
 * Deliberately pure: no network, no filesystem, no database. Everything that
 * can go wrong with a recipe page can be reproduced from a saved string, which
 * is the only reason this is testable at all.
 *
 * The structured-data spec is loose in ways that matter. From the 14 Nov spike
 * and schema.org's own definitions:
 *
 *   - A page may carry several <script type="application/ld+json"> blocks, and
 *     the Recipe is rarely the first. One malformed block must not stop the
 *     others being read.
 *   - The Recipe may sit at the top level, inside an array, or nested in
 *     "@graph".
 *   - "@type" may be a string or an array (["Recipe", "NewsArticle"]).
 *   - recipeInstructions may be a string, an array of strings, an array of
 *     HowToStep, or HowToSection objects containing itemListElement.
 *   - recipeYield may be "36", "about 3 dozen", or -- really, from King
 *     Arthur -- ["36", "36 cookies)"].
 *   - Numbers arrive as strings about as often as numbers.
 */

import { parseIngredient, methodHint, type ParsedIngredient } from "@recipes/core";

export type Method = "melted" | "creamed" | "other";

export interface ExtractedRecipe {
  sourceUrl: string;
  sourceName: string;
  title: string;
  yieldCount: number | null;
  rating: number | null;
  ratingCount: number | null;
  method: Method | null;
  bakeTempF: number | null;
  bakeMinutes: number | null;
  chillsDough: boolean;
  imageUrl: string | null;
  ingredients: ParsedIngredient[];
  instructionsText: string;
  rawJsonLd: unknown;
}

// ----------------------------------------------------------- finding it ----

/** Every ld+json block on the page, parsed leniently. */
function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  // Match the MIME type anywhere in the tag rather than insisting on
  // type="...". HTML5 allows unquoted attribute values and Yoast -- which is
  // on a large share of food blogs -- emits exactly that:
  //   <script type=application/ld+json class=yoast-schema-graph>
  // Requiring the quotes skipped those pages silently.
  const re = /<script[^>]*\bapplication\/ld\+json\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1]!.trim()));
    } catch {
      // A single unparseable block is normal on real pages. Skip it; the
      // Recipe is very often in a later one.
    }
  }
  return out;
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

/** Walks arrays and @graph, collecting anything typed Recipe. */
export function findRecipeNodes(parsed: unknown, found: Record<string, unknown>[] = []) {
  if (Array.isArray(parsed)) {
    for (const n of parsed) findRecipeNodes(n, found);
  } else if (parsed && typeof parsed === "object") {
    const node = parsed as Record<string, unknown>;
    if (typesOf(node).includes("Recipe")) found.push(node);
    if ("@graph" in node) findRecipeNodes(node["@graph"], found);
  }
  return found;
}

// ------------------------------------------------------------- coercion ----

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.match(/-?\d+(?:\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in (v as Record<string, unknown>)) {
    const n = (v as Record<string, unknown>).name;
    if (typeof n === "string") return n;
  }
  if (Array.isArray(v)) {
    for (const item of v) { const s = str(item); if (s) return s; }
  }
  return null;
}

/**
 * First integer anywhere in the yield. King Arthur returns
 * ["36", "36 cookies)"] -- note the stray bracket -- so this takes the first
 * value that contains a number rather than trusting the shape.
 */
function parseYield(v: unknown): number | null {
  const candidates = Array.isArray(v) ? v : [v];
  for (const c of candidates) {
    const n = num(c);
    if (n !== null && n > 0) return Math.round(n);
  }
  return null;
}

/** recipeInstructions, in all four shapes, flattened to plain text. */
export function instructionsToText(v: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") { parts.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      // HowToSection holds its steps in itemListElement.
      if ("itemListElement" in o) { walk(o.itemListElement); return; }
      if (typeof o.text === "string") { parts.push(o.text); return; }
      if (typeof o.name === "string") { parts.push(o.name); return; }
    }
  };
  walk(v);
  return parts
    .map((p) => p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------- derived properties ----

export function bakeTempF(text: string): number | null {
  // "350°F", "350 degrees F", "350 F". Celsius-only pages are rarer in this
  // corpus and are left null rather than guessed at.
  const m = text.match(/(\d{3})\s*(?:°|\s)?\s*(?:degrees?\s*)?F\b/i);
  return m ? Number(m[1]) : null;
}

export function bakeMinutes(text: string): number | null {
  // Prefer a range's upper bound: "bake 10 to 12 minutes" is 12 at the oven.
  const range = text.match(/(\d+)\s*(?:to|-|–|—)\s*(\d+)\s*min/i);
  if (range) return Number(range[2]);
  const single = text.match(/(\d+)\s*min/i);
  return single ? Number(single[1]) : null;
}

export function chillsDough(text: string): boolean {
  return /\b(chill|refrigerat)\w*\b/i.test(text) ||
    /\brest\b[^.]{0,40}\b(hours?|overnight)\b/i.test(text);
}

/**
 * Melted or creamed, which is a bigger texture lever than most ratios.
 *
 * The ingredient line is checked first because it is unambiguous when present
 * -- Love and Lemons writes "(1½ sticks, melted and cooled slightly)" right
 * there. Falling back to the instructions is guesswork by comparison, so
 * anything that does not clearly say one or the other becomes "other" rather
 * than a coin flip.
 */
export function detectMethod(ings: ParsedIngredient[], instructions: string): Method {
  for (const i of ings) {
    const hint = methodHint(i);
    if (hint) return hint;
  }
  const t = instructions.toLowerCase();
  if (/\bmelt(ed|ing)?\b[^.]{0,30}\bbutter\b/.test(t)) return "melted";
  if (/\bbutter\b[^.]{0,30}\bmelt(ed|ing)?\b/.test(t)) return "melted";
  // "cream the butter and sugar" is the explicit form. But King Arthur writes
  // "combine the sugars, butter, shortening ... beating until smooth and
  // creamy", where the creaming is described by its result, after the
  // ingredients, and "beating" defeats a \bbeat\b anchor. Both forms count.
  if (/\bcream(ed|ing|s)?\b[^.]{0,40}\b(butter|sugar)\b/.test(t)) return "creamed";
  if (/\b(beat|mix|combine|whisk)\w*\b[^.]{0,160}\b(creamy|fluffy)\b/.test(t)) return "creamed";
  if (/\bbutter\b[^.]{0,160}\b(creamy|fluffy)\b/.test(t)) return "creamed";
  return "other";
}

/**
 * schema.org allows `image` to be a URL string, an ImageObject, or an array of
 * either -- and sites use all three. Google requires the property for recipe
 * rich results, so in practice every page that publishes a Recipe publishes a
 * photograph too.
 */
export function imageUrlFrom(v: unknown): string | null {
  if (typeof v === "string") return v || null;
  if (Array.isArray(v)) {
    for (const item of v) { const u = imageUrlFrom(item); if (u) return u; }
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["url", "contentUrl"]) {
      if (typeof o[k] === "string" && o[k]) return o[k] as string;
    }
  }
  return null;
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// ----------------------------------------------------------------- main ----

export function extractRecipe(html: string, sourceUrl: string): ExtractedRecipe | null {
  const nodes: Record<string, unknown>[] = [];
  for (const block of jsonLdBlocks(html)) findRecipeNodes(block, nodes);
  if (nodes.length === 0) return null;

  // If a page somehow carries several, take the one with the most
  // ingredients -- the others are usually related-recipe stubs.
  const node = nodes.sort(
    (a, b) => (asArray(b.recipeIngredient).length - asArray(a.recipeIngredient).length),
  )[0]!;

  const title = str(node.name) ?? "";
  const ingredientLines = asArray(node.recipeIngredient).filter(
    (x): x is string => typeof x === "string",
  );
  const ingredients = ingredientLines.map(parseIngredient);
  const instructionsText = instructionsToText(node.recipeInstructions);

  const agg = (node.aggregateRating ?? {}) as Record<string, unknown>;

  return {
    sourceUrl,
    sourceName: str(node.publisher) ?? str(node.author) ?? hostnameOf(sourceUrl),
    title,
    yieldCount: parseYield(node.recipeYield),
    rating: num(agg.ratingValue),
    ratingCount: num(agg.ratingCount) ?? num(agg.reviewCount),
    method: ingredients.length ? detectMethod(ingredients, instructionsText) : null,
    bakeTempF: bakeTempF(instructionsText),
    bakeMinutes: bakeMinutes(instructionsText),
    chillsDough: chillsDough(instructionsText),
    imageUrl: imageUrlFrom(node.image),
    ingredients,
    instructionsText,
    rawJsonLd: node,
  };
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
}

/**
 * Does this look like the dish we asked for?
 *
 * A Food.com chocolate chip cookie URL returned "Apricot Banana Bread" during
 * the spike. Whatever the cause, the lesson is that the recipe you get back is
 * not necessarily the recipe you asked for, and a corpus seeded without this
 * check quietly contains banana bread.
 */
export function titleMatches(title: string, expectedKeywords: string[]): boolean {
  const t = title.toLowerCase();
  return expectedKeywords.every((k) => t.includes(k.toLowerCase()));
}
