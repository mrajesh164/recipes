/**
 * Push out/recipes.json into Supabase.
 *
 *   node --env-file=.env.local --experimental-strip-types packages/corpus/src/seed.ts
 *
 * Run from the repo root. `--env-file` is how the service-role key reaches
 * this process: it stays in .env.local, which is gitignored and which agents
 * are denied from reading, and it never goes to Vercel. Seeding is a thing
 * that happens from a laptop.
 *
 * This is also the only writer. The tables have no insert/update/delete
 * policy, so the deployed app physically cannot write to them -- which is why
 * this script needs the service role rather than the publishable key.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { CorpusRecipe } from "./dish.ts";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run from the repo root with:  node --env-file=.env.local ...",
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const recipes: CorpusRecipe[] = JSON.parse(
  readFileSync(join(PKG, "out", "recipes.json"), "utf8"),
);
console.log(`seeding ${recipes.length} recipes...\n`);

let ingredientRows = 0;
let recipesWritten = 0;
let failed = 0;

for (const r of recipes) {
  // source_url is unique, so re-running updates in place rather than
  // accumulating duplicates every time the corpus is rebuilt.
  const { data: row, error } = await db
    .from("recipes")
    .upsert(
      {
        source_url: r.sourceUrl,
        source_name: r.sourceName,
        title: r.title,
        dish_type: r.dishType,
        yield_count: r.yieldCount,
        rating: r.rating,
        rating_count: r.ratingCount,
        method: r.method,
        bake_temp_f: r.bakeTempF,
        bake_minutes: r.bakeMinutes,
        chills_dough: r.chillsDough,
        image_url: r.imageUrl,
        // Null rather than [] where the page published none: an empty array
        // would say we looked and found nothing, which is a different claim.
        reviews: r.reviews.length ? r.reviews : null,
        hand_entered: false,
        raw_jsonld: r.rawJsonLd,
      },
      { onConflict: "source_url" },
    )
    .select("id")
    .single();

  if (error || !row) {
    console.error(`  x ${r.title}: ${error?.message ?? "no row returned"}`);
    failed++;
    continue;
  }

  // Replace the ingredient list wholesale. Upserting per position would leave
  // stragglers behind if a recipe loses an ingredient between runs.
  await db.from("ingredients").delete().eq("recipe_id", row.id);

  const rows = r.ingredients.map((i, position) => ({
    recipe_id: row.id,
    position,
    raw_text: i.raw,
    canonical_name: i.canonicalName,
    grams: i.grams,
    grams_source: i.gramsSource,
    display_qty: i.displayQty,
    display_unit: i.displayUnit,
  }));

  const { error: ingErr } = await db.from("ingredients").insert(rows);
  if (ingErr) {
    console.error(`  x ${r.title} ingredients: ${ingErr.message}`);
    failed++;
    continue;
  }

  recipesWritten++;
  ingredientRows += rows.length;
  const withGrams = r.ingredients.filter((i) => i.grams !== null).length;
  console.log(
    `  ok ${r.title}  (${r.dishType}, ${rows.length} ingredients, ` +
      `${withGrams} with grams, ${r.method})`,
  );
}

// Anything in the table that is no longer in the corpus is stale. Upserting
// alone never removes, so a URL that gets dropped from urls.txt -- or one that
// turns out to be a duplicate under a different key -- would linger and could
// still be recommended.
//
// This used to be one `not in (...)` carrying every URL in the corpus. At 13
// recipes that was a query string a few hundred characters long. At 250 it is
// over fifteen kilobytes of URL, which PostgREST sits behind a proxy that will
// refuse it -- and the failure mode is a 414 on the *cleanup* step, after the
// upserts have already succeeded, so the corpus looks seeded and quietly keeps
// its stale rows. Read the keys, diff them here, delete by id in batches.
const keep = new Set(recipes.map((r) => r.sourceUrl));

/**
 * A seed that could not write must not prune.
 *
 * The two halves of this script fail independently: if every upsert is
 * rejected -- a bad key, or a column the migrations have not been applied for
 * yet -- the cleanup below would still run, and would still cheerfully delete
 * every row that is not in a corpus it just failed to write. That turns a
 * recoverable error into an empty table.
 */
if (failed > 0 && recipesWritten === 0) {
  console.error(`\nFAILED: nothing was written, so nothing will be deleted either.`);
  console.error(`${failed} recipes failed. Fix the cause and re-run.`);
  process.exit(1);
}

/**
 * Read the existing rows in pages.
 *
 * This select had no range, and PostgREST caps a response at 1,000 rows
 * whatever is asked for -- silently: the request succeeds and error is null.
 * So the prune only ever considered the first 1,000 rows in the table. With
 * 1,402 rows it removed the 13 stale English muffins that fell inside the
 * window and never learned about the other 4, which stayed in the database as
 * muffins, reachable by search, while this script printed a clean finish.
 *
 * The same cap bit the app's own read of the corpus. It is worth assuming of
 * any unbounded select here: the failure is invisible until the table outgrows
 * the cap, and then it is a wrong answer rather than an error.
 */
const PAGE = 1000;
const existing: { id: string; source_url: string; title: string }[] = [];
let listErr: { message: string } | null = null;

for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from("recipes")
    .select("id, source_url, title")
    // Ordered, because a page boundary in an unordered read can return a row
    // twice and skip another -- and a skipped row here is one that never gets
    // considered for deletion.
    .order("id")
    .range(from, from + PAGE - 1);
  if (error) {
    listErr = error;
    break;
  }
  const page = (data ?? []) as typeof existing;
  existing.push(...page);
  if (page.length < PAGE) break;
}

if (listErr) {
  console.error(`  ! cleanup failed to list rows: ${listErr.message}`);
  failed++;
} else {
  console.log(`\n  ${existing.length} rows in the table, ${keep.size} in the corpus`);
  const stale = existing.filter((r) => !keep.has(r.source_url));
  for (let i = 0; i < stale.length; i += 100) {
    const batch = stale.slice(i, i + 100);
    const { error: delErr } = await db
      .from("recipes")
      .delete()
      .in("id", batch.map((r) => r.id));
    if (delErr) {
      console.error(`  ! cleanup failed: ${delErr.message}`);
      failed++;
      break;
    }
    for (const r of batch) console.log(`  -- removed stale: ${r.title}`);
  }
}

/**
 * Report what was written, not what was attempted, and exit non-zero on any
 * failure.
 *
 * This previously printed "done: 13 recipes" off recipes.length -- the size of
 * the *input* -- so a run where every single upsert was rejected with
 * "Invalid API key" still ended on a line that read like success. A seed
 * script that lies about seeding is worse than one that crashes.
 */
if (failed > 0) {
  console.error(
    `\nFAILED: ${recipesWritten}/${recipes.length} recipes written, ` +
      `${failed} failed. ${ingredientRows} ingredients.`,
  );
  process.exit(1);
}

console.log(`\ndone: ${recipesWritten} recipes, ${ingredientRows} ingredients`);
