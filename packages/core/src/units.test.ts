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

test("filler words between quantity and unit do not break the parse", () => {
  // Real line from King Arthur. "heaping" sits where the unit parser looks,
  // so without skipping it the chocolate resolves to no weight at all.
  const r = parseIngredient("1 heaping cup dark chocolate chips");
  assert.equal(r.canonicalName, "chocolate chips");
  assert.equal(r.grams, 170);
});

test("a packed cup is still packed, and still a cup", () => {
  const r = parseIngredient("1 firmly packed cup brown sugar");
  assert.equal(r.grams, 213);
  assert.equal(r.note, "packed");
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

// ------------------------------------------- the widened corpus's pantry --

/**
 * These arrived with the oatmeal, peanut butter, sugar and snickerdoodle
 * recipes. Two of them were not missing at all -- they already resolved, to
 * the wrong thing, which is worse.
 */

test("cream of tartar is not cream", () => {
  // It is a powdered acid. Matched as cream it converted at 227g per cup and
  // a teaspoon came back as 4.7g: a plausible number, confidently wrong, and
  // nothing threw. Snickerdoodles are built on it.
  const r = parseIngredient("1 teaspoon cream of tartar");
  assert.equal(r.canonicalName, "cream of tartar");
  assert.equal(r.grams, 3);
});

test("heavy cream is still cream", () => {
  const r = parseIngredient("1 cup heavy cream");
  assert.equal(r.canonicalName, "cream");
  assert.equal(r.grams, 227);
});

test("almond extract is not a nut", () => {
  // Matched by the walnut/pecan/almond rule, a teaspoon of extract was being
  // weighed as 113g-per-cup of almonds.
  const r = parseIngredient("1 teaspoon almond extract");
  assert.equal(r.canonicalName, "almond extract");
  assert.equal(r.grams, 4);
});

test("chopped almonds are still nuts", () => {
  assert.equal(parseIngredient("1 cup chopped almonds").canonicalName, "nuts");
});

test("condensed milk is not milk", () => {
  // Milk with the water boiled off and sugar added. Read as milk it came out
  // a third light.
  const r = parseIngredient("1 cup sweetened condensed milk");
  assert.equal(r.canonicalName, "condensed milk");
  assert.equal(r.grams, 306);
});

test("evaporated milk is not milk either", () => {
  assert.equal(parseIngredient("1 cup evaporated milk").grams, 252);
});

test("whole milk is still milk", () => {
  assert.equal(parseIngredient("1 cup whole milk").grams, 227);
});

test("the spices an oatmeal cookie brings with it", () => {
  assert.equal(parseIngredient("1/2 teaspoon ground nutmeg").grams, 1.1);
  assert.equal(parseIngredient("1/4 teaspoon ground cloves").grams, 0.5);
  assert.equal(parseIngredient("1/2 teaspoon ground ginger").grams, 0.9);
  assert.equal(parseIngredient("1/4 teaspoon allspice").grams, 0.5);
  assert.equal(parseIngredient("1/2 teaspoon cardamom").grams, 1);
  assert.equal(parseIngredient("2 teaspoons pumpkin pie spice").grams, 4.6);
});

test("ground ginger does not swallow gingerbread", () => {
  // \bginger\b, so the word has to end there.
  assert.equal(parseIngredient("2 cups gingerbread crumbs").canonicalName, null);
});

test("corn syrup, coconut and the chips that are not chocolate", () => {
  assert.equal(parseIngredient("1/2 cup light corn syrup").grams, 156);
  assert.equal(parseIngredient("1 cup shredded coconut").grams, 85);
  assert.equal(parseIngredient("1/2 cup butterscotch chips").grams, 85);
  assert.equal(parseIngredient("1 cup toffee bits").grams, 150);
});

test("margarine converts at butter's density", () => {
  // Sold as a butter replacement and packed to the same volume. It is a solid
  // fat creamed the same way, so unlike a vegan butter substitute it does not
  // change the question the ratio is answering.
  const r = parseIngredient("1 cup margarine");
  assert.equal(r.canonicalName, "margarine");
  assert.equal(r.grams, 227);
});

test("a hyphenated mixed number is still a mixed number", () => {
  // Taste of Home's house style. Left alone, the quantity parser reads the
  // leading "1", the unit parser finds "-1/2 cups" and gives up, and a cup
  // and a half of butter resolves to nothing at all. It was the single
  // biggest source of unresolved lines in the corpus.
  assert.equal(parseIngredient("1-1/2 cups butter, softened").grams, 340.5);
  assert.equal(parseIngredient("2-1/2 teaspoons ground cinnamon").grams, 6.5);
});

test("a hyphen that is not a mixed number is left alone", () => {
  // A fraction has to follow it, so ranges and sizes are untouched.
  assert.equal(normalizeFractions("bake 10-12 minutes"), "bake 10-12 minutes");
  assert.equal(normalizeFractions("one 9-inch pan"), "one 9-inch pan");
});

test("a package weight in parentheses needs no density", () => {
  assert.equal(parseIngredient("1 package (8 ounces) cream cheese, softened").grams, 226.8);
  assert.equal(parseIngredient("1 bag (12 ounces) semisweet chocolate chips").grams, 340.2);
});

test('but "each" in the line means the parenthetical is not the total', () => {
  // "4 cans (15-1/4 ounces each)" is four times that. Reading it as the total
  // would be silently light, so it resolves to nothing instead.
  assert.equal(parseIngredient("4 cans (15-1/4 ounces each) sliced peaches, drained").grams, null);
});

test("a parenthetical that restates the volume still must not become grams", () => {
  // The original trap: "(1 1/2 sticks, ...)" is not a weight.
  const r = parseIngredient("3/4 cup unsalted butter (1 1/2 sticks, melted and cooled slightly)");
  assert.equal(r.grams, 170.3);
  assert.equal(r.gramsSource, "converted");
});

test("cream cheese is not cream", () => {
  assert.equal(parseIngredient("1 cup cream cheese").canonicalName, "cream cheese");
});
