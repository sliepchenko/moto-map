/**
 * Finds and renders "prominent place" markers along a planned route.
 *
 * Searches for tourist-friendly place types at regular intervals along the
 * route path using the Google Places API.  Results are deduplicated, rendered
 * as map markers, and returned to the caller so the sidebar panel can display
 * a clickable list.
 *
 * Supported place categories (mapped to Places API types):
 *   viewpoint        → point_of_interest (keyword: viewpoint)
 *   cafe             → cafe
 *   restaurant       → restaurant
 *   hotel            → lodging
 *   museum           → museum
 *   tourist_attraction → tourist_attraction
 *   natural_feature  → natural_feature
 *
 * SOLID notes:
 *  - SRP: only responsible for nearby-place search and marker rendering;
 *          no route logic, no sidebar logic.
 *  - OCP: extend PLACE_CATEGORIES to add new types without changing the
 *          search or render logic.
 */

/** @typedef {{ id: string, name: string, vicinity: string, category: string, lat: number, lng: number, rating: number|null, isOpen: boolean|null }} NearbyPlace */

const SEARCH_RADIUS_M   = 3_000;   // 3 km around each sample point
const SAMPLE_INTERVAL_M = 15_000;  // one sample every ~15 km

/**
 * Place categories to search for.
 * Each entry has a `type` (Places API type), an optional `keyword`, an
 * `icon` URL (asset), a display `label`, and a `color` for the marker badge.
 */
const PLACE_CATEGORIES = [
  { id: 'viewpoint',         type: 'point_of_interest', keyword: 'viewpoint',          icon: 'assets/icons/viewpoint.svg',  label: 'Viewpoints',      color: '#22c55e' },
  { id: 'tourist_attraction',type: 'tourist_attraction', keyword: null,                 icon: 'assets/icons/castle.svg',     label: 'Attractions',     color: '#a78bfa' },
  { id: 'cafe',              type: 'cafe',               keyword: null,                 icon: 'assets/icons/cafe.svg',       label: 'Cafes',           color: '#f59e0b' },
  { id: 'restaurant',        type: 'restaurant',         keyword: null,                 icon: 'assets/icons/cafe.svg',       label: 'Restaurants',     color: '#fb923c' },
  { id: 'hotel',             type: 'lodging',            keyword: null,                 icon: 'assets/icons/hotel.svg',      label: 'Hotels',          color: '#38bdf8' },
  { id: 'museum',            type: 'museum',             keyword: null,                 icon: 'assets/icons/castle.svg',     label: 'Museums',         color: '#e879f9' },
  { id: 'natural_feature',   type: 'natural_feature',    keyword: null,                 icon: 'assets/icons/water.svg',      label: 'Nature',          color: '#34d399' },
];

export { PLACE_CATEGORIES };

export class NearbyPlacesRenderer {
  /** @type {google.maps.Map} */
  #map;

  /** @type {{ current: google.maps.InfoWindow|null }} */
  #openInfoWindow;

  /** @type {google.maps.Marker[]} */
  #markers = [];

  /**
   * Optional callback invoked when the user clicks "Add to Route" inside an
   * InfoWindow.  Receives `{ name, lat, lng }`.
   * @type {((place: { name: string, lat: number, lng: number }) => void)|null}
   */
  #onAddToRoute = null;

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
   * Registers a callback invoked when the user clicks "Add to Route" on a
   * nearby-place marker InfoWindow.
   *
   * @param {((place: { name: string, lat: number, lng: number }) => void)|null} fn
   */
  setAddToRouteHandler(fn) {
    this.#onAddToRoute = fn;
  }

  /**
   * Searches for prominent places along `routePath`, renders their markers,
   * and returns a structured list for the sidebar.
   *
   * @param {Array<{lat: number, lng: number}>} routePath
   *   Dense path array returned by RouteRenderer.render().
   * @param {string[]} [enabledCategories]
   *   Category IDs to include (defaults to all).
   * @returns {Promise<NearbyPlace[]>}  Deduplicated list of found places.
   */
  async render(routePath, enabledCategories = PLACE_CATEGORIES.map(c => c.id)) {
    this.clear();

    const samplePoints = this.#samplePath(routePath, SAMPLE_INTERVAL_M);
    const categories   = PLACE_CATEGORIES.filter(c => enabledCategories.includes(c.id));

    const allPlaces = await this.#searchAll(samplePoints, categories);
    this.#markers   = this.#placeMarkers(allPlaces);
    return allPlaces;
  }

  /** Removes all nearby-place markers from the map. */
  clear() {
    this.#markers.forEach(m => m.setMap(null));
    this.#markers = [];
  }

  /**
   * Shows or hides all map markers that belong to a given category.
   *
   * @param {string}  categoryId  One of the PLACE_CATEGORIES id values.
   * @param {boolean} visible     `true` to show, `false` to hide.
   */
  setMarkerVisibility(categoryId, visible) {
    this.#markers
      .filter(m => m._categoryId === categoryId)
      .forEach(m => m.setMap(visible ? this.#map : null));
  }

  /**
   * Pans the map to the place with the given `placeId` and opens its
   * InfoWindow.
   *
   * @param {string} placeId  The `id` field from a `NearbyPlace` object.
   */
  focusPlace(placeId) {
    const marker = this.#markers.find(m => m._placeId === placeId);
    if (!marker) return;
    this.#openInfoWindow.current?.close();
    this.#map.panTo(marker.getPosition());
    this.#map.setZoom(15);
    if (marker._infoWindow) {
      marker._infoWindow.open(this.#map, marker);
      this.#openInfoWindow.current = marker._infoWindow;
    }
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

    const last = new google.maps.LatLng(path.at(-1).lat, path.at(-1).lng);
    const finalSample = samples.at(-1);
    if (finalSample.lat() !== last.lat() || finalSample.lng() !== last.lng()) {
      samples.push(last);
    }

    return samples;
  }

  /**
   * Runs nearbySearch for every (sample, category) pair, then deduplicates.
   *
   * @param {google.maps.LatLng[]} samplePoints
   * @param {typeof PLACE_CATEGORIES} categories
   * @returns {Promise<NearbyPlace[]>}
   */
  async #searchAll(samplePoints, categories) {
    const service = new google.maps.places.PlacesService(this.#map);
    const seen    = new Set();
    const unique  = [];

    // Run all searches in parallel for speed
    const batches = await Promise.all(
      categories.flatMap(cat =>
        samplePoints.map(point =>
          this.#nearbySearch(service, point, SEARCH_RADIUS_M, cat),
        ),
      ),
    );

    for (const { results, cat } of batches) {
      for (const place of results) {
        if (!seen.has(place.place_id)) {
          seen.add(place.place_id);
          unique.push(this.#toNearbyPlace(place, cat.id));
        }
      }
    }

    // Sort by rating descending (unrated places go last)
    unique.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

    return unique;
  }

  /**
   * Wraps PlacesService.nearbySearch() in a Promise.
   * Always resolves (returns `{ results: [], cat }` on any error).
   *
   * @param {google.maps.places.PlacesService} service
   * @param {google.maps.LatLng}               location
   * @param {number}                           radius
   * @param {object}                           cat
   * @returns {Promise<{ results: google.maps.places.PlaceResult[], cat: object }>}
   */
  #nearbySearch(service, location, radius, cat) {
    return new Promise(resolve => {
      const request = { location, radius, type: cat.type };
      if (cat.keyword) request.keyword = cat.keyword;

      service.nearbySearch(request, (results, status) => {
        if (
          status === google.maps.places.PlacesServiceStatus.OK ||
          status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS
        ) {
          resolve({ results: results ?? [], cat });
        } else {
          console.warn(`NearbyPlacesRenderer: Places search returned ${status} for "${cat.id}"`);
          resolve({ results: [], cat });
        }
      });
    });
  }

  /**
   * Converts a raw PlaceResult to a NearbyPlace plain object.
   *
   * @param {google.maps.places.PlaceResult} place
   * @param {string}                         categoryId
   * @returns {NearbyPlace}
   */
  #toNearbyPlace(place, categoryId) {
    return {
      id:       place.place_id,
      name:     place.name,
      vicinity: place.vicinity ?? '',
      category: categoryId,
      lat:      place.geometry.location.lat(),
      lng:      place.geometry.location.lng(),
      rating:   place.rating ?? null,
      isOpen:   place.opening_hours?.isOpen?.() ?? null,
    };
  }

  /**
   * Creates one map marker per place result.
   *
   * @param {NearbyPlace[]} places
   * @returns {google.maps.Marker[]}
   */
  #placeMarkers(places) {
    return places.map(place => {
      const cat      = PLACE_CATEGORIES.find(c => c.id === place.category);
      const position = new google.maps.LatLng(place.lat, place.lng);

      const marker = new google.maps.Marker({
        position,
        map:    this.#map,
        title:  place.name,
        icon: {
          url:        cat?.icon ?? 'assets/icons/viewpoint.svg',
          scaledSize: new google.maps.Size(28, 28),
          anchor:     new google.maps.Point(14, 14),
        },
        zIndex: 140,
      });

      // Attach the place id and category so focusPlace() / setMarkerVisibility() can look them up
      marker._placeId    = place.id;
      marker._categoryId = place.category;

      const mapsLink   = `https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + place.vicinity)}`;
      const ratingHtml = place.rating != null
        ? `<span style="color:#fbbf24">★ ${place.rating.toFixed(1)}</span>&nbsp;&nbsp;`
        : '';
      const openStatus = place.isOpen === true
        ? '<span style="color:#22c55e">Open now</span>'
        : (place.isOpen === false ? '<span style="color:#f87171">Closed</span>' : '');

      const body = [
        place.vicinity ? `<div style="color:#9ca3af;font-size:11px;margin-bottom:2px">${place.vicinity}</div>` : '',
        (ratingHtml || openStatus) ? `<div style="margin-bottom:4px">${ratingHtml}${openStatus}</div>` : '',
        `<div style="display:flex;gap:8px;align-items:center;margin-top:4px">`,
        `<a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:12px">Open in Maps</a>`,
        `<button data-add-to-route data-place-id="${place.id}" data-place-name="${place.name.replace(/"/g, '&quot;')}" data-lat="${place.lat}" data-lng="${place.lng}" style="font-size:12px;padding:2px 8px;border:1px solid #3b82f6;border-radius:4px;background:#eff6ff;color:#1d4ed8;cursor:pointer;white-space:nowrap">+ Add to Route</button>`,
        `</div>`,
      ].join('');

      const infoWindow = new google.maps.InfoWindow({
        headerContent: place.name,
        content:       body,
      });

      marker._infoWindow = infoWindow;

      marker.addListener('click', () => {
        this.#openInfoWindow.current?.close();
        infoWindow.open(this.#map, marker);
        this.#openInfoWindow.current = infoWindow;
      });

      // Wire "Add to Route" button inside the InfoWindow DOM
      infoWindow.addListener('domready', () => {
        const btn = document.querySelector(`[data-add-to-route][data-place-id="${place.id}"]`);
        if (btn) {
          btn.addEventListener('click', () => {
            this.#onAddToRoute?.({ name: place.name, lat: place.lat, lng: place.lng });
          });
        }
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
