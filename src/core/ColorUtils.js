/**
 * Colour utilities for trip gradient rendering.
 *
 * SOLID notes:
 *  - SRP: pure colour math, no side-effects, no DOM/map references.
 *  - OCP: add or reorder palette colours by editing RECENCY_PALETTE only.
 */

/**
 * Discrete recency palette — index 0 is the most recent ride, index 5 is
 * the 6th-most-recent. Every ride older than that receives FALLBACK_COLOR.
 *
 * @type {string[]}
 */
const RECENCY_PALETTE = [
  '#5FC25E', // most recent  (1st)
  '#7BB37A', // 2nd most recent
  '#93A492', // 3rd
  '#A6A6A6', // 4th
  '#C2C2C2', // 5th
  '#D9D9D9', // 6th
];

/** Color used for any ride older than the palette covers. */
const FALLBACK_COLOR = '#D9D9D9';

/**
 * Assigns a `_color` property to each trip based on its recency rank.
 *
 * The newest trip receives `RECENCY_PALETTE[0]`, the previous trip receives
 * `RECENCY_PALETTE[1]`, and so on. Any trip beyond the palette length
 * receives `FALLBACK_COLOR`. A manual `trip.color` field takes precedence.
 *
 * @param {Object[]} trips - must be sorted by date ascending before calling
 */
export function assignTripColors(trips) {
  const total = trips.length;

  trips.forEach((trip, i) => {
    if (trip.color) {
      trip._color = trip.color;
      return;
    }
    // Rank 0 = newest (last in ascending-sorted array), rank 1 = previous, …
    const rank = total - 1 - i;
    trip._color = rank < RECENCY_PALETTE.length ? RECENCY_PALETTE[rank] : FALLBACK_COLOR;
  });
}
