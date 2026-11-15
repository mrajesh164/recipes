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
    .select("*, ingredients(*)")
    .order("title")
    .order("position", { referencedTable: "ingredients" });

  if (error) throw new Error(`Supabase: ${error.message}`);

  // Scored here, not stored. The corpus is small enough that this is free,
  // and it means a change to the weights can never leave stale numbers in a
  // table -- which would be wrong silently, the worst way to be wrong.
  return (data ?? []).map((r) => {
    const recipe = r as Recipe;
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
