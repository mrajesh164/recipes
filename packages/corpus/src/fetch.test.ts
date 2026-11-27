import { test } from "node:test";
import assert from "node:assert/strict";
import { hostOf, interleaveByHost } from "./fetch.ts";

test("hostOf drops www and keeps the rest", () => {
  assert.equal(hostOf("https://www.sallysbakingaddiction.com/a/b"), "sallysbakingaddiction.com");
  assert.equal(hostOf("http://bakeorbreak.com/x"), "bakeorbreak.com");
});

test("interleaveByHost keeps every url exactly once", () => {
  const urls = [
    "https://a.com/1", "https://a.com/2", "https://a.com/3",
    "https://b.com/1", "https://b.com/2",
    "https://c.com/1",
  ];
  const out = interleaveByHost(urls);
  assert.equal(out.length, urls.length);
  assert.deepEqual([...out].sort(), [...urls].sort());
});

test("interleaveByHost separates same-host requests", () => {
  const urls = [
    "https://a.com/1", "https://a.com/2", "https://a.com/3",
    "https://b.com/1", "https://b.com/2",
    "https://c.com/1",
  ];
  const out = interleaveByHost(urls).map(hostOf);
  // The first pass takes one from each host before any host's second page.
  assert.deepEqual(out.slice(0, 3), ["a.com", "b.com", "c.com"]);
  // No host appears twice in a row while another still has pages queued.
  assert.notEqual(out[0], out[1]);
  assert.notEqual(out[1], out[2]);
});

test("a single host degrades to the plain order", () => {
  const urls = ["https://a.com/1", "https://a.com/2"];
  assert.deepEqual(interleaveByHost(urls), urls);
});
