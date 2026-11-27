/**
 * Where one recipe sits on one ratio, as a position rather than a distribution.
 *
 * Three versions of this have now been called confusing, and the lesson of the
 * third is that the format was wrong rather than badly tuned. It drew the
 * spread of the corpus as a histogram, which meant a reader had to decode a
 * chart before learning anything, and worse, the highlighted bar was sized by
 * how many recipes shared its bin. A recipe at the 91st percentile is usually
 * alone up there, so the single most important mark on the plot rendered as a
 * 4px sliver while the grey bars towered over it. The thing you were meant to
 * look at was the thing hardest to see.
 *
 * So this shows one thing: how far along the range this recipe sits. A track
 * filled to that point needs no legend and no density to interpret, and the
 * line underneath says it in words.
 *
 * The words are a band rather than a percentage on purpose. "81%, higher than
 * 81% of them" was a real line in the old version: brown sugar is itself a
 * percentage, so the value and the percentile collided and read as a
 * tautology. "81% of the sugar, on the high side" cannot.
 *
 * Still per gram of flour, and the position is still measured against the
 * recipes it is actually being compared with, which is its own dish.
 */

export interface RangePlotProps {
  label: string;
  /** "more = chewier". Sign-posts which direction means what. */
  hint: string;
  /** Every recipe's value for this ratio, including the picked one. */
  values: number[];
  /** The recommendation's value. */
  picked: number;
  /** How to render a value for a person. */
  format: (n: number) => string;
}

/** How far along its range this value sits, 0-100. */
export function positionOf(values: number[], picked: number): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v < picked).length;
  return Math.round((below / values.length) * 100);
}

export function RangePlot({
  label,
  hint,
  values,
  picked,
  format,
}: RangePlotProps) {
  if (values.length === 0) return null;

  const allSame = values.every((v) => v === values[0]);
  if (allSame) {
    return (
      <div className="py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-ink-faint">
            all the same, {format(picked)}
          </span>
        </div>
      </div>
    );
  }

  // The bar is a value scale now, not a percentile.
  //
  // It was filled to the percentile and carried a sentence saying so. With the
  // sentence gone the fill meant nothing on its own: 63 g showed as 8% full and
  // there was no way to tell what 8% of what. Labelling the two ends fixes that
  // with no prose at all, but only if the fill agrees with the labels, so the
  // scale is linear between them. 63 g between 47 and 151 is 15% along, which
  // is a different number from its percentile and the honest one to draw under
  // endpoints that say 47 and 151.
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;
  const lo = sorted.length >= 20 ? at(0.05) : sorted[0]!;
  const hi = sorted.length >= 20 ? at(0.95) : sorted[sorted.length - 1]!;
  const along =
    hi === lo ? 0 : Math.max(0, Math.min(100, ((picked - lo) / (hi - lo)) * 100));

  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">
          {label}{" "}
          <span className="tabular-nums text-clay-deep">{format(picked)}</span>
        </span>
        <span className="text-xs italic text-ink-faint">{hint}</span>
      </div>

      <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-cream-deep">
        <div
          className="h-full rounded-full bg-clay-deep"
          style={{ width: `${Math.max(2, along)}%` }}
        />
      </div>

      {/* The two ends of the scale. This is what makes the fill mean something:
          without them a filled bar is a quantity of nothing in particular. */}
      <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-faint">
        <span>{format(lo)}</span>
        <span>{format(hi)}</span>
      </div>
    </div>
  );
}
