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
import type { ExtractedRecipe } from "./extract.ts";

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

const recipes: ExtractedRecipe[] = JSON.parse(
  readFileSync(join(PKG, "out", "recipes.json"), "utf8"),
);
console.log(`seeding ${recipes.length} recipes...\n`);

let ingredientRows = 0;

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
        yield_count: r.yieldCount,
        rating: r.rating,
        rating_count: r.ratingCount,
        method: r.method,
        bake_temp_f: r.bakeTempF,
        bake_minutes: r.bakeMinutes,
        chills_dough: r.chillsDough,
        hand_entered: false,
        raw_jsonld: r.rawJsonLd,
      },
      { onConflict: "source_url" },
    )
    .select("id")
    .single();

  if (error || !row) {
    console.error(`  x ${r.title}: ${error?.message ?? "no row returned"}`);
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
    continue;
  }

  ingredientRows += rows.length;
  const withGrams = r.ingredients.filter((i) => i.grams !== null).length;
  console.log(
    `  ok ${r.title}  (${rows.length} ingredients, ${withGrams} with grams, ${r.method})`,
  );
}

console.log(`\ndone: ${recipes.length} recipes, ${ingredientRows} ingredients`);
