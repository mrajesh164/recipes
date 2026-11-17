/**
 * Pull candidate recipe URLs out of a site's sitemap.
 *
 *   node --experimental-strip-types packages/corpus/src/harvest.ts
 *
 * Every site in SOURCES advertises its sitemap in robots.txt, which is an
 * explicit invitation to crawl it, and none of them disallow recipe pages
 * (checked 15 Nov, re-checked 17 Nov). This reads the index, follows the child
 * sitemaps, and filters -- so the corpus grows without anyone typing recipes
 * in by hand.
 *
 * The filtering matters more than the fetching. "chocolate chip" in a URL
 * catches muffins, scones, blondies and pecan pie, and a chocolate chip
 * *cake* has nothing useful to say about how chewy a *cookie* will be. Worse,
 * gluten-free and vegan versions substitute the exact ingredients the texture
 * scoring reads -- a flour blend and a butter replacement -- so including them
 * would quietly poison the ratios rather than add variety.
 *
 * The lists that encode all that now live in dish.ts, because run.ts needs the
 * same answers when it decides what to keep. See the note there.
 *
 * Which sites are listed is not a taste judgement. Of 38 candidate domains
 * probed on 17 Nov, 16 return 403 to any automated request -- no header gets
 * past it, that was tested with a full browser header set -- and several more
 * publish no usable sitemap. What is left is what answers.
 */

import { fetchPage } from "./fetch.ts";
import { EXCLUDE, classifyDish } from "./dish.ts";

interface Source {
  name: string;
  sitemap: string;
  /** All must appear in the URL. */
  include: string[];
  /** Any one of these disqualifies it. */
  exclude: string[];
}

/**
 * Pages that are *about* cookies without *being* a cookie: roundups,
 * collections, tag pages, shop listings. They carry no Recipe in their
 * structured data, so extract.ts would drop them anyway -- but each one still
 * costs a fetch and 1.2 seconds of someone else's bandwidth.
 */
const NOT_A_RECIPE_PAGE = [
  "/collection/", "/collections/", "/category/", "/categories/", "/tag/",
  "/tags/", "/gallery/", "/article/", "/articles/", "/shop/", "/products/",
  "/blog/", "/author/", "/search", "/about", "-recipes-to-", "best-cookie-recipes",
  "cookie-recipes/", "/guide/", "/how-to/", "/video", "/class", "/learn/",
];

const SOURCES: Source[] = [
  // Confirmed answering an automated request, with schema.org Recipe on the
  // page, on 17 Nov.
  { name: "King Arthur Baking", sitemap: "https://www.kingarthurbaking.com/sitemap.xml", include: ["/recipes/", "cookie"], exclude: EXCLUDE },
  { name: "Love and Lemons", sitemap: "https://www.loveandlemons.com/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Taste of Home", sitemap: "https://www.tasteofhome.com/sitemap_index.xml", include: ["/recipes/", "cookie"], exclude: EXCLUDE },
  { name: "Averie Cooks", sitemap: "https://www.averiecooks.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Broma Bakery", sitemap: "https://bromabakery.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "The Kitchn", sitemap: "https://www.thekitchn.com/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Once Upon a Chef", sitemap: "https://www.onceuponachef.com/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "RecipeTin Eats", sitemap: "https://www.recipetineats.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Natasha's Kitchen", sitemap: "https://natashaskitchen.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "BBC Good Food", sitemap: "https://www.bbcgoodfood.com/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Inspired Taste", sitemap: "https://www.inspiredtaste.net/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Epicurious", sitemap: "https://www.epicurious.com/sitemap.xml", include: ["/recipes/", "cookie"], exclude: EXCLUDE },

  // Second batch, probed 17 Nov after the first twelve came up short of 200.
  { name: "Bake or Break", sitemap: "https://bakeorbreak.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Tasty", sitemap: "https://tasty.co/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Land O'Lakes", sitemap: "https://www.landolakes.com/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "My Baking Addiction", sitemap: "https://www.mybakingaddiction.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Joy the Baker", sitemap: "https://joythebaker.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Live Well Bake Often", sitemap: "https://www.livewellbakeoften.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Baked by Rachel", sitemap: "https://www.bakedbyrachel.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Barefeet in the Kitchen", sitemap: "https://barefeetinthekitchen.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Spend With Pennies", sitemap: "https://www.spendwithpennies.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Tutti Dolci", sitemap: "https://tutti-dolci.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Betty Crocker", sitemap: "https://www.bettycrocker.com/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Pillsbury", sitemap: "https://www.pillsbury.com/sitemap.xml", include: ["cookie"], exclude: EXCLUDE },
  { name: "Bon Appetit", sitemap: "https://www.bonappetit.com/sitemap.xml", include: ["/recipe", "cookie"], exclude: EXCLUDE },
  { name: "Salty Side Dish", sitemap: "https://www.saltysidedish.com/sitemap_index.xml", include: ["cookie"], exclude: EXCLUDE },

  // Probed and rejected, kept here so the next person does not re-probe them:
  //   403 to every request, full browser headers included --
  //     davidlebovitz, beyondfrosting, completelydelicious, thestayathomechef,
  //     shugarysweets, cookiedoughandovenmitt, ghirardelli (406),
  //     allrecipes, seriouseats, simplyrecipes, sallysbakingaddiction,
  //     preppykitchen, budgetbytes, cookieandkate, sugarspunrun,
  //     joyfoodsunshine, bakingamoment, crazyforcrust, halfbakedharvest,
  //     thefoodcharlatan, chelseasmessyapron, ambitiouskitchen,
  //     lifeloveandsugar, modernhoney, twopeasandtheirpod
  //   no sitemap, or 429 on robots.txt --
  //     food52, bakerbynature, handletheheat, delish
  //   Food.com: serves "Apricot Banana Bread" for a cookie URL. See urls.txt.
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

/**
 * Child sitemaps worth following. Taste of Home's index lists sitemaps for
 * authors, taxonomies and images as well as content; fetching all of them to
 * find cookies is slow and rude in equal measure.
 */
const CONTENT_SITEMAP = /post|recipe|page|article|content|sitemap-?\d|\bwp-/i;

async function urlsFrom(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 1) return []; // indexes of indexes are not a thing worth chasing
  const res = await fetchPage(sitemapUrl);
  if (!res.html) {
    console.error(`  ! ${sitemapUrl}: http ${res.status}${res.error ? ` ${res.error}` : ""}`);
    return [];
  }
  const locs = locsIn(res.html);
  if (!isIndex(res.html)) return locs;

  const children = locs.filter((c) => CONTENT_SITEMAP.test(c));
  const out: string[] = [];
  for (const child of (children.length ? children : locs).slice(0, 25)) {
    out.push(...(await urlsFrom(child, depth + 1)));
    await new Promise((r) => setTimeout(r, 800));
  }
  return out;
}

for (const src of SOURCES) {
  console.log(`\n# ${src.name}`);
  const all = await urlsFrom(src.sitemap);
  const matched = [...new Set(all)]
    .filter((u) => src.include.every((k) => u.toLowerCase().includes(k)))
    .filter((u) => !src.exclude.some((k) => u.toLowerCase().includes(k)))
    .filter((u) => !NOT_A_RECIPE_PAGE.some((k) => u.toLowerCase().includes(k)))
    // Exactly one dish, or we cannot say what it is. See classifyDish.
    .filter((u) => classifyDish(u) !== null)
    .sort();
  console.error(`  (${all.length} urls in sitemap, ${matched.length} kept)`);
  for (const u of matched) console.log(u);
}
