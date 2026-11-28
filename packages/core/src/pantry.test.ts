import { test } from "node:test";
import assert from "node:assert/strict";
import { pantryFit } from "./pantry.ts";
import { parseIngredient } from "./units.ts";

const lines = (...raw: string[]) => raw.map((r) => parseIngredient(r));

test("counts what you have and names what you do not", () => {
  const fit = pantryFit(["flour", "butter", "sugar"], lines(
    "2 cups all-purpose flour",
    "1 cup unsalted butter, softened",
    "3/4 cup granulated sugar",
    "1 cup buttermilk",
  ));
  assert.equal(fit.required, 4);
  assert.equal(fit.have, 3);
  assert.deepEqual(fit.missing, ["buttermilk"]);
});

test("butter does not cover buttermilk", () => {
  // The trap a substring match falls into, and the reason for word boundaries.
  const fit = pantryFit(["butter"], lines("1 cup buttermilk"));
  assert.equal(fit.have, 0);
  assert.deepEqual(fit.missing, ["buttermilk"]);
});

test("cream does not cover cream of tartar", () => {
  // Word boundaries are not enough here -- "cream of tartar" contains the word
  // cream. The canonical name is what settles it.
  const fit = pantryFit(["cream"], lines("1/2 teaspoon cream of tartar"));
  assert.equal(fit.have, 0);
  assert.deepEqual(fit.missing, ["cream of tartar"]);
});

test("a named ingredient has to be named", () => {
  // The flip side of the cream-of-tartar rule. No rule over the string can
  // tell that chips are chocolate while tartar is not cream, so where the
  // parser has named a line the pantry has to say that name.
  assert.equal(pantryFit(["chocolate chips"], lines("2 cups semisweet chocolate chips")).have, 1);
  assert.equal(pantryFit(["chocolate"], lines("2 cups semisweet chocolate chips")).have, 0);
  // And the shortfall says what to write down.
  assert.deepEqual(
    pantryFit(["chocolate"], lines("2 cups semisweet chocolate chips")).missing,
    ["chocolate chips"],
  );
});

test("matches things the parser does not recognise", () => {
  // 11% of lines have no canonical name, and that is where the interesting
  // ingredients are. Raw text is the fallback.
  const fit = pantryFit(["tahini", "banana"], lines(
    "1/2 cup tahini",
    "3 ripe bananas, mashed",
  ));
  assert.equal(fit.have, 2);
  assert.deepEqual(fit.missing, []);
});

test("water and salt are assumed, not shopped for", () => {
  const fit = pantryFit([], lines("1/4 cup water", "1 teaspoon salt"));
  assert.equal(fit.required, 2);
  assert.equal(fit.have, 2);
  assert.deepEqual(fit.missing, []);
});

test("an optional topping is not a requirement", () => {
  const fit = pantryFit(["flour"], lines(
    "2 cups flour",
    "flaky sea salt, for sprinkling; optional",
    "coarse sugar (optional for topping)",
  ));
  assert.equal(fit.required, 1);
  assert.equal(fit.have, 1);
  assert.deepEqual(fit.missing, []);
});

test("the shopping list reads like a list, not like a recipe line", () => {
  const fit = pantryFit([], lines("1 1/2 cups (190 g) all-purpose flour, sifted"));
  assert.deepEqual(fit.missing, ["flour"]);
  const odd = pantryFit([], lines("2 tablespoons toasted sesame seeds, for the top"));
  // "for the top" is a garnish, so nothing is required at all.
  assert.equal(odd.required, 0);
});

test("the same missing thing is listed once", () => {
  const fit = pantryFit([], lines("1 cup buttermilk", "2 tbsp buttermilk"));
  assert.deepEqual(fit.missing, ["buttermilk"]);
});
