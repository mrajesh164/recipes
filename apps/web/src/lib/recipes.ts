import { cacheLife } from "next/cache";
import { scoreTexture, type ParsedIngredient, type TextureScores } from "@recipes/core";
import { supabaseRead } from "./supabase";

export interface Ingredient {
  position: number;
  raw_text: string;
  canonical_name: string | null;
  grams: number | null;
  grams_source: "stated" | "converted" | null;
  display_qty: string | null;
  display_unit: string | null;
}

export interface Recipe {
  id: string;
  source_url: string;
  source_name: string;
  title: string;
  yield_count: number | null;
  rating: number | null;
  rating_count: number | null;
  method: "melted" | "creamed" | "other" | null;
  bake_temp_f: number | null;
  bake_minutes: number | null;
  chills_dough: boolean;
  hand_entered: boolean;
  image_url: string | null;
  /** Which drop cookie. Null for rows that predate the widening. */
  dish_type: string | null;
  ingredients: Ingredient[];
}

/** A recipe with its predicted texture attached. */
export interface ScoredRecipe extends Recipe {
  scores: TextureScores;
}

/**
 * The database stores what the parser produced; scoreTexture wants the
 * parser's own shape back. Mapping here rather than storing camelCase keeps
 * the SQL readable and the core package unaware of the database.
 */
function toParsed(i: Ingredient): ParsedIngredient {
  return {
    raw: i.raw_text,
    canonicalName: i.canonical_name,
    grams: i.grams,
    gramsSource: i.grams_source,
    displayQty: i.display_qty,
    displayUnit: i.display_unit,
    note: null,
    confidence: "high",
  };
}

/**
 * The corpus only changes when the seed script runs, so this is cached rather
 * than read per request. Cache Components is on, which means an uncached read
 * here would need a Suspense boundary; caching is both simpler and correct for
 * data that is static between seeds.
 */
export async function getRecipes(): Promise<ScoredRecipe[]> {
  "use cache";
  cacheLife("hours");

  const { data, error } = await supabaseRead()
    .from("recipes")
    // Explicit columns, not `*`. `*` drags raw_jsonld along -- the whole
    // structured-data blob per recipe -- and since the corpus ships to the
    // client for instant ranking, that put 7.6 MB on the wire at 325
    // recipes. Invisible at 13. Nothing renders it.
    //
    // One string literal, not concatenation: supabase-js parses this at the
    // type level and cannot read a built-up string.
    .select(
      "id, source_url, source_name, title, yield_count, rating, rating_count, method, bake_temp_f, bake_minutes, chills_dough, hand_entered, image_url, dish_type, ingredients(position, raw_text, canonical_name, grams, grams_source, display_qty, display_unit)",
    )
    .order("title")
    .order("position", { referencedTable: "ingredients" });

  if (error) throw new Error(`Supabase: ${error.message}`);

  // Scored here, not stored. The corpus is small enough that this is free,
  // and it means a change to the weights can never leave stale numbers in a
  // table -- which would be wrong silently, the worst way to be wrong.
  return (data ?? []).map((r) => {
    const recipe = r as Recipe;
    // Four sources publish "//host/path" with no scheme. Next treats a leading
    // // as a local path and refuses to optimise it.
    if (recipe.image_url?.startsWith("//")) {
      recipe.image_url = `https:${recipe.image_url}`;
    }
    return {
      ...recipe,
      scores: scoreTexture({
        ingredients: recipe.ingredients.map(toParsed),
        method: recipe.method,
        chillsDough: recipe.chills_dough,
      }),
    };
  });
}
