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
import './src/components/RoutePlannerComponent.js';
import './src/components/AppSettingsComponent.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = 'AIzaSyD_XkQAhqeRRkLct-LBdcwP5QfIMvU0B4I';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

class App {
  /** @type {MapController} */         #map;
  /** @type {AppSidebarComponent} */   #sidebar;
  /** @type {UrlStateManager} */       #urlState;

  /**
   * All route summaries from the last successful `renderPlannedRoute()` call.
   * Stored here so `#onRouteAltSelect` can look up the newly active path.
   * @type {Array<{distanceKm: number, durationMin: number, legs: object[], routePath: object[], hasTolls: boolean}>}
   */
  #lastRouteSummaries = [];

  constructor() {
    this.#urlState  = new UrlStateManager();
    this.#sidebar   = document.querySelector('app-sidebar');
    this.#map       = new MapController(
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

    // Wire route planner events (bubbled from <route-planner> inside the sidebar)
    this.#sidebar.addEventListener('route-geocode',            e => this.#onRouteGeocode(e));
    this.#sidebar.addEventListener('route-plan',               e => this.#onRoutePlan(e));
    this.#sidebar.addEventListener('route-alternative-select', e => this.#onRouteAltSelect(e));
    this.#sidebar.addEventListener('route-save',               e => this.#onRouteSave(e));
    this.#sidebar.addEventListener('route-export-gmaps',       e => this.#onRouteExportGMaps(e));
    this.#sidebar.addEventListener('route-clear',              () => this.#onRouteClear());
    this.#sidebar.addEventListener('route-pick-start',         () => this.#map.enablePickMode());
    this.#sidebar.addEventListener('route-pick-cancel',        () => this.#map.disablePickMode());

    // Wire map-pick event back to route planner
    this.#map.on('map-pick', ({ lat, lng }) => {
      this.#sidebar.routePlanner?.addMapPoint(lat, lng);
    });

    // Wire route polyline double-click → insert a new stop at the clicked position
    // and immediately recalculate the route so the new marker appears and is draggable.
    this.#map.setRouteDoubleClickHandler(async (lat, lng, segmentIndex) => {
      const planner = this.#sidebar.routePlanner;
      if (!planner) return;
      planner.insertMapPoint(lat, lng, segmentIndex + 1);
      await this.#recalculateRoute(planner);
    });

    // Wire route marker drag → move the stop to the new position and recalculate the route
    this.#map.setMarkerDragHandler(async (index, lat, lng) => {
      const planner = this.#sidebar.routePlanner;
      if (!planner) return;
      planner.updateWaypointPosition(index, lat, lng);
      await this.#recalculateRoute(planner);
    });

    // Wire alternative polyline clicks on the map → select the matching sidebar card.
    // The RouteRenderer already swaps the active polyline; we only need to keep the
    // sidebar card highlights in sync and refresh the fuel station overlay.
    this.#map.setAltPolylineClickHandler(async index => {
      const planner = this.#sidebar.routePlanner;
      if (planner) planner.selectAltCard(index);
      const summary = this.#lastRouteSummaries[index];
      if (!summary) return;
      try {
        const count = await this.#map.showFuelStations(summary.routePath);
        if (planner && count > 0) {
          const km      = summary.distanceKm.toFixed(1);
          const mins    = Math.round(summary.durationMin);
          const hrs     = Math.floor(mins / 60);
          const remMins = mins % 60;
          const dur     = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
          planner.setStatus(`Route ${index + 1}: ${km} km · ${dur} · ${count} fuel station${count === 1 ? '' : 's'}`);
        }
      } catch { /* non-critical */ }
    });

    // Wire settings change events (bubbled from <app-settings> inside the sidebar)
    this.#sidebar.addEventListener('setting-change', e => this.#onSettingChange(e));
  }

  // ── private helpers ──────────────────────────────────────────────────────

  /**
   * Re-renders the planned route using the planner's current resolved waypoints,
   * then updates the status bar, route summary, and fuel-station overlay.
   * Used after any in-place edit (double-click insert, marker drag).
   *
   * @param {RoutePlannerComponent} planner
   */
  async #recalculateRoute(planner) {
    const waypoints = planner.resolvedWaypoints;
    if (waypoints.length < 2) return;
    planner.setStatus('Recalculating route…');
    try {
      const mapped = waypoints.map(w => ({ address: w.address, lat: w.lat, lng: w.lng }));
      const summaries = await this.#map.renderPlannedRoute(
        mapped,
        {
          avoidHighways: planner.avoidHighways,
          avoidTolls:    planner.avoidTolls,
          avoidFerries:  planner.avoidFerries,
        },
      );
      this.#lastRouteSummaries = summaries;
      // After recalculation (e.g. drag), always reset to route 0 — alternatives
      // may have changed.  Use the first summary as the active one.
      const primary = summaries[0];
      const km      = primary.distanceKm.toFixed(1);
      const mins    = Math.round(primary.durationMin);
      const hrs     = Math.floor(mins / 60);
      const remMins = mins % 60;
      const duration = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
      planner.setStatus(`Route: ${km} km · ${duration}`);
      planner.setRouteSummaries(summaries, mapped, 0);
      try {
        const count = await this.#map.showFuelStations(primary.routePath);
        if (count > 0) {
          planner.setStatus(`Route: ${km} km · ${duration} · ${count} fuel station${count === 1 ? '' : 's'}`);
        }
      } catch { /* non-critical */ }
    } catch (err) {
      console.error('Route recalculation failed', err);
      planner.setStatus('Failed to recalculate route.', true);
    }
  }

  // ── private handlers ─────────────────────────────────────────────────────

  #onMapLoaded() {
    const { tripList, poiList } = this.#sidebar;

    tripList.setTrips(this.#map.trips);
    poiList.setPoiList(this.#map.pois);

    this.#sidebar.show();

    // Apply persisted settings now that the map layers exist
    const settings = this.#sidebar.querySelector('app-settings');
    if (settings) {
      const { showRouteDirections, showPoi, showTerrain, darkMap } = settings.values;
      if (!showRouteDirections) this.#map.setRouteDirections(false);
      if (!showPoi) this.#map.setPoiVisibility(false);
      if (!showTerrain) this.#map.setTerrainEnabled(false);
      if (darkMap) this.#map.setDarkMap(true);
    }

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

  // ── route planner handlers ─────────────────────────────────────────────────

  /**
   * Geocodes a waypoint address and resolves the result back into the planner.
   * @param {CustomEvent} e  — detail: { id: number, address: string }
   */
  async #onRouteGeocode({ detail: { id, address } }) {
    const planner = this.#sidebar.routePlanner;
    if (!planner) return;

    planner.setStatus(`Searching "${address}"…`);
    const coords = await this.#map.geocode(address);

    if (coords) {
      planner.resolveWaypoint(id, coords.lat, coords.lng);
      planner.setStatus('');
    } else {
      planner.setStatus(`Could not find "${address}". Try a more specific address.`, true);
    }
  }

  /**
   * Renders the planned route on the map and shows alternatives.
   * @param {CustomEvent} e  — detail: { waypoints: [{address,lat,lng}], avoidHighways, avoidTolls, avoidFerries }
   */
  async #onRoutePlan({ detail: { waypoints, avoidHighways, avoidTolls, avoidFerries } }) {
    const planner = this.#sidebar.routePlanner;
    if (!planner) return;

    planner.setStatus('Calculating route…');

    try {
      const summaries = await this.#map.renderPlannedRoute(
        waypoints,
        { avoidHighways, avoidTolls, avoidFerries },
      );
      this.#lastRouteSummaries = summaries;
      const primary = summaries[0];
      const km      = primary.distanceKm.toFixed(1);
      const mins    = Math.round(primary.durationMin);
      const hrs     = Math.floor(mins / 60);
      const remMins = mins % 60;
      const duration = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
      planner.setStatus(`Route: ${km} km · ${duration}`);
      planner.setRouteSummaries(summaries, waypoints, 0);

      // Automatically show fuel stations along the active route.
      try {
        const count = await this.#map.showFuelStations(primary.routePath);
        if (count > 0) {
          planner.setStatus(`Route: ${km} km · ${duration} · ${count} fuel station${count === 1 ? '' : 's'}`);
        }
      } catch {
        // Fuel station search failing is non-critical — route is still shown.
      }
    } catch (err) {
      console.error('Route planning failed', err);
      planner.setStatus('Failed to calculate route.', true);
    }
  }

  /**
   * Switches the active route to the chosen alternative without re-fetching directions.
   * Also refreshes the fuel station overlay for the newly selected route path.
   *
   * @param {CustomEvent} e — detail: { index: number }
   */
  async #onRouteAltSelect({ detail: { index } }) {
    this.#map.selectAlternativeRoute(index);
    const summary = this.#lastRouteSummaries[index];
    if (!summary) return;
    try {
      const count = await this.#map.showFuelStations(summary.routePath);
      const planner = this.#sidebar.routePlanner;
      if (planner && count > 0) {
        const km      = summary.distanceKm.toFixed(1);
        const mins    = Math.round(summary.durationMin);
        const hrs     = Math.floor(mins / 60);
        const remMins = mins % 60;
        const dur     = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
        planner.setStatus(`Route ${index + 1}: ${km} km · ${dur} · ${count} fuel station${count === 1 ? '' : 's'}`);
      }
    } catch { /* non-critical */ }
  }

  /**
   * Downloads the planned route as a trip JSON file.
   * @param {CustomEvent} e  — detail: { waypoints, routePath, distanceKm, durationMin, avoidHighways, avoidTolls, avoidFerries }
   */
  #onRouteSave({ detail: { waypoints, routePath, distanceKm, durationMin, avoidHighways, avoidTolls, avoidFerries } }) {
    // Build filename in the same format as existing trips: trip_DD-MM-YY.json
    const now = new Date();
    const dd  = String(now.getDate()).padStart(2, '0');
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const yy  = String(now.getFullYear()).slice(-2);
    const id  = `trip_${dd}-${mm}-${yy}`;

    // Build the trip object matching the existing schema
    const lastIdx = waypoints.length - 1;
    const trip = {
      id,
      title: waypoints[0]?.address
        ? `Ride from ${waypoints[0].address}`
        : 'Planned ride',
      date: now.toISOString().slice(0, 10),
      waypoints: waypoints.map((wp, i) => ({
        lat: wp.lat,
        lng: wp.lng,
        // Mark start and finish visible so "My Rides" renders both endpoint markers.
        ...(i === 0 || i === lastIdx ? { isVisible: true } : {}),
        // Preserve address for display (e.g. info-window labels).
        ...(wp.address ? { label: wp.address } : {}),
      })),
      // Always preserve avoidance options so the route is re-drawn identically in "My Rides".
      avoidHighways: avoidHighways ?? false,
      avoidTolls:    avoidTolls    ?? false,
      avoidFerries:  avoidFerries  ?? false,
    };

    const json = JSON.stringify(trip, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Opens the planned route in Google Maps in a new browser tab.
   *
   * Uses the Google Maps Directions URL API:
   *   https://developers.google.com/maps/documentation/urls/get-started#directions-action
   *
   * Format:
   *   https://www.google.com/maps/dir/?api=1
   *     &origin=<lat,lng>
   *     &destination=<lat,lng>
   *     &waypoints=<lat,lng>|<lat,lng>|…   (intermediate stops only, max 8)
   *     &travelmode=two-wheeler
   *
   * @param {CustomEvent} e  — detail: { waypoints: [{address, lat, lng}] }
   */
  #onRouteExportGMaps({ detail: { waypoints } }) {
    if (!waypoints || waypoints.length < 2) return;

    const origin      = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediate = waypoints.slice(1, -1); // may be empty

    const params = new URLSearchParams({
      api:        '1',
      origin:     `${origin.lat},${origin.lng}`,
      destination:`${destination.lat},${destination.lng}`,
      travelmode: 'driving',
    });

    // Google Maps URLs API supports up to 8 intermediate waypoints.
    if (intermediate.length > 0) {
      const wpStr = intermediate
        .slice(0, 8)
        .map(wp => `${wp.lat},${wp.lng}`)
        .join('|');
      params.set('waypoints', wpStr);
    }

    const gmapsUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
    window.open(gmapsUrl, '_blank', 'noopener,noreferrer');
  }

  /** Clears the planned route from the map. */
  #onRouteClear() {
    this.#map.clearPlannedRoute();
    this.#map.clearFuelStations();
    this.#map.disablePickMode();
  }

  /**
   * Handles setting changes from the settings panel.
   * @param {CustomEvent} e — detail: { key: string, value: any }
   */
  #onSettingChange({ detail: { key, value } }) {
    if (key === 'showRouteDirections') {
      this.#map.setRouteDirections(value);
    }
    if (key === 'showPoi') {
      this.#map.setPoiVisibility(value);
    }
    if (key === 'showTerrain') {
      this.#map.setTerrainEnabled(value);
    }
    if (key === 'darkMap') {
      this.#map.setDarkMap(value);
    }
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
