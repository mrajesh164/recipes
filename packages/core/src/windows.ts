/**
 * GENERATED. Re-make with:
 *   node --experimental-strip-types packages/corpus/src/measure-windows.ts
 *
 * The 10th to 90th percentile of each ratio, measured over the corpus, per
 * dish and overall. scoreTexture spreads its scores across these, so they are
 * a property of the data and not constants: when the corpus changes shape they
 * are wrong until they are measured again.
 */

export interface Window {
  /** How many recipes it was measured over. Drives how far it is trusted. */
  n: number;
  fat: readonly [number, number];
  sugar: readonly [number, number];
}

export const OVERALL_WINDOW: Window = {"n":1329,"fat":[0.31,1.5],"sugar":[0.29,2.64]};

export const DISH_WINDOWS: Readonly<Record<string, Window>> = {
  "muffin": {
    "n": 365,
    "fat": [
      0.24,
      0.68
    ],
    "sugar": [
      0.33,
      1.27
    ]
  },
  "brownie": {
    "n": 251,
    "fat": [
      0.76,
      2.84
    ],
    "sugar": [
      1.27,
      4.79
    ]
  },
  "chocolate chip": {
    "n": 183,
    "fat": [
      0.47,
      0.95
    ],
    "sugar": [
      0.76,
      1.42
    ]
  },
  "scone": {
    "n": 153,
    "fat": [
      0.12,
      0.57
    ],
    "sugar": [
      0.03,
      0.86
    ]
  },
  "banana bread": {
    "n": 110,
    "fat": [
      0.27,
      0.83
    ],
    "sugar": [
      0.45,
      1.62
    ]
  },
  "blondie": {
    "n": 85,
    "fat": [
      0.47,
      1.14
    ],
    "sugar": [
      1.11,
      2.37
    ]
  },
  "oatmeal": {
    "n": 77,
    "fat": [
      0.63,
      1.26
    ],
    "sugar": [
      0.98,
      2.08
    ]
  },
  "peanut butter": {
    "n": 55,
    "fat": [
      0.71,
      1.68
    ],
    "sugar": [
      0.98,
      1.78
    ]
  },
  "sugar": {
    "n": 38,
    "fat": [
      0.38,
      0.95
    ],
    "sugar": [
      0.62,
      1.65
    ]
  },
  "snickerdoodle": {
    "n": 10,
    "fat": [
      0.56,
      0.69
    ],
    "sugar": [
      0.9,
      1.2
    ]
  },
  "pumpkin bread": {
    "n": 2,
    "fat": [
      0.35,
      0.35
    ],
    "sugar": [
      0.84,
      0.84
    ]
  }
};

/**
 * What is typical for a kind, so the effort preferences can compare a recipe
 * against its own sort rather than against a cookie.
 */
export interface Effort {
  n: number;
  /** Median ingredient count. */
  ingredients: number;
  /** Median bake, in minutes. */
  bakeMinutes: number;
}

export const OVERALL_EFFORT: Effort = {"n":1329,"ingredients":12,"bakeMinutes":18};

export const DISH_EFFORT: Readonly<Record<string, Effort>> = {
  "muffin": {
    "n": 365,
    "ingredients": 13,
    "bakeMinutes": 20
  },
  "brownie": {
    "n": 251,
    "ingredients": 11,
    "bakeMinutes": 26
  },
  "chocolate chip": {
    "n": 183,
    "ingredients": 11,
    "bakeMinutes": 12
  },
  "scone": {
    "n": 153,
    "ingredients": 12,
    "bakeMinutes": 20
  },
  "banana bread": {
    "n": 110,
    "ingredients": 13,
    "bakeMinutes": 50
  },
  "blondie": {
    "n": 85,
    "ingredients": 10,
    "bakeMinutes": 27
  },
  "oatmeal": {
    "n": 77,
    "ingredients": 12,
    "bakeMinutes": 12
  },
  "peanut butter": {
    "n": 55,
    "ingredients": 11,
    "bakeMinutes": 10
  },
  "sugar": {
    "n": 38,
    "ingredients": 10,
    "bakeMinutes": 12
  },
  "snickerdoodle": {
    "n": 10,
    "ingredients": 12,
    "bakeMinutes": 12
  },
  "pumpkin bread": {
    "n": 2,
    "ingredients": 14,
    "bakeMinutes": 36
  }
};
