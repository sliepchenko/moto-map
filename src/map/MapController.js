import { EventEmitter }      from '../core/EventEmitter.js';
import { assignTripColors }  from '../core/ColorUtils.js';
import { MapLoader }         from './MapLoader.js';
import { TripRenderer }      from './TripRenderer.js';
import { PoiRenderer }       from './PoiRenderer.js';
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
  /** @type {Map<string, { trip: Object, polyline: google.maps.Polyline, markers: google.maps.Marker[] }>} */
  #tripLayers = new Map();
  /** @type {google.maps.Marker[]} */ #poiMarkers = [];
  /** @type {string|null} */          #activeId   = null;

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

    this.#map.panTo(marker.getPosition());
    this.#map.setZoom(15);
    marker._infoWindow?.open(this.#map, marker);
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

      const tripRenderer = new TripRenderer(this.#map);
      trips.forEach(trip => {
        const { polyline, markers } = tripRenderer.render(trip);
        this.#tripLayers.set(trip.id, { trip, polyline, markers });
      });

      const poiRenderer  = new PoiRenderer(this.#map);
      this.#poiMarkers   = poiRenderer.renderAll(pois);

      if (trips.length > 0) this.#fitToAllTrips();
    } catch (err) {
      console.error('MapController: failed to load or render data.', err);
    }

    this.emit('load');
  }

  /** Dims unselected trips; bolds the selected one. */
  #applyHighlight(selectedId) {
    this.#tripLayers.forEach(({ polyline }, id) => {
      const isSelected = selectedId === null || id === selectedId;
      polyline.setOptions({
        strokeOpacity: isSelected ? 1.0 : 0.25,
        strokeWeight:  isSelected && selectedId !== null ? 6 : 4,
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
