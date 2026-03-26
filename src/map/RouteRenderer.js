/**
 * Renders a user-planned route on the map using Google Maps DirectionsService.
 *
 * Draws a single polyline connecting all waypoints via road-following directions,
 * plus numbered markers for each stop.  Supports full route replacement and clearing.
 *
 * SOLID notes:
 *  - SRP: only responsible for drawing / clearing one planned route.
 *  - OCP: swap routing back-end by overriding `#routeSegment`.
 */
export class RouteRenderer {
  /** @type {google.maps.Map} */
  #map;

  /** @type {google.maps.Polyline|null} */
  #polyline = null;

  /** @type {google.maps.Marker[]} */
  #markers = [];

  /** @type {{ current: google.maps.InfoWindow|null }} */
  #openInfoWindow;

  /** @type {boolean} */
  #avoidHighways = false;

  /** @type {boolean} */
  #avoidTolls = false;

  /** @type {boolean} */
  #avoidFerries = false;

  /**
   * @param {google.maps.Map}                          map
   * @param {{ current: google.maps.InfoWindow|null }} openInfoWindow
   */
  constructor(map, openInfoWindow) {
    this.#map            = map;
    this.#openInfoWindow = openInfoWindow;
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Draws a road-following route through `waypoints` and returns a summary.
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints
   * @returns {Promise<{distanceKm: number, durationMin: number, legs: object[]}>}
   */
  async render(waypoints) {
    this.clear();

    const ROUTE_COLOR   = '#3b82f6';  // blue — distinct from trip green
    const ROUTE_WEIGHT  = 5;

    const path = new google.maps.MVCArray();
    this.#polyline = new google.maps.Polyline({
      map:           this.#map,
      path,
      geodesic:      true,
      strokeColor:   ROUTE_COLOR,
      strokeOpacity: 0.9,
      strokeWeight:  ROUTE_WEIGHT,
    });

    // Place numbered markers immediately so the user sees feedback
    this.#markers = this.#placeMarkers(waypoints, ROUTE_COLOR);

    // Build road-following route; accumulate summary stats
    const summary = { distanceKm: 0, durationMin: 0, legs: [], routePath: [] };

    for (let i = 0; i < waypoints.length - 1; i++) {
      const origin      = new google.maps.LatLng(waypoints[i].lat,     waypoints[i].lng);
      const destination = new google.maps.LatLng(waypoints[i + 1].lat, waypoints[i + 1].lng);

      const { result, status } = await this.#routeSegment(origin, destination);

      if (status === google.maps.DirectionsStatus.OK) {
        const leg = result.routes[0].legs[0];
        summary.distanceKm  += (leg.distance?.value ?? 0) / 1000;
        summary.durationMin += (leg.duration?.value ?? 0) / 60;
        summary.legs.push({ distance: leg.distance?.text, duration: leg.duration?.text });
        result.routes[0].overview_path.forEach(pt => {
          path.push(pt);
          summary.routePath.push({ lat: pt.lat(), lng: pt.lng() });
        });
      } else {
        // Straight-line fallback
        path.push(origin);
        path.push(destination);
        summary.routePath.push({ lat: waypoints[i].lat, lng: waypoints[i].lng });
        summary.routePath.push({ lat: waypoints[i + 1].lat, lng: waypoints[i + 1].lng });
        summary.legs.push({ distance: '?', duration: '?' });
        console.warn(`RouteRenderer: directions failed (${status}) for segment ${i}→${i + 1}.`);
      }
    }

    // Fit viewport to the planned route
    const bounds = new google.maps.LatLngBounds();
    waypoints.forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }));
    this.#map.fitBounds(bounds);

    return summary;
  }

  /** Removes all polylines and markers from the map. */
  clear() {
    this.#polyline?.setMap(null);
    this.#polyline = null;
    this.#markers.forEach(m => m.setMap(null));
    this.#markers = [];
  }

  /**
   * Sets road-type avoidance flags used for future route renders.
   * @param {{ avoidHighways?: boolean, avoidTolls?: boolean, avoidFerries?: boolean }} options
   */
  setAvoidOptions({ avoidHighways, avoidTolls, avoidFerries }) {
    if (avoidHighways !== undefined) this.#avoidHighways = avoidHighways;
    if (avoidTolls    !== undefined) this.#avoidTolls    = avoidTolls;
    if (avoidFerries  !== undefined) this.#avoidFerries  = avoidFerries;
  }

  // ── private ──────────────────────────────────────────────────────────────

  /**
   * Places numbered markers at each waypoint.
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints
   * @param {string} color
   * @returns {google.maps.Marker[]}
   */
  #placeMarkers(waypoints, color) {
    return waypoints.map((wp, i) => {
      const isEndpoint = i === 0 || i === waypoints.length - 1;
      const label      = String(i + 1);

      const marker = new google.maps.Marker({
        position: { lat: wp.lat, lng: wp.lng },
        map:      this.#map,
        title:    wp.address,
        label: {
          text:      label,
          color:     '#ffffff',
          fontSize:  '11px',
          fontWeight: 'bold',
        },
        icon: {
          path:        google.maps.SymbolPath.CIRCLE,
          scale:       isEndpoint ? 14 : 11,
          fillColor:   isEndpoint ? '#1d4ed8' : color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        zIndex: 200 + i,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-size:13px;max-width:220px;">
          <strong>${i + 1}. ${wp.address}</strong>
        </div>`,
      });

      marker.addListener('click', () => {
        this.#openInfoWindow.current?.close();
        infoWindow.open(this.#map, marker);
        this.#openInfoWindow.current = infoWindow;
      });

      return marker;
    });
  }

  /** Wraps DirectionsService.route() in a Promise. */
  #routeSegment(origin, destination) {
    return new Promise(resolve => {
      new google.maps.DirectionsService().route(
        {
          origin,
          destination,
          travelMode:    google.maps.TravelMode.TWO_WHEELER,
          avoidHighways: this.#avoidHighways,
          avoidTolls:    this.#avoidTolls,
          avoidFerries:  this.#avoidFerries,
        },
        (result, status) => resolve({ result, status }),
      );
    });
  }
}
