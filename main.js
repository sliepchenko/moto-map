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
import { LocationTracker }      from './src/core/LocationTracker.js';
import { NavigationSession }    from './src/map/NavigationSession.js';

// Register WebComponents before the DOM parser encounters their tags.
import './src/components/TripListComponent.js';
import './src/components/PoiListComponent.js';
import './src/components/AppSidebarComponent.js';
import './src/components/RoutePlannerComponent.js';
import './src/components/AppSettingsComponent.js';
import './src/components/NavigationHudComponent.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = 'AIzaSyD_XkQAhqeRRkLct-LBdcwP5QfIMvU0B4I';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

class App {
  /** @type {MapController} */         #map;
  /** @type {AppSidebarComponent} */   #sidebar;
  /** @type {UrlStateManager} */       #urlState;
  /** @type {NavigationHudComponent} */ #navHud;
  /** @type {LocationTracker} */       #locationTracker;
  /** @type {NavigationSession} */     #navSession;

  /**
   * Pending destination (geocoded lat/lng) waiting for user to tap "Start".
   * @type {{ lat: number, lng: number, path: Array, distanceKm: number, durationMin: number }|null}
   */
  #pendingNav = null;

  constructor() {
    this.#urlState  = new UrlStateManager();
    this.#sidebar   = document.querySelector('app-sidebar');
    this.#map       = new MapController(
      GOOGLE_MAPS_API_KEY,
      document.getElementById('map'),
    );
    this.#locationTracker = new LocationTracker();
    this.#navSession      = new NavigationSession();
    this.#navHud          = document.querySelector('navigation-hud');
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
    this.#sidebar.addEventListener('route-geocode',   e => this.#onRouteGeocode(e));
    this.#sidebar.addEventListener('route-plan',      e => this.#onRoutePlan(e));
    this.#sidebar.addEventListener('route-save',      e => this.#onRouteSave(e));
    this.#sidebar.addEventListener('route-clear',     () => this.#onRouteClear());
    this.#sidebar.addEventListener('route-pick-start',() => this.#map.enablePickMode());
    this.#sidebar.addEventListener('route-pick-cancel',() => this.#map.disablePickMode());

    // Wire map-pick event back — routes to nav HUD or route planner depending on context
    this.#map.on('map-pick', ({ lat, lng }) => {
      if (this.#navHud.querySelector('.nav-search-overlay:not(.hidden)')) {
        // Navigation HUD is open — treat pick as a destination
        this.#navHud.setPickMode(false);
        this.#map.disablePickMode();
        this.#onNavCoordinate(lat, lng);
      } else {
        // Otherwise feed into route planner
        this.#sidebar.routePlanner?.addMapPoint(lat, lng);
      }
    });

    // Wire settings change events (bubbled from <app-settings> inside the sidebar)
    this.#sidebar.addEventListener('setting-change', e => this.#onSettingChange(e));

    // ── Navigation HUD events ────────────────────────────────────────────────

    // Sidebar "Navigate" button → open the HUD search bar
    this.#sidebar.addEventListener('nav-open', () => this.#navHud.openSearch());

    // User typed/picked a destination address
    document.addEventListener('nav-destination', e => this.#onNavDestination(e));

    // User confirmed "Start"
    document.addEventListener('nav-start', () => this.#onNavStart());

    // User cancelled / stopped navigation
    document.addEventListener('nav-stop', () => this.#onNavStop());

    // Re-center map on current GPS position
    document.addEventListener('nav-recenter', () => this.#onNavRecenter());

    // Pick-on-map buttons for nav HUD
    document.addEventListener('nav-pick-start',  () => this.#map.enablePickMode());
    document.addEventListener('nav-pick-cancel', () => this.#map.disablePickMode());

    // LocationTracker → update map dot + session
    this.#locationTracker.onPosition(pos => this.#onGpsPosition(pos));
    this.#locationTracker.onError(err  => {
      console.warn('GPS error:', err.message ?? err);
    });

    // NavigationSession callbacks
    this.#navSession.onStep(step => {
      this.#navHud.updateStep(step);
    });
    this.#navSession.onArrived(() => {
      this.#locationTracker.stop();
      this.#navHud.showArrived();
    });
    this.#navSession.onError(msg => {
      this.#navHud.showError(msg);
    });
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
   * Renders the planned route on the map and shows a summary.
   * @param {CustomEvent} e  — detail: { waypoints: [{address,lat,lng}], avoidHighways, avoidTolls, avoidFerries }
   */
  async #onRoutePlan({ detail: { waypoints, avoidHighways, avoidTolls, avoidFerries } }) {
    const planner = this.#sidebar.routePlanner;
    if (!planner) return;

    planner.setStatus('Calculating route…');

    try {
      const summary = await this.#map.renderPlannedRoute(
        waypoints,
        { avoidHighways, avoidTolls, avoidFerries },
      );
      const km      = summary.distanceKm.toFixed(1);
      const mins    = Math.round(summary.durationMin);
      const hrs     = Math.floor(mins / 60);
      const remMins = mins % 60;
      const duration = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
      planner.setStatus(`Route: ${km} km · ${duration}`);
      planner.setRouteSummary({
        waypoints,
        routePath:   summary.routePath,
        distanceKm:  summary.distanceKm,
        durationMin: summary.durationMin,
      });
    } catch (err) {
      console.error('Route planning failed', err);
      planner.setStatus('Failed to calculate route.', true);
    }
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

  /** Clears the planned route from the map. */
  #onRouteClear() {
    this.#map.clearPlannedRoute();
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

  // ── navigation handlers ───────────────────────────────────────────────────

  /**
   * User submitted a destination address from the nav HUD search bar.
   * Geocodes it, then calls `#onNavCoordinate`.
   * @param {CustomEvent} e — detail: { address: string }
   */
  async #onNavDestination({ detail: { address } }) {
    const coords = await this.#map.geocode(address);
    if (!coords) {
      this.#navHud.showError(`Could not find "${address}". Try a more specific address.`);
      return;
    }
    await this.#onNavCoordinate(coords.lat, coords.lng);
  }

  /**
   * Requests a route from current GPS position to the given coordinate and
   * shows the preview (distance + duration + "Start" button).
   *
   * @param {number} lat
   * @param {number} lng
   */
  async #onNavCoordinate(lat, lng) {
    // We need a current GPS position to compute the route from.
    let origin = this.#locationTracker.lastPosition;

    if (!origin) {
      // Try to get a one-shot position first
      origin = await this.#getOneTimePosition();
      if (!origin) {
        this.#navHud.showError('Could not determine your current location. Please enable GPS.');
        return;
      }
    }

    this.#navHud.showLoading();

    const result = await this.#navSession.start(origin, { lat, lng });
    if (!result) return; // error already emitted by session

    this.#pendingNav = { lat, lng, ...result };

    // Draw the route preview on the map
    this.#map.drawNavigationRoute(result.path, { lat, lng });

    this.#navHud.setRoutePreview(result.distanceKm, result.durationMin);
  }

  /**
   * User tapped "Start" on the route preview — begin turn-by-turn navigation.
   */
  #onNavStart() {
    if (!this.#pendingNav) return;

    // Start GPS tracking
    this.#locationTracker.start();

    // The session is already started (from preview); just show the HUD
    const firstStep = this.#navSession.steps[0];
    if (firstStep) {
      this.#navHud.startNavigating({
        instruction: firstStep.instruction,
        distance:    firstStep.distance,
        maneuver:    firstStep.maneuver,
        stepIndex:   0,
        totalSteps:  this.#navSession.steps.length,
      });
    }

    // Enable auto-follow
    this.#map.setFollowPosition(true);
  }

  /** User cancelled or stopped navigation. */
  #onNavStop() {
    this.#locationTracker.stop();
    this.#navSession.stop();
    this.#map.clearNavigation();
    this.#pendingNav = null;
  }

  /** Re-center the map on the latest GPS position. */
  #onNavRecenter() {
    const pos = this.#locationTracker.lastPosition;
    if (pos) this.#map.recenterOnPosition(pos);
    this.#map.setFollowPosition(true);
  }

  /**
   * Called on every new GPS position during navigation.
   * @param {{ lat: number, lng: number, accuracy: number }} pos
   */
  #onGpsPosition(pos) {
    this.#map.updateNavigationPosition(pos);
    this.#navSession.updatePosition(pos);
  }

  /**
   * Returns a single GPS fix using `getCurrentPosition`, or null on error.
   * @returns {Promise<{ lat: number, lng: number }|null>}
   */
  #getOneTimePosition() {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()  => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
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
