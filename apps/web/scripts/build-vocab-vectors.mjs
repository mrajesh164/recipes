/**
 * Embed the interpreter's own vocabulary, once, at build time.
 *
 *   node apps/web/scripts/build-vocab-vectors.mjs
 *
 * The output is a JSON of one vector per known phrase, committed to the repo.
 * At search time the browser embeds only the words it did not recognise and
 * finds the nearest known phrase, so an unknown word inherits the weights that
 * phrase already carries. Nothing new is scored and nothing new is invented:
 * "stodgy" becomes "fudgy", and fudgy already means chewy 0.9.
 *
 * I tried the obvious thing first, which was to write a dozen concept
 * sentences and match against those. It was measurably worse: "bendy" matched
 * crispy at 0.55, which is backwards, because an adjective embedded alone sits
 * closer to whichever sentence shares its surface vocabulary than to the one
 * that shares its meaning. Word against word behaves; word against sentence
 * does not.
 */

import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

// Read the vocabulary from the interpreter rather than restating it. A copy
// here would drift the first time a word is added.
const src = readFileSync(join(ROOT, "packages/core/src/interpret.ts"), "utf8");
const grab = (name) => {
  const block = src.slice(src.indexOf(`const ${name}`));
  return [...block.slice(0, block.indexOf("\n];")).matchAll(/\["([^"]+)",/g)].map((m) => m[1]);
};
const phrases = [
  ...new Set([...grab("TEXTURE_WORDS"), ...grab("PREF_WORDS"), ...grab("DISH_WORDS")]),
];

const MODEL = "Xenova/all-MiniLM-L6-v2";
console.log(`embedding ${phrases.length} vocabulary phrases with ${MODEL}...`);
const embed = await pipeline("feature-extraction", MODEL, { dtype: "q8" });

const vectors = {};
for (const p of phrases) {
  const t = await embed(p, { pooling: "mean", normalize: true });
  // 4 places: the file is far smaller and cosine similarity moves in the
  // fourth decimal, well below any threshold worth setting.
  vectors[p] = Array.from(t.data).map((n) => Math.round(n * 1e4) / 1e4);
}

const path = join(HERE, "..", "src", "lib", "vocab-vectors.json");
writeFileSync(path, JSON.stringify({ model: MODEL, dims: 384, vectors }));
console.log(`wrote ${phrases.length} vectors to ${path}`);
