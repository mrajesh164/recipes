/**
 * Pull candidate recipe URLs out of a site's sitemap.
 *
 *   node --experimental-strip-types packages/corpus/src/harvest.ts
 *
 * Every site in SOURCES advertises its sitemap in robots.txt, which is an
 * explicit invitation to crawl it, and none of them disallow recipe pages
 * (checked 15 Nov). This reads the index, follows the child sitemaps, and
 * filters -- so the corpus grows without anyone typing recipes in by hand.
 *
 * The filtering matters more than the fetching. "chocolate chip" in a URL
 * catches muffins, scones, blondies and pecan pie, and a chocolate chip
 * *cake* has nothing useful to say about how chewy a *cookie* will be. Worse,
 * gluten-free and vegan versions substitute the exact ingredients the texture
 * scoring reads -- a flour blend and a butter replacement -- so including them
 * would quietly poison the ratios rather than add variety.
 */

import { fetchPage } from "./fetch.ts";

interface Source {
  name: string;
  sitemap: string;
  /** All must appear in the URL. */
  include: string[];
  /** Any one of these disqualifies it. */
  exclude: string[];
}

/**
 * Shared, because the same things disqualify a recipe whichever site it is on.
 * Keeping two lists in step by hand is how Love and Lemons' carrot-oat and
 * pumpkin cookies got through on the first run.
 */
const NOT_THE_SAME_DISH = [
  "bars", "cake", "skillet", "ice-cream", "pie", "muffin", "scone",
  "bread", "blondie", "mandelbrot", "snickerdoodle",
];

/** Substitutes the very ingredients the texture scoring reads. */
const SUBSTITUTES_THE_RATIOS = [
  "gluten-free", "vegan", "almond-flour", "self-rising", "baking-mix",
  "healthy",
];

/** Additions and methods that dominate the texture for other reasons. */
const CONFOUNDING = [
  "zucchini", "pumpkin", "oatmeal", "oat-", "-oat", "carrot",
  "peanut-butter", "pistachio", "sourdough", "double-chocolate",
  "marbled", "cream-cheese", "high-altitude",
];

const EXCLUDE = [...NOT_THE_SAME_DISH, ...SUBSTITUTES_THE_RATIOS, ...CONFOUNDING];

const SOURCES: Source[] = [
  {
    name: "King Arthur Baking",
    sitemap: "https://www.kingarthurbaking.com/sitemap.xml",
    include: ["/recipes/", "chocolate-chip", "cookie"],
    exclude: EXCLUDE,
  },
  {
    name: "Love and Lemons",
    sitemap: "https://www.loveandlemons.com/sitemap.xml",
    include: ["chocolate-chip-cookies"],
    exclude: EXCLUDE,
  },
];

const LOC = /<loc>([^<]*)<\/loc>/g;

function locsIn(xml: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = LOC.exec(xml)) !== null) out.push(m[1]!.trim());
  LOC.lastIndex = 0;
  return out;
}

/** A sitemap index points at more sitemaps; a sitemap points at pages. */
function isIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

async function urlsFrom(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 1) return []; // indexes of indexes are not a thing worth chasing
  const res = await fetchPage(sitemapUrl);
  if (!res.html) {
    console.error(`  ! ${sitemapUrl}: http ${res.status}${res.error ? ` ${res.error}` : ""}`);
    return [];
  }
  const locs = locsIn(res.html);
  if (!isIndex(res.html)) return locs;

  const out: string[] = [];
  for (const child of locs) {
    out.push(...(await urlsFrom(child, depth + 1)));
    await new Promise((r) => setTimeout(r, 800));
  }
  return out;
}

for (const src of SOURCES) {
  console.log(`\n# ${src.name}`);
  const all = await urlsFrom(src.sitemap);
  const matched = [...new Set(all)]
    .filter((u) => src.include.every((k) => u.includes(k)))
    .filter((u) => !src.exclude.some((k) => u.includes(k)))
    .sort();
  console.error(`  (${all.length} urls in sitemap, ${matched.length} kept)`);
  for (const u of matched) console.log(u);
}
