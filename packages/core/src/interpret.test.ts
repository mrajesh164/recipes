import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpret, dominantTexture, matchScore, candidatesFor, type Rankable,
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
  rating: 4.5, ingredientCount: 12,
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
    rating: 5, ingredientCount: 10,
  };
  const worse: Rankable = { ...base, rating: 3 };
  const i = interpret("oatmeal");
  assert.ok(matchScore(base, i) > matchScore(worse, i));
});
