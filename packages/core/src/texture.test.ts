import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredient } from "./units.ts";
import { scoreTexture, rankFor, type TextureInput } from "./texture.ts";

const ings = (lines: string[]) => lines.map(parseIngredient);

/** The two real recipes currently in the corpus, as their ingredient lines. */
const LOVE_AND_LEMONS = [
  "2 cups all-purpose flour (spooned and leveled)",
  "1 teaspoon baking soda",
  "1 teaspoon sea salt",
  "¾ cup unsalted butter (1½ sticks, melted and cooled slightly)",
  "½ cup packed brown sugar",
  "½ cup granulated sugar",
  "1 large egg",
  "1 large egg yolk",
  "2 teaspoons vanilla extract",
  "1 heaping cup dark chocolate chips",
];

test("a melted-butter, extra-yolk recipe scores chewier than cakey", () => {
  const s = scoreTexture({
    ingredients: ings(LOVE_AND_LEMONS),
    method: "melted",
    chillsDough: true,
  });
  assert.ok(s.chewy > s.cakey, `chewy ${s.chewy} should beat cakey ${s.cakey}`);
  assert.equal(s.confidence, "high");
});

test("creaming pushes the same ratios toward cakey", () => {
  const base: TextureInput = {
    ingredients: ings(LOVE_AND_LEMONS),
    chillsDough: false,
    method: "melted",
  };
  const melted = scoreTexture(base);
  const creamed = scoreTexture({ ...base, method: "creamed" });

  assert.ok(melted.chewy > creamed.chewy, "melted should be chewier");
  assert.ok(creamed.cakey > melted.cakey, "creamed should be cakier");
});

test("all brown sugar is chewier than all white", () => {
  const common = ["2 cups all-purpose flour", "¾ cup butter, melted", "1 large egg"];
  const allBrown = scoreTexture({
    ingredients: ings([...common, "1 cup packed brown sugar"]),
    method: "melted", chillsDough: false,
  });
  const allWhite = scoreTexture({
    ingredients: ings([...common, "1 cup granulated sugar"]),
    method: "melted", chillsDough: false,
  });
  assert.ok(allBrown.chewy > allWhite.chewy);
  assert.ok(allWhite.crispy > allBrown.crispy);
});

test("more fat relative to flour reads chewier", () => {
  const lean = scoreTexture({
    ingredients: ings(["3 cups all-purpose flour", "½ cup butter", "1 cup brown sugar", "1 large egg"]),
    method: "creamed", chillsDough: false,
  });
  const rich = scoreTexture({
    ingredients: ings(["2 cups all-purpose flour", "1 cup butter", "1 cup brown sugar", "1 large egg"]),
    method: "creamed", chillsDough: false,
  });
  assert.ok(rich.chewy > lean.chewy);
});

// ------------------------------------------------------------- honesty ----

test("signals explain the score, strongest first", () => {
  const s = scoreTexture({
    ingredients: ings(LOVE_AND_LEMONS),
    method: "melted", chillsDough: true,
  });
  assert.ok(s.signals.length >= 3, "should produce several signals");
  // Sorted descending, so the interface can take the top N honestly.
  for (let i = 1; i < s.signals.length; i++) {
    assert.ok(s.signals[i - 1]!.strength >= s.signals[i]!.strength);
  }
  // The melted butter must be among them -- it is the thing a baker would
  // most want to see behind a "chewy" recommendation.
  assert.ok(s.signals.some((x) => x.label === "Melted butter"));
});

test("no flour means no opinion, not a zero score presented as fact", () => {
  const s = scoreTexture({
    ingredients: ings(["1 cup butter", "1 cup sugar"]),
    method: "creamed", chillsDough: false,
  });
  assert.equal(s.confidence, "low");
  assert.equal(s.signals.length, 0);
});

test("a mostly unresolved ingredient list is low confidence", () => {
  // Three of four lines will not resolve to grams.
  const s = scoreTexture({
    ingredients: ings([
      "2 cups all-purpose flour",
      "a handful of rhubarb",
      "some chopped quince",
      "a splash of verjuice",
    ]),
    method: "creamed", chillsDough: false,
  });
  assert.equal(s.confidence, "low");
});

// ------------------------------------------------------------ ranking ----

test("ranking picks the highest score for the wanted texture", () => {
  const items = [
    { id: "cakey", scores: scoreTexture({ ingredients: ings(["2 cups flour", "½ cup butter", "1 cup granulated sugar", "2 large eggs"]), method: "creamed", chillsDough: true }) },
    { id: "chewy", scores: scoreTexture({ ingredients: ings(LOVE_AND_LEMONS), method: "melted", chillsDough: false }) },
  ];
  assert.equal(rankFor(items, "chewy")[0]!.id, "chewy");
  assert.equal(rankFor(items, "cakey")[0]!.id, "cakey");
});

test("confidence beats a narrow score win", () => {
  // The low-confidence recipe has the higher raw chewy score, but that score
  // is computed from a list that barely parsed, so it must not be ranked
  // first. A 0.02 difference there is missing data, not a chewier cookie.
  const high = { id: "high", scores: scoreTexture({ ingredients: ings(LOVE_AND_LEMONS), method: "melted", chillsDough: false }) };
  const low = { id: "low", scores: { ...high.scores, chewy: high.scores.chewy + 0.02, confidence: "low" as const } };
  assert.equal(rankFor([low, high], "chewy")[0]!.id, "high");
});

/* ------------------------------------------------------- fat equivalence */

test("peanut butter counts as half its weight in fat", () => {
  // Commercial peanut butter is around 50% fat; the rest is protein, fibre
  // and sugar. Counted whole, it put a recipe on the signed-out page claiming
  // 263 g of butter per 100 g of flour, on an axis that stops at 230.
  const withPB = scoreTexture({
    ingredients: [
      { raw: "1 cup flour", grams: 120, canonicalName: "flour", quantity: 1, unit: "cup" },
      { raw: "1 cup peanut butter", grams: 270, canonicalName: "peanut butter", quantity: 1, unit: "cup" },
    ],
    method: "creamed",
    chillsDough: false,
  });
  assert.equal(withPB.ratios?.fatPerFlour, 270 * 0.5 / 120);
});

test("baking chips are not fat at all", () => {
  const s = scoreTexture({
    ingredients: [
      { raw: "1 cup flour", grams: 120, canonicalName: "flour", quantity: 1, unit: "cup" },
      { raw: "1/2 cup butter", grams: 113, canonicalName: "butter", quantity: 0.5, unit: "cup" },
      { raw: "1 cup peanut butter chips", grams: 170, canonicalName: "peanut butter chips", quantity: 1, unit: "cup" },
      { raw: "1 cup chocolate chips", grams: 170, canonicalName: "chocolate chips", quantity: 1, unit: "cup" },
    ],
    method: "creamed",
    chillsDough: false,
  });
  // The butter alone. A cookie studded with sweets is not a fattier cookie.
  assert.equal(s.ratios?.fatPerFlour, 113 / 120);
});
