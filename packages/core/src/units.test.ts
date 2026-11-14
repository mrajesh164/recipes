import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredient, normalizeFractions, methodHint } from "./units.ts";

/**
 * Most of these are real strings pulled off real recipe pages during the
 * 14 Nov spike, not invented examples. The ones that matter most are the
 * cases where a wrong answer would look reasonable.
 */

// ------------------------------------------------- the source stated grams --

test("trusts a gram weight the source already gave", () => {
  const r = parseIngredient("2/3 cup (142g) light brown sugar, packed");
  assert.equal(r.grams, 142);
  assert.equal(r.gramsSource, "stated");
  assert.equal(r.canonicalName, "brown sugar");
  assert.equal(r.note, "packed");
  assert.equal(r.confidence, "high");
});

test("reads grams with a space before the unit", () => {
  const r = parseIngredient("2 large (100 g) eggs");
  assert.equal(r.grams, 100);
  assert.equal(r.gramsSource, "stated");
  assert.equal(r.canonicalName, "egg");
});

test("stated grams win over anything we would compute", () => {
  // 8 tbsp of butter converts to 113.5; the source says 113. Prefer the source.
  const r = parseIngredient("8 tablespoons (113g) unsalted butter");
  assert.equal(r.grams, 113);
  assert.equal(r.gramsSource, "stated");
});

// ------------------------------------------------------ the dangerous case --

test("a parenthetical restating volume is NOT read as grams", () => {
  // The failure this guards against: matching the "1" in "(1½ sticks…)" and
  // recording butter as 1 gram. Nothing downstream would notice.
  const r = parseIngredient("¾ cup unsalted butter (1½ sticks, melted and cooled slightly)");
  assert.equal(r.gramsSource, "converted");
  assert.equal(r.grams, 170.3); // 0.75 cup x 227
  assert.equal(r.canonicalName, "butter");
  assert.equal(r.note, "melted and cooled");
});

test("'unsalted' is not salt", () => {
  const r = parseIngredient("¾ cup unsalted butter");
  assert.equal(r.canonicalName, "butter");
});

test("peanut butter is not butter", () => {
  // \bbutter\b matches inside "peanut butter", so rule order decides this.
  // Getting it wrong is a 227-vs-270 silent error.
  const r = parseIngredient("1/2 cup peanut butter");
  assert.equal(r.canonicalName, "peanut butter");
  assert.equal(r.grams, 135); // 0.5 x 270
});

test("buttermilk is not butter", () => {
  const r = parseIngredient("1 cup buttermilk");
  assert.equal(r.canonicalName, "buttermilk");
  assert.equal(r.grams, 227);
});

test("brown sugar beats sugar", () => {
  const r = parseIngredient("1 cup packed light brown sugar");
  assert.equal(r.canonicalName, "brown sugar");
  assert.equal(r.grams, 213);
});

// -------------------------------------------------------- unicode and mess --

test("unicode fractions become ascii", () => {
  assert.equal(normalizeFractions("¾ cup"), "3/4 cup");
  assert.equal(normalizeFractions("1½ sticks"), "1 1/2 sticks");
  assert.equal(normalizeFractions("⅓ cup"), "1/3 cup");
});

test("survives irregular whitespace", () => {
  const r = parseIngredient("1/3  cup    butter, softened");
  assert.equal(r.grams, 75.7); // 1/3 x 227
  assert.equal(r.note, "softened");
});

test("handles a mixed number", () => {
  const r = parseIngredient("1 1/2 cups bread flour");
  assert.equal(r.grams, 180); // 1.5 x 120
  assert.equal(r.canonicalName, "bread flour");
});

test("ignores a trailing parenthetical that is not a weight", () => {
  const r = parseIngredient("2 cups all-purpose flour (spooned and leveled)");
  assert.equal(r.grams, 240);
  assert.equal(r.canonicalName, "flour");
});

// ------------------------------------------------------------ unit variety --

test("teaspoon-scale items use their own density", () => {
  const r = parseIngredient("1 teaspoon baking soda");
  assert.equal(r.grams, 6);
});

test("a stick is butter-specific", () => {
  const r = parseIngredient("1 stick butter");
  assert.equal(r.grams, 113.4);
  assert.equal(r.displayUnit, "stick");
});

test("weight units need no density", () => {
  const r = parseIngredient("4 oz unsalted butter");
  assert.equal(r.grams, 113.4);
  assert.equal(r.gramsSource, "stated");
});

test("counted items are counted", () => {
  const r = parseIngredient("2 large eggs");
  assert.equal(r.grams, 100);
  assert.equal(r.gramsSource, "converted");
  assert.equal(r.confidence, "medium"); // egg sizes vary
});

// --------------------------------------------------- admitting to not knowing --

test("kosher salt is flagged, because the brands differ", () => {
  const r = parseIngredient("1/2 teaspoon kosher salt");
  assert.equal(r.confidence, "medium");
});

test("an unknown ingredient yields null grams, never zero", () => {
  // The whole point: null excludes it from a comparison. Zero would quietly
  // drag an average down and look like a real measurement.
  const r = parseIngredient("2 cups chopped rhubarb");
  assert.equal(r.grams, null);
  assert.equal(r.canonicalName, null);
  assert.equal(r.confidence, "low");
});

test("a line with no quantity at all does not invent one", () => {
  const r = parseIngredient("flaky sea salt, for sprinkling");
  assert.equal(r.grams, null);
  assert.equal(r.displayQty, null);
});

// ------------------------------------------------------------ method hints --

test("melted butter implies the melted method", () => {
  assert.equal(methodHint(parseIngredient("1/2 cup butter, melted")), "melted");
});

test("softened butter implies creaming", () => {
  assert.equal(methodHint(parseIngredient("1 cup butter, softened")), "creamed");
});

test("method hints only come from butter", () => {
  assert.equal(methodHint(parseIngredient("1 cup milk, cold")), null);
});
