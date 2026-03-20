/**
 * Colour utilities for trip gradient rendering.
 *
 * SOLID notes:
 *  - SRP: pure colour math, no side-effects, no DOM/map references.
 *  - OCP: add more colour stops by extending COLOR_STOPS only.
 */

/**
 * Three-stop gradient used for trip age colouring.
 * oldest → gray-green, middle → dark green, newest → bright green.
 * @type {{ r: number, g: number, b: number }[]}
 */
const COLOR_STOPS = [
  { r: 107, g: 124, b: 110 }, // #6b7c6e — gray-green  (oldest)
  { r:  22, g: 101, b:  52 }, // #166534 — dark green  (middle)
  { r:  34, g: 197, b:  94 }, // #22c55e — bright green (newest)
];

/**
 * Interpolates a CSS hex colour across {@link COLOR_STOPS} based on a
 * normalised position `t ∈ [0, 1]`.
 *
 * @param {number} t - normalised position; 0 = oldest, 1 = newest
 * @returns {string} hex colour string, e.g. `'#3a8f5c'`
 */
export function lerpColor(t) {
  const segments = COLOR_STOPS.length - 1;
  const scaled   = Math.min(t * segments, segments - 1e-10);
  const idx      = Math.floor(scaled);
  const u        = scaled - idx;

  const a = COLOR_STOPS[idx];
  const b = COLOR_STOPS[idx + 1];

  const r  = Math.round(a.r + (b.r - a.r) * u);
  const g  = Math.round(a.g + (b.g - a.g) * u);
  const bv = Math.round(a.b + (b.b - a.b) * u);

  return '#' + [r, g, bv].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Assigns a `_color` property to each trip based on its date using the
 * three-stop gradient. A manual `trip.color` field takes precedence.
 *
 * @param {Object[]} trips - must be sorted by date ascending before calling
 */
export function assignTripColors(trips) {
  const timestamps = trips.map(t => new Date(t.date).getTime());
  const min   = Math.min(...timestamps);
  const max   = Math.max(...timestamps);
  const range = max - min;

  trips.forEach((trip, i) => {
    trip._color = trip.color
      ? trip.color
      : lerpColor(range === 0 ? 0 : (timestamps[i] - min) / range);
  });
}
