/**
 * `<route-planner>` — sidebar panel for building a custom route.
 *
 * The user can:
 *  1. Add up to 10 waypoints by typing an address or clicking the map.
 *  2. Reorder waypoints via drag-and-drop (or up/down buttons).
 *  3. Remove individual waypoints.
 *  4. Press "Get Directions" to request a road-following route.
 *  5. Pick from up to 3 alternative routes shown as selectable cards, each
 *     with a colour swatch matching the polyline on the map.
 *  6. Press "Save Route" to download the planned route as a trip JSON file.
 *  7. Press "Open in Google Maps" to open the route in Google Maps.
 *  8. Press "Clear" to reset the planner.
 *
 * Fires custom events (bubble up to the sidebar):
 *  - `route-plan`              { waypoints: [{address,lat,lng}], avoidHighways, avoidTolls, avoidFerries }  — when the user submits
 *  - `route-alternative-select`{ index: number }                 — when the user picks an alternative
 *  - `route-save`              { waypoints, routePath, distanceKm, durationMin, avoidHighways, avoidTolls, avoidFerries } — download trip JSON
 *  - `route-export-gmaps`      { waypoints: [{address,lat,lng}] }     — open route in Google Maps
 *  - `route-clear`                                                — when the user clears
 *  - `route-pick-start`                                           — ask map for a click-to-add-waypoint mode
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
  /** @type {number|null} id of the waypoint currently being dragged */
  #dragId = null;
  /** @type {number|null} id of the waypoint whose label is being inline-edited */
  #editingId = null;
  /**
   * Stored after a successful "Get Directions" call so "Save Route" can use it.
   * Always reflects the currently *selected* alternative (index #activeAltIndex).
   * @type {{ waypoints: object[], routePath: object[], distanceKm: number, durationMin: number }|null}
   */
  #lastRouteSummary = null;

  /**
   * All route alternative summaries from the last render call.
   * @type {Array<{distanceKm: number, durationMin: number, legs: object[], routePath: object[], hasTolls: boolean}>}
   */
  #allSummaries = [];

  /** 0-based index of the selected alternative (matches what the map is showing). */
  #activeAltIndex = 0;

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

  /**
   * Inserts a new stop at `index` in the waypoints list (from a route double-click).
   * @param {number} lat
   * @param {number} lng
   * @param {number} index  0-based insertion index
   */
  insertMapPoint(lat, lng, index) {
    if (this.#waypoints.length >= 10) {
      this.setStatus('Maximum 10 stops reached.', true);
      return;
    }
    const wp = { id: this.#nextId++, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
    this.#waypoints.splice(index, 0, wp);
    this.#render();
  }

  /**
   * Updates the lat/lng of a waypoint by its list index (from a map marker drag).
   * Also updates the address label to the new coordinates.
   * @param {number} index  0-based index in the resolved waypoints list
   * @param {number} lat
   * @param {number} lng
   */
  updateWaypointPosition(index, lat, lng) {
    const resolved = this.resolvedWaypoints;
    const wp = resolved[index];
    if (!wp) return;
    wp.lat     = lat;
    wp.lng     = lng;
    wp.address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
   * Stores the summary for the active route and enables Save/GMaps buttons.
   * For multiple alternatives, prefer calling `setRouteSummaries()` instead.
   *
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
    const saveBtn  = this.querySelector('#rp-save-btn');
    if (saveBtn) saveBtn.disabled = false;
    const gmapsBtn = this.querySelector('#rp-gmaps-btn');
    if (gmapsBtn) gmapsBtn.disabled = false;
  }

  /**
   * Called by the orchestrator when route alternatives are available.
   * Renders a selectable card list in the panel and enables Save/GMaps.
   *
   * @param {Array<{distanceKm: number, durationMin: number, legs: object[], routePath: object[], hasTolls: boolean, color?: string}>} summaries
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints   resolved waypoint list
   * @param {number} [activeIndex=0]   which summary is currently shown on the map
   */
  setRouteSummaries(summaries, waypoints, activeIndex = 0) {
    this.#allSummaries   = summaries;
    this.#activeAltIndex = activeIndex;

    // Always keep #lastRouteSummary in sync with the active summary
    const active = summaries[activeIndex];
    if (active) {
      this.#lastRouteSummary = {
        waypoints,
        routePath:    active.routePath,
        distanceKm:   active.distanceKm,
        durationMin:  active.durationMin,
        avoidHighways: this.#avoidHighways,
        avoidTolls:    this.#avoidTolls,
        avoidFerries:  this.#avoidFerries,
      };
    }

    this.#renderAlternatives(waypoints);

    const saveBtn  = this.querySelector('#rp-save-btn');
    if (saveBtn) saveBtn.disabled = false;
    const gmapsBtn = this.querySelector('#rp-gmaps-btn');
    if (gmapsBtn) gmapsBtn.disabled = false;
  }

  /**
   * Selects an alternative card by index without emitting `route-alternative-select`.
   * Used when the map polyline is clicked directly so we only sync the UI.
   *
   * @param {number} index
   */
  selectAltCard(index) {
    if (index < 0 || index >= this.#allSummaries.length) return;
    if (index === this.#activeAltIndex) return;

    this.#activeAltIndex = index;
    const active = this.#allSummaries[index];
    if (active) {
      this.#lastRouteSummary = {
        ...(this.#lastRouteSummary ?? {}),
        routePath:   active.routePath,
        distanceKm:  active.distanceKm,
        durationMin: active.durationMin,
      };
      const km      = active.distanceKm.toFixed(1);
      const mins    = Math.round(active.durationMin);
      const hrs     = Math.floor(mins / 60);
      const remMins = mins % 60;
      const dur     = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
      this.setStatus(`Route ${index + 1}: ${km} km · ${dur}`);
    }

    // Refresh card highlights only
    this.querySelectorAll('.rp-alt-card').forEach((card, i) => {
      card.classList.toggle('active', i === index);
    });
  }

  /** Returns the waypoints that have been geocoded (lat/lng resolved). */
  get resolvedWaypoints() {
    return this.#waypoints.filter(w => w.lat !== null && w.lng !== null);
  }

  /** @returns {boolean} */
  get avoidHighways() { return this.#avoidHighways; }
  /** @returns {boolean} */
  get avoidTolls()    { return this.#avoidTolls; }
  /** @returns {boolean} */
  get avoidFerries()  { return this.#avoidFerries; }

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
          <button class="rp-btn rp-btn-directions" id="rp-go-btn" disabled>Build</button>
          <button class="rp-btn rp-btn-save" id="rp-save-btn" disabled>Download</button>
          <button class="rp-btn rp-btn-gmaps" id="rp-gmaps-btn" disabled title="Open this route in Google Maps">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:middle;margin-right:4px">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>Google
          </button>
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
    this.querySelector('#rp-gmaps-btn').addEventListener('click',() => this.#onGMapsClick());
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

    this.#list.innerHTML = this.#waypoints.map((wp, i) => {
      const isEditing = this.#editingId === wp.id;
      const labelHtml = isEditing
        ? `<input
             class="rp-wp-label-edit"
             data-id="${wp.id}"
             type="text"
             value="${wp.address.replace(/"/g, '&quot;')}"
             autocomplete="off"
             title="Press Enter or click away to save"
           />`
        : `<span class="rp-wp-label ${wp.lat !== null ? 'resolved' : 'pending'}"
                title="Double-click to rename · ${wp.address}">
             ${wp.address}
           </span>`;
      return `
        <div class="rp-wp-row${isEditing ? ' rp-wp-editing' : ''}" data-id="${wp.id}" draggable="${isEditing ? 'false' : 'true'}">
          <span class="rp-wp-handle" title="Drag to reorder">⠿</span>
          <span class="rp-wp-index">${i + 1}</span>
          ${labelHtml}
          <div class="rp-wp-controls">
            <button class="rp-wp-btn rp-wp-up"   data-id="${wp.id}" title="Move up"   ${i === 0 ? 'disabled' : ''}>▲</button>
            <button class="rp-wp-btn rp-wp-down"  data-id="${wp.id}" title="Move down" ${i === this.#waypoints.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="rp-wp-btn rp-wp-remove" data-id="${wp.id}" title="Remove">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind row buttons
    this.#list.querySelectorAll('.rp-wp-up').forEach(btn =>
      btn.addEventListener('click', () => this.#moveWaypoint(+btn.dataset.id, -1)));
    this.#list.querySelectorAll('.rp-wp-down').forEach(btn =>
      btn.addEventListener('click', () => this.#moveWaypoint(+btn.dataset.id, +1)));
    this.#list.querySelectorAll('.rp-wp-remove').forEach(btn =>
      btn.addEventListener('click', () => this.#removeWaypoint(+btn.dataset.id)));

    // Bind double-click to start inline label editing
    this.#list.querySelectorAll('.rp-wp-label').forEach(label => {
      label.addEventListener('dblclick', e => {
        e.stopPropagation();
        const row = label.closest('.rp-wp-row');
        if (row) this.#startEdit(+row.dataset.id);
      });
    });

    // Bind inline edit input events
    this.#list.querySelectorAll('.rp-wp-label-edit').forEach(input => {
      // Focus immediately and select all text
      requestAnimationFrame(() => { input.focus(); input.select(); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#commitEdit(+input.dataset.id, input.value);
        } else if (e.key === 'Escape') {
          this.#cancelEdit();
        }
      });
      input.addEventListener('blur', () => this.#commitEdit(+input.dataset.id, input.value));
      // Prevent drag from starting on the input
      input.addEventListener('mousedown', e => e.stopPropagation());
    });

    // Bind drag-and-drop handlers
    this.#list.querySelectorAll('.rp-wp-row:not(.rp-wp-editing)').forEach(row => {
      row.addEventListener('dragstart', e => this.#onDragStart(e, +row.dataset.id));
      row.addEventListener('dragover',  e => this.#onDragOver(e, +row.dataset.id));
      row.addEventListener('dragend',   () => this.#onDragEnd());
      row.addEventListener('drop',      e => e.preventDefault());
    });
  }

  // ── inline label editing ─────────────────────────────────────────────────

  /**
   * Enters inline-edit mode for the waypoint with the given id.
   * @param {number} id
   */
  #startEdit(id) {
    if (this.#editingId === id) return;
    this.#editingId = id;
    this.#render();
  }

  /**
   * Saves the new label and exits edit mode.
   * The lat/lng are preserved — only the display address is updated.
   * @param {number} id
   * @param {string} rawValue
   */
  #commitEdit(id, rawValue) {
    if (this.#editingId !== id) return;  // already committed / re-rendered
    const label = rawValue.trim();
    const wp = this.#waypoints.find(w => w.id === id);
    if (wp && label) wp.address = label;
    this.#editingId = null;
    this.#render();
  }

  /** Cancels editing without saving. */
  #cancelEdit() {
    if (this.#editingId === null) return;
    this.#editingId = null;
    this.#render();
  }

  /** @param {DragEvent} e @param {number} id */
  #onDragStart(e, id) {
    this.#dragId = id;
    e.dataTransfer.effectAllowed = 'move';
    // Slight delay so the browser renders the drag ghost before we add the dimming class
    requestAnimationFrame(() => {
      const row = this.#list?.querySelector(`[data-id="${id}"]`);
      if (row) row.classList.add('rp-wp-dragging');
    });
  }

  /** @param {DragEvent} e @param {number} overId */
  #onDragOver(e, overId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this.#dragId === null || this.#dragId === overId) return;

    const fromIdx = this.#waypoints.findIndex(w => w.id === this.#dragId);
    const toIdx   = this.#waypoints.findIndex(w => w.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Reorder the array live while dragging
    const updated = [...this.#waypoints];
    const [item]  = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, item);
    this.#waypoints = updated;
    this.#render();

    // Restore dragging state on the relocated row (render cleared it)
    requestAnimationFrame(() => {
      const row = this.#list?.querySelector(`[data-id="${this.#dragId}"]`);
      if (row) row.classList.add('rp-wp-dragging');
    });
  }

  #onDragEnd() {
    this.#dragId = null;
    this.#list?.querySelectorAll('.rp-wp-dragging').forEach(r => r.classList.remove('rp-wp-dragging'));
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
    this.#waypoints       = [];
    this.#lastRouteSummary = null;
    this.#allSummaries    = [];
    this.#activeAltIndex  = 0;
    this.#setPickingMode(false);
    this.setStatus('');
    this.#render();
    // Clear the alternatives panel if visible
    const altEl = this.querySelector('#rp-alternatives');
    if (altEl) altEl.remove();
    const saveBtn  = this.querySelector('#rp-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    const gmapsBtn = this.querySelector('#rp-gmaps-btn');
    if (gmapsBtn) gmapsBtn.disabled = true;
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

  #onGMapsClick() {
    if (!this.#lastRouteSummary) return;
    const { waypoints } = this.#lastRouteSummary;
    this.dispatchEvent(new CustomEvent('route-export-gmaps', {
      bubbles: true,
      composed: true,
      detail: { waypoints },
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

  // ── alternatives panel ────────────────────────────────────────────────────

  /**
   * Renders (or updates) the alternatives picker panel below the actions row.
   * Each card shows a colour swatch matching the map polyline, distance,
   * duration, and a toll badge when applicable.
   * If only one summary exists the panel is removed (nothing to compare).
   *
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints
   */
  #renderAlternatives(waypoints) {
    // Remove existing panel first
    const existing = this.querySelector('#rp-alternatives');
    if (existing) existing.remove();

    if (this.#allSummaries.length <= 1) return;

    const container = this.querySelector('.rp-container');
    if (!container) return;

    const panel = document.createElement('div');
    panel.id        = 'rp-alternatives';
    panel.className = 'rp-alternatives';

    const header = document.createElement('div');
    header.className   = 'rp-alt-header';
    header.textContent = `${this.#allSummaries.length} routes found — pick one`;
    panel.appendChild(header);

    this.#allSummaries.forEach((s, i) => {
      const mins    = Math.round(s.durationMin);
      const hrs     = Math.floor(mins / 60);
      const remMins = mins % 60;
      const duration = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
      const km       = s.distanceKm.toFixed(1);
      const color    = s.color ?? '#3b82f6';

      const card = document.createElement('button');
      card.className   = `rp-alt-card${i === this.#activeAltIndex ? ' active' : ''}`;
      card.type        = 'button';
      card.dataset.idx = String(i);

      card.innerHTML = `
        <span class="rp-alt-swatch" style="background:${color};box-shadow:0 0 0 1px ${color}44;"></span>
        <span class="rp-alt-label">Route ${i + 1}</span>
        <span class="rp-alt-stats">
          <span class="rp-alt-stat rp-alt-dist">${km} km</span>
          <span class="rp-alt-sep">·</span>
          <span class="rp-alt-stat rp-alt-dur">${duration}</span>
          ${s.hasTolls
            ? '<span class="rp-alt-sep">·</span><span class="rp-alt-toll" title="Includes toll roads">Tolls</span>'
            : ''}
        </span>
      `;

      card.addEventListener('click', () => this.#onAltCardClick(i, waypoints));
      panel.appendChild(card);
    });

    // Insert after .rp-actions
    const actions = container.querySelector('.rp-actions');
    if (actions) {
      actions.after(panel);
    } else {
      container.appendChild(panel);
    }
  }

  /**
   * Called when the user clicks an alternative route card.
   * Updates the active card styling, syncs #lastRouteSummary, and emits the
   * selection event so the orchestrator can call `map.selectAlternativeRoute()`.
   *
   * @param {number} index
   * @param {Array<{address: string, lat: number, lng: number}>} waypoints
   */
  #onAltCardClick(index, waypoints) {
    if (index === this.#activeAltIndex) return;

    this.#activeAltIndex = index;
    const active = this.#allSummaries[index];
    if (active) {
      this.#lastRouteSummary = {
        waypoints,
        routePath:    active.routePath,
        distanceKm:   active.distanceKm,
        durationMin:  active.durationMin,
        avoidHighways: this.#avoidHighways,
        avoidTolls:    this.#avoidTolls,
        avoidFerries:  this.#avoidFerries,
      };
      // Update status bar
      const km      = active.distanceKm.toFixed(1);
      const mins    = Math.round(active.durationMin);
      const hrs     = Math.floor(mins / 60);
      const remMins = mins % 60;
      const dur     = hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
      this.setStatus(`Route ${index + 1}: ${km} km · ${dur}`);
    }

    // Refresh card highlights
    this.querySelectorAll('.rp-alt-card').forEach((card, i) => {
      card.classList.toggle('active', i === index);
    });

    this.dispatchEvent(new CustomEvent('route-alternative-select', {
      bubbles: true,
      composed: true,
      detail: { index },
    }));
  }
}

customElements.define('route-planner', RoutePlannerComponent);
