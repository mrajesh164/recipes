/**
 * Where one recipe sits among all the others, on one ratio.
 *
 * This is the picture from the proposal: the spread of what real recipes do,
 * with this one marked. It answers "why this one" in a glance instead of three
 * sentences, and it shows the thing the whole project is about, that recipes
 * disagree on purpose and the disagreement is a dial.
 *
 * It used to draw one dot per recipe on a single line. That was honest at
 * thirteen recipes and unreadable at 313: a dot is about 6px, the line is
 * about 400px, so two thirds of the corpus was drawn on top of itself and the
 * result was three grey smears. "The lines with dots can be confusing" was the
 * note, and the dots were not the problem, the overlap was.
 *
 * So the same data is binned now. A bar is a count of recipes in that slice of
 * the range, which is the thing the dots were trying and failing to show, and
 * it stays legible whether the corpus holds thirteen recipes or a thousand.
 *
 * Two deliberate choices kept from before:
 *
 * Everything is per gram of flour. Absolute grams of butter cannot be compared
 * across recipes making 24 and 60 cookies; per-flour can.
 *
 * The axis spans the 5th to 95th percentile, not 0 to max. A handful of
 * recipes parse badly, and an axis stretched to fit them squashes every real
 * recipe into the left third.
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

const BINS = 20;

export function RangePlot({ label, hint, values, picked, format }: RangePlotProps) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))]!;
  const lo = sorted.length >= 20 ? at(0.05) : sorted[0]!;
  const hi = sorted.length >= 20 ? at(0.95) : sorted[sorted.length - 1]!;
  const span = hi - lo;
  const clampedLo = values.filter((v) => v < lo).length;
  const clampedHi = values.filter((v) => v > hi).length;

  // Every recipe identical on this ratio: a chart would imply a spread that is
  // not there. Say so in words instead.
  if (span === 0) {
    return (
      <div className="py-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-ink-faint">all the same, {format(lo)}</span>
        </div>
      </div>
    );
  }

  // Out-of-window recipes are not binned into the end bars.
  //
  // My first version clamped them to the edges, which looked right and was
  // badly wrong: a handful of mis-parsed recipes landed in bin 0 and bin 19,
  // those two bars became the tallest by a distance, and every real bar was
  // scaled against them down to the 3px minimum. The result read as a dotted
  // line with two spikes rather than as a distribution. The chevrons beside
  // the axis labels already say how many sit outside, which is the honest
  // place for them.
  const binOf = (v: number) => Math.floor(((v - lo) / span) * BINS);
  const inWindow = (v: number) => v >= lo && v <= hi;

  const counts = new Array<number>(BINS).fill(0);
  for (const v of values) {
    if (!inWindow(v)) continue;
    counts[Math.min(BINS - 1, Math.max(0, binOf(v)))]! += 1;
  }
  const tallest = Math.max(...counts, 1);
  const pickedBin = inWindow(picked)
    ? Math.min(BINS - 1, Math.max(0, binOf(picked)))
    : null;

  // The sentence is the part that does not need decoding. A reader who has
  // never seen this chart before still knows what "more butter than 68% of
  // them" means, and the bars then show them the shape behind it.
  const below = values.filter((v) => v < picked).length;
  const share = Math.round((below / values.length) * 100);

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs italic text-ink-faint">{hint}</span>
      </div>

      {/* Bars sit on a baseline and grow up, so the shape of the corpus reads
          as a shape rather than as a line of overlapping marks. */}
      <div className="mt-3 flex h-8 items-end gap-px" aria-hidden>
        {counts.map((n, i) => (
          <span
            key={i}
            className={[
              "flex-1 rounded-sm",
              i === pickedBin ? "bg-clay-deep" : "bg-ink-faint/30",
            ].join(" ")}
            // A bin with recipes in it never renders as nothing: 3px minimum,
            // so "a few" and "none" do not look the same.
            style={{ height: n === 0 ? 1 : `${Math.max(4, (n / tallest) * 32)}px` }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between border-t border-line-soft pt-1.5 text-xs tabular-nums text-ink-faint">
        <span>
          {clampedLo > 0 && <span title={`${clampedLo} below the axis`}>&lsaquo; </span>}
          {format(lo)}
        </span>
        <span>
          {format(hi)}
          {clampedHi > 0 && <span title={`${clampedHi} above the axis`}> &rsaquo;</span>}
        </span>
      </div>

      <p className="mt-1.5 text-sm">
        <span className="font-bold tabular-nums text-clay-deep">{format(picked)}</span>
        <span className="text-ink-soft">
          {" "}
          &middot; more than {share}% of them
        </span>
      </p>
    </div>
  );
}
