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

import { parseIngredient, methodHint, mentionsTexture, type ParsedIngredient } from "@recipes/core";

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
  /**
   * What people wrote about it, trimmed.
   *
   * Kept because a review is the only direct evidence in the corpus of how a
   * recipe actually turned out -- everything else is inferred from the
   * ingredient list. Capped and truncated: these ship to the browser with the
   * corpus, and the whole point of a quote is that it is short.
   */
  reviews: string[];
  rawJsonLd: unknown;
}

/**
 * Review bodies from the schema.org node.
 *
 * `review` is either one object or an array of them, and plenty of sites emit
 * an empty reviewBody or a rating with no words in it. Whitespace gets
 * collapsed because these are written in a textarea and arrive with newlines
 * and runs of spaces in them.
 */
const MAX_REVIEWS = 4;
const MAX_REVIEW_CHARS = 180;

export function reviewsFrom(node: Record<string, unknown>): string[] {
  const raw = node.review;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: string[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const body = (r as Record<string, unknown>).reviewBody;
    if (typeof body !== "string") continue;
    const text = body.replace(/\s+/g, " ").trim();
    // One-word reviews ("Great!") carry no information about the bake.
    if (text.length < 12) continue;
    // Nor does "delicious, will make again", which is most of them. Only a
    // review that names a texture can ever be quoted as evidence, so the rest
    // are payload that crowds out the ones that can -- taking the first four
    // of everything threw away a "so chewy" sitting at position seven.
    if (!mentionsTexture(text)) continue;
    out.push(text.length > MAX_REVIEW_CHARS ? text.slice(0, MAX_REVIEW_CHARS - 1).trimEnd() + "\u2026" : text);
    if (out.length === MAX_REVIEWS) break;
  }
  return out;
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

/**
 * JSON-LD carries HTML entities through unescaped, because the JSON is
 * embedded in an HTML document and plenty of plugins never decode it on the
 * way in. Real lines from the corpus:
 *
 *   1 &amp; 1/2 teaspoons vanilla extract
 *   Oatmeal S&#8217;more Cookies
 *
 * Left alone, "&amp;" hides a mixed number from the quantity parser and the
 * title shows a user raw markup. Both are silent: nothing throws, the number
 * is simply never found.
 */
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", deg: "\u00b0",
  frac12: "\u00bd", frac14: "\u00bc", frac34: "\u00be", frac13: "\u2153",
  frac23: "\u2154", times: "\u00d7", middot: "\u00b7",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      // Decoding to a control character or a lone surrogate would be worse
      // than leaving the entity visible.
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/**
 * Ingredient lists are grouped, and the group labels arrive as ingredients.
 *
 * "Cookie", "Frosting", "Drizzle", "For the dough:" -- these are headings in
 * the recipe card that schema.org has no way to mark as such, so they land in
 * recipeIngredient looking like food. They are not food: they have no
 * quantity, they can never resolve to grams, and counting them drags down a
 * number that is supposed to measure the parser.
 *
 * Deliberately narrow. A line is only a heading if it carries no digit at all
 * and is either punctuated like a label or is one of the words recipe cards
 * actually use for one. "Flaky sea salt" stays an ingredient -- it is real,
 * it simply has no quantity.
 */
const HEADING_WORDS = new Set([
  "cookie", "cookies", "dough", "batter", "frosting", "icing", "glaze",
  "drizzle", "topping", "filling", "assembly", "garnish", "crust", "sauce",
  "coating", "decoration", "decorations", "equipment", "optional",
  "sugar", "flour", "butter", "wet", "dry", "cream",
]);

export function isSectionHeading(line: string): boolean {
  const t = line.trim();
  if (!t || /\d/.test(t)) return false;
  if (/[:：]\s*$/.test(t)) return true;
  if (/^for the\b/i.test(t)) return true;
  const words = t.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/);
  return words.length <= 2 && words.every((w) => HEADING_WORDS.has(w));
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
 *
 * It takes the LARGEST, which is the whole point of this function and was the
 * cause of a visible bug. 211 of the 325 corpus recipes publish an array, and
 * it is conventionally ordered 1:1, 4:3, 16:9 -- Google asks for several crops
 * of the same photo. Taking the first meant taking the square thumbnail, often
 * 480x480, and then rendering it 640px wide in a card. Every one of those
 * pictures was visibly soft, which is what "blurry pic" was.
 *
 * Size comes from the declared width/height when the site publishes an
 * ImageObject, and from the filename when it does not -- WordPress stamps the
 * crop into the name as "-1200x800", which 74 of the corpus URLs carry.
 */
interface Sized { url: string; pixels: number }

/** WordPress and friends: "...cookies-480x480.jpg" -> 230400. */
function pixelsFromUrl(url: string): number {
  const m = url.match(/[-_](\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i);
  return m ? Number(m[1]) * Number(m[2]) : 0;
}

function sizedImages(v: unknown, out: Sized[] = []): Sized[] {
  if (typeof v === "string") {
    if (v) out.push({ url: v, pixels: pixelsFromUrl(v) });
    return out;
  }
  if (Array.isArray(v)) {
    for (const item of v) sizedImages(item, out);
    return out;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["url", "contentUrl"]) {
      const u = o[k];
      if (typeof u === "string" && u) {
        // A declared size beats one guessed from the filename, since the
        // filename often describes a crop of a much larger original.
        const w = num(o.width);
        const h = num(o.height);
        const declared = w !== null && h !== null ? w * h : 0;
        out.push({ url: u, pixels: declared || pixelsFromUrl(u) });
        break;
      }
    }
  }
  return out;
}

export function imageUrlFrom(v: unknown): string | null {
  const all = sizedImages(v);
  if (all.length === 0) return null;
  // Stable: equal sizes keep publication order, so a site that declares
  // nothing still gets its own first choice rather than an arbitrary one.
  let best = all[0]!;
  for (const c of all) if (c.pixels > best.pixels) best = c;
  return best.url;
}

/**
 * The un-cropped original behind a WordPress crop, if the URL names one.
 *
 * "cookies-480x480.jpg" is a derivative; "cookies.jpg" is what the author
 * uploaded, and it is usually 1200-2000px wide. Stripping the suffix is a
 * guess, though -- the original can be gone, or the crop can be the only
 * version -- so this only proposes the URL. Whoever calls it has to confirm
 * the file is really there before putting it in the database, because a 404
 * here is a card with no photograph at all, which is worse than a soft one.
 */
export function originalImageCandidate(url: string): string | null {
  const m = url.match(/^(.*?)[-_](\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp|avif))(\?.*)?$/i);
  if (!m) return null;
  // Already big enough that the original is unlikely to be worth a request.
  if (Number(m[2]) >= 1200) return null;
  return `${m[1]}${m[4]}${m[5] ?? ""}`;
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

  const title = decodeEntities(str(node.name) ?? "");
  const ingredientLines = asArray(node.recipeIngredient)
    .filter((x): x is string => typeof x === "string")
    .map((line) => decodeEntities(line).replace(/\s+/g, " ").trim())
    .filter((line) => line && !isSectionHeading(line));
  const ingredients = ingredientLines.map(parseIngredient);
  const instructionsText = decodeEntities(instructionsToText(node.recipeInstructions));

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
    reviews: reviewsFrom(node),
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
