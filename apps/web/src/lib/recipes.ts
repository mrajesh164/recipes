import { cacheLife } from "next/cache";
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
  ingredients: Ingredient[];
}

/**
 * The corpus only changes when the seed script runs, so this is cached rather
 * than read per request. Cache Components is on, which means an uncached read
 * here would need a Suspense boundary; caching is both simpler and correct for
 * data that is static between seeds.
 */
export async function getRecipes(): Promise<Recipe[]> {
  "use cache";
  cacheLife("hours");

  const { data, error } = await supabaseRead()
    .from("recipes")
    .select("*, ingredients(*)")
    .order("title")
    .order("position", { referencedTable: "ingredients" });

  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data ?? []) as Recipe[];
}
