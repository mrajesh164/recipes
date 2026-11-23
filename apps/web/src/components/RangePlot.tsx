/**
 * Where one recipe sits among all the others, on one ratio.
 *
 * This is the picture from the proposal: every dot is a real recipe, the
 * ringed one is the recommendation. It answers "why this one" in a glance
 * instead of three sentences, and it shows the thing the whole project is
 * about -- that recipes disagree, on purpose, and the disagreement is a dial.
 *
 * Two deliberate choices:
 *
 * Everything is per gram of flour. Absolute grams of butter cannot be compared
 * across recipes making 24 and 60 cookies; per-flour can.
 *
 * The axis spans the corpus, not 0-to-max. If every recipe falls between 0.55
 * and 0.95, a 0-to-1 axis crushes all thirteen dots into the right-hand third
 * and the differences -- which are the entire point -- disappear.
 */

export interface RangePlotProps {
  label: string;
  /** "more = chewier". Sign-posts which direction means what. */
  hint: string;
  /** Every recipe's value for this ratio, including the picked one. */
  values: number[];
  /** The recommendation's value. Ringed. */
  picked: number;
  /** How to render a value for a person. */
  format: (n: number) => string;
}

export function RangePlot({ label, hint, values, picked, format }: RangePlotProps) {
  if (values.length === 0) return null;

  // The axis spans the 5th-95th percentile, not the full range.
  //
  // At 13 recipes min-to-max was fine. At 325 it is not: a handful of recipes
  // parse badly -- 526 g of butter per 100 g of flour is not a cookie, and
  // neither is 0 g -- and because the axis stretched to fit them, all 313
  // real recipes squashed into the left third. The plot got less readable as
  // the corpus grew, which is the opposite of its job.
  //
  // Values outside the window are clamped to the edge rather than dropped, so
  // the dot count still matches the corpus and nothing is hidden.
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))]!;
  const lo = sorted.length >= 20 ? at(0.05) : sorted[0]!;
  const hi = sorted.length >= 20 ? at(0.95) : sorted[sorted.length - 1]!;
  const span = hi - lo;
  const clampedLo = values.filter((v) => v < lo).length;
  const clampedHi = values.filter((v) => v > hi).length;

  // Every recipe identical on this ratio: a plot would be a single stack of
  // dots implying a spread that isn't there. Say so in words instead.
  if (span === 0) {
    return (
      <div className="py-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-ink-faint">
            all the same, {format(lo)}
          </span>
        </div>
      </div>
    );
  }

  const x = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));

  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs italic text-ink-faint">{hint}</span>
      </div>

      <div className="relative mt-4 mb-1 h-5">
        {/* the axis */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />

        {/* every other recipe */}
        {values.map((v, i) =>
          v === picked ? null : (
            <span
              key={`${v}-${i}`}
              className="absolute top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-faint/55"
              style={{ left: `${x(v)}%` }}
            />
          ),
        )}

        {/* the recommendation */}
        <span
          className="absolute top-1/2 block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-clay-deep ring-4 ring-clay/35"
          style={{ left: `${x(picked)}%` }}
        />
      </div>

      <div className="flex justify-between text-xs tabular-nums text-ink-faint">
        <span>
          {clampedLo > 0 && <span title={`${clampedLo} below`}>&lsaquo; </span>}
          {format(lo)}
        </span>
        <span className="font-semibold text-clay-deep">{format(picked)}</span>
        <span>
          {format(hi)}
          {clampedHi > 0 && <span title={`${clampedHi} above`}> &rsaquo;</span>}
        </span>
      </div>
    </div>
  );
}
