import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyDish, titleKeywordsFor, titleIsExcluded, notADropCookie, usesAPreparedMix,
} from "./dish.ts";

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

test("the exclusion list stops at word boundaries at both ends", () => {
  // "tart" must not fire on "cream of tartar" -- a snickerdoodle recipe that
  // advertises leaving it out is a real title, and it is not a tart.
  assert.equal(titleIsExcluded("Snickerdoodles Without Cream of Tartar"), null);
  // "pie" must not fire on "pieces".
  assert.equal(titleIsExcluded("Chocolate Chip Cookies with Toffee Pieces"), null);
  // but the plural still counts
  assert.equal(titleIsExcluded("Pumpkin Pies"), "pie");
  assert.equal(titleIsExcluded("Lemon Bar"), "bars");
});

test("and does not fire on words that merely start the same", () => {
  // "brown butter" is not a brownie, and these are the real titles in the
  // corpus -- a greedy substring match drops them.
  assert.equal(titleIsExcluded("Joy's Brown Butter Chocolate Chip Cookies with Pecans"), null);
  assert.equal(titleIsExcluded("Crunchy Whole Grain Chocolate Chip Cookies"), null);
  assert.equal(titleIsExcluded("Supersized, Super-Soft Chocolate Chip Cookies"), null);
  assert.equal(titleIsExcluded("Best Chocolate Chip Cookies"), null);
});

test("the instructions get a vote on whether it is a drop cookie", () => {
  // "Valentine Sugar Cookies" and "Easter Sugar Cookies" say nothing about
  // shaping in their titles, and both turned out to be rolled, cut and iced
  // -- a stiffer, drier dough answering a different question.
  assert.equal(
    notADropCookie("Chill the dough, then roll out on a floured surface and cut into shapes."),
    "roll out",
  );
  assert.equal(notADropCookie("Cut out the cookies with a cookie cutter."), "cookie cutter");
  assert.ok(notADropCookie("Press into a 9x13 pan and bake."));
});

test("rolling dough into balls is still a drop cookie", () => {
  // The distinction the filter has to get right: this is the normal way to
  // portion a chocolate chip cookie and must not be read as rolling it out.
  assert.equal(
    notADropCookie("Roll the dough into balls and place on the baking sheet."),
    null,
  );
  assert.equal(
    notADropCookie("Drop by rounded tablespoonfuls onto ungreased baking sheets."),
    null,
  );
  assert.equal(
    notADropCookie("Scoop the dough into 2-tablespoon balls, roll in cinnamon sugar."),
    null,
  );
});

test("a lined baking sheet is not a lined pan", () => {
  // A half sheet is 13x18. An earlier version of this rule matched any
  // "line a 13 x ..." and threw out the corpus's own Tate's copycat.
  assert.equal(notADropCookie("Line a 13 x 18 inch baking sheet with parchment."), null);
  assert.ok(notADropCookie("Line a 9 x 13 inch pan with parchment paper."));
});

test("a recipe built on a pouch of mix states no ratio", () => {
  // The flour, butter and sugar are inside the pouch, so the two tablespoons
  // of butter stirred in look like the entire fat content.
  assert.ok(usesAPreparedMix(["1 pouch Betty Crocker sugar cookie mix", "1 egg"]));
  assert.ok(usesAPreparedMix(["1 roll refrigerated chocolate chip cookie dough"]));
  assert.ok(usesAPreparedMix(["Butter and egg called for on cookie mix pouch"]));
});

test("but flour and butter are not a prepared mix", () => {
  assert.equal(
    usesAPreparedMix(["2 cups all-purpose flour", "1 cup butter, softened", "2 large eggs"]),
    null,
  );
});
