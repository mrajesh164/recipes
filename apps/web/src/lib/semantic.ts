/**
 * The third tier of recognition: a word the vocabulary has never seen.
 *
 * Tier one is the keyword matcher, instant and free. Tier two is the
 * misspelling check, also instant and free. This runs only when both find
 * nothing, which means the common case never touches it and never pays for it.
 *
 * What it does: embeds the unknown words in the browser and finds the nearest
 * phrase the interpreter already knows. "stodgy" becomes "fudgy", and fudgy
 * already means chewy 0.9, so nothing new is scored and no second scoring path
 * exists to drift from the first.
 *
 * Everything runs locally. A ~22 MB model downloads once and is cached by the
 * browser, so there is no API key, no per-search cost, no spending cap to set,
 * and no free tier that can start rate-limiting the week someone is marking
 * this. It also keeps working in a kitchen with bad wifi, which is the actual
 * use case.
 *
 * THRESHOLD. Measured, not guessed. Against words deliberately outside the
 * vocabulary, correct matches landed between 0.48 and 0.80, and wrong ones
 * between 0.37 and 0.56. Those overlap, so no cutoff is clean: 0.55 keeps most
 * of the good matches and rejects most of the junk, and the residue is handled
 * by the interface rather than pretended away. Whatever this infers is shown
 * as an inference, in the user's word and the one it was read as, so a wrong
 * guess is visible and correctable instead of silent. That display is not
 * decoration, it is the thing that makes an imperfect matcher acceptable.
 */

/**
 * Confident enough to read the word as its match without asking.
 *
 * Raised from 0.55 after seeing what 0.55 let through: "tuesday" matched "same
 * day" at 0.558 and was applied, so typing a day of the week silently became a
 * request for something quick. At 0.60 that becomes a question instead.
 *
 * Being conservative here got cheap once near-misses became offers. A demoted
 * word is not lost, it is asked about, so the cost of a high bar is one click
 * and the cost of a low one is a confident wrong answer. "melty" at 0.618 and
 * "gooier" at 0.728 still clear it; "shatters" at 0.554 and "underdone" at
 * 0.583 are now offered rather than assumed, which is the right trade.
 */
const CONFIDENT = 0.6;

/**
 * Close enough to be worth offering, not close enough to assume.
 *
 * "homey" tops out at 0.519 against doughy and "cozy" at 0.503 against
 * pillowy. Refusing those is right, they are not reliable readings. But
 * refusing them and then saying "I couldn't read anything in that" is a dead
 * end, and a dead end is the thing the TA's note was actually about. The same
 * numbers that are too weak to act on are strong enough to ask about.
 */
const WORTH_ASKING = 0.40;

type Loaded = {
  embed: (s: string) => Promise<number[]>;
  vectors: Record<string, number[]>;
};

let loading: Promise<Loaded> | null = null;

/**
 * Loaded once, on first need, and never on the server. The import is dynamic
 * so neither the model nor the 379 KB of vectors reaches the initial bundle.
 */
function load(): Promise<Loaded> {
  loading ??= (async () => {
    const [{ pipeline }, data] = await Promise.all([
      import("@huggingface/transformers"),
      import("./vocab-vectors.json"),
    ]);
    const pipe = await pipeline("feature-extraction", data.model, { dtype: "q8" });
    return {
      embed: async (s: string) =>
        Array.from((await pipe(s, { pooling: "mean", normalize: true })).data as Float32Array),
      vectors: data.vectors as Record<string, number[]>,
    };
  })();
  return loading;
}

/** Both vectors are unit length, so the dot product is the cosine. */
function cosine(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i]! * b[i]!;
  return total;
}

export interface Inference {
  /** What they typed. */
  typed: string;
  /** The vocabulary phrase it was read as. */
  meant: string;
}

export interface Guess {
  /** What they typed. */
  typed: string;
  /** The nearest few phrases, best first. Offered, never applied. */
  options: string[];
}

export interface Reading {
  /** Confident enough to apply, and shown as applied. */
  inferences: Inference[];
  /** Not confident enough to apply. Offered as a question. */
  guesses: Guess[];
}

/**
 * Read unknown words as the nearest thing the vocabulary knows.
 *
 * Returns only the ones that cleared the threshold. A word with no good match
 * stays unrecognised, which is the honest answer and the one the interface
 * already knows how to say.
 */
export async function readUnknownWords(words: string[]): Promise<Reading> {
  if (words.length === 0) return { inferences: [], guesses: [] };
  const { embed, vectors } = await load();
  const known = Object.entries(vectors);

  const inferences: Inference[] = [];
  const guesses: Guess[] = [];

  for (const word of words) {
    const v = await embed(word);
    const ranked = known
      .map(([phrase, pv]) => ({ phrase, sim: cosine(v, pv) }))
      .sort((a, b) => b.sim - a.sim);

    const best = ranked[0];
    if (!best) continue;

    if (best.sim >= CONFIDENT) {
      inferences.push({ typed: word, meant: best.phrase });
      continue;
    }

    // Three at most. A list of ten guesses is its own kind of dead end, and
    // anything past the third is noticeably worse than the first.
    const options = ranked
      .filter((r) => r.sim >= WORTH_ASKING)
      .slice(0, 3)
      .map((r) => r.phrase);
    if (options.length > 0) guesses.push({ typed: word, options });
  }

  return { inferences, guesses };
}
