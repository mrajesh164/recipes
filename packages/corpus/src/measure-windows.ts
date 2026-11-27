/**
 * Measure the normalisation windows, per dish and overall.
 *
 *   node --experimental-strip-types packages/corpus/src/measure-windows.ts
 *
 * Writes packages/core/src/windows.ts, which is generated and committed. The
 * windows are a property of the corpus, so they have to be re-measured when the
 * corpus changes shape -- which is the instruction the comment in texture.ts
 * has carried since the first time they were wrong.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreTexture } from "@recipes/core";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

const recipes = JSON.parse(
  readFileSync(join(ROOT, "packages/corpus/out/recipes.json"), "utf8"),
) as { dishType: string; ingredients: never[]; method: never; chillsDough: boolean }[];

const rows = recipes
  .map((r) => ({
    dish: r.dishType,
    scores: scoreTexture({
      ingredients: r.ingredients,
      method: r.method,
      chillsDough: r.chillsDough,
    }),
  }))
  .filter((r) => r.scores.ratios !== null);

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;
}

/** The 10th to 90th percentile: the range the scoring spreads scores across. */
function window(values: number[]): [number, number] {
  return [percentile(values, 0.1), percentile(values, 0.9)];
}

const round = (n: number) => Math.round(n * 100) / 100;

const byDish = new Map<string, typeof rows>();
for (const r of rows) {
  const list = byDish.get(r.dish) ?? [];
  list.push(r);
  byDish.set(r.dish, list);
}

const overall = {
  n: rows.length,
  fat: window(rows.map((r) => r.scores.ratios!.fatPerFlour)).map(round) as [number, number],
  sugar: window(rows.map((r) => r.scores.ratios!.sugarPerFlour)).map(round) as [number, number],
};

const dishes: Record<string, { n: number; fat: [number, number]; sugar: [number, number] }> = {};
for (const [dish, list] of [...byDish].sort((a, b) => b[1].length - a[1].length)) {
  dishes[dish] = {
    n: list.length,
    fat: window(list.map((r) => r.scores.ratios!.fatPerFlour)).map(round) as [number, number],
    sugar: window(list.map((r) => r.scores.ratios!.sugarPerFlour)).map(round) as [number, number],
  };
}

const out = `/**
 * GENERATED. Re-make with:
 *   node --experimental-strip-types packages/corpus/src/measure-windows.ts
 *
 * The 10th to 90th percentile of each ratio, measured over the corpus, per
 * dish and overall. scoreTexture spreads its scores across these, so they are
 * a property of the data and not constants: when the corpus changes shape they
 * are wrong until they are measured again.
 */

export interface Window {
  /** How many recipes it was measured over. Drives how far it is trusted. */
  n: number;
  fat: readonly [number, number];
  sugar: readonly [number, number];
}

export const OVERALL_WINDOW: Window = ${JSON.stringify(overall)};

export const DISH_WINDOWS: Readonly<Record<string, Window>> = ${JSON.stringify(dishes, null, 2)};
`;

const path = join(ROOT, "packages/core/src/windows.ts");
writeFileSync(path, out);

console.log(`overall  n=${overall.n}  fat ${overall.fat.join("-")}  sugar ${overall.sugar.join("-")}`);
for (const [d, w] of Object.entries(dishes)) {
  console.log(`  ${d.padEnd(16)} n=${String(w.n).padStart(3)}  fat ${w.fat.join("-")}  sugar ${w.sugar.join("-")}`);
}
console.log(`\nwrote ${path}`);
