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
  /** "oatmeal recipes", or just "recipes" when the pool is mixed. */
  poolNoun: string;
}

/**
 * A percentile as a whole sentence, counted in tenths.
 *
 * "79th percentile" and "on the high side" were both wrong, for opposite
 * reasons: the first asks for statistics, the second says nothing you can
 * check. "More than 8 in 10 oatmeal recipes" is what a person actually wants
 * and can hold in their head.
 *
 * The whole phrase is built here rather than a fragment glued after "more
 * than", because that construction produced "more than almost none recipes" at
 * the bottom of the range. A recipe with no brown sugar in it is not "more
 * than" anything; it is less than almost all of them, and the sentence has to
 * be able to say so.
 */
function positionPhrase(share: number, noun: string): string {
  if (share >= 95) return `more than almost all ${noun}`;
  if (share <= 5) return `less than almost all ${noun}`;
  if (share >= 45 && share <= 55) return `about average for ${noun}`;
  return share > 55
    ? `more than ${Math.round(share / 10)} in 10 ${noun}`
    : `less than ${Math.round((100 - share) / 10)} in 10 ${noun}`;
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
  poolNoun,
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

  const share = positionOf(values, picked);

  return (
    <div className="py-2.5">
      {/* The recipe's own value belongs to the label, not under the bar.
 
          It sat under the bar before and the two were read as one thing: for
          brown sugar the value is itself a percentage, 79% of the sugar, and
          the bar was filled to the percentile, 81%. Two unrelated quantities,
          near-identical numbers, stacked. "What does 79% mean" was the right
          question and the honest answer was "one of two things". Attaching the
          value to the name leaves the bar alone with the sentence that
          describes it. */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">
          {label}{" "}
          <span className="tabular-nums text-clay-deep">{format(picked)}</span>
        </span>
        <span className="text-xs italic text-ink-faint">{hint}</span>
      </div>

      <div
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-cream-deep"
        title={`Higher than ${share}% of them`}
      >
        <div
          className="h-full rounded-full bg-clay-deep"
          style={{ width: `${Math.max(2, share)}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-ink-soft">{positionPhrase(share, poolNoun)}</p>
    </div>
  );
}
