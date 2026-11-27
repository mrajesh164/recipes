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
import { exclusionsFor, classifyDish, type Category } from "./dish.ts";

interface Source {
  name: string;
  /** Which category this sweep is looking for. Decides what it rules out. */
  category: Category;
  sitemap: string;
  /** All must appear in the URL. */
  include: string[];
  /** Any one of these disqualifies it. */
  exclude: readonly string[];
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
  { name: "King Arthur Baking", category: "cookie", sitemap: "https://www.kingarthurbaking.com/sitemap.xml", include: ["/recipes/", "cookie"], exclude: exclusionsFor("cookie") },
  { name: "Love and Lemons", category: "cookie", sitemap: "https://www.loveandlemons.com/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Taste of Home", category: "cookie", sitemap: "https://www.tasteofhome.com/sitemap_index.xml", include: ["/recipes/", "cookie"], exclude: exclusionsFor("cookie") },
  { name: "Averie Cooks", category: "cookie", sitemap: "https://www.averiecooks.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Broma Bakery", category: "cookie", sitemap: "https://bromabakery.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "The Kitchn", category: "cookie", sitemap: "https://www.thekitchn.com/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Once Upon a Chef", category: "cookie", sitemap: "https://www.onceuponachef.com/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "RecipeTin Eats", category: "cookie", sitemap: "https://www.recipetineats.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Natasha's Kitchen", category: "cookie", sitemap: "https://natashaskitchen.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "BBC Good Food", category: "cookie", sitemap: "https://www.bbcgoodfood.com/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Inspired Taste", category: "cookie", sitemap: "https://www.inspiredtaste.net/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Epicurious", category: "cookie", sitemap: "https://www.epicurious.com/sitemap.xml", include: ["/recipes/", "cookie"], exclude: exclusionsFor("cookie") },

  // Second batch, probed 17 Nov after the first twelve came up short of 200.
  { name: "Bake or Break", category: "cookie", sitemap: "https://bakeorbreak.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Tasty", category: "cookie", sitemap: "https://tasty.co/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Land O'Lakes", category: "cookie", sitemap: "https://www.landolakes.com/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "My Baking Addiction", category: "cookie", sitemap: "https://www.mybakingaddiction.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Joy the Baker", category: "cookie", sitemap: "https://joythebaker.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Live Well Bake Often", category: "cookie", sitemap: "https://www.livewellbakeoften.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Baked by Rachel", category: "cookie", sitemap: "https://www.bakedbyrachel.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Barefeet in the Kitchen", category: "cookie", sitemap: "https://barefeetinthekitchen.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Spend With Pennies", category: "cookie", sitemap: "https://www.spendwithpennies.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Tutti Dolci", category: "cookie", sitemap: "https://tutti-dolci.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Betty Crocker", category: "cookie", sitemap: "https://www.bettycrocker.com/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Pillsbury", category: "cookie", sitemap: "https://www.pillsbury.com/sitemap.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },
  { name: "Bon Appetit", category: "cookie", sitemap: "https://www.bonappetit.com/sitemap.xml", include: ["/recipe", "cookie"], exclude: exclusionsFor("cookie") },
  { name: "Salty Side Dish", category: "cookie", sitemap: "https://www.saltysidedish.com/sitemap_index.xml", include: ["cookie"], exclude: exclusionsFor("cookie") },

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
