/**
 * `<app-sidebar>` — the full sidebar wrapper with four accordion sections
 * ("My Rides", "My POI", "Plan Route").
 *
 * Contains:
 *  - Four `<div class="accordion-section">` wrappers with `<button>` headers
 *    and `<div class="accordion-body">` panels.
 *  - Hosts `<trip-list>`, `<poi-list>`, `<route-planner>`, and
 *    `<nearby-places>` custom elements inside those panels.
 *    `<nearby-places>` lives inside the "Plan Route" panel.
 *
 * Public API:
 *  - `show()`                  — removes the `hidden` class.
 *  - `openSection(name)`       — opens 'rides', 'poi', or 'planner' accordion section.
 *  - `tripList` / `poiList`    — direct references to the child components.
 *  - `routePlanner`            — direct reference to the route-planner component.
 *  - `nearbyPlaces`            — direct reference to the nearby-places component.
 *
 * SOLID notes:
 *  - SRP: manages sidebar structure and accordion behaviour only.
 *  - OCP: add new accordion sections by extending the `SECTIONS` config.
 *  - LSP: fully substitutes for a standard HTMLElement wherever a sidebar
 *          element is expected.
 */
export class AppSidebarComponent extends HTMLElement {
  static #STORAGE_KEY = 'moto-map:accordion';

  /** @type {import('./TripListComponent.js').TripListComponent|null} */
  #tripList = null;
  /** @type {import('./PoiListComponent.js').PoiListComponent|null} */
  #poiList = null;
  /** @type {import('./RoutePlannerComponent.js').RoutePlannerComponent|null} */
  #routePlanner = null;
  /** @type {import('./AppSettingsComponent.js').AppSettingsComponent|null} */
  #settings = null;
  /** @type {import('./NearbyPlacesPanel.js').NearbyPlacesPanel|null} */
  #nearbyPlaces = null;

  connectedCallback() {
    this.id = 'sidebar';
    this.classList.add('hidden');
    this.#buildDOM();
    this.#bindAccordion();
    this.#restoreAccordion();
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Makes the sidebar visible. */
  show() {
    this.classList.remove('hidden');
  }

  /**
   * Opens the accordion section named `name` and closes all others.
   * @param {'rides'|'poi'|'planner'} name
   */
  openSection(name) {
    this.querySelectorAll('.accordion-section').forEach(section => {
      section.classList.toggle('open', section.dataset.section === name);
    });
    this.#saveAccordion(name);
    this.#emitSectionChange(name);
  }

  /** @returns {import('./TripListComponent.js').TripListComponent} */
  get tripList() { return this.#tripList; }

  /** @returns {import('./PoiListComponent.js').PoiListComponent} */
  get poiList() { return this.#poiList; }

  /** @returns {import('./RoutePlannerComponent.js').RoutePlannerComponent} */
  get routePlanner() { return this.#routePlanner; }

  /** @returns {import('./AppSettingsComponent.js').AppSettingsComponent} */
  get settings() { return this.#settings; }

  /** @returns {import('./NearbyPlacesPanel.js').NearbyPlacesPanel} */
  get nearbyPlaces() { return this.#nearbyPlaces; }

  // ── private ──────────────────────────────────────────────────────────────

  #buildDOM() {
    this.innerHTML = `
      <div class="accordion-section open" data-section="rides">
        <button class="accordion-header">
          <span>My Rides</span>
          ${AppSidebarComponent.#arrowSvg()}
        </button>
        <div class="accordion-body">
          <trip-list></trip-list>
        </div>
      </div>

      <div class="accordion-section" data-section="poi">
        <button class="accordion-header">
          <span>My POI</span>
          ${AppSidebarComponent.#arrowSvg()}
        </button>
        <div class="accordion-body">
          <poi-list></poi-list>
        </div>
      </div>

      <div class="accordion-section" data-section="planner">
        <button class="accordion-header">
          <span>Plan Route</span>
          ${AppSidebarComponent.#arrowSvg()}
        </button>
        <div class="accordion-body">
          <route-planner></route-planner>
          <nearby-places></nearby-places>
        </div>
      </div>

      <div class="sidebar-bottom">
        <app-settings></app-settings>
      </div>
    `;

    this.#tripList     = this.querySelector('trip-list');
    this.#poiList      = this.querySelector('poi-list');
    this.#routePlanner = this.querySelector('route-planner');
    this.#settings     = this.querySelector('app-settings');
    this.#nearbyPlaces = this.querySelector('nearby-places');
  }

  #bindAccordion() {
    this.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.accordion-section');
        const wasOpen = section.classList.contains('open');
        // Collapse all
        this.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
        // Toggle: if it was closed, open it; if it was open, leave all closed
        const nextOpen = wasOpen ? null : section.dataset.section;
        if (nextOpen) section.classList.add('open');
        this.#saveAccordion(nextOpen);
        this.#emitSectionChange(nextOpen);
      });
    });
  }

  #saveAccordion(openSection) {
    try {
      if (openSection) {
        localStorage.setItem(AppSidebarComponent.#STORAGE_KEY, openSection);
      } else {
        localStorage.removeItem(AppSidebarComponent.#STORAGE_KEY);
      }
    } catch { /* ignore storage errors */ }
  }

  #restoreAccordion() {
    try {
      const stored = localStorage.getItem(AppSidebarComponent.#STORAGE_KEY);
      if (stored) {
        // Clear the default open state then open the stored section
        this.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
        const target = this.querySelector(`.accordion-section[data-section="${stored}"]`);
        if (target) target.classList.add('open');
      }
      // Emit the initial active section so App can set up initial visibility
      const active = stored ?? 'rides';
      this.#emitSectionChange(active);
    } catch { /* ignore storage errors */ }
  }

  /**
   * Dispatches a `section-change` CustomEvent with the currently open section name.
   * Fires `null` when all sections are collapsed.
   *
   * @param {string|null} section
   */
  #emitSectionChange(section) {
    this.dispatchEvent(new CustomEvent('section-change', {
      detail: { section },
      bubbles: true,
      composed: true,
    }));
  }

  static #arrowSvg() {
    return `<svg class="accordion-arrow" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`;
  }
}

customElements.define('app-sidebar', AppSidebarComponent);
