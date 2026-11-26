/**
 * Embed the concepts once, at build time, so the browser never has to.
 *
 *   node apps/web/scripts/build-concepts.mjs
 *
 * The output is a small JSON of vectors committed to the repo. The model is
 * only needed to produce it, not to use it: at search time the browser embeds
 * the handful of words someone typed and compares them against these.
 *
 * Several phrasings per concept rather than one. A single phrase makes the
 * match hostage to its exact wording; taking the best similarity across a few
 * gives each concept a small region of meaning rather than a point.
 */

import { pipeline } from "@huggingface/transformers";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Each concept maps to something the interpreter already produces: a texture, a
 * preference, or a dish. Nothing new is invented here, so an embedding match
 * lands in the same shape a keyword match does and the rest of the app cannot
 * tell which tier answered.
 */
const CONCEPTS = [
  { kind: "texture", key: "chewy", phrases: [
    "a chewy cookie, dense and bendy, holds its moisture",
    "soft and gooey in the middle, fudgy, slightly underbaked",
    "stodgy, squidgy, rich and heavy",
  ]},
  { kind: "texture", key: "cakey", phrases: [
    "a cakey cookie, light and risen, like a sponge",
    "fluffy and airy, puffed up tall and soft",
    "tender and crumbly, delicate",
  ]},
  { kind: "texture", key: "crispy", phrases: [
    "a crisp cookie that snaps, breaks clean",
    "thin and brittle, crunchy all the way through",
    "flat and lacy, shatters",
  ]},
  { kind: "pref", key: "quick", phrases: [
    "quick to make, no waiting around, no chilling the dough",
    "I am in a hurry and want these soon",
  ]},
  { kind: "pref", key: "easy", phrases: [
    "easy and simple, few ingredients, no mixer needed",
    "beginner friendly, hard to get wrong, one bowl",
  ]},
  { kind: "pref", key: "popular", phrases: [
    "popular and well reviewed, a crowd favourite, highly rated",
  ]},
  { kind: "dish", key: "chocolate chip", phrases: ["chocolate chip cookies"] },
  { kind: "dish", key: "oatmeal", phrases: ["oatmeal cookies, made with rolled oats"] },
  { kind: "dish", key: "peanut butter", phrases: ["peanut butter cookies"] },
  { kind: "dish", key: "sugar", phrases: ["plain sugar cookies, vanilla, no add-ins"] },
  { kind: "dish", key: "snickerdoodle", phrases: ["snickerdoodles, rolled in cinnamon sugar"] },
];

const MODEL = "Xenova/all-MiniLM-L6-v2";

console.log(`loading ${MODEL} (one-time, ~22 MB)...`);
const embed = await pipeline("feature-extraction", MODEL, { dtype: "q8" });

const out = [];
for (const c of CONCEPTS) {
  for (const phrase of c.phrases) {
    const t = await embed(phrase, { pooling: "mean", normalize: true });
    // Rounded to 4 places. The file is 60% smaller and cosine similarity moves
    // in the fourth decimal, which is far below any threshold worth setting.
    out.push({
      kind: c.kind,
      key: c.key,
      phrase,
      vector: Array.from(t.data).map((n) => Math.round(n * 1e4) / 1e4),
    });
  }
}

const dims = out[0].vector.length;
const path = join(HERE, "..", "src", "lib", "concepts.json");
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify({ model: MODEL, dims, concepts: out }));
console.log(`wrote ${out.length} vectors of ${dims} dims to ${path}`);
