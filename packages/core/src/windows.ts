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

export const OVERALL_WINDOW: Window = {"n":313,"fat":[0.54,1.26],"sugar":[0.83,1.78]};

export const DISH_WINDOWS: Readonly<Record<string, Window>> = {
  "chocolate chip": {
    "n": 156,
    "fat": [
      0.5,
      0.95
    ],
    "sugar": [
      0.79,
      1.42
    ]
  },
  "oatmeal": {
    "n": 71,
    "fat": [
      0.63,
      1.26
    ],
    "sugar": [
      0.98,
      2.17
    ]
  },
  "peanut butter": {
    "n": 46,
    "fat": [
      0.69,
      1.72
    ],
    "sugar": [
      0.98,
      1.78
    ]
  },
  "sugar": {
    "n": 30,
    "fat": [
      0.47,
      1
    ],
    "sugar": [
      0.58,
      1.66
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
  }
};
