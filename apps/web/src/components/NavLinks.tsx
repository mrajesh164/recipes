"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The three places you can go, as three of the same thing.
 *
 * Two problems this fixes. The home link used to be the script wordmark, so of
 * three destinations two looked like buttons and one looked like a logo. A
 * logo that goes home is a convention people mostly know, but making the other
 * two explicit is what made the third feel broken rather than conventional.
 *
 * And nothing said where you were. On /saved the header was identical to the
 * header on /, so the answer to "where am I" was "read the page and work it
 * out".
 *
 * The first one is called what the page does rather than where it sits. "Home"
 * describes the site to someone who already has a model of the site; "Find a
 * recipe" describes the thing you came to do.
 */
const LINKS = [
  { href: "/", label: "Find a recipe" },
  { href: "/recipes", label: "All recipes" },
  { href: "/saved", label: "Saved" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label }) => {
        const here = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            // aria-current is the part a screen reader uses. The fill is the
            // part everyone else uses. Both say the same thing.
            aria-current={here ? "page" : undefined}
            className={[
              "whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold",
              "transition-colors sm:px-4",
              here
                ? "border-clay-deep bg-clay-deep text-paper"
                : "border-line bg-paper text-ink hover:border-pink-deep hover:bg-cream-deep",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
