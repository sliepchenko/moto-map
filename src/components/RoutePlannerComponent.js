/**
 * `<route-planner>` — sidebar panel for building a custom route.
 *
 * The user can:
 *  1. Add up to 10 waypoints by typing an address or clicking the map.
 *  2. Reorder waypoints via drag-and-drop (or up/down buttons).
 *  3. Remove individual waypoints.
 *  4. Press "Get Directions" to request a road-following route.
 *  5. Press "Save Route" to download the planned route as a trip JSON file.
 *  6. Press "Clear" to reset the planner.
 *
 * Fires custom events (bubble up to the sidebar):
 *  - `route-plan`   { waypoints: [{address,lat,lng}], avoidHighways, avoidTolls, avoidFerries }  — when the user submits
 *  - `route-save`   { waypoints, routePath, distanceKm, durationMin, avoidHighways, avoidTolls, avoidFerries } — download trip JSON
 *  - `route-clear`                                       — when the user clears
 *  - `route-pick-start`                                  — ask map for a click-to-add-waypoint mode
 *
 * SOLID notes:
 *  - SRP: manages only the planner UI; no map calls, no routing calls.
 *  - OCP: geocoding and rendering are handled outside this component.
 */
export class RoutePlannerComponent extends HTMLElement {
  /** @type {Array<{id: number, address: string, lat: number|null, lng: number|null}>} */
  #waypoints = [];
  #nextId = 0;
  /** @type {HTMLElement|null} */
  #list = null;
  /** @type {HTMLElement|null} */
  #statusEl = null;
  /** @type {boolean} */
  #pickingMode = false;
  /**
   * Stored after a successful "Get Directions" call so "Save Route" can use it.
   * @type {{ waypoints: object[], routePath: object[], distanceKm: number, durationMin: number }|null}
   */
  #lastRouteSummary = null;

  // ── avoidance options ──────────────────────────────────────────────────────
  /** @type {boolean} */ #avoidHighways = false;
  /** @type {boolean} */ #avoidTolls    = false;
  /** @type {boolean} */ #avoidFerries  = false;

  connectedCallback() {
    this.#buildDOM();
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Called by the map controller when the user clicks the map in pick mode.
   * @param {number} lat
   * @param {number} lng
   * @param {string} [label]
   */
  addMapPoint(lat, lng, label = '') {
    this.#addWaypoint(label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
    this.#setPickingMode(false);
    this.#render();
  }

  /** Resolves geocoded coordinates back into a waypoint slot (by id). */
  resolveWaypoint(id, lat, lng) {
    const wp = this.#waypoints.find(w => w.id === id);
    if (!wp) return;
    wp.lat = lat;
    wp.lng = lng;
    this.#render();
  }

  /** Show a temporary status message. */
  setStatus(msg, isError = false) {
    if (!this.#statusEl) return;
    this.#statusEl.textContent = msg;
    this.#statusEl.style.color = isError ? '#f87171' : '#6b7280';
  }

  /**
   * Called by the orchestrator after a successful route calculation.
   * Enables the "Save Route" button.
   * @param {{ waypoints: object[], routePath: object[], distanceKm: number, durationMin: number }} summary
   */
  setRouteSummary(summary) {
    // Capture the current avoidance options so they are included in the export.
    this.#lastRouteSummary = {
      ...summary,
      avoidHighways: this.#avoidHighways,
      avoidTolls:    this.#avoidTolls,
      avoidFerries:  this.#avoidFerries,
    };
    const saveBtn = this.querySelector('#rp-save-btn');
    if (saveBtn) saveBtn.disabled = false;
  }

  /** Returns the waypoints that have been geocoded (lat/lng resolved). */
  get resolvedWaypoints() {
    return this.#waypoints.filter(w => w.lat !== null && w.lng !== null);
  }

  // ── private ──────────────────────────────────────────────────────────────

  #buildDOM() {
    this.innerHTML = `
      <div class="rp-container">
        <div class="rp-waypoints" id="rp-waypoints"></div>
        <div class="rp-add-row">
          <input
            class="rp-input"
            id="rp-new-address"
            type="text"
            placeholder="Add a stop (address or place)"
            autocomplete="off"
          />
          <button class="rp-btn rp-btn-icon rp-btn-add" title="Add stop" id="rp-add-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="rp-btn rp-btn-icon rp-btn-pick" id="rp-pick-btn" title="Click on map to add stop">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
          </button>
        </div>
        <div class="rp-status" id="rp-status"></div>
        <div class="rp-options">
          <button
            class="rp-option-toggle ${this.#avoidHighways ? 'on' : ''}"
            id="rp-avoid-highways"
            role="switch"
            aria-checked="${this.#avoidHighways}"
            data-key="avoidHighways"
            title="Avoid highways / motorways"
          >
            <span class="rp-option-thumb"></span>
            <span class="rp-option-label">No highways</span>
          </button>
          <button
            class="rp-option-toggle ${this.#avoidTolls ? 'on' : ''}"
            id="rp-avoid-tolls"
            role="switch"
            aria-checked="${this.#avoidTolls}"
            data-key="avoidTolls"
            title="Avoid toll roads"
          >
            <span class="rp-option-thumb"></span>
            <span class="rp-option-label">No tolls</span>
          </button>
          <button
            class="rp-option-toggle ${this.#avoidFerries ? 'on' : ''}"
            id="rp-avoid-ferries"
            role="switch"
            aria-checked="${this.#avoidFerries}"
            data-key="avoidFerries"
            title="Avoid ferries"
          >
            <span class="rp-option-thumb"></span>
            <span class="rp-option-label">No ferries</span>
          </button>
        </div>
        <div class="rp-actions">
          <button class="rp-btn rp-btn-directions" id="rp-go-btn" disabled>Get Directions</button>
          <button class="rp-btn rp-btn-save" id="rp-save-btn" disabled>Save Route</button>
          <button class="rp-btn rp-btn-clear" id="rp-clear-btn">Clear</button>
        </div>
      </div>
    `;

    this.#list      = this.querySelector('#rp-waypoints');
    this.#statusEl  = this.querySelector('#rp-status');

    this.querySelector('#rp-add-btn').addEventListener('click',  () => this.#onAddClick());
    this.querySelector('#rp-pick-btn').addEventListener('click', () => this.#onPickClick());
    this.querySelector('#rp-go-btn').addEventListener('click',   () => this.#onGoClick());
    this.querySelector('#rp-save-btn').addEventListener('click', () => this.#onSaveClick());
    this.querySelector('#rp-clear-btn').addEventListener('click',() => this.#onClearClick());

    // Bind avoidance toggles
    this.querySelectorAll('.rp-option-toggle').forEach(btn =>
      btn.addEventListener('click', () => this.#onOptionToggle(btn)));

    const input = this.querySelector('#rp-new-address');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.#onAddClick();
    });

    this.#render();
  }

  #addWaypoint(address, lat = null, lng = null) {
    if (this.#waypoints.length >= 10) {
      this.setStatus('Maximum 10 stops reached.', true);
      return;
    }
    this.#waypoints.push({ id: this.#nextId++, address, lat, lng });
  }

  #removeWaypoint(id) {
    this.#waypoints = this.#waypoints.filter(w => w.id !== id);
    this.#render();
  }

  #moveWaypoint(id, direction) {
    const idx = this.#waypoints.findIndex(w => w.id === id);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= this.#waypoints.length) return;
    [this.#waypoints[idx], this.#waypoints[target]] = [this.#waypoints[target], this.#waypoints[idx]];
    this.#render();
  }

  #render() {
    if (!this.#list) return;

    const resolved = this.resolvedWaypoints;
    const goBtn    = this.querySelector('#rp-go-btn');
    if (goBtn) goBtn.disabled = resolved.length < 2;

    this.#list.innerHTML = this.#waypoints.map((wp, i) => `
      <div class="rp-wp-row" data-id="${wp.id}">
        <span class="rp-wp-index">${i + 1}</span>
        <span class="rp-wp-label ${wp.lat !== null ? 'resolved' : 'pending'}" title="${wp.address}">
          ${wp.address}
        </span>
        <div class="rp-wp-controls">
          <button class="rp-wp-btn rp-wp-up"   data-id="${wp.id}" title="Move up"   ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="rp-wp-btn rp-wp-down"  data-id="${wp.id}" title="Move down" ${i === this.#waypoints.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="rp-wp-btn rp-wp-remove" data-id="${wp.id}" title="Remove">✕</button>
        </div>
      </div>
    `).join('');

    // Bind row buttons
    this.#list.querySelectorAll('.rp-wp-up').forEach(btn =>
      btn.addEventListener('click', () => this.#moveWaypoint(+btn.dataset.id, -1)));
    this.#list.querySelectorAll('.rp-wp-down').forEach(btn =>
      btn.addEventListener('click', () => this.#moveWaypoint(+btn.dataset.id, +1)));
    this.#list.querySelectorAll('.rp-wp-remove').forEach(btn =>
      btn.addEventListener('click', () => this.#removeWaypoint(+btn.dataset.id)));
  }

  #onAddClick() {
    const input   = this.querySelector('#rp-new-address');
    const address = input.value.trim();
    if (!address) return;
    this.#addWaypoint(address);
    input.value = '';
    this.#render();
    // Ask the controller to geocode this waypoint
    const wp = this.#waypoints.at(-1);
    this.#emitGeocode(wp.id, address);
  }

  #onPickClick() {
    this.#setPickingMode(!this.#pickingMode);
  }

  #setPickingMode(active) {
    this.#pickingMode = active;
    const btn = this.querySelector('#rp-pick-btn');
    if (!btn) return;
    btn.classList.toggle('active', active);
    btn.title = active ? 'Click on map to add stop (click again to cancel)' : 'Click on map to add stop';
    if (active) {
      this.dispatchEvent(new CustomEvent('route-pick-start', { bubbles: true, composed: true }));
    } else {
      this.dispatchEvent(new CustomEvent('route-pick-cancel', { bubbles: true, composed: true }));
    }
  }

  #onGoClick() {
    const waypoints = this.resolvedWaypoints;
    if (waypoints.length < 2) {
      this.setStatus('Add at least 2 resolved stops.', true);
      return;
    }
    this.setStatus('');
    this.dispatchEvent(new CustomEvent('route-plan', {
      bubbles: true,
      composed: true,
      detail: {
        waypoints:     waypoints.map(w => ({ address: w.address, lat: w.lat, lng: w.lng })),
        avoidHighways: this.#avoidHighways,
        avoidTolls:    this.#avoidTolls,
        avoidFerries:  this.#avoidFerries,
      },
    }));
  }

  #onClearClick() {
    this.#waypoints = [];
    this.#lastRouteSummary = null;
    this.#setPickingMode(false);
    this.setStatus('');
    this.#render();
    const saveBtn = this.querySelector('#rp-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    this.dispatchEvent(new CustomEvent('route-clear', { bubbles: true, composed: true }));
  }

  #onSaveClick() {
    if (!this.#lastRouteSummary) return;
    const { waypoints, routePath, distanceKm, durationMin, avoidHighways, avoidTolls, avoidFerries } = this.#lastRouteSummary;
    this.dispatchEvent(new CustomEvent('route-save', {
      bubbles: true,
      composed: true,
      detail: { waypoints, routePath, distanceKm, durationMin, avoidHighways, avoidTolls, avoidFerries },
    }));
  }

  /** Handles clicks on an avoidance toggle pill. */
  #onOptionToggle(btn) {
    const key  = btn.dataset.key;
    const next = !(btn.getAttribute('aria-checked') === 'true');

    if (key === 'avoidHighways') this.#avoidHighways = next;
    if (key === 'avoidTolls')    this.#avoidTolls    = next;
    if (key === 'avoidFerries')  this.#avoidFerries  = next;

    btn.setAttribute('aria-checked', String(next));
    btn.classList.toggle('on', next);
  }

  /** Fires a geocode request up to the orchestrator. */
  #emitGeocode(id, address) {
    this.dispatchEvent(new CustomEvent('route-geocode', {
      bubbles: true,
      composed: true,
      detail: { id, address },
    }));
  }
}

customElements.define('route-planner', RoutePlannerComponent);
