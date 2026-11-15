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
