/**
 * One icon, one place. The start of the set slice 2 formalises.
 *
 * Before this the app had a single inline <svg> in the whole interface, which
 * is why "do a normalization pass on icons" understated the problem: there was
 * no set to normalize. Everything here shares a 24-unit box, a 1.8 stroke and
 * currentColor, so an icon takes the colour and weight of the text it sits
 * beside rather than carrying its own.
 */

/** A square with an arrow leaving it: this link takes you off the site. */
export function ExternalLinkIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* the square, open at the corner the arrow leaves through */}
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M19 15v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
    </svg>
  );
}
