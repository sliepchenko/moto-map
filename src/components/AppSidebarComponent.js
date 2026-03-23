/**
 * `<app-sidebar>` — the full sidebar wrapper with three accordion sections
 * ("My Rides", "My POI", and "Plan Route").
 *
 * Contains:
 *  - Three `<div class="accordion-section">` wrappers with `<button>` headers
 *    and `<div class="accordion-body">` panels.
 *  - Hosts `<trip-list>`, `<poi-list>`, and `<route-planner>` custom elements
 *    inside those panels.
 *
 * Public API:
 *  - `show()`                  — removes the `hidden` class.
 *  - `openSection(name)`       — opens 'rides', 'poi', or 'planner' accordion section.
 *  - `tripList` / `poiList`    — direct references to the child components.
 *  - `routePlanner`            — direct reference to the route-planner component.
 *
 * SOLID notes:
 *  - SRP: manages sidebar structure and accordion behaviour only.
 *  - OCP: add new accordion sections by extending the `SECTIONS` config.
 *  - LSP: fully substitutes for a standard HTMLElement wherever a sidebar
 *          element is expected.
 */
export class AppSidebarComponent extends HTMLElement {
  /** @type {import('./TripListComponent.js').TripListComponent|null} */
  #tripList = null;
  /** @type {import('./PoiListComponent.js').PoiListComponent|null} */
  #poiList = null;
  /** @type {import('./RoutePlannerComponent.js').RoutePlannerComponent|null} */
  #routePlanner = null;

  connectedCallback() {
    this.id = 'sidebar';
    this.classList.add('hidden');
    this.#buildDOM();
    this.#bindAccordion();
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
  }

  /** @returns {import('./TripListComponent.js').TripListComponent} */
  get tripList() { return this.#tripList; }

  /** @returns {import('./PoiListComponent.js').PoiListComponent} */
  get poiList() { return this.#poiList; }

  /** @returns {import('./RoutePlannerComponent.js').RoutePlannerComponent} */
  get routePlanner() { return this.#routePlanner; }

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
        </div>
      </div>
    `;

    this.#tripList    = this.querySelector('trip-list');
    this.#poiList     = this.querySelector('poi-list');
    this.#routePlanner = this.querySelector('route-planner');
  }

  #bindAccordion() {
    this.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.accordion-section');
        const wasOpen = section.classList.contains('open');
        // Collapse all, then toggle the clicked one
        this.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
        if (!wasOpen) section.classList.add('open');
      });
    });
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
