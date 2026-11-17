import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDish, titleKeywordsFor, titleIsExcluded } from "./dish.ts";

test("names the dish a url is about", () => {
  assert.equal(classifyDish("https://x.com/classic-chocolate-chip-cookies-recipe"), "chocolate chip");
  assert.equal(classifyDish("https://x.com/best-oatmeal-cookies/"), "oatmeal");
  assert.equal(classifyDish("https://x.com/peanut-butter-cookies/"), "peanut butter");
  assert.equal(classifyDish("https://x.com/soft-sugar-cookies/"), "sugar");
  assert.equal(classifyDish("https://x.com/snickerdoodle-cookies/"), "snickerdoodle");
});

test("a url naming two dishes at once names neither", () => {
  // A real and popular cookie, and a bad member of either set: scored against
  // the chocolate chip recipes, the oats read as flour that is not there.
  assert.equal(classifyDish("https://x.com/oatmeal-chocolate-chip-cookies-recipe"), null);
  assert.equal(classifyDish("https://x.com/peanut-butter-chocolate-chip-cookies"), null);
});

test("a url naming no dish is not guessed at", () => {
  assert.equal(classifyDish("https://x.com/black-and-white-cookies-recipe"), null);
  assert.equal(classifyDish("https://x.com/recipes/almond-thumbprint-cookies"), null);
});

test("chocolate chip wins over sugar, which every cookie contains", () => {
  // Ordering, not luck: "sugar" only counts as a dish when it is "sugar cookie".
  assert.equal(classifyDish("https://x.com/brown-sugar-chocolate-chip-cookies"), "chocolate chip");
});

test("every dish must still say cookie in its own title", () => {
  assert.deepEqual(titleKeywordsFor("chocolate chip"), ["chocolate", "chip", "cookie"]);
  assert.deepEqual(titleKeywordsFor("snickerdoodle"), ["snickerdoodle", "cookie"]);
});

test("a title can disqualify a page the url made look fine", () => {
  assert.equal(titleIsExcluded("Chewy Chocolate Chip Cookie Bars"), "bars");
  assert.equal(titleIsExcluded("Gluten-Free Chocolate Chip Cookies"), "gluten free");
  assert.equal(titleIsExcluded("Vegan Chocolate Chip Cookies"), "vegan");
});

test("and does not fire on words that merely start the same", () => {
  // "brown butter" is not a brownie, and these are the real titles in the
  // corpus -- a greedy substring match drops them.
  assert.equal(titleIsExcluded("Joy's Brown Butter Chocolate Chip Cookies with Pecans"), null);
  assert.equal(titleIsExcluded("Crunchy Whole Grain Chocolate Chip Cookies"), null);
  assert.equal(titleIsExcluded("Supersized, Super-Soft Chocolate Chip Cookies"), null);
  assert.equal(titleIsExcluded("Best Chocolate Chip Cookies"), null);
});
