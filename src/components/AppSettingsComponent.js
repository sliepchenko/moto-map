/**
 * Settings panel WebComponent.
 *
 * Renders a settings entry at the bottom of the sidebar. Clicking the row
 * opens an inline panel (positioned above the button on desktop) with
 * toggle switches for each setting.
 * Dispatches `setting-change` CustomEvents when the user toggles an option.
 *
 * SOLID notes:
 *  - SRP: only responsible for rendering and emitting setting changes; no map
 *          or data logic lives here.
 *  - OCP: new settings rows can be added to `#settings` without touching the
 *          toggle or render machinery.
 */
export class AppSettingsComponent extends HTMLElement {
  connectedCallback() {
    this.#render();
    this.#bindEvents();
  }

  // ── public API ───────────────────────────────────────────────────────────

  /** Read-only snapshot of the current settings values. */
  get values() { return { ...this.#settings }; }

  // ── private ──────────────────────────────────────────────────────────────

  static #STORAGE_KEY = 'moto-map:settings';

  /** Current setting values (merged with any persisted values). */
  #settings = this.#loadSettings();

  #loadSettings() {
    const defaults = { showRouteDirections: true, showPoi: true };
    try {
      const stored = localStorage.getItem(AppSettingsComponent.#STORAGE_KEY);
      if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch { /* ignore parse errors */ }
    return defaults;
  }

  #saveSettings() {
    try {
      localStorage.setItem(AppSettingsComponent.#STORAGE_KEY, JSON.stringify(this.#settings));
    } catch { /* ignore storage errors */ }
  }

  #render() {
    this.innerHTML = `
      <button id="settings-btn" class="settings-btn" aria-label="Settings" title="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span class="settings-btn-label">Settings</span>
      </button>

      <div id="settings-panel" class="settings-panel hidden" role="dialog" aria-label="Application settings">
        <div class="settings-header">
          <span class="settings-title">Settings</span>
          <button id="settings-close" class="settings-close" aria-label="Close settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="settings-body">
          <div class="settings-row">
            <div class="settings-row-info">
              <span class="settings-row-label">Route directions</span>
              <span class="settings-row-desc">Show arrow indicators on trip routes</span>
            </div>
            <button
              id="toggle-showRouteDirections"
              class="settings-toggle ${this.#settings.showRouteDirections ? 'on' : ''}"
              role="switch"
              aria-checked="${this.#settings.showRouteDirections}"
              data-key="showRouteDirections"
            >
              <span class="settings-toggle-thumb"></span>
            </button>
          </div>

          <div class="settings-row">
            <div class="settings-row-info">
              <span class="settings-row-label">Points of interest</span>
              <span class="settings-row-desc">Show POI markers on the map</span>
            </div>
            <button
              id="toggle-showPoi"
              class="settings-toggle ${this.#settings.showPoi ? 'on' : ''}"
              role="switch"
              aria-checked="${this.#settings.showPoi}"
              data-key="showPoi"
            >
              <span class="settings-toggle-thumb"></span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  #bindEvents() {
    const btn   = this.querySelector('#settings-btn');
    const panel = this.querySelector('#settings-panel');
    const close = this.querySelector('#settings-close');

    btn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });

    close.addEventListener('click', () => {
      panel.classList.add('hidden');
    });

    // Close when clicking outside the component
    document.addEventListener('click', e => {
      if (!this.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });

    // Wire all toggle buttons
    this.querySelectorAll('.settings-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => this.#onToggle(toggle));
    });
  }

  /** @param {HTMLElement} toggle */
  #onToggle(toggle) {
    const key     = toggle.dataset.key;
    const current = this.#settings[key];
    const next    = !current;

    this.#settings[key] = next;
    this.#saveSettings();
    toggle.classList.toggle('on', next);
    toggle.setAttribute('aria-checked', String(next));

    this.dispatchEvent(new CustomEvent('setting-change', {
      bubbles:  true,
      composed: true,
      detail:   { key, value: next },
    }));
  }
}

customElements.define('app-settings', AppSettingsComponent);
