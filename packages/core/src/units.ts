/**
 * Turning an ingredient line into grams.
 *
 * This is the one piece of the project where a bug is silent. A broken parser
 * does not throw -- it returns a plausible number, the comparison sorts on it,
 * and the app confidently recommends the wrong recipe. So every path either
 * produces a number it can justify or returns `grams: null`, and null means
 * "exclude this ingredient from the comparison", never "zero".
 *
 * Three real strings from the 14 Nov spike, which between them cover most of
 * what the corpus throws at this:
 *
 *   King Arthur      2/3 cup (142g) light brown sugar, packed
 *   Love and Lemons  ¾ cup unsalted butter (1½ sticks, melted and cooled slightly)
 *   Food.com         1/3  cup    butter, softened
 *
 * Note what each one needs. The first already states grams, so no density is
 * involved and nothing can go wrong. The second has a unicode fraction, a
 * parenthetical that restates the volume rather than giving a weight, and the
 * mixing method hiding in the ingredient line. The third has irregular
 * whitespace.
 *
 * Densities are King Arthur's published weights, because they are the
 * reference most American baking sites measure against.
 */

export type GramsSource = "stated" | "converted";
export type Confidence = "high" | "medium" | "low";

export interface ParsedIngredient {
  raw: string;
  canonicalName: string | null;
  grams: number | null;
  gramsSource: GramsSource | null;
  /** What to show a person, so the UI never re-parses `raw`. */
  displayQty: string | null;
  displayUnit: string | null;
  /** "melted", "softened", "packed" -- matters for texture, see methodHint. */
  note: string | null;
  confidence: Confidence;
}

// ---------------------------------------------------------------- fractions --

const VULGAR: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4",
  "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
  "⅓": "1/3", "⅔": "2/3",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

/**
 * `¾` is one character, not three. A parser that only understands "3/4"
 * does not crash on it -- it silently fails to find a quantity, which is
 * exactly the kind of quiet wrongness this module exists to avoid.
 *
 * A digit immediately followed by a vulgar fraction is a mixed number:
 * "1½" means one and a half, so it becomes "1 1/2" rather than "11/2".
 */
export function normalizeFractions(input: string): string {
  // Taste of Home writes mixed numbers with a hyphen: "1-1/2 cups butter",
  // "2-1/2 teaspoons ground cinnamon". Left alone, parseQuantity reads the
  // leading "1", the unit parser then finds "-1/2 cups" and gives up, and a
  // cup and a half of butter resolves to no weight at all. It was the single
  // biggest source of unresolved lines in the corpus.
  //
  // A fraction has to follow the hyphen for this to fire, so a range like
  // "10-12 minutes" or a "9-inch pan" is left alone.
  input = input.replace(/(\d)\s*-\s*(\d+\s*\/\s*\d+)/g, "$1 $2");

  // Some cards spell the mixed number with an ampersand: "1 & 1/2 teaspoons
  // vanilla extract". It reaches us as "1 &amp; 1/2" and is decoded upstream.
  input = input.replace(/(\d)\s*&\s*(\d+\s*\/\s*\d+)/g, "$1 $2");

  // A range takes its lower bound: "2 to 3 tablespoons milk" is recorded as
  // 2 tablespoons. The alternative is what used to happen -- the unit parser
  // met "to 3 tablespoons", found no unit, and the line resolved to nothing
  // at all. A bound that is honest about being the low end beats a blank.
  // Requires a digit on both sides, so "9-inch" and "1 1/2" are untouched.
  input = input.replace(/(\d+(?:\.\d+)?)\s*(?:to|-|\u2013|\u2014)\s*\d+(?:\.\d+)?(?=\s*[a-z(])/gi, "$1");

  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    const frac = VULGAR[ch];
    if (!frac) { out += ch; continue; }
    if (/\d$/.test(out)) out += " ";
    out += frac;
  }
  return out;
}

// -------------------------------------------------------------------- units --

/** Volume units, expressed in cups. */
const VOLUME_IN_CUPS: Record<string, number> = {
  cup: 1, cups: 1, c: 1,
  tablespoon: 1 / 16, tablespoons: 1 / 16, tbsp: 1 / 16, tbs: 1 / 16, tb: 1 / 16, T: 1 / 16,
  teaspoon: 1 / 48, teaspoons: 1 / 48, tsp: 1 / 48, ts: 1 / 48,
  "fluid ounce": 1 / 8, "fluid ounces": 1 / 8, "fl oz": 1 / 8,
  pint: 2, pints: 2, quart: 4, quarts: 4,
  // A pinch is conventionally 1/16 tsp and a dash 1/8. They contribute
  // almost no mass, but "pinch salt" was the single most common unresolved
  // line in the corpus and it is not actually unknowable.
  pinch: 1 / 768, dash: 1 / 384, splash: 1 / 48,
  milliliter: 1 / 236.588, milliliters: 1 / 236.588, ml: 1 / 236.588,
  liter: 4.22675, liters: 4.22675, l: 4.22675,
};

/** Weight units, expressed in grams. Nothing here needs a density. */
const WEIGHT_IN_GRAMS: Record<string, number> = {
  gram: 1, grams: 1, g: 1,
  kilogram: 1000, kilograms: 1000, kg: 1000,
  ounce: 28.3495, ounces: 28.3495, oz: 28.3495,
  pound: 453.592, pounds: 453.592, lb: 453.592, lbs: 453.592,
};

/** Grams per cup. King Arthur's published weights. */
const GRAMS_PER_CUP: Record<string, number> = {
  flour: 120, "bread flour": 120, "cake flour": 113, "whole wheat flour": 113,
  sugar: 198, "brown sugar": 213, "powdered sugar": 113,
  butter: 227, shortening: 191, oil: 198,
  milk: 227, buttermilk: 227, water: 227, cream: 227, "sour cream": 227, yogurt: 227,
  "cocoa powder": 84, "chocolate chips": 170, oats: 89, cornstarch: 113,
  honey: 340, molasses: 340, "maple syrup": 312, "peanut butter": 270,
  nuts: 113, raisins: 150,
  // Added when the corpus widened past chocolate chip. Oatmeal and sugar
  // cookies bring a different pantry with them.
  "corn syrup": 312, coconut: 85, "butterscotch chips": 170, "toffee bits": 150,
  // Same as the other baking chips.
  "peanut butter chips": 170,
  // Not from King Arthur, who do not publish it: derived from a Biscoff jar's
  // net weight against its volume, so treat it as the least certain number in
  // this table. It only has to be closer than butter's 227, which is what it
  // was being converted at.
  "cookie butter": 250,
  // Margarine is sold as a butter replacement and is packed to the same
  // volume, so it converts at butter's density. It is not excluded the way a
  // vegan butter substitute is: it is still a solid fat creamed the same way.
  margarine: 227,
  // Not milk's 227. Condensed milk is milk with the water boiled off and
  // sugar added, and reading it as milk understates it by a third.
  "condensed milk": 306, "evaporated milk": 252,
  "cream cheese": 227,
  "dried fruit": 113, "corn flakes": 28, oreos: 100,
};

/**
 * Things measured in spoons rather than cups. Converting these through
 * grams-per-cup works arithmetically but the densities differ enough at
 * teaspoon scale to be worth stating directly.
 */
const GRAMS_PER_TSP: Record<string, number> = {
  "baking soda": 6, "baking powder": 4,
  salt: 6, "kosher salt": 5,
  "vanilla extract": 4, cinnamon: 2.6, yeast: 3, vinegar: 5,
  "espresso powder": 2,
  // Snickerdoodles and sugar cookies are mostly why the corpus widened, and
  // both are built on cream of tartar.
  "cream of tartar": 3,
  "almond extract": 4,
  nutmeg: 2.2, cloves: 2.1, ginger: 1.8, allspice: 2, cardamom: 2,
  "pumpkin pie spice": 2.3,
};

/** Items counted rather than measured. Grams per one. */
const GRAMS_EACH: Record<string, number> = {
  egg: 50, "egg yolk": 18, "egg white": 32,
};

// ------------------------------------------------------------- ingredients --

/**
 * Ordered most specific first, because "brown sugar" must win over "sugar"
 * and "egg yolk" over "egg". A plain object would not guarantee that.
 */
const CANONICAL: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bbrown sugar\b/, "brown sugar"],
  [/\b(confectioner'?s'?|powdered|icing) sugar\b/, "powdered sugar"],
  [/\b(granulated|white|caster)? ?sugar\b/, "sugar"],
  [/\bbread flour\b/, "bread flour"],
  [/\bcake flour\b/, "cake flour"],
  [/\bwhole ?wheat flour\b/, "whole wheat flour"],
  [/\b(all[- ]purpose|plain)? ?flour\b/, "flour"],
  [/\begg yolks?\b/, "egg yolk"],
  [/\begg whites?\b/, "egg white"],
  [/\beggs?\b/, "egg"],
  [/\bbaking soda\b|\bbicarbonate of soda\b/, "baking soda"],
  [/\bbaking powder\b/, "baking powder"],
  [/\bkosher salt\b/, "kosher salt"],
  [/\bsalt\b/, "salt"],
  [/\bvanilla\b/, "vanilla extract"],
  // Before the nut rule below, which otherwise reads this as 113g/cup of
  // almonds and returns a confident, wrong number for a teaspoon of extract.
  [/\balmond extract\b/, "almond extract"],
  [/\bvinegar\b/, "vinegar"],
  [/\bespresso powder\b|\binstant (coffee|espresso)\b/, "espresso powder"],
  [/\bchocolate (chips?|chunks?|morsels?)\b/, "chocolate chips"],
  // Chopped chocolate, which a bar is sold as and a recipe calls for by
  // volume as often as by weight. Same density as chips.
  [/\b(white|semi-?sweet|bittersweet|dark|milk) chocolate\b/, "chocolate chips"],
  [/\bcocoa\b/, "cocoa powder"],
  [/\b(vegetable |canola |rapeseed )?shortening\b/, "shortening"],
  // Inclusions that happen to have "peanut butter" in their name. Half a cup
  // of peanut butter chips, or of M&Ms, or of chopped peanut butter cups, is
  // candy -- mostly sugar and a chocolate shell. Read as peanut butter they
  // came to 135 g each, and one recipe with all three of them claimed three
  // times its own weight in fat.
  [/\bpeanut butter (chips?|morsels?|baking chips?)\b/, "peanut butter chips"],
  [/\bpeanut butter (m\s?&\s?m'?s?|cups?)\b/, "chocolate chips"],
  // Cookie butter is Biscoff: biscuit crumb and sugar with some oil in it,
  // not a solid fat. The \bbutter\b rule below read it as 113 g of butter,
  // which doubled one recipe's butter and put it top of the outlier list.
  [/\b(cookie butter|biscoff|speculoos)\b/, "cookie butter"],
  [/\bpeanut butter\b/, "peanut butter"],
  [/\bbutter\b/, "butter"],
  [/\b(vegetable|canola|olive|sunflower) oil\b|\boil\b/, "oil"],
  [/\bbuttermilk\b/, "buttermilk"],
  [/\bsour cream\b/, "sour cream"],
  // Before the cream rule. "Cream of tartar" is a powdered acid, not a
  // dairy product: matched as cream it converted at 227g per cup and a
  // teaspoon came out at 4.7g instead of 3g. Nothing threw -- it just
  // quietly reported the wrong weight, which is the failure this module
  // exists to prevent.
  [/\bcream of tartar\b/, "cream of tartar"],
  [/\bcream cheese\b/, "cream cheese"],
  [/\b(heavy |double |whipping )?cream\b/, "cream"],
  [/\byogh?urt\b/, "yogurt"],
  // Both before the plain milk rule, for the same reason as cream of tartar.
  [/\b(sweetened )?condensed milk\b/, "condensed milk"],
  [/\bevaporated milk\b/, "evaporated milk"],
  [/\bmilk\b/, "milk"],
  [/\b(rolled |old[- ]fashioned )?oats\b/, "oats"],
  [/\bcorn ?starch\b/, "cornstarch"],
  [/\bhoney\b/, "honey"],
  [/\bmolasses\b/, "molasses"],
  [/\bmaple syrup\b/, "maple syrup"],
  [/\bcinnamon\b/, "cinnamon"],
  [/\bnutmeg\b/, "nutmeg"],
  [/\bcloves?\b/, "cloves"],
  [/\ballspice\b/, "allspice"],
  [/\bcardamom\b/, "cardamom"],
  [/\bpumpkin pie spice\b/, "pumpkin pie spice"],
  [/\b(ground |fresh |grated )?ginger\b/, "ginger"],
  [/\byeast\b/, "yeast"],
  [/\b(walnuts?|pecans?|almonds?|hazelnuts?|peanuts?|cashews?|macadamias?|pistachios?|nuts)\b/, "nuts"],
  [/\bdried (cranberries|cherries|blueberries|apricots|dates)\b/, "dried fruit"],
  [/\bcorn ?flakes\b/, "corn flakes"],
  [/\braisins?\b/, "raisins"],
  [/\bbutterscotch chips\b/, "butterscotch chips"],
  [/\btoffee (bits|pieces)\b/, "toffee bits"],
  [/\bcoconut\b/, "coconut"],
  [/\bcorn syrup\b/, "corn syrup"],
  [/\bmargarine\b/, "margarine"],
  [/\bwater\b/, "water"],
];

const NOTES = [
  "melted and cooled", "melted", "softened", "room temperature",
  "packed", "chilled", "cold", "browned", "sifted", "beaten",
] as const;

// ------------------------------------------------------------------ parsing --

/**
 * Numbers that arrive as words. "one 3.5-ounce packet instant vanilla
 * pudding mix" is a real line, and so is "two large eggs".
 */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  a: 1, an: 1, half: 0.5,
};

/** "1 1/2" -> 1.5, "3/4" -> 0.75, "2" -> 2, "1.5" -> 1.5, "one" -> 1 */
function parseQuantity(text: string): { value: number; display: string } | null {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) {
    const [, w, n, d] = mixed;
    return { value: Number(w) + Number(n) / Number(d), display: `${w} ${n}/${d}` };
  }
  const frac = text.match(/^(\d+)\/(\d+)/);
  if (frac) {
    const [, n, d] = frac;
    return { value: Number(n) / Number(d), display: `${n}/${d}` };
  }
  const dec = text.match(/^(\d+(?:\.\d+)?)/);
  if (dec) return { value: Number(dec[1]), display: dec[1]! };

  // "a" and "an" are only a quantity in front of a unit ("a cup of flour"),
  // never on their own, or "almond extract" would start with a quantity.
  const word = text.match(/^([a-z]+)\b/i);
  if (word) {
    const w = word[1]!.toLowerCase();
    const value = WORD_NUMBERS[w];
    if (value !== undefined && !((w === "a" || w === "an") && !/^(a|an)\s+\w/i.test(text))) {
      return { value, display: word[1]! };
    }
  }
  return null;
}

/** Longest unit name first, so "fluid ounce" is not read as "ounce". */
const UNIT_NAMES = [...Object.keys(VOLUME_IN_CUPS), ...Object.keys(WEIGHT_IN_GRAMS)]
  .sort((a, b) => b.length - a.length);

function parseUnit(text: string): { unit: string; rest: string } | null {
  for (const name of UNIT_NAMES) {
    const re = new RegExp(`^${name.replace(/ /g, "\\s+")}s?\\.?\\b`, "i");
    const m = text.match(re);
    if (m) return { unit: name, rest: text.slice(m[0].length).trim() };
  }
  return null;
}

/**
 * Words that sit between the quantity and the unit and mean nothing to a
 * converter: "1 heaping cup", "2 scant tablespoons", "1 firmly packed cup".
 * Leaving them in means the unit parser looks at "heaping" and gives up, so
 * the ingredient silently resolves to no weight at all.
 *
 * They are only skipped for unit-finding. noteFor() still reads the whole
 * line, so "packed" is still recorded as a note.
 */
const FILLER = /^(heaping|heaped|scant|rounded|level|generous|firmly|lightly|loosely|tightly|packed|large|small|medium|big)\s+/i;

function stripFiller(text: string): string {
  let out = text.trim();
  for (;;) {
    const next = out.replace(FILLER, "");
    if (next === out) return out;
    out = next;
  }
}

function canonicalFor(text: string): string | null {
  for (const [re, name] of CANONICAL) if (re.test(text)) return name;
  return null;
}

function noteFor(text: string): string | null {
  for (const n of NOTES) if (text.includes(n)) return n;
  return null;
}

/**
 * A gram weight the source already gave us, e.g. "2/3 cup (142g)".
 *
 * Deliberately strict about the shape: it must be digits followed by a gram
 * unit inside parentheses. "(1½ sticks, melted and cooled slightly)" restates
 * the volume and must not match, or butter comes out at 1 gram.
 */
function statedGrams(text: string): number | null {
  const m = text.match(/\(\s*(\d+(?:\.\d+)?)\s*(?:g|gr|gram|grams)\b/i);
  if (m) return Number(m[1]);

  // American brands state the package, not the measure: "1 package (8 ounces)
  // cream cheese", "1 bag (12 ounces) semisweet chocolate chips". The weight
  // is right there and needs no density.
  //
  // Not when the line says "each", though: "4 cans (15-1/4 ounces each)" is
  // four times that, and reading the parenthetical as the total would be
  // confidently, silently light -- the exact failure this module is built to
  // avoid. Better to resolve nothing.
  if (/\beach\b/i.test(text)) return null;
  const oz = text.match(/\(\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(?:oz|ounces?)\b/i);
  if (oz) {
    const q = parseQuantity(oz[1]!.trim());
    if (q) return round(q.value * 28.3495);
  }
  return null;
}

export function parseIngredient(raw: string): ParsedIngredient {
  const base: ParsedIngredient = {
    raw,
    canonicalName: null, grams: null, gramsSource: null,
    displayQty: null, displayUnit: null, note: null, confidence: "low",
  };

  const text = normalizeFractions(raw).replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  const canonicalName = canonicalFor(lower);
  const note = noteFor(lower);

  // 1. The source stated a weight. Nothing to get wrong, so trust it over
  //    anything we could compute ourselves.
  const stated = statedGrams(text);

  // 2. Quantity and unit off the front of the line.
  const qty = parseQuantity(text);
  const afterQty = qty ? text.slice(text.indexOf(qty.display) + qty.display.length).trim() : text;
  const unitMatch = parseUnit(stripFiller(afterQty));

  if (stated !== null) {
    return {
      ...base, canonicalName, note,
      grams: stated, gramsSource: "stated",
      displayQty: qty?.display ?? null,
      displayUnit: unitMatch?.unit ?? null,
      confidence: "high",
    };
  }

  // "pinch salt", "splash of vanilla extract": a line that opens with a unit
  // has an implied quantity of one. Safe because parseUnit anchors on a word
  // boundary, so "Toffee bits" is not read as a tablespoon of anything.
  if (!qty) {
    const leading = parseUnit(stripFiller(text));
    if (leading && canonicalName) {
      const cups = VOLUME_IN_CUPS[leading.unit];
      const perTsp = GRAMS_PER_TSP[canonicalName];
      const perCup = GRAMS_PER_CUP[canonicalName];
      if (cups !== undefined && (perTsp !== undefined || perCup !== undefined)) {
        const grams = perTsp !== undefined ? cups * 48 * perTsp : cups * perCup!;
        return {
          ...base, canonicalName, note,
          grams: round(grams), gramsSource: "converted",
          displayQty: "1", displayUnit: leading.unit, confidence: "medium",
        };
      }
    }
    return { ...base, canonicalName, note };
  }

  // 3. A weight unit needs no density either.
  if (unitMatch && unitMatch.unit in WEIGHT_IN_GRAMS) {
    return {
      ...base, canonicalName, note,
      grams: round(qty.value * WEIGHT_IN_GRAMS[unitMatch.unit]!),
      gramsSource: "stated",
      displayQty: qty.display, displayUnit: unitMatch.unit,
      confidence: "high",
    };
  }

  // 4. "1 stick butter" -- a unit that only means anything for butter.
  if (/^sticks?\b/i.test(stripFiller(afterQty)) && canonicalName === "butter") {
    return {
      ...base, canonicalName, note,
      grams: round(qty.value * 113.4), gramsSource: "converted",
      displayQty: qty.display, displayUnit: "stick",
      confidence: "high",
    };
  }

  // 5. A volume, which needs a density -- so it needs to know what this is.
  if (unitMatch && unitMatch.unit in VOLUME_IN_CUPS && canonicalName) {
    const cups = qty.value * VOLUME_IN_CUPS[unitMatch.unit]!;
    const perTsp = GRAMS_PER_TSP[canonicalName];
    const perCup = GRAMS_PER_CUP[canonicalName];

    if (perTsp !== undefined) {
      return {
        ...base, canonicalName, note,
        grams: round(cups * 48 * perTsp), gramsSource: "converted",
        displayQty: qty.display, displayUnit: unitMatch.unit,
        // Kosher salt is two different densities depending on the brand, and
        // recipes almost never say which.
        confidence: canonicalName === "kosher salt" ? "medium" : "high",
      };
    }
    if (perCup !== undefined) {
      return {
        ...base, canonicalName, note,
        grams: round(cups * perCup), gramsSource: "converted",
        displayQty: qty.display, displayUnit: unitMatch.unit,
        confidence: "high",
      };
    }
    // A quantity and a unit but no density: show it, do not invent a weight.
    return {
      ...base, canonicalName, note,
      displayQty: qty.display, displayUnit: unitMatch.unit, confidence: "low",
    };
  }

  // 6. Counted, not measured: "2 large eggs".
  if (!unitMatch && canonicalName && canonicalName in GRAMS_EACH) {
    return {
      ...base, canonicalName, note,
      grams: round(qty.value * GRAMS_EACH[canonicalName]!),
      gramsSource: "converted",
      displayQty: qty.display, displayUnit: null,
      confidence: "medium",
    };
  }

  return {
    ...base, canonicalName, note,
    displayQty: qty.display, displayUnit: unitMatch?.unit ?? null,
    confidence: "low",
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Which mixing method an ingredient line implies, if any.
 *
 * Melted butter skips the aeration that creaming produces and lets water reach
 * the flour, developing more gluten -- which is most of the difference between
 * a chewy cookie and a cakey one. Love and Lemons writes it straight into the
 * ingredient line, so it can be had without parsing instructions at all.
 */
export function methodHint(parsed: ParsedIngredient): "melted" | "creamed" | null {
  if (parsed.canonicalName !== "butter" || !parsed.note) return null;
  if (parsed.note.startsWith("melted")) return "melted";
  if (parsed.note === "softened" || parsed.note === "room temperature") return "creamed";
  return null;
}
