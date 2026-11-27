import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyDish, categoryOf, titleKeywordsFor, titleIsExcluded, wrongShapeFor, usesAPreparedMix,
  DISHES,
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
  assert.equal(titleIsExcluded("Chewy Chocolate Chip Cookie Bars", "cookie"), "bars");
  assert.equal(titleIsExcluded("Gluten-Free Chocolate Chip Cookies", "cookie"), "gluten free");
  assert.equal(titleIsExcluded("Vegan Chocolate Chip Cookies", "cookie"), "vegan");
});

test("the exclusion list stops at word boundaries at both ends", () => {
  // "tart" must not fire on "cream of tartar" -- a snickerdoodle recipe that
  // advertises leaving it out is a real title, and it is not a tart.
  assert.equal(titleIsExcluded("Snickerdoodles Without Cream of Tartar", "cookie"), null);
  // "pie" must not fire on "pieces".
  assert.equal(titleIsExcluded("Chocolate Chip Cookies with Toffee Pieces", "cookie"), null);
  // but the plural still counts
  assert.equal(titleIsExcluded("Pumpkin Pies", "cookie"), "pie");
  assert.equal(titleIsExcluded("Lemon Bar", "cookie"), "bars");
});

test("and does not fire on words that merely start the same", () => {
  // "brown butter" is not a brownie, and these are the real titles in the
  // corpus -- a greedy substring match drops them.
  assert.equal(titleIsExcluded("Joy's Brown Butter Chocolate Chip Cookies with Pecans", "cookie"), null);
  assert.equal(titleIsExcluded("Crunchy Whole Grain Chocolate Chip Cookies", "cookie"), null);
  assert.equal(titleIsExcluded("Supersized, Super-Soft Chocolate Chip Cookies", "cookie"), null);
  assert.equal(titleIsExcluded("Best Chocolate Chip Cookies", "cookie"), null);
});

test("the instructions get a vote on whether it is a drop cookie", () => {
  // "Valentine Sugar Cookies" and "Easter Sugar Cookies" say nothing about
  // shaping in their titles, and both turned out to be rolled, cut and iced
  // -- a stiffer, drier dough answering a different question.
  assert.equal(
    wrongShapeFor("cookie", "Chill the dough, then roll out on a floured surface and cut into shapes."),
    "roll out",
  );
  assert.equal(wrongShapeFor("cookie", "Cut out the cookies with a cookie cutter."), "cookie cutter");
  assert.ok(wrongShapeFor("cookie", "Press into a 9x13 pan and bake."));
});

test("rolling dough into balls is still a drop cookie", () => {
  // The distinction the filter has to get right: this is the normal way to
  // portion a chocolate chip cookie and must not be read as rolling it out.
  assert.equal(
    wrongShapeFor("cookie", "Roll the dough into balls and place on the baking sheet."),
    null,
  );
  assert.equal(
    wrongShapeFor("cookie", "Drop by rounded tablespoonfuls onto ungreased baking sheets."),
    null,
  );
  assert.equal(
    wrongShapeFor("cookie", "Scoop the dough into 2-tablespoon balls, roll in cinnamon sugar."),
    null,
  );
});

test("a lined baking sheet is not a lined pan", () => {
  // A half sheet is 13x18. An earlier version of this rule matched any
  // "line a 13 x ..." and threw out the corpus's own Tate's copycat.
  assert.equal(wrongShapeFor("cookie", "Line a 13 x 18 inch baking sheet with parchment."), null);
  assert.ok(wrongShapeFor("cookie", "Line a 9 x 13 inch pan with parchment paper."));
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

// --- form vs flavour -------------------------------------------------------

test("a form decides the dish however many flavours came with it", () => {
  // These were dropped as ambiguous before forms and flavours were told
  // apart. Only four URLs in the current sweeps are affected -- the rule
  // matters for being right rather than for the count, and the count will
  // grow as sites are added.
  assert.equal(classifyDish("chocolate chip muffins"), "muffin");
  assert.equal(classifyDish("banana chocolate chip muffins"), "muffin");
  assert.equal(classifyDish("peanut butter brownies"), "brownie");
  assert.equal(classifyDish("chocolate chip scones"), "scone");
  assert.equal(classifyDish("chocolate chip banana bread"), "banana bread");
});

test("a loaf with chips in it is not a cookie", () => {
  // The misfiling that mattered: the flavour matched, the form did not exist,
  // so a quick bread was scored against the chocolate chip cookie window.
  assert.equal(classifyDish("chocolate chip pumpkin bread"), "pumpkin bread");
  assert.equal(categoryOf("pumpkin bread"), "quick bread");
  assert.equal(categoryOf("zucchini bread"), "quick bread");
});

test("the quick breads the sweeps look for all have a dish", () => {
  for (const t of ["banana bread", "pumpkin bread", "zucchini bread"]) {
    assert.equal(classifyDish(t), t, `${t} should classify as itself`);
  }
});

test("two forms is still ambiguous, and so are two flavours", () => {
  assert.equal(classifyDish("banana bread muffins"), null);
  assert.equal(classifyDish("oatmeal chocolate chip cookies"), null);
  assert.equal(classifyDish("peanut butter chocolate chip cookies"), null);
});

// --- the database has to agree about which dishes exist --------------------

test("the dish_type check constraint lists exactly the DishType union", () => {
  // The bug this catches, having happened once: dish_type was constrained to
  // the five cookie flavours, so every brownie, muffin, bread and scone was
  // rejected on insert -- most of the corpus, failing with a constraint error
  // rather than anything that reads as a data problem. The constraint is
  // worth keeping; it only has to stay in step with the code.
  const dir = dirname(fileURLToPath(import.meta.url));
  const migrations = join(dir, "..", "..", "..", "supabase", "migrations");
  const latest = readdirSync(migrations)
    .filter((f) => f.endsWith(".sql") && readFileSync(join(migrations, f), "utf8")
      .includes("recipes_dish_type_check"))
    .sort()
    .pop();
  assert.ok(latest, "no migration defines recipes_dish_type_check");

  const sql = readFileSync(join(migrations, latest), "utf8");
  const body = /check \(dish_type in \(([\s\S]*?)\)\)/.exec(sql)?.[1];
  assert.ok(body, "could not read the constraint's dish list");

  const inSql = new Set([...body.matchAll(/'([^']+)'/g)].map((m) => m[1]!));
  const inCode = new Set(DISHES.map((d) => d.type));

  assert.deepEqual(
    [...inSql].sort(),
    [...inCode].sort(),
    "the migration and DISHES disagree about which dish types exist",
  );
});

test("a form is not made to call itself by its category's name", () => {
  // A blondie's category is brownie, so appending the category noun demanded
  // that a page titled "Blondies" also say "brownie". 87 of 104 blondies were
  // dropped for it. Every other form's category noun was its own name, which
  // is why nothing else showed the bug.
  assert.deepEqual(titleKeywordsFor("blondie"), ["blondie"]);
  assert.ok(!titleKeywordsFor("blondie").includes("brownie"));
});

test("a flavour still has to say what form it is", () => {
  // The guard that must not be lost: "Chocolate Chip" alone could be a cake.
  assert.ok(titleKeywordsFor("chocolate chip").includes("cookie"));
  assert.ok(titleKeywordsFor("oatmeal").includes("cookie"));
  assert.ok(titleKeywordsFor("sugar").includes("cookie"));
});
