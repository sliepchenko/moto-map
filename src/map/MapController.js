import { EventEmitter }      from '../core/EventEmitter.js';
import { assignTripColors }  from '../core/ColorUtils.js';
import { MapLoader }         from './MapLoader.js';
import { TripRenderer }      from './TripRenderer.js';
import { PoiRenderer }       from './PoiRenderer.js';
import { RouteRenderer }     from './RouteRenderer.js';
import { TripRepository }    from '../data/TripRepository.js';
import { PoiRepository }     from '../data/PoiRepository.js';

/** Default map centre (Zagreb, Croatia). */
const ZAGREB_CENTER = { lat: 45.8150, lng: 15.9819 };
const DEFAULT_ZOOM  = 12;

/**
 * Orchestrates Google Maps initialisation, data loading, trip/POI rendering,
 * and selection state.
 *
 * Emits:
 *  - `'load'`  — once all data has been rendered and the map is ready.
 *
 * SOLID notes:
 *  - SRP: owns map state and selection; delegates loading to repositories and
 *          rendering to dedicated renderers.
 *  - OCP: swap repositories or renderers via the constructor without
 *          modifying this class.
 *  - DIP: depends on abstract collaborator contracts (repositories / renderers
 *          / EventEmitter), not on concrete implementations.
 */
export class MapController extends EventEmitter {
  /**
   * @param {string}          apiKey
   * @param {HTMLElement}     container   - element to mount the map into
   * @param {TripRepository}  [tripRepo]
   * @param {PoiRepository}   [poiRepo]
   */
  constructor(
    apiKey,
    container,
    tripRepo = new TripRepository(),
    poiRepo  = new PoiRepository(),
  ) {
    super();
    this.#apiKey    = apiKey;
    this.#container = container;
    this.#tripRepo  = tripRepo;
    this.#poiRepo   = poiRepo;
  }

  // ── private fields ────────────────────────────────────────────────────────

  /** @type {string} */              #apiKey;
  /** @type {HTMLElement} */         #container;
  /** @type {TripRepository} */      #tripRepo;
  /** @type {PoiRepository} */       #poiRepo;

  /** @type {google.maps.Map|null} */ #map       = null;
  /** @type {Object[]} */             #trips     = [];
  /** @type {Object[]} */             #pois      = [];
  /** @type {Map<string, { trip: Object, polyline: google.maps.Polyline, basePolyline: google.maps.Polyline, markers: google.maps.Marker[] }>} */
  #tripLayers = new Map();
  /** @type {google.maps.Marker[]} */                        #poiMarkers    = [];
  /** @type {string|null} */                                 #activeId      = null;
  /**
   * Shared holder passed to every renderer so that opening any InfoWindow
   * (POI click, waypoint click, or programmatic openPoi) always closes the
   * previously open one, regardless of which renderer created it.
   *
   * @type {{ current: google.maps.InfoWindow|null }}
   */
  #openInfoWindow = { current: null };

  /** @type {boolean} Whether directional arrows are currently visible. */
  #showRouteDirections = true;

  /** @type {RouteRenderer|null} */
  #routeRenderer = null;

  /** @type {google.maps.Geocoder|null} */
  #geocoder = null;

  /** True when the map is in "pick a point" mode for the route planner. */
  #pickingMode = false;

  /** @type {google.maps.MapsEventListener|null} */
  #pickListener = null;

  // ── public API ────────────────────────────────────────────────────────────

  /** The underlying `google.maps.Map` instance (available after `'load'`). */
  get map()   { return this.#map; }
  /** Loaded trip objects (available after `'load'`). */
  get trips() { return this.#trips; }
  /** Loaded POI objects (available after `'load'`). */
  get pois()  { return this.#pois; }

  /**
   * Bootstraps the map, loads data, and renders everything.
   * Emits `'load'` once complete.
   *
   * @returns {Promise<void>}
   */
  async init() {
    const loader = new MapLoader(this.#apiKey);
    const styles = await loader.load();

    this.#map = new google.maps.Map(this.#container, {
      center:            ZAGREB_CENTER,
      zoom:              DEFAULT_ZOOM,
      mapTypeId:         google.maps.MapTypeId.TERRAIN,
      styles,
      zoomControl:       true,
      mapTypeControl:    true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    google.maps.event.addListenerOnce(this.#map, 'idle', () => this.#onMapReady());
  }

  /**
   * Highlights the trip matching `id` and fits the viewport to it.
   * Pass `null` to deselect all trips and show the full overview.
   *
   * @param {string|null} id
   */
  selectTrip(id) {
    this.#activeId = id;
    this.#applyHighlight(id);

    if (id) {
      const layer = this.#tripLayers.get(id);
      if (layer) this.#fitToTrip(layer.trip);
    } else {
      if (this.#trips.length > 0) this.#fitToAllTrips();
    }
  }

  /**
   * Pans to and opens the InfoWindow of the POI at `index`.
   *
   * @param {number} index - zero-based index in the `pois` array
   */
  openPoi(index) {
    const marker = this.#poiMarkers[index];
    if (!marker) return;

    // Close any previously open InfoWindow before opening the new one
    this.#openInfoWindow.current?.close();

    this.#map.panTo(marker.getPosition());
    this.#map.setZoom(15);

    if (marker._infoWindow) {
      marker._infoWindow.open(this.#map, marker);
      this.#openInfoWindow.current = marker._infoWindow;
    }
  }

  /**
   * Geocodes an address string and returns {lat, lng}, or null on failure.
   * @param {string} address
   * @returns {Promise<{lat: number, lng: number}|null>}
   */
  async geocode(address) {
    if (!this.#geocoder) return null;
    return new Promise(resolve => {
      this.#geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Renders a planned route through the given waypoints.
   * Returns a summary object { distanceKm, durationMin, legs }.
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints
   * @returns {Promise<{distanceKm: number, durationMin: number, legs: object[]}>}
   */
  async renderPlannedRoute(waypoints) {
    return this.#routeRenderer.render(waypoints);
  }

  /** Clears the planned route from the map. */
  clearPlannedRoute() {
    this.#routeRenderer?.clear();
  }

  /**
   * Shows or hides the directional arrow icons on all trip polylines.
   * @param {boolean} enabled
   */
  setRouteDirections(enabled) {
    this.#showRouteDirections = enabled;
    this.#tripLayers.forEach(({ polyline }) => {
      const existingIcons = polyline.get('icons');
      const existingIcon  = existingIcons[0].icon;
      polyline.setOptions({
        icons: [{
          icon: {
            ...existingIcon,
            fillOpacity:   enabled ? 0.9  : 0,
            strokeOpacity: enabled ? 0.35 : 0,
          },
          offset: existingIcons[0].offset,
          repeat: existingIcons[0].repeat,
        }],
      });
    });
  }

  /**
   * Shows or hides all POI markers on the map.
   * @param {boolean} enabled
   */
  setPoiVisibility(enabled) {
    this.#poiMarkers.forEach(marker => marker.setVisible(enabled));
  }

  /**
   * Enables or disables the terrain map type.
   * When disabled, falls back to the default ROADMAP type.
   * @param {boolean} enabled
   */
  setTerrainEnabled(enabled) {
    this.#map.setMapTypeId(
      enabled
        ? google.maps.MapTypeId.TERRAIN
        : google.maps.MapTypeId.ROADMAP,
    );
  }

  /**
   * Switches the map between dark and light theme styles.
   * @param {boolean} dark
   */
  async setDarkMap(dark) {
    try {
      const url  = dark ? 'dark-theme.json' : 'theme.json';
      const resp = await fetch(url);
      const styles = resp.ok ? await resp.json() : [];
      this.#map.setOptions({ styles });
    } catch {
      console.warn('MapController: failed to load map theme.');
    }
  }

  /**
   * Fires the `'map-pick'` event with `{ lat, lng }` on click, then auto-disables.
   */
  enablePickMode() {
    if (this.#pickingMode) return;
    this.#pickingMode = true;
    if (this.#map) {
      this.#map.setOptions({ draggableCursor: 'crosshair' });
      this.#pickListener = this.#map.addListener('click', e => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        this.disablePickMode();
        this.emit('map-pick', { lat, lng });
      });
    }
  }

  /** Deactivates map-click pick mode. */
  disablePickMode() {
    if (!this.#pickingMode) return;
    this.#pickingMode = false;
    this.#map?.setOptions({ draggableCursor: '' });
    if (this.#pickListener) {
      google.maps.event.removeListener(this.#pickListener);
      this.#pickListener = null;
    }
  }

  // ── private ──────────────────────────────────────────────────────────────

  async #onMapReady() {
    try {
      const [trips, pois] = await Promise.all([
        this.#tripRepo.fetchAll(),
        this.#poiRepo.fetchAll(),
      ]);

      assignTripColors(trips);
      this.#trips = trips;
      this.#pois  = pois;

      const tripRenderer = new TripRenderer(this.#map, this.#openInfoWindow);
      trips.forEach(trip => {
        const { polyline, markers, _basePolyline } = tripRenderer.render(trip);
        this.#tripLayers.set(trip.id, { trip, polyline, basePolyline: _basePolyline, markers });
      });

      const poiRenderer  = new PoiRenderer(this.#map, this.#openInfoWindow);
      this.#poiMarkers   = poiRenderer.renderAll(pois);

      // Initialise route planner renderer and geocoder
      this.#routeRenderer = new RouteRenderer(this.#map, this.#openInfoWindow);
      this.#geocoder      = new google.maps.Geocoder();

      if (trips.length > 0) this.#fitToAllTrips();
    } catch (err) {
      console.error('MapController: failed to load or render data.', err);
    }

    this.emit('load');
  }

  /** Dims unselected trips; bolds the selected one. */
  #applyHighlight(selectedId) {
    this.#tripLayers.forEach(({ polyline, basePolyline }, id) => {
      const isSelected  = selectedId === null || id === selectedId;
      const lineOpacity = isSelected ? 1.0  : 0.15;
      const weight      = isSelected && selectedId !== null ? 6 : 5;
      const scale       = isSelected && selectedId !== null ? 2.5 : 2;
      const repeat      = isSelected && selectedId !== null ? '20px' : '24px';

      // Respect the showRouteDirections setting: keep arrows hidden if disabled
      const arrowFillOpacity   = this.#showRouteDirections ? (isSelected ? 0.9 : 0.2) : 0;
      const arrowStrokeOpacity = this.#showRouteDirections ? (isSelected ? 0.35 : 0.1) : 0;

      // Update the solid base line
      if (basePolyline) {
        basePolyline.setOptions({
          strokeOpacity: lineOpacity,
          strokeWeight:  weight,
        });
      }

      // Update the arrow overlay
      const existingIcon = polyline.get('icons')[0].icon;
      polyline.setOptions({
        strokeWeight: weight,
        icons: [{
          icon: {
            ...existingIcon,
            scale,
            fillOpacity:   arrowFillOpacity,
            strokeOpacity: arrowStrokeOpacity,
          },
          offset: '12px',
          repeat,
        }],
      });
    });
  }

  #fitToAllTrips() {
    const bounds = new google.maps.LatLngBounds();
    this.#trips.forEach(t => t.waypoints.forEach(wp => bounds.extend(wp)));
    this.#map.fitBounds(bounds);
  }

  #fitToTrip(trip) {
    const bounds = new google.maps.LatLngBounds();
    trip.waypoints.forEach(wp => bounds.extend(wp));
    this.#map.fitBounds(bounds);
  }
}
