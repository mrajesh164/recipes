import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpret, dominantTexture, matchScore, candidatesFor, type Rankable, confidentRating, reviewEvidence,
} from "./interpret.ts";

test("reads a plain texture word", () => {
  const i = interpret("chewy");
  assert.equal(i.textures.chewy, 1);
  assert.equal(i.empty, false);
  assert.deepEqual(i.understood, ["chewy"]);
});

test("reads a synonym", () => {
  assert.ok(interpret("gooey").textures.chewy > 0.5);
  assert.ok(interpret("crunchy").textures.crispy === 1);
  assert.ok(interpret("fluffy").textures.cakey > 0.5);
});

test("a longer phrase wins over its parts", () => {
  // "thick and chewy" must not also fire "thick" and "chewy" separately and
  // double-count, and must not leave "thick" behind as unrecognised.
  const i = interpret("thick and chewy");
  assert.deepEqual(i.understood, ["thick and chewy"]);
  assert.deepEqual(i.unrecognised, []);
});

test("crispy edges reads as both", () => {
  const i = interpret("crispy edges with a soft middle");
  assert.ok(i.textures.crispy > 0);
  assert.ok(i.textures.chewy > 0);
});

test("'soft' is split rather than guessed", () => {
  // The most ambiguous word a baker uses: chewy to some, cakey to others.
  // Picking one silently would be inventing an intent.
  const i = interpret("soft");
  assert.equal(i.textures.chewy, i.textures.cakey);
  assert.ok(i.textures.chewy > 0);
});

// ------------------------------------------------------- being honest ----

test("reports words it does not understand", () => {
  const i = interpret("nutty and buttery");
  assert.ok(i.unrecognised.includes("nutty"));
  assert.ok(i.unrecognised.includes("buttery"));
});

test("does not report filler as unrecognised", () => {
  // Otherwise every query reads as half-misunderstood and the warning
  // becomes noise people learn to ignore.
  const i = interpret("I want a really chewy chocolate chip cookie please");
  assert.equal(i.textures.chewy, 1);
  assert.deepEqual(i.unrecognised, []);
});

test("knows when it understood nothing at all", () => {
  const i = interpret("purple elephant");
  assert.equal(i.empty, true);
  assert.equal(dominantTexture(i), null);
});

test("an empty box is empty, not an error", () => {
  const i = interpret("");
  assert.equal(i.empty, true);
  assert.deepEqual(i.unrecognised, []);
});

// -------------------------------------------------------- preferences ----

test("reads preferences the buttons could not express", () => {
  const i = interpret("quick chewy cookies with no mixer");
  assert.equal(i.prefs.quick, true);
  assert.equal(i.prefs.easy, true);
  assert.equal(i.textures.chewy, 1);
});

test("preferences alone are not empty", () => {
  const i = interpret("something quick");
  assert.equal(i.empty, false);
  assert.equal(i.prefs.quick, true);
  assert.equal(dominantTexture(i), null);
});

// ------------------------------------------------------------ ranking ----

const base: Rankable = {
  scores: { chewy: 0.8, cakey: 0.2, crispy: 0.3, confidence: "high" },
  method: "creamed", chills_dough: true, bake_minutes: 12,
  rating: 4.5,
  ratingCount: 50,
  reviews: null,
  dishType: null, ingredientCount: 12,
};

test("texture dominates preferences", () => {
  // "quick chewy" must not return a fast cakey cookie. That answers a
  // question nobody asked.
  const chewySlow = { ...base };
  const cakeyFast: Rankable = {
    ...base,
    scores: { chewy: 0.2, cakey: 0.9, crispy: 0.3, confidence: "high" },
    chills_dough: false, bake_minutes: 9,
  };
  const i = interpret("quick chewy");
  assert.ok(matchScore(chewySlow, i) > matchScore(cakeyFast, i));
});

test("a preference breaks a texture tie", () => {
  const chills = { ...base };
  const doesnt = { ...base, chills_dough: false };
  const i = interpret("quick chewy");
  assert.ok(matchScore(doesnt, i) > matchScore(chills, i));
});

test("no mixer favours melted butter", () => {
  const creamed = { ...base };
  const melted: Rankable = { ...base, method: "melted" };
  const i = interpret("chewy, no mixer");
  assert.ok(matchScore(melted, i) > matchScore(creamed, i));
});

test("low confidence is still penalised", () => {
  const good = { ...base };
  const shaky: Rankable = { ...base, scores: { ...base.scores, confidence: "low" } };
  const i = interpret("chewy");
  assert.ok(matchScore(good, i) > matchScore(shaky, i));
});

/* ------------------------------------------------- dishes, and the words
   around them. Added after "chewy, oat" reported that it did not know what
   "oat" meant and then recommended a peanut butter cookie. ------------- */

test("a dish word narrows, and is not reported as unknown", () => {
  const i = interpret("chewy, oat");
  assert.equal(i.textures.chewy, 1);
  assert.deepEqual(i.dishes, ["oatmeal"]);
  assert.deepEqual(i.unrecognised, []);
});

test("every dish in the corpus can be asked for", () => {
  assert.deepEqual(interpret("oatmeal").dishes, ["oatmeal"]);
  assert.deepEqual(interpret("peanut butter").dishes, ["peanut butter"]);
  assert.deepEqual(interpret("pb").dishes, ["peanut butter"]);
  assert.deepEqual(interpret("sugar cookie").dishes, ["sugar"]);
  assert.deepEqual(interpret("snickerdoodle").dishes, ["snickerdoodle"]);
  assert.deepEqual(interpret("choc chip").dishes, ["chocolate chip"]);
});

test("chocolate and chip are read, not swallowed", () => {
  // They used to sit in the stop-list, so "chewy chocolate chip" threw two
  // thirds of the query away and said nothing about it.
  const i = interpret("chewy chocolate chip cookies");
  assert.deepEqual(i.dishes, ["chocolate chip"]);
  assert.deepEqual(i.unrecognised, []);
});

test("a dish is named once even when two of its words match", () => {
  const i = interpret("chocolate chip choc cookies");
  assert.deepEqual(i.dishes, ["chocolate chip"]);
});

test("cinnamon sugar is a snickerdoodle, not a sugar cookie", () => {
  assert.deepEqual(interpret("cinnamon sugar").dishes, ["snickerdoodle"]);
});

test("brown sugar is a texture, so it never reads as a sugar cookie", () => {
  const i = interpret("brown sugar");
  assert.ok(i.textures.chewy > 0.5);
  assert.deepEqual(i.dishes, []);
});

test("two dishes widen rather than conflict", () => {
  const i = interpret("oatmeal or peanut butter");
  assert.deepEqual(i.dishes, ["oatmeal", "peanut butter"]);
});

const row = (dish: string | null, chewy: number, cakey: number, crispy: number) => ({
  dish_type: dish,
  scores: { chewy, cakey, crispy },
});

test("candidatesFor filters by dish, and never empties the corpus", () => {
  const rows = [
    row("oatmeal", 0.8, 0.2, 0.1),
    row("chocolate chip", 0.2, 0.8, 0.1),
    row(null, 0.3, 0.3, 0.9),
  ];
  assert.deepEqual(candidatesFor(rows, interpret("oatmeal")), [rows[0]]);
  // No dish named: everything stays.
  assert.equal(candidatesFor(rows, interpret("chewy")).length, 3);
  // A dish the corpus has none of must not return nothing at all.
  assert.equal(candidatesFor([row("sugar", 0.5, 0.5, 0.5)], interpret("oatmeal")).length, 1);
});

test("a negated texture drops the recipes that rank highest on it", () => {
  // Nine recipes, cakey ascending. "not cakey" should take the top third off
  // that ranking, which is the three cakiest, and leave the rest alone. It
  // used to compare textures against each other and drop whatever "led" with
  // cakey, a comparison the scores do not support.
  const rows = Array.from({ length: 9 }, (_, n) => row(null, 0.5, n / 10, 0.5));
  const kept = candidatesFor(rows, interpret("not cakey"));
  assert.equal(kept.length, 6);
  for (const dropped of rows.slice(6)) assert.ok(!kept.includes(dropped));
  for (const stays of rows.slice(0, 6)) assert.ok(kept.includes(stays));
});

test("a negation leaves a small pool alone", () => {
  // Taking a third off five recipes is not a filter, it is a cull. An almost
  // right answer beats a nearly empty list.
  const rows = Array.from({ length: 5 }, (_, n) => row(null, 0.5, n / 10, 0.5));
  assert.equal(candidatesFor(rows, interpret("not cakey")).length, 5);
});

test("a negation on its own is understood", () => {
  const i = interpret("not cakey");
  assert.deepEqual(i.excluded, ["cakey"]);
  assert.equal(i.empty, false);
  assert.equal(i.textures.cakey, 0);
});

/* ---------------------------------------------- inflections and modifiers */

test("plurals and comparatives need no separate entries", () => {
  assert.deepEqual(interpret("oats").dishes, ["oatmeal"]);
  assert.equal(interpret("chewier").textures.chewy, 1);
  assert.equal(interpret("crispiest").textures.crispy, 1);
  assert.ok(interpret("thinner").textures.crispy > 0.5);
  assert.deepEqual(interpret("snickerdoodles").dishes, ["snickerdoodle"]);
});

test("an intensifier turns a texture up and is shown back", () => {
  const plain = interpret("thick");
  const loud = interpret("extra thick");
  assert.ok(loud.textures.cakey > plain.textures.cakey);
  assert.ok(loud.understood.includes("extra thick"));
  assert.deepEqual(loud.unrecognised, []);
});

test("an intensifier never pushes a weight above 1", () => {
  assert.equal(interpret("super chewy").textures.chewy, 1);
});

test("a position word adds nothing but is not called unknown", () => {
  // This app scores a cookie as a whole; where in it the texture sits is real
  // to a baker but unmodelled here. Reading it as the texture is honest.
  const i = interpret("chewy middle");
  assert.equal(i.textures.chewy, 1);
  assert.deepEqual(i.unrecognised, []);
});

test("hyphens and spaces are the same thing", () => {
  assert.deepEqual(interpret("soft-baked").understood, interpret("soft baked").understood);
  assert.equal(interpret("no-mixer").prefs.easy, true);
});

test("a negated texture is dropped rather than inverted", () => {
  // "not cakey" used to read as cakey, because "not" was a stop-word.
  const i = interpret("not cakey");
  assert.equal(i.textures.cakey, 0);
  assert.deepEqual(i.refused, ["cakey"]);
});

test("negation survives a filler word", () => {
  const i = interpret("chewy but not too thin");
  assert.equal(i.textures.chewy, 1);
  assert.equal(i.textures.crispy, 0);
  assert.deepEqual(i.refused, ["thin"]);
});

test("a negator does not eat the effort phrases that start with one", () => {
  assert.equal(interpret("no mixer").prefs.easy, true);
  assert.equal(interpret("no chill").prefs.quick, true);
});

test("a dish on its own ranks by rating rather than by nothing", () => {
  const base: Rankable = {
    scores: { chewy: 0.5, cakey: 0.5, crispy: 0.5, confidence: "high" },
    method: "creamed", chills_dough: false, bake_minutes: 11,
    rating: 5,
    ratingCount: 50,
    reviews: null,
    dishType: null, ingredientCount: 10,
  };
  const worse: Rankable = { ...base, rating: 3 };
  const i = interpret("oatmeal");
  assert.ok(matchScore(base, i) > matchScore(worse, i));
});

// --- a rating is worth what its count makes it worth ----------------------

test("more people saying five stars beats fewer people saying five stars", () => {
  // The bug as reported: "best snickerdoodle" put 5 stars from one person
  // above 5 stars from two, and the two were in fact tied -- the order came
  // from wherever the array happened to put them.
  const one = confidentRating(5, 1)!;
  const two = confidentRating(5, 2)!;
  const many = confidentRating(5, 500)!;
  assert.ok(two > one, "two ratings should outrank one");
  assert.ok(many > two, "five hundred should outrank two");
});

test("a well-reviewed near-perfect score beats a lone perfect one", () => {
  // 118 of the 276 perfect 5.0s in the corpus have two ratings or fewer, so
  // taking them at face value hands every popularity query to whichever
  // recipe nobody has reviewed yet.
  assert.ok(confidentRating(4.9, 400)! > confidentRating(5, 1)!);
  assert.ok(confidentRating(4.98, 90)! > confidentRating(5, 2)!);
});

test("shrinkage pulls toward the mean, never past the rating", () => {
  // A rating with no count behind it becomes the prior, not a zero.
  assert.equal(confidentRating(5, 0), confidentRating(1, 0));
  // And a rating below the mean is pulled up, not down.
  assert.ok(confidentRating(3, 1)! > 3);
  assert.ok(confidentRating(3, 1)! < 5);
  // Unrated stays unrated.
  assert.equal(confidentRating(null, 100), null);
});

// --- evidence from reviews ------------------------------------------------

test("quotes a review that uses the word the query used", () => {
  const m = reviewEvidence(["These came out so chewy and soft, perfect!"], interpret("chewy"));
  assert.equal(m?.word, "chewy");
});

test("finds the inflections a reviewer actually types", () => {
  assert.equal(reviewEvidence(["Even chewier than the bakery ones."], interpret("chewy"))?.word, "chewier");
  assert.equal(reviewEvidence(["Nice and crisp, my kind of cookie!"], interpret("crispy"))?.word, "crisp");
  assert.equal(reviewEvidence(["The chew is perfect."], interpret("chewy"))?.word, "chew");
});

test("a negated mention is not evidence", () => {
  // The review contains the word and argues the opposite with it.
  assert.equal(reviewEvidence(["Not chewy at all, very disappointing."], interpret("chewy")), null);
  assert.equal(reviewEvidence(["These were not crispy."], interpret("crispy")), null);
});

test("does not answer one texture with a review about another", () => {
  assert.equal(reviewEvidence(["The crisp edges were the best part."], interpret("chewy")), null);
  assert.equal(reviewEvidence(["So soft and chewy."], interpret("crispy")), null);
});

test("a food noun is not a texture word", () => {
  // Measured on the corpus: allowing bare "cake" to answer "cakey" matched 33
  // more reviews, nearly all of them an ingredient or a typo.
  assert.equal(reviewEvidence(["More cake than cookie, very sweet."], interpret("cakey")), null);
  assert.equal(reviewEvidence(["1C chocolate cake chips is plenty."], interpret("cakey")), null);
  // The real word still works.
  assert.equal(reviewEvidence(["Lovely and cakey, like a muffin top."], interpret("cakey"))?.word, "cakey");
});

test("nothing to quote is not an error", () => {
  assert.equal(reviewEvidence([], interpret("chewy")), null);
  assert.equal(reviewEvidence(null, interpret("chewy")), null);
  assert.equal(reviewEvidence(["Great recipe, made them twice."], interpret("chewy")), null);
  // No query, nothing to match against.
  assert.equal(reviewEvidence(["So chewy!"], interpret("")), null);
});

// --- ruling a dish out ----------------------------------------------------

test("a negated dish is ruled out, not asked for", () => {
  // The bug as reported: "no peanuts" showed 65 peanut butter recipes. The
  // negator was not matched, the dish word was, and the reader was handed the
  // opposite of what they asked for.
  assert.deepEqual(interpret("no peanuts").dishes, []);
  assert.deepEqual(interpret("no peanuts").excludedDishes, ["peanut butter"]);
  assert.deepEqual(interpret("no brownies").excludedDishes, ["brownie"]);
});

test("the words people use to rule something out", () => {
  // "without" and "minus" were not negators, so "without peanut butter"
  // selected peanut butter.
  for (const q of [
    "without peanut butter",
    "minus the peanut butter",
    "skip peanut butter",
    "avoid peanut butter",
  ]) {
    assert.deepEqual(interpret(q).excludedDishes, ["peanut butter"], q);
    assert.deepEqual(interpret(q).dishes, [], q);
  }
});

test("an article between the negator and its target", () => {
  // "minus the brownies" and "no more scones" both slipped through, because
  // the filler list held adverbs but no articles.
  assert.deepEqual(interpret("minus the brownies").excludedDishes, ["brownie"]);
  assert.deepEqual(interpret("no more scones").excludedDishes, ["scone"]);
  assert.deepEqual(interpret("without any peanut butter").excludedDishes, ["peanut butter"]);
});

test("ruling a dish out is understood, not an empty query", () => {
  // It says less than a texture does and it is not nothing, so the page must
  // not answer it with the empty state.
  assert.equal(interpret("no peanuts").empty, false);
});

test("asking for a dish still asks for it", () => {
  assert.deepEqual(interpret("peanut butter").dishes, ["peanut butter"]);
  assert.deepEqual(interpret("peanut butter").excludedDishes, []);
  assert.deepEqual(interpret("chewy brownie").dishes, ["brownie"]);
});
