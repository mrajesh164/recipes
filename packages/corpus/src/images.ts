/**
 * Upgrade each recipe's photograph to the biggest file that really exists.
 *
 * extract.ts already picks the largest variant the page *declares*. This goes
 * one step further for the WordPress crops: "cookies-480x480.jpg" is a
 * derivative of "cookies.jpg", and the original is usually 1200px or wider.
 * Stripping the suffix is only a guess, so every candidate is confirmed with a
 * HEAD request before it is used -- an upgrade that 404s would replace a soft
 * photograph with no photograph, which is a worse bug than the one being fixed.
 *
 * Results are cached on disk. The confirmation is a property of the URL, not
 * of this run, and re-checking 300 images on every parser tweak would be rude
 * to the sites and slow for me.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { originalImageCandidate } from "./extract.ts";

type Verdict = string | null; // the upgraded URL, or null for "no better one"

function loadCache(path: string): Record<string, Verdict> {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, Verdict>;
  } catch {
    return {};
  }
}

/** Is it there, and is it actually an image? */
async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return false;
    // Some hosts answer 200 with an HTML "not found" page for a missing file.
    return (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

export async function upgradeImages<T extends { imageUrl: string | null }>(
  recipes: T[],
  cachePath: string,
  concurrency = 6,
): Promise<{ upgraded: number; checked: number }> {
  const cache = loadCache(cachePath);

  const todo = [
    ...new Set(
      recipes
        .map((r) => r.imageUrl)
        .filter((u): u is string => Boolean(u) && !(u! in cache))
        .filter((u) => originalImageCandidate(u) !== null),
    ),
  ];

  let checked = 0;
  // A small fixed pool rather than Promise.all over all 300: these are other
  // people's servers.
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let u = queue.shift(); u !== undefined; u = queue.shift()) {
        const candidate = originalImageCandidate(u)!;
        cache[u] = (await exists(candidate)) ? candidate : null;
        checked++;
      }
    }),
  );

  if (todo.length) {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  }

  let upgraded = 0;
  for (const r of recipes) {
    if (!r.imageUrl) continue;
    const better = cache[r.imageUrl];
    if (better) {
      r.imageUrl = better;
      upgraded++;
    }
  }
  return { upgraded, checked };
}
