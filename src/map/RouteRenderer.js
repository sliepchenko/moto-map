/**
 * Renders a user-planned route on the map using Google Maps DirectionsService.
 *
 * Draws the active route as a solid blue polyline and up to 2 alternative
 * routes as distinct-coloured dimmed polylines.  Numbered markers are placed
 * at each stop.  Alternative polylines are interactive: hovering highlights
 * them and clicking selects them as the active route (same as picking the
 * sidebar card).
 *
 * The user can call `selectAlternative(index)` to swap the active route
 * programmatically (e.g. from a sidebar card click).
 *
 * SOLID notes:
 *  - SRP: only responsible for drawing / clearing one planned route (+ its alternatives).
 *  - OCP: swap routing back-end by overriding `#routeSegment`.
 *
 * Return shape of `render()`:
 * ```
 * Array<{
 *   distanceKm:  number,
 *   durationMin: number,
 *   legs:        Array<{ distance: string, duration: string }>,
 *   routePath:   Array<{ lat: number, lng: number }>,
 *   hasTolls:    boolean,
 *   color:       string,   // hex colour assigned to this route
 * }>
 * ```
 * Index 0 is the initially selected (primary) route; indices 1–2 are alternatives.
 */
export class RouteRenderer {
  // ── Route colour palette ─────────────────────────────────────────────────
  // Index 0 = active/primary (blue), 1 = first alt (amber), 2 = second alt (teal)
  static ROUTE_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

  /** @type {google.maps.Map} */
  #map;

  /** @type {google.maps.Polyline|null}  Active (selected) route polyline */
  #polyline = null;

  /** @type {google.maps.Polyline[]}  Alternative polylines, index-aligned with #allSummaries. */
  #altPolylines = [];

  /**
   * Dense path arrays for each rendered route (index-aligned with #allSummaries).
   * Stored so `selectAlternative()` can rebuild the active polyline path.
   * @type {Array<google.maps.LatLng[]>}
   */
  #allPaths = [];

  /**
   * All route summaries returned by the last `render()` call.
   * @type {Array<{distanceKm: number, durationMin: number, legs: object[], routePath: object[], hasTolls: boolean, color: string}>}
   */
  #allSummaries = [];

  /** 0-based index of the currently active route within #allSummaries / #allPaths. */
  #activeIndex = 0;

  /** Waypoints from the last `render()` call — needed for re-drawing markers. */
  #lastWaypoints = [];

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
   * Called when the user clicks an alternative polyline on the map.
   * Receives `(index: number)` — the 0-based route index that was clicked.
   * @type {Function|null}
   */
  #onAltPolylineClick = null;

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

  /**
   * Registers a callback invoked when the user clicks an alternative route
   * polyline directly on the map.  The callback receives `(index: number)` —
   * the 0-based route index that was clicked.  The renderer will also call
   * `selectAlternative(index)` internally, so the polylines swap immediately.
   *
   * @param {((index: number) => void)|null} fn
   */
  setAltPolylineClickHandler(fn) {
    this.#onAltPolylineClick = fn;
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Draws road-following routes through `waypoints`.
   *
   * For a two-stop (single-leg) route, requests up to 3 alternatives from the
   * Directions API and renders all of them — the primary as a solid blue polyline
   * and the others as dimmed grey polylines.
   *
   * For multi-stop routes, Google Directions does not return alternatives across
   * the whole journey, so only one route per segment is used (same behaviour as
   * before).
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints
   * @returns {Promise<Array<{distanceKm: number, durationMin: number, legs: object[], routePath: object[], hasTolls: boolean}>>}
   *   Sorted array of summaries; index 0 is the active (selected) route.
   */
  async render(waypoints) {
    this.clear();

    this.#lastWaypoints = waypoints;
    this.#activeIndex   = 0;

    const isSingleLeg = waypoints.length === 2;

    if (isSingleLeg) {
      await this.#renderSingleLeg(waypoints);
    } else {
      await this.#renderMultiLeg(waypoints);
    }

    // Fit viewport to the planned route
    const bounds = new google.maps.LatLngBounds();
    waypoints.forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }));
    this.#map.fitBounds(bounds);

    return this.#allSummaries;
  }

  /**
   * Switches the active (highlighted) route to the given index without
   * fetching new directions.  Redraws polylines and updates markers.
   *
   * @param {number} index  0-based index into the summaries returned by `render()`
   */
  selectAlternative(index) {
    if (index < 0 || index >= this.#allSummaries.length) return;
    if (index === this.#activeIndex) return;

    this.#activeIndex = index;
    this.#rebuildPolylines();
  }

  /** Removes all polylines and markers from the map. */
  clear() {
    this.#polyline?.setMap(null);
    this.#polyline = null;
    this.#altPolylines.forEach(p => p.setMap(null));
    this.#altPolylines = [];
    this.#allPaths     = [];
    this.#allSummaries = [];
    this.#activeIndex  = 0;
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

  // ── private: rendering strategies ────────────────────────────────────────

  /**
   * Single-leg (A→B) path: request alternatives, build a summary per returned
   * route, and draw them all.
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints  length === 2
   */
  async #renderSingleLeg(waypoints) {
    const origin      = new google.maps.LatLng(waypoints[0].lat, waypoints[0].lng);
    const destination = new google.maps.LatLng(waypoints[1].lat, waypoints[1].lng);

    const { result, status } = await this.#routeSegment(origin, destination, true);

    if (status === google.maps.DirectionsStatus.OK) {
      // Build one summary + path per returned route (up to 3)
      result.routes.forEach((route, i) => {
        const leg     = route.legs[0];
        const color   = RouteRenderer.ROUTE_COLORS[i] ?? RouteRenderer.ROUTE_COLORS[0];
        const summary = {
          distanceKm:  (leg.distance?.value ?? 0) / 1000,
          durationMin: (leg.duration?.value ?? 0) / 60,
          legs:        [{ distance: leg.distance?.text, duration: leg.duration?.text }],
          hasTolls:    this.#routeHasTolls(route),
          color,
          routePath:   [],
        };
        const path = [];
        route.overview_path.forEach(pt => {
          path.push(pt);
          summary.routePath.push({ lat: pt.lat(), lng: pt.lng() });
        });
        this.#allSummaries.push(summary);
        this.#allPaths.push(path);
      });
    } else {
      // Straight-line fallback — single "route"
      console.warn(`RouteRenderer: directions failed (${status}) for single-leg route.`);
      this.#allSummaries.push({
        distanceKm:  0,
        durationMin: 0,
        legs:        [{ distance: '?', duration: '?' }],
        hasTolls:    false,
        color:       RouteRenderer.ROUTE_COLORS[0],
        routePath:   [
          { lat: waypoints[0].lat, lng: waypoints[0].lng },
          { lat: waypoints[1].lat, lng: waypoints[1].lng },
        ],
      });
      this.#allPaths.push([origin, destination]);
    }

    this.#buildPolylines(waypoints);
  }

  /**
   * Multi-leg (A→B→…→Z) path: iterate over consecutive waypoint pairs,
   * request one route per segment (no alternatives for multi-stop), accumulate.
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints  length >= 3
   */
  async #renderMultiLeg(waypoints) {
    const summary = {
      distanceKm:  0,
      durationMin: 0,
      legs:        [],
      hasTolls:    false,
      color:       RouteRenderer.ROUTE_COLORS[0],
      routePath:   [],
    };
    const path    = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const origin      = new google.maps.LatLng(waypoints[i].lat,     waypoints[i].lng);
      const destination = new google.maps.LatLng(waypoints[i + 1].lat, waypoints[i + 1].lng);

      const { result, status } = await this.#routeSegment(origin, destination, false);

      if (status === google.maps.DirectionsStatus.OK) {
        const route = result.routes[0];
        const leg   = route.legs[0];
        summary.distanceKm  += (leg.distance?.value ?? 0) / 1000;
        summary.durationMin += (leg.duration?.value ?? 0) / 60;
        summary.legs.push({ distance: leg.distance?.text, duration: leg.duration?.text });
        if (this.#routeHasTolls(route)) summary.hasTolls = true;
        route.overview_path.forEach(pt => {
          path.push(pt);
          summary.routePath.push({ lat: pt.lat(), lng: pt.lng() });
        });
      } else {
        // Straight-line fallback for this segment
        path.push(origin);
        path.push(destination);
        summary.routePath.push({ lat: waypoints[i].lat, lng: waypoints[i].lng });
        summary.routePath.push({ lat: waypoints[i + 1].lat, lng: waypoints[i + 1].lng });
        summary.legs.push({ distance: '?', duration: '?' });
        console.warn(`RouteRenderer: directions failed (${status}) for segment ${i}→${i + 1}.`);
      }
    }

    this.#allSummaries.push(summary);
    this.#allPaths.push(path);
    this.#buildPolylines(waypoints);
  }

  // ── private: polyline helpers ─────────────────────────────────────────────

  /**
   * Draws the primary polyline (index `#activeIndex`) and all alternative polylines.
   * Alternative polylines use their own colour from ROUTE_COLORS, with reduced opacity.
   * Hovering an alternative brightens it; clicking it selects it as the active route.
   * Attaches the dblclick listener and places stop markers.
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints
   */
  #buildPolylines(waypoints) {
    const ACTIVE_WEIGHT = 5;
    const ALT_WEIGHT    = 4;

    // Draw alternative polylines first (underneath the active one)
    this.#allPaths.forEach((path, i) => {
      if (i === this.#activeIndex) return; // drawn separately below

      const altColor = this.#allSummaries[i]?.color ?? '#6b7280';

      const polyline = new google.maps.Polyline({
        map:           this.#map,
        path,
        geodesic:      true,
        strokeColor:   altColor,
        strokeOpacity: 0.45,
        strokeWeight:  ALT_WEIGHT,
        zIndex:        1,
      });

      // Hover: brighten
      polyline.addListener('mouseover', () => {
        polyline.setOptions({ strokeOpacity: 0.8, strokeWeight: ALT_WEIGHT + 1 });
      });
      polyline.addListener('mouseout', () => {
        // Only restore if this polyline is still an alt (not now the active one)
        if (i !== this.#activeIndex) {
          polyline.setOptions({ strokeOpacity: 0.45, strokeWeight: ALT_WEIGHT });
        }
      });

      // Click: select this alternative
      polyline.addListener('click', () => {
        if (i === this.#activeIndex) return;
        this.selectAlternative(i);
        this.#onAltPolylineClick?.(i);
      });

      this.#altPolylines.push(polyline);
    });

    // Draw active polyline on top with dblclick support
    const activeColor = this.#allSummaries[this.#activeIndex]?.color ?? RouteRenderer.ROUTE_COLORS[0];
    const activePath  = new google.maps.MVCArray(this.#allPaths[this.#activeIndex] ?? []);
    this.#polyline = new google.maps.Polyline({
      map:           this.#map,
      path:          activePath,
      geodesic:      true,
      strokeColor:   activeColor,
      strokeOpacity: 0.9,
      strokeWeight:  ACTIVE_WEIGHT,
      zIndex:        2,
    });

    this.#polyline.addListener('dblclick', e => {
      if (!this.#onPolylineDblClick) return;
      e.stop?.();
      const lat    = e.latLng.lat();
      const lng    = e.latLng.lng();
      const segIdx = this.#nearestSegmentIndex({ lat, lng }, waypoints);
      this.#onPolylineDblClick(lat, lng, segIdx);
    });

    // Place numbered markers
    this.#markers = this.#placeMarkers(waypoints, activeColor);
  }

  /**
   * Redraws all polylines after `selectAlternative()` changes `#activeIndex`.
   * Avoids full re-fetch — only swaps visual styling.
   */
  #rebuildPolylines() {
    // Tear down existing polylines (keep markers — waypoints didn't change)
    this.#polyline?.setMap(null);
    this.#polyline = null;
    this.#altPolylines.forEach(p => p.setMap(null));
    this.#altPolylines = [];

    this.#buildPolylines(this.#lastWaypoints);
  }

  // ── private: Directions API ───────────────────────────────────────────────

  /**
   * Wraps DirectionsService.route() in a Promise.
   *
   * @param {google.maps.LatLng} origin
   * @param {google.maps.LatLng} destination
   * @param {boolean}            [alternatives=false]  Request up to 3 alternatives
   */
  #routeSegment(origin, destination, alternatives = false) {
    return new Promise(resolve => {
      new google.maps.DirectionsService().route(
        {
          origin,
          destination,
          travelMode:              google.maps.TravelMode.TWO_WHEELER,
          avoidHighways:           this.#avoidHighways,
          avoidTolls:              this.#avoidTolls,
          avoidFerries:            this.#avoidFerries,
          provideRouteAlternatives: alternatives,
        },
        (result, status) => resolve({ result, status }),
      );
    });
  }

  /**
   * Checks whether a Directions API route contains toll roads.
   * Uses `warnings` array (contains "This route has tolls." in many locales).
   *
   * @param {google.maps.DirectionsRoute} route
   * @returns {boolean}
   */
  #routeHasTolls(route) {
    if (!route) return false;
    // Check leg-level fare info first
    if (route.fare) return true;
    // Fall back to warning strings
    const warnings = route.warnings ?? [];
    return warnings.some(w => /toll/i.test(w));
  }

  // ── private: markers ──────────────────────────────────────────────────────

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

  // ── private: geometry helpers ─────────────────────────────────────────────

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
