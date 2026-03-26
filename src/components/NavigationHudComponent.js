/**
 * `<navigation-hud>` — the full-screen navigation overlay.
 *
 * States:
 *  1. **idle** (`show()` not called) — hidden.
 *  2. **search** — destination input bar visible; user types or picks on map.
 *  3. **loading** — "Calculating route…" spinner.
 *  4. **navigating** — turn-by-turn instruction banner + bottom summary bar.
 *  5. **arrived** — "You have arrived" banner.
 *
 * Events dispatched (bubble):
 *  - `nav-destination`   detail: { address: string }   — user submitted address
 *  - `nav-start`                                        — user confirmed to start
 *  - `nav-stop`                                         — user cancelled / closed
 *  - `nav-recenter`                                     — re-center map on GPS dot
 *  - `nav-pick-start`                                   — user wants to pick dest on map
 *  - `nav-pick-cancel`                                  — cancel map-pick mode
 *
 * Public API:
 *  - `openSearch()`                            — show destination-input bar
 *  - `setRoutePreview(distanceKm, durationMin)` — show preview + "Start" button
 *  - `startNavigating(step)`                   — show turn-by-turn HUD
 *  - `updateStep(step)`                        — update current instruction
 *  - `showArrived()`                           — show arrival screen
 *  - `showError(msg)`                          — show error in search bar
 *  - `close()`                                 — hide everything
 *  - `setPickMode(active)`                     — toggle map-pick button state
 *
 * SOLID notes:
 *  - SRP: only manages HUD display and user input; no routing or GPS logic.
 */
export class NavigationHudComponent extends HTMLElement {
  connectedCallback() {
    this.#buildDOM();
    this.#bindEvents();
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Shows the destination-search input bar. */
  openSearch() {
    this.#showState('search');
  }

  /**
   * Shows the route summary with a "Start" button.
   * @param {number} distanceKm
   * @param {number} durationMin
   */
  setRoutePreview(distanceKm, durationMin) {
    const km  = distanceKm.toFixed(1);
    const hrs = Math.floor(durationMin / 60);
    const min = Math.round(durationMin % 60);
    const dur = hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
    this.querySelector('.nav-preview-info').textContent = `${km} km · ${dur}`;
    this.querySelector('.nav-preview').classList.remove('hidden');
    this.querySelector('.nav-loading').classList.add('hidden');
  }

  /**
   * Hides search/preview, shows the turn-by-turn HUD.
   * @param {{ instruction: string, distance: string, maneuver: string, stepIndex: number, totalSteps: number }} step
   */
  startNavigating(step) {
    this.#showState('navigating');
    this.#applyStep(step);
  }

  /**
   * Updates the current instruction without changing state.
   * @param {{ instruction: string, distance: string, maneuver: string, stepIndex: number, totalSteps: number }} step
   */
  updateStep(step) {
    this.#applyStep(step);
  }

  /** Switches to "You have arrived" state. */
  showArrived() {
    this.#showState('arrived');
  }

  /**
   * Displays an error message beneath the search input.
   * @param {string} msg
   */
  showError(msg) {
    const el = this.querySelector('.nav-search-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  /** Shows a loading spinner, hides the preview info. */
  showLoading() {
    this.querySelector('.nav-loading').classList.remove('hidden');
    this.querySelector('.nav-preview').classList.add('hidden');
    this.querySelector('.nav-search-error').classList.add('hidden');
  }

  /** Hides the HUD entirely and resets all state. */
  close() {
    this.#showState('hidden');
    this.querySelector('.nav-search-input').value = '';
    this.querySelector('.nav-search-error').classList.add('hidden');
    this.querySelector('.nav-preview').classList.add('hidden');
    this.querySelector('.nav-loading').classList.add('hidden');
  }

  /**
   * Toggles the "pick on map" button active state.
   * @param {boolean} active
   */
  setPickMode(active) {
    this.querySelector('.nav-pick-btn')?.classList.toggle('active', active);
  }

  // ── private ──────────────────────────────────────────────────────────────

  #buildDOM() {
    this.innerHTML = `
      <!-- Search overlay (state: search) -->
      <div class="nav-search-overlay hidden" data-state="search">
        <div class="nav-search-bar">
          <button class="nav-close-btn" title="Cancel navigation" aria-label="Cancel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <input class="nav-search-input" type="text" placeholder="Where to?" autocomplete="off" />
          <button class="nav-go-btn" title="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button class="nav-pick-btn" title="Pick on map">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
        </div>
        <div class="nav-search-error hidden"></div>
        <div class="nav-loading hidden">
          <div class="nav-spinner"></div>
          <span>Calculating route…</span>
        </div>
        <div class="nav-preview hidden">
          <span class="nav-preview-info"></span>
          <button class="nav-start-btn">Start</button>
        </div>
      </div>

      <!-- Turn-by-turn HUD (state: navigating) -->
      <div class="nav-instruction-banner hidden" data-state="navigating">
        <div class="nav-maneuver-icon" aria-hidden="true"></div>
        <div class="nav-instruction-text"></div>
        <div class="nav-step-distance"></div>
        <button class="nav-stop-btn" title="Stop navigation">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
        </button>
      </div>

      <!-- Bottom nav bar (state: navigating) -->
      <div class="nav-bottom-bar hidden" data-state="navigating">
        <div class="nav-progress-text"></div>
        <button class="nav-recenter-btn" title="Re-center on my location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </button>
      </div>

      <!-- Arrived banner (state: arrived) -->
      <div class="nav-arrived-banner hidden" data-state="arrived">
        <span class="nav-arrived-icon">&#x1F3C1;</span>
        <span>You have arrived!</span>
        <button class="nav-arrived-close">Done</button>
      </div>
    `;
  }

  #bindEvents() {
    // Close / cancel
    this.querySelector('.nav-close-btn').addEventListener('click', () => {
      this.close();
      this.#dispatch('nav-stop');
    });

    // Search submission via button
    this.querySelector('.nav-go-btn').addEventListener('click', () => this.#submitSearch());

    // Search submission via Enter
    this.querySelector('.nav-search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.#submitSearch();
    });

    // Pick on map
    const pickBtn = this.querySelector('.nav-pick-btn');
    pickBtn.addEventListener('click', () => {
      const active = pickBtn.classList.toggle('active');
      this.#dispatch(active ? 'nav-pick-start' : 'nav-pick-cancel');
    });

    // Start navigating
    this.querySelector('.nav-start-btn').addEventListener('click', () => {
      this.#dispatch('nav-start');
    });

    // Stop navigation
    this.querySelector('.nav-stop-btn').addEventListener('click', () => {
      this.close();
      this.#dispatch('nav-stop');
    });

    // Re-center
    this.querySelector('.nav-recenter-btn').addEventListener('click', () => {
      this.#dispatch('nav-recenter');
    });

    // Arrived — close
    this.querySelector('.nav-arrived-close').addEventListener('click', () => {
      this.close();
      this.#dispatch('nav-stop');
    });
  }

  /** @param {'hidden'|'search'|'navigating'|'arrived'} state */
  #showState(state) {
    // Hide all state elements
    this.querySelectorAll('[data-state]').forEach(el => el.classList.add('hidden'));
    if (state === 'hidden') return;

    // Show all elements belonging to the requested state
    this.querySelectorAll(`[data-state="${state}"]`).forEach(el => el.classList.remove('hidden'));
  }

  /**
   * @param {{ instruction: string, distance: string, maneuver: string,
   *           stepIndex: number, totalSteps: number }} step
   */
  #applyStep(step) {
    this.querySelector('.nav-instruction-text').textContent = step.instruction;
    this.querySelector('.nav-step-distance').textContent    = step.distance;
    this.querySelector('.nav-maneuver-icon').textContent    = this.#maneuverEmoji(step.maneuver);
    this.querySelector('.nav-progress-text').textContent    =
      `Step ${step.stepIndex + 1} of ${step.totalSteps}`;
  }

  #submitSearch() {
    const input = this.querySelector('.nav-search-input');
    const val   = input.value.trim();
    if (!val) return;
    this.querySelector('.nav-search-error').classList.add('hidden');
    this.showLoading();
    this.#dispatch('nav-destination', { address: val });
  }

  /** Returns a simple directional emoji for common Google Maps maneuver types. */
  #maneuverEmoji(maneuver) {
    const MAP = {
      'turn-left':           '↰',
      'turn-right':          '↱',
      'turn-sharp-left':     '↺',
      'turn-sharp-right':    '↻',
      'turn-slight-left':    '↖',
      'turn-slight-right':   '↗',
      'uturn-left':          '↩',
      'uturn-right':         '↪',
      'roundabout-left':     '↺',
      'roundabout-right':    '↻',
      'keep-left':           '↖',
      'keep-right':          '↗',
      'merge':               '↑',
      'ramp-left':           '↰',
      'ramp-right':          '↱',
      'fork-left':           '↰',
      'fork-right':          '↱',
      'ferry':               '⛴',
      'ferry-train':         '🚂',
      'straight':            '↑',
    };
    return MAP[maneuver] ?? '↑';
  }

  #dispatch(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
}

customElements.define('navigation-hud', NavigationHudComponent);
