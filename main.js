/**
 * Application entry point.
 *
 * `App` is a thin orchestrator that wires together the map, sidebar
 * WebComponents, and URL state. It contains no rendering or data-fetching
 * logic — those concerns live in their dedicated classes.
 *
 * SOLID notes:
 *  - SRP: only wires collaborators together and reacts to user/browser events.
 *  - DIP: depends on the abstract interfaces of MapController, AppSidebarComponent,
 *          and UrlStateManager — not on concrete fetch or DOM calls.
 */

import { MapController }        from './src/map/MapController.js';
import { UrlStateManager }      from './src/state/UrlStateManager.js';

// Register WebComponents before the DOM parser encounters their tags.
import './src/components/TripListComponent.js';
import './src/components/PoiListComponent.js';
import './src/components/AppSidebarComponent.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = 'AIzaSyD_XkQAhqeRRkLct-LBdcwP5QfIMvU0B4I';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

class App {
  /** @type {MapController} */         #map;
  /** @type {AppSidebarComponent} */   #sidebar;
  /** @type {UrlStateManager} */       #urlState;

  constructor() {
    this.#urlState = new UrlStateManager();
    this.#sidebar  = document.querySelector('app-sidebar');
    this.#map      = new MapController(
      GOOGLE_MAPS_API_KEY,
      document.getElementById('map'),
    );
  }

  async start() {
    // Kick off map loading (async; fires 'load' when data is rendered)
    await this.#map.init();

    // Wire map 'load' → populate sidebar + apply URL state
    this.#map.on('load', () => this.#onMapLoaded());

    // Wire browser back/forward
    this.#urlState.onNavigate(state => this.#onNavigate(state));

    // Wire sidebar trip-select events
    this.#sidebar.addEventListener('trip-select', e => this.#onTripSelect(e));

    // Wire sidebar poi-select events
    this.#sidebar.addEventListener('poi-select', e => this.#onPoiSelect(e));
  }

  // ── private handlers ─────────────────────────────────────────────────────

  #onMapLoaded() {
    const { tripList, poiList } = this.#sidebar;

    tripList.setTrips(this.#map.trips);
    poiList.setPoiList(this.#map.pois);

    this.#sidebar.show();

    // Restore URL state on first load
    const tripId   = this.#urlState.getTripId();
    const poiIndex = this.#urlState.getPoiIndex();

    if (poiIndex !== null) {
      this.#sidebar.openSection('poi');
      this.#applyPoi(poiIndex);
    } else if (tripId) {
      this.#applyTrip(tripId);
    }
  }

  /** Handles the `trip-select` CustomEvent from `<trip-list>`. */
  #onTripSelect({ detail: { id } }) {
    this.#urlState.pushTrip(id);
    this.#applyTrip(id);
  }

  /** Handles the `poi-select` CustomEvent from `<poi-list>`. */
  #onPoiSelect({ detail: { index } }) {
    this.#urlState.pushPoi(index);
    this.#applyPoi(index);
  }

  /** Handles browser back/forward navigation. */
  #onNavigate({ tripId, poiIndex }) {
    if (poiIndex !== null) {
      this.#sidebar.openSection('poi');
      this.#applyPoi(poiIndex);
    } else if (tripId) {
      this.#sidebar.openSection('rides');
      this.#sidebar.poiList.setActive(null);
      this.#applyTrip(tripId);
    } else {
      this.#applyTrip(null);
      this.#sidebar.poiList.setActive(null);
    }
  }

  /**
   * Selects a trip on the map and updates the sidebar highlight.
   * @param {string|null} id
   */
  #applyTrip(id) {
    this.#map.selectTrip(id ?? null);
    this.#sidebar.tripList.setActive(id ?? null);
  }

  /**
   * Opens a POI on the map and highlights the sidebar item.
   * @param {number} index
   */
  #applyPoi(index) {
    this.#map.openPoi(index);
    this.#sidebar.poiList.setActive(index);
  }
}

// Start the application
new App().start();

// ── Service Worker registration ───────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(err => console.warn('Service Worker registration failed:', err));
  });
}
