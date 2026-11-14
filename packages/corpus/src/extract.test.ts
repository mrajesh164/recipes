import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractRecipe, instructionsToText, bakeTempF, bakeMinutes,
  chillsDough, detectMethod, titleMatches, findRecipeNodes,
} from "./extract.ts";
import { parseIngredient } from "@recipes/core";

/**
 * The fixture deliberately stacks every awkward shape the spike turned up
 * onto one page: a malformed block before the real one, the Recipe buried in
 * @graph, "@type" as an array, instructions as HowToSection wrapping
 * HowToStep, King Arthur's broken recipeYield array, numbers as strings, and
 * a unicode fraction in an ingredient line.
 *
 * A real page has one or two of these. If extraction survives all of them at
 * once it will survive the corpus.
 */
const NASTY = `
<!doctype html><html><head>
<script type="application/ld+json">{ this is not json at all }</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "name": "Not The Recipe" },
    {
      "@type": ["Recipe", "NewsArticle"],
      "name": "Chewy Chocolate Chip Cookies",
      "publisher": { "@type": "Organization", "name": "Test Kitchen" },
      "recipeYield": ["36", "36 cookies)"],
      "aggregateRating": { "ratingValue": "4.5", "ratingCount": "560" },
      "recipeIngredient": [
        "2/3 cup (142g) light brown sugar, packed",
        "¾ cup unsalted butter (1½ sticks, melted and cooled slightly)",
        "2 cups all-purpose flour",
        "1 teaspoon baking soda",
        "2 large eggs"
      ],
      "recipeInstructions": [
        { "@type": "HowToSection", "name": "Prep", "itemListElement": [
          { "@type": "HowToStep", "text": "Chill the dough for 1 hour." }
        ]},
        { "@type": "HowToStep", "text": "Bake at 350°F for 10 to 12 minutes." }
      ]
    }
  ]
}
</script>
</head><body></body></html>`;

test("finds the Recipe past a malformed block and inside @graph", () => {
  const r = extractRecipe(NASTY, "https://example.com/cookies");
  assert.ok(r, "should have found a recipe");
  assert.equal(r.title, "Chewy Chocolate Chip Cookies");
});

test("@type as an array still counts as a Recipe", () => {
  const nodes = findRecipeNodes(JSON.parse(`{"@type":["Recipe","NewsArticle"],"name":"x"}`));
  assert.equal(nodes.length, 1);
});

test("reads publisher as the source name", () => {
  const r = extractRecipe(NASTY, "https://example.com/cookies")!;
  assert.equal(r.sourceName, "Test Kitchen");
});

test("falls back to the hostname when there is no publisher", () => {
  const html = `<script type="application/ld+json">
    {"@type":"Recipe","name":"Plain","recipeIngredient":["1 cup flour"]}</script>`;
  const r = extractRecipe(html, "https://www.someblog.com/a/b")!;
  assert.equal(r.sourceName, "someblog.com");
});

test("survives King Arthur's broken recipeYield array", () => {
  // ["36", "36 cookies)"] -- note the stray bracket. Take the first number.
  const r = extractRecipe(NASTY, "https://example.com/cookies")!;
  assert.equal(r.yieldCount, 36);
});

test("numbers arriving as strings are coerced", () => {
  const r = extractRecipe(NASTY, "https://example.com/cookies")!;
  assert.equal(r.rating, 4.5);
  assert.equal(r.ratingCount, 560);
});

test("flattens HowToSection wrapping HowToStep", () => {
  const r = extractRecipe(NASTY, "https://example.com/cookies")!;
  assert.match(r.instructionsText, /Chill the dough/);
  assert.match(r.instructionsText, /Bake at 350/);
});

test("instructions as a bare string also work", () => {
  assert.equal(instructionsToText("Mix it."), "Mix it.");
});

test("instructions as an array of strings also work", () => {
  assert.equal(instructionsToText(["Mix.", "Bake."]), "Mix. Bake.");
});

test("strips html out of instruction text", () => {
  assert.equal(instructionsToText([{ text: "<p>Mix <b>well</b>.</p>" }]), "Mix well .");
});

test("ingredients are normalized through core", () => {
  const r = extractRecipe(NASTY, "https://example.com/cookies")!;
  const butter = r.ingredients.find((i) => i.canonicalName === "butter")!;
  assert.equal(butter.grams, 170.3);          // not 1, from "(1½ sticks…)"
  const sugar = r.ingredients.find((i) => i.canonicalName === "brown sugar")!;
  assert.equal(sugar.grams, 142);
  assert.equal(sugar.gramsSource, "stated");
});

// ------------------------------------------------------------- derived ----

test("reads the bake temperature", () => {
  assert.equal(bakeTempF("Bake at 350°F for 10 minutes."), 350);
  assert.equal(bakeTempF("Preheat to 375 degrees F."), 375);
  assert.equal(bakeTempF("No temperature here."), null);
});

test("takes the upper bound of a bake time range", () => {
  // "10 to 12 minutes" means you are at the oven at 12.
  assert.equal(bakeMinutes("Bake 10 to 12 minutes."), 12);
  assert.equal(bakeMinutes("Bake 11 minutes."), 11);
});

test("detects chilling", () => {
  assert.equal(chillsDough("Chill the dough for 1 hour."), true);
  assert.equal(chillsDough("Refrigerate overnight."), true);
  assert.equal(chillsDough("Let rest for 2 hours."), true);
  assert.equal(chillsDough("Drop onto the sheet and bake."), false);
});

test("the ingredient line decides the method when it can", () => {
  const ings = [parseIngredient("1 cup butter, melted")];
  // Instructions say creamed; the ingredient line is unambiguous and wins.
  assert.equal(detectMethod(ings, "Cream the butter and sugar."), "melted");
});

test("falls back to the instructions when ingredients are silent", () => {
  const ings = [parseIngredient("1 cup butter")];
  assert.equal(detectMethod(ings, "Cream the butter and sugar together."), "creamed");
  assert.equal(detectMethod(ings, "Melt the butter in a saucepan."), "melted");
});

test("refuses to guess a method it cannot see", () => {
  const ings = [parseIngredient("1 cup butter")];
  assert.equal(detectMethod(ings, "Combine everything in a bowl."), "other");
});

// ------------------------------------------------------- sanity on seed ----

test("catches a page that served the wrong recipe", () => {
  // A Food.com chocolate chip cookie URL returned "Apricot Banana Bread"
  // during the spike. Seeding without this check means the corpus quietly
  // contains banana bread.
  assert.equal(titleMatches("Apricot Banana Bread", ["chocolate", "chip"]), false);
  assert.equal(titleMatches("Best Chocolate Chip Cookies", ["chocolate", "chip"]), true);
});

test("finds ld+json when the type attribute is unquoted", () => {
  // Yoast, which is on a large share of food blogs, emits
  //   <script type=application/ld+json class=yoast-schema-graph>
  // A regex insisting on type="..." skips those pages and reports the site
  // as having no structured data, which is how this was first missed.
  const html = `<script type=application/ld+json class=yoast-schema-graph>
    {"@type":"Recipe","name":"Unquoted Chocolate Chip","recipeIngredient":["1 cup flour"]}
    </script>`;
  const r = extractRecipe(html, "https://example.com/x");
  assert.ok(r, "should find a Recipe despite the unquoted attribute");
  assert.equal(r.title, "Unquoted Chocolate Chip");
});

test("creaming described by its result still counts", () => {
  // King Arthur: "...beating until smooth and creamy". No "cream the butter",
  // and \bbeat\b does not match "beating".
  const ings = [parseIngredient("1 cup butter")];
  const ka = "In a large bowl, combine the sugars, butter, shortening, salt, " +
    "vanilla and almond extracts, vinegar, and baking soda, beating until smooth and creamy.";
  assert.equal(detectMethod(ings, ka), "creamed");
});

test("returns null when there is no structured data at all", () => {
  // Smitten Kitchen's 2009 post, for instance: 200 OK, no markup.
  assert.equal(extractRecipe("<html><body>Just prose.</body></html>", "https://x.com"), null);
});
