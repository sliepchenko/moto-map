/**
 * Finds and renders fuel station markers along a planned route.
 *
 * Strategy:
 *  1. Sample the route path at every ~SAMPLE_INTERVAL_M metres.
 *  2. For each sample point, call PlacesService.nearbySearch() for
 *     `gas_station` within SEARCH_RADIUS_M.
 *  3. Deduplicate results by `place_id`.
 *  4. Render one marker per unique station using the existing fuel.svg icon.
 *
 * SOLID notes:
 *  - SRP: only responsible for fuel-station search and rendering; no route
 *          logic, no sidebar logic.
 *  - OCP: swap the icon, search radius, or sample interval via constants
 *          without touching other modules.
 */

const FUEL_ICON_URL      = 'assets/icons/fuel.svg';
const SEARCH_RADIUS_M    = 500;   // metres around each sample point
const SAMPLE_INTERVAL_M  = 10_000; // one sample every ~10 km

export class FuelStationRenderer {
  /** @type {google.maps.Map} */
  #map;

  /** @type {{ current: google.maps.InfoWindow|null }} */
  #openInfoWindow;

  /** @type {google.maps.Marker[]} */
  #markers = [];

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
   * Searches for fuel stations along `routePath` and renders their markers.
   *
   * @param {Array<{lat: number, lng: number}>} routePath
   *   The dense path array returned by RouteRenderer.render().
   * @returns {Promise<number>}  Number of unique fuel stations found.
   */
  async render(routePath) {
    this.clear();

    const samplePoints  = this.#samplePath(routePath, SAMPLE_INTERVAL_M);
    const allStations   = await this.#searchAll(samplePoints);
    this.#markers       = this.#placeMarkers(allStations);
    return this.#markers.length;
  }

  /** Removes all fuel station markers from the map. */
  clear() {
    this.#markers.forEach(m => m.setMap(null));
    this.#markers = [];
  }

  // ── private ──────────────────────────────────────────────────────────────

  /**
   * Returns a subset of path points spaced at least `intervalM` metres apart.
   * Always includes the first and last point.
   *
   * @param {Array<{lat: number, lng: number}>} path
   * @param {number} intervalM
   * @returns {google.maps.LatLng[]}
   */
  #samplePath(path, intervalM) {
    if (path.length === 0) return [];

    const samples   = [];
    let accumulated = 0;
    let prev        = new google.maps.LatLng(path[0].lat, path[0].lng);
    samples.push(prev);

    for (let i = 1; i < path.length; i++) {
      const curr = new google.maps.LatLng(path[i].lat, path[i].lng);
      accumulated += google.maps.geometry
        ? google.maps.geometry.spherical.computeDistanceBetween(prev, curr)
        : this.#haversine(prev, curr);

      if (accumulated >= intervalM) {
        samples.push(curr);
        accumulated = 0;
      }
      prev = curr;
    }

    // Always include the final point so we cover the end of the route.
    const last = new google.maps.LatLng(path.at(-1).lat, path.at(-1).lng);
    const finalSample = samples.at(-1);
    if (finalSample.lat() !== last.lat() || finalSample.lng() !== last.lng()) {
      samples.push(last);
    }

    return samples;
  }

  /**
   * Runs a nearbySearch for each sample point and deduplicates by place_id.
   *
   * @param {google.maps.LatLng[]} samplePoints
   * @returns {Promise<google.maps.places.PlaceResult[]>}
   */
  async #searchAll(samplePoints) {
    const service     = new google.maps.places.PlacesService(this.#map);
    const seen        = new Set();
    const unique      = [];

    const searches = samplePoints.map(point =>
      this.#nearbySearch(service, point, SEARCH_RADIUS_M),
    );

    const results = await Promise.all(searches);

    for (const batch of results) {
      for (const place of batch) {
        if (!seen.has(place.place_id)) {
          seen.add(place.place_id);
          unique.push(place);
        }
      }
    }

    return unique;
  }

  /**
   * Wraps PlacesService.nearbySearch() in a Promise.
   * Resolves with an empty array on any error status (ZERO_RESULTS, etc.).
   *
   * @param {google.maps.places.PlacesService} service
   * @param {google.maps.LatLng}               location
   * @param {number}                           radius
   * @returns {Promise<google.maps.places.PlaceResult[]>}
   */
  #nearbySearch(service, location, radius) {
    return new Promise(resolve => {
      service.nearbySearch(
        { location, radius, type: 'gas_station' },
        (results, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK ||
            status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS
          ) {
            resolve(results ?? []);
          } else {
            console.warn(`FuelStationRenderer: Places search returned ${status}`);
            resolve([]);
          }
        },
      );
    });
  }

  /**
   * Creates one marker per place result.
   *
   * @param {google.maps.places.PlaceResult[]} stations
   * @returns {google.maps.Marker[]}
   */
  #placeMarkers(stations) {
    return stations.map(place => {
      const position = place.geometry.location;

      const marker = new google.maps.Marker({
        position,
        map:    this.#map,
        title:  place.name,
        icon: {
          url:        FUEL_ICON_URL,
          scaledSize: new google.maps.Size(32, 32),
          anchor:     new google.maps.Point(16, 16),
        },
        zIndex: 150,
      });

      const mapsLink  = `https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + (place.vicinity ?? ''))}`;
      const openStatus = place.opening_hours?.isOpen?.()
        ? '<span style="color:#22c55e">Open now</span>'
        : (place.opening_hours ? '<span style="color:#f87171">Closed</span>' : '');

      const body = [
        place.vicinity ? `<div style="color:#9ca3af;font-size:11px;margin-bottom:2px">${place.vicinity}</div>` : '',
        openStatus ? `<div style="margin-bottom:4px">${openStatus}</div>` : '',
        `<a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Open in Maps</a>`,
      ].join('');

      const infoWindow = new google.maps.InfoWindow({
        headerContent: place.name,
        content:       body,
      });

      marker.addListener('click', () => {
        this.#openInfoWindow.current?.close();
        infoWindow.open(this.#map, marker);
        this.#openInfoWindow.current = infoWindow;
      });

      return marker;
    });
  }

  /**
   * Haversine fallback in case the `geometry` library is unavailable.
   *
   * @param {google.maps.LatLng} a
   * @param {google.maps.LatLng} b
   * @returns {number} distance in metres
   */
  #haversine(a, b) {
    const R    = 6_371_000;
    const lat1 = a.lat() * Math.PI / 180;
    const lat2 = b.lat() * Math.PI / 180;
    const dLat = (b.lat() - a.lat()) * Math.PI / 180;
    const dLng = (b.lng() - a.lng()) * Math.PI / 180;
    const h    = Math.sin(dLat / 2) ** 2
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}
