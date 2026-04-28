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
 * Returns the total road distance of a trip in kilometres.
 *
 * Prefer `trip.roadDistanceKm` when it is available — this is the accurate
 * value obtained from the Google Directions API at the time the route was
 * saved and reflects the actual road geometry.
 *
 * Falls back to summing Haversine (straight-line) distances between
 * consecutive waypoints for older trips that were saved before this field
 * was introduced.  The Haversine result will always be shorter than the
 * real road distance because it ignores road curvature.
 *
 * @param {{ waypoints: {lat:number,lng:number}[], roadDistanceKm?: number|null }} trip
 * @returns {number} distance in km
 */
export function estimateTripDistance(trip) {
  if (trip.roadDistanceKm != null && trip.roadDistanceKm > 0) {
    return trip.roadDistanceKm;
  }

  // Legacy fallback: straight-line sum of waypoint-to-waypoint segments.
  const pts = trip.waypoints;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += haversineKm(pts[i], pts[i + 1]);
  }
  return total;
}

/**
 * Estimates the riding duration of a trip based on straight-line distance and
 * an assumed average speed. Returns a human-readable string like "1 h 23 min"
 * or "45 min".
 *
 * The assumed average speed accounts for stops, corners, and mixed roads.
 *
 * @param {{ waypoints: {lat:number,lng:number}[] }} trip
 * @param {number} [avgSpeedKph=50] — assumed average riding speed in km/h
 * @returns {string} formatted duration string
 */
export function estimateTripDuration(trip, avgSpeedKph = 50) {
  const km      = estimateTripDistance(trip);
  const totalMin = Math.round((km / avgSpeedKph) * 60);
  const h   = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min} min`;
  if (min === 0) return `${h} h`;
  return `${h} h ${min} min`;
}
