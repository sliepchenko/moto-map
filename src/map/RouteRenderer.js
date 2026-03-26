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

  /** @type {Function|null} Called with (lat, lng, segmentIndex) when the user double-clicks the polyline. */
  #onPolylineDblClick = null;

  /**
   * Called when the user finishes dragging a stop marker to a new position.
   * Receives `(index: number, lat: number, lng: number)`.
   * @type {Function|null}
   */
  #onMarkerDragEnd = null;

  /**
   * @param {google.maps.Map}                          map
   * @param {{ current: google.maps.InfoWindow|null }} openInfoWindow
   */
  constructor(map, openInfoWindow) {
    this.#map            = map;
    this.#openInfoWindow = openInfoWindow;
  }

  /**
   * Registers a callback invoked when the user double-clicks the rendered route polyline.
   * The callback receives `(lat: number, lng: number, segmentIndex: number)`.
   * `segmentIndex` is the 0-based index of the waypoint *after* which the click falls.
   *
   * @param {((lat: number, lng: number, segmentIndex: number) => void)|null} fn
   */
  setDoubleClickHandler(fn) {
    this.#onPolylineDblClick = fn;
  }

  /**
   * Registers a callback invoked when the user finishes dragging a stop marker.
   * The callback receives `(index: number, lat: number, lng: number)`.
   *
   * @param {((index: number, lat: number, lng: number) => void)|null} fn
   */
  setMarkerDragHandler(fn) {
    this.#onMarkerDragEnd = fn;
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

    // Double-click on the polyline inserts a new stop at the clicked point.
    this.#polyline.addListener('dblclick', e => {
      if (!this.#onPolylineDblClick) return;
      // Suppress the map's own dblclick zoom
      e.stop?.();
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      const segIdx = this.#nearestSegmentIndex({ lat, lng }, waypoints);
      this.#onPolylineDblClick(lat, lng, segIdx);
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
        position:  { lat: wp.lat, lng: wp.lng },
        map:       this.#map,
        title:     wp.address,
        draggable: true,
        cursor:    'grab',
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

      // Provide visual feedback while dragging
      marker.addListener('dragstart', () => {
        this.#openInfoWindow.current?.close();
        this.#openInfoWindow.current = null;
      });

      // Fire the drag-end callback so the route can be recalculated
      marker.addListener('dragend', e => {
        if (!this.#onMarkerDragEnd) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        this.#onMarkerDragEnd(i, lat, lng);
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

  /**
   * Returns the index of the waypoint that comes *before* the nearest segment
   * to the given point.  For N waypoints there are N-1 segments; a result of
   * `k` means "between waypoints[k] and waypoints[k+1]", so the new stop
   * should be inserted at index k+1.
   *
   * Uses a simple squared-distance heuristic on the raw waypoint coordinates.
   *
   * @param {{ lat: number, lng: number }} point
   * @param {Array<{ lat: number, lng: number }>} waypoints
   * @returns {number}  0-based segment index (0 … waypoints.length - 2)
   */
  #nearestSegmentIndex(point, waypoints) {
    let bestIdx  = 0;
    let bestDist = Infinity;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const d = this.#distToSegmentSq(point, a, b);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    return bestIdx;
  }

  /** Squared distance from point P to line segment AB (in lat/lng space). */
  #distToSegmentSq(p, a, b) {
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      // Degenerate segment — return distance to point A
      const ex = p.lng - a.lng;
      const ey = p.lat - a.lat;
      return ex * ex + ey * ey;
    }

    let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const cx = a.lng + t * dx;
    const cy = a.lat + t * dy;
    const fx = p.lng - cx;
    const fy = p.lat - cy;
    return fx * fx + fy * fy;
  }
}
