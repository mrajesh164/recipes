import { getRecipes } from "@/lib/recipes";

/**
 * Slice 1: prove the pipeline end to end on a live URL.
 *
 * Deliberately plain. The job of this page is to show that a recipe page was
 * fetched, its structured data parsed, its ingredients normalized to grams,
 * and the result stored and read back. Design comes after that is confirmed.
 *
 * Every number below came out of a real recipe page, not a fixture.
 */
export default async function Page() {
  const recipes = await getRecipes();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">
        Recipe corpus
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {recipes.length} recipe{recipes.length === 1 ? "" : "s"}, scraped from
        structured data and normalized to grams.
      </p>

      {recipes.length === 0 && (
        <p className="mt-10 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          Nothing seeded yet. Run the corpus pipeline, then the seed script.
        </p>
      )}

      {recipes.map((r) => {
        const resolved = r.ingredients.filter((i) => i.grams !== null).length;
        return (
          <section key={r.id} className="mt-12">
            <h2 className="text-xl font-semibold">{r.title}</h2>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              <div>
                <dt className="inline font-medium">Source: </dt>
                <dd className="inline">
                  <a
                    href={r.source_url}
                    className="underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.source_name}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Method: </dt>
                <dd className="inline">{r.method ?? "unknown"}</dd>
              </div>
              {r.rating !== null && (
                <div>
                  <dt className="inline font-medium">Rating: </dt>
                  <dd className="inline">
                    {r.rating}
                    {r.rating_count !== null && ` from ${r.rating_count}`}
                  </dd>
                </div>
              )}
              {r.bake_temp_f !== null && (
                <div>
                  <dt className="inline font-medium">Bake: </dt>
                  <dd className="inline">
                    {r.bake_temp_f}&deg;F
                    {r.bake_minutes !== null && `, ${r.bake_minutes} min`}
                  </dd>
                </div>
              )}
              {r.chills_dough && <div>Chills the dough</div>}
            </dl>

            <p className="mt-3 text-xs text-neutral-500">
              {resolved} of {r.ingredients.length} ingredients resolved to grams
            </p>

            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-700">
                  <th className="py-2 pr-3 font-medium">As written</th>
                  <th className="py-2 pr-3 font-medium">Ingredient</th>
                  <th className="py-2 pr-3 text-right font-medium">Grams</th>
                  <th className="py-2 font-medium">From</th>
                </tr>
              </thead>
              <tbody>
                {r.ingredients.map((i) => (
                  <tr
                    key={i.position}
                    className="border-b border-neutral-200 last:border-0 dark:border-neutral-800"
                  >
                    <td className="py-2 pr-3">{i.raw_text}</td>
                    <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-400">
                      {i.canonical_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {/* null is not zero: an unresolved ingredient has no
                          weight, and must not read as weighing nothing. */}
                      {i.grams === null ? "—" : i.grams}
                    </td>
                    <td className="py-2 text-xs text-neutral-500">
                      {i.grams_source ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
