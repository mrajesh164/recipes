/**
 * The network edge. Kept apart from extract.ts so that everything which can
 * actually go wrong with a recipe page is testable from a saved string.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface FetchResult {
  /** The URL as requested. */
  url: string;
  /**
   * Where the request actually ended up. fetch() follows redirects, and a
   * hand-written URL often lands somewhere canonical:
   * /recipes/chocolate-chip-cookies-recipe redirects to
   * /recipes/classic-chocolate-chip-cookies-recipe. Storing the requested URL
   * as the identity means the same recipe can enter the corpus twice under
   * two keys, which is how a duplicate first appeared.
   */
  finalUrl: string;
  status: number;
  html: string | null;
  error: string | null;
}

export async function fetchPage(url: string, timeoutMs = 25_000): Promise<FetchResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    // A 403 here is bot protection, not a bug, and not something a different
    // header will fix -- that was tested. Record it and move on.
    if (!res.ok) return { url, finalUrl: res.url || url, status: res.status, html: null, error: null };
    return { url, finalUrl: res.url || url, status: res.status, html: await res.text(), error: null };
  } catch (e) {
    return { url, finalUrl: url, status: 0, html: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** One request at a time, with a gap. There is no hurry and no reason to hammer. */
export async function fetchAll(urls: string[], gapMs = 1200): Promise<FetchResult[]> {
  const out: FetchResult[] = [];
  for (const [i, url] of urls.entries()) {
    out.push(await fetchPage(url));
    if (i < urls.length - 1) await new Promise((r) => setTimeout(r, gapMs));
  }
  return out;
}

/** The host, without www., as the unit politeness is actually owed to. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/**
 * Round-robin the queue across hosts, so consecutive requests land on
 * different sites.
 *
 * The queue arrives grouped: every URL from one site, then every URL from the
 * next, because that is the order the sitemap sweeps produced them in. Fetched
 * in that order, a per-host gap cannot overlap with anything -- each wait for
 * site A is dead time that no request to site B is filling. Interleaved, the
 * gap one host is serving runs down while other hosts are being fetched, so
 * the crawl is bounded by response time rather than by politeness, and no site
 * is hit any harder.
 */
export function interleaveByHost(urls: string[]): string[] {
  const queues = new Map<string, string[]>();
  for (const u of urls) {
    const h = hostOf(u);
    const q = queues.get(h);
    if (q) q.push(u);
    else queues.set(h, [u]);
  }
  const lists = [...queues.values()];
  const out: string[] = [];
  for (let i = 0; out.length < urls.length; i++) {
    for (const list of lists) {
      const u = list[i];
      if (u !== undefined) out.push(u);
    }
  }
  return out;
}

// ------------------------------------------------------------- caching --

/**
 * The same fetch, but remembering what came back.
 *
 * Extraction gets iterated on: a density is missing, a title guard is too
 * strict, a site nests its Recipe somewhere new. Each iteration previously
 * meant pulling 237 pages down again, which is slow and -- more to the point
 * -- is someone else's bandwidth being spent on a bug in this repo. The pages
 * do not change between runs; the parser does.
 *
 * The cache lives under out/, which is gitignored, so it is a local
 * convenience and never a source of truth. Pass refresh to ignore it.
 */
export async function fetchAllCached(
  urls: string[],
  cacheDir: string,
  opts: { refresh?: boolean; gapMs?: number } = {},
): Promise<FetchResult[]> {
  // gapMs is per host, not global. See the wait below.
  const { refresh = false, gapMs = 1200 } = opts;
  const { mkdirSync, readFileSync, writeFileSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");

  mkdirSync(cacheDir, { recursive: true });
  const pathFor = (u: string) =>
    join(cacheDir, `${createHash("sha1").update(u).digest("hex")}.json`);

  const out: FetchResult[] = [];
  /** When each host was last asked for something, so the gap is owed per site. */
  const lastHitAt = new Map<string, number>();
  let fetched = 0;
  for (const url of urls) {
    const file = pathFor(url);
    if (!refresh && existsSync(file)) {
      try {
        out.push(JSON.parse(readFileSync(file, "utf8")) as FetchResult);
        continue;
      } catch {
        // A corrupt cache entry is not worth a crash -- refetch it.
      }
    }
    // Only sleep before a request that is actually going out, and only for
    // as long as this particular host is still owed. A cache hit costs nobody
    // anything and should not cost 1.2 seconds either -- and neither should a
    // request to a site that has not been touched yet. The gap was previously
    // global, which waited just as long between two different sites as
    // between two pages of the same one; with the corpus spread over ~30
    // sites that is most of the run spent waiting on nobody's behalf.
    const h = hostOf(url);
    const since = Date.now() - (lastHitAt.get(h) ?? -Infinity);
    if (since < gapMs) await new Promise((r) => setTimeout(r, gapMs - since));
    lastHitAt.set(h, Date.now());
    const res = await fetchPage(url);
    fetched++;
    out.push(res);
    writeFileSync(file, JSON.stringify(res));
  }
  console.error(`  (${fetched} fetched, ${urls.length - fetched} from cache)`);
  return out;
}
