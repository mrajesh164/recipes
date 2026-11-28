import Image from "next/image";
import Link from "next/link";
import type { ScoredRecipe } from "@/lib/recipes";
import { BookmarkIcon } from "./icons";

/**
 * What this app does, as the places where it does it.
 *
 * Deliberately a list rather than three hand-written blocks: there are more
 * features coming, starting with telling it what ingredients you have, and the
 * point of a landing page that explains itself is that it keeps explaining
 * itself as the app grows. Adding one here is adding one entry.
 */
interface Feature {
  href: string;
  title: string;
  blurb: string;
  /** How many corpus photographs to show across the top. 0 for the glyph. */
  photos: number;
}

export function FeatureCards({ recipes }: { recipes: ScoredRecipe[] }) {
  // Deterministic, so the cards do not reshuffle between renders.
  const photos = recipes
    .filter((r) => r.image_url !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

  const features: Feature[] = [
    {
      href: "/find",
      title: "Find a recipe",
      blurb: "Describe what you want (chewy, crispy, quick) and get a recipe.",
      photos: 3,
    },
    {
      href: "/recipes",
      title: "All recipes",
      blurb: "Scroll all recipes, sort them, and filter.",
      photos: 3,
    },
    {
      href: "/saved",
      title: "Saved",
      blurb: "Recipes you kept.",
      photos: 3,
    },
  ];

  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f, n) => (
        <li key={f.href}>
          <Link
            href={f.href}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border-2
                       border-line bg-paper transition-colors hover:border-clay-deep"
          >
            {f.photos > 0 ? (
              <div className="grid" style={{ gridTemplateColumns: `repeat(${f.photos}, 1fr)` }}>
                {/* A different slice per card, so the three do not show the
                    same cookies as each other. */}
                {photos.slice(n * f.photos, n * f.photos + f.photos).map((r) => (
                  <div key={r.id} className="relative aspect-square">
                    <Image
                      src={r.image_url!}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 33vw, 120px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid aspect-[3/1] place-items-center bg-cream-deep">
                <BookmarkIcon className="h-9 w-9 text-clay-deep" />
              </div>
            )}

            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-bold tracking-tight group-hover:text-clay-deep">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-ink-soft">{f.blurb}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
