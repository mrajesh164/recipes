import { test } from "node:test";
import assert from "node:assert/strict";
import { interpret, dominantTexture, matchScore, type Rankable } from "./interpret.ts";

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
