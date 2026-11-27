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
/** One pill, so Home and the other three cannot look like different things. */
function Pill({ href, label, here }: { href: string; label: string; here: boolean }) {
  return (
    <Link
      href={href}
      // aria-current is the part a screen reader uses. The fill is the part
      // everyone else uses. Both say the same thing.
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
}

/**
 * The left-hand slot, where the script wordmark used to be.
 *
 * A wordmark that goes home is a convention most people know, but it was the
 * odd one out next to explicit pills, and it meant the name was on screen
 * twice on the page that already says it in display type. "Home" is a word,
 * and a word is unambiguously a thing you can click.
 */
export function NavHome() {
  const pathname = usePathname();
  return <Pill href="/" label="Home" here={pathname === "/"} />;
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      <Pill href="/find" label="Find a recipe" here={pathname === "/find"} />
      <Pill href="/recipes" label="All recipes" here={pathname === "/recipes"} />
      <Pill href="/saved" label="Saved" here={pathname === "/saved"} />
    </>
  );
}
