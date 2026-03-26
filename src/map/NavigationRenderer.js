/**
 * Draws the active navigation route on the map:
 *  - A prominent blue-green polyline along the calculated route.
 *  - A pulsing blue dot for the user's live GPS position.
 *  - A destination pin marker.
 *
 * Keeps all map objects in private fields so `clear()` is always clean.
 *
 * SOLID notes:
 *  - SRP: only draws; no routing or location logic.
 */
export class NavigationRenderer {
  /** @type {google.maps.Map} */
  #map;

  /** @type {google.maps.Polyline|null} */
  #routePolyline = null;

  /** @type {google.maps.Marker|null} */
  #positionMarker = null;

  /** @type {google.maps.Marker|null} */
  #destinationMarker = null;

  /** @type {google.maps.Circle|null} */
  #accuracyCircle = null;

  /**
   * @param {google.maps.Map} map
   */
  constructor(map) {
    this.#map = map;
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Draws the route polyline and destination marker.
   *
   * @param {Array<{lat: number, lng: number}>} path
   * @param {{ lat: number, lng: number }}      destination
   */
  drawRoute(path, destination) {
    // Remove existing route polyline
    this.#routePolyline?.setMap(null);

    this.#routePolyline = new google.maps.Polyline({
      map:           this.#map,
      path:          path.map(p => new google.maps.LatLng(p.lat, p.lng)),
      geodesic:      true,
      strokeColor:   '#06b6d4',   // cyan — visually distinct from trip green (#22c55e) and plan blue (#3b82f6)
      strokeOpacity: 0.95,
      strokeWeight:  7,
      zIndex:        150,
    });

    // Destination marker
    this.#destinationMarker?.setMap(null);
    this.#destinationMarker = new google.maps.Marker({
      position: destination,
      map:      this.#map,
      title:    'Destination',
      icon: {
        path:         google.maps.SymbolPath.CIRCLE,
        scale:        12,
        fillColor:    '#ef4444',
        fillOpacity:  1,
        strokeColor:  '#ffffff',
        strokeWeight: 3,
      },
      zIndex: 300,
    });
  }

  /**
   * Updates (or creates) the live GPS position marker and accuracy circle.
   *
   * @param {{ lat: number, lng: number, accuracy: number }} position
   */
  updatePosition(position) {
    const latLng = new google.maps.LatLng(position.lat, position.lng);

    if (!this.#positionMarker) {
      this.#positionMarker = new google.maps.Marker({
        position: latLng,
        map:      this.#map,
        title:    'Your location',
        icon: {
          path:         google.maps.SymbolPath.CIRCLE,
          scale:        10,
          fillColor:    '#06b6d4',
          fillOpacity:  1,
          strokeColor:  '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 400,
      });
    } else {
      this.#positionMarker.setPosition(latLng);
    }

    // Accuracy circle
    if (!this.#accuracyCircle) {
      this.#accuracyCircle = new google.maps.Circle({
        map:           this.#map,
        center:        latLng,
        radius:        position.accuracy,
        strokeColor:   '#06b6d4',
        strokeOpacity: 0.3,
        strokeWeight:  1,
        fillColor:     '#06b6d4',
        fillOpacity:   0.08,
        zIndex:        100,
      });
    } else {
      this.#accuracyCircle.setCenter(latLng);
      this.#accuracyCircle.setRadius(position.accuracy);
    }
  }

  /**
   * Removes the live position marker only (route and dest pin remain visible).
   * Call this when GPS is lost.
   */
  clearPosition() {
    this.#positionMarker?.setMap(null);
    this.#positionMarker = null;
    this.#accuracyCircle?.setMap(null);
    this.#accuracyCircle = null;
  }

  /** Removes all navigation map objects. */
  clear() {
    this.#routePolyline?.setMap(null);
    this.#routePolyline = null;
    this.clearPosition();
    this.#destinationMarker?.setMap(null);
    this.#destinationMarker = null;
  }
}
