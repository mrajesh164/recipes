import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabaseForUser } from "@/lib/supabase-server-user";

export const metadata = { title: "Saved recipes" };

/**
 * One person's list.
 *
 * Cache Components is on, so an uncached read needs a Suspense boundary --
 * and this read is per-user, so caching it would be actively wrong. The
 * boundary is the correct tool here rather than a workaround.
 */
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-6">
      <h1 className="text-3xl font-bold tracking-tight">Saved</h1>
      <Suspense fallback={<p className="mt-6 text-sm text-ink-soft">Looking…</p>}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  const db = await supabaseForUser();
  if (!db) {
    return <p className="mt-6 text-sm text-ink-soft">Sign in to see your saved recipes.</p>;
  }

  const { data, error } = await db
    .from("saved_recipes")
    .select("id, saved_for, created_at, recipes(id, title, source_name, source_url, image_url, rating)")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="mt-6 text-sm text-pink-deep">
        Couldn&apos;t load your saves: {error.message}
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-dashed border-line bg-paper px-6 py-10 text-center">
        <p className="font-semibold">Nothing saved yet.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Find a recipe you like and hit Save.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-clay-deep px-5 py-3 text-sm font-semibold text-paper hover:bg-clay"
        >
          Find a recipe
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((row) => {
        // Supabase types an embedded one-to-one as an array.
        const r = (Array.isArray(row.recipes) ? row.recipes[0] : row.recipes) as
          | { id: string; title: string; source_name: string; source_url: string; image_url: string | null; rating: number | null }
          | undefined;
        if (!r) return null;
        return (
          <li key={row.id}>
            <a
              href={r.source_url}
              target="_blank"
              rel="noreferrer"
              className="group block h-full overflow-hidden rounded-2xl border border-line bg-paper hover:border-pink-deep"
            >
              {r.image_url && (
                <div className="relative aspect-[4/3]">
                  <Image
                    src={r.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-bold leading-snug tracking-tight group-hover:text-clay-deep">
                  {r.title}
                </h2>
                <p className="mt-1 text-xs text-ink-faint">
                  {r.source_name}
                  {r.rating !== null && ` · ${r.rating}★`}
                </p>
                {row.saved_for && (
                  <p className="mt-2 inline-block rounded-full bg-cream-deep px-2.5 py-0.5 text-[11px] text-ink-soft">
                    saved for &ldquo;{row.saved_for}&rdquo;
                  </p>
                )}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
