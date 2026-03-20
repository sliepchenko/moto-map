/**
 * Geographical / geodesic utility functions.
 *
 * SOLID notes:
 *  - SRP: pure math, zero dependencies, no side-effects.
 */

/**
 * Returns the great-circle distance in kilometres between two lat/lng points
 * using the Haversine formula.
 *
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number} distance in km
 */
export function haversineKm(a, b) {
  const R       = 6371;
  const toRad   = deg => deg * Math.PI / 180;
  const dLat    = toRad(b.lat - a.lat);
  const dLng    = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Estimates the total route length of a trip by summing Haversine distances
 * between consecutive points. Uses `route` if present, otherwise `waypoints`.
 *
 * @param {{ route?: {lat:number,lng:number}[], waypoints: {lat:number,lng:number}[] }} trip
 * @returns {number} estimated distance in km
 */
export function estimateTripDistance(trip) {
  const pts = trip.route ?? trip.waypoints;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += haversineKm(pts[i], pts[i + 1]);
  }
  return total;
}
