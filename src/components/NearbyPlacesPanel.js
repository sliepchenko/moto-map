/**
 * `<nearby-places>` — sidebar panel that displays prominent places found
 * near the currently planned route.
 *
 * Responsibilities:
 *  - Shows a loading / empty / results state.
 *  - Renders places grouped by category with toggle-able category filters.
 *  - Each place row is clickable: dispatches `nearby-place-focus` so the map
 *    can pan to it and open its InfoWindow.
 *  - Exposes `setPlaces(places)`, `setLoading(bool)`, `clear()`.
 *
 * Events dispatched (bubbling):
 *  - `nearby-place-focus`  — detail: { placeId: string }
 *  - `nearby-category-toggle` — detail: { categoryId: string, enabled: boolean }
 *
 * SOLID notes:
 *  - SRP: only manages the nearby-places list UI; no map or Places API logic.
 *  - OCP: extend by passing new categories from PLACE_CATEGORIES without
 *          changing this component.
 */

import { PLACE_CATEGORIES } from '../map/NearbyPlacesRenderer.js';

export class NearbyPlacesPanel extends HTMLElement {
  /** @type {import('../map/NearbyPlacesRenderer.js').NearbyPlace[]} */
  #places = [];

  /** @type {Set<string>} Category IDs currently shown */
  #enabledCategories = new Set(PLACE_CATEGORIES.map(c => c.id));

  /** @type {boolean} */
  #loading = false;

  connectedCallback() {
    this.id = 'nearby-places-panel';
    this.#render();
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Populates the panel with nearby places.
   * @param {import('../map/NearbyPlacesRenderer.js').NearbyPlace[]} places
   */
  setPlaces(places) {
    this.#places  = places;
    this.#loading = false;
    this.#render();
  }

  /** Shows or hides the loading indicator. */
  setLoading(loading) {
    this.#loading = loading;
    if (loading) {
      this.#places = [];
    }
    this.#render();
  }

  /** Clears all results and resets to the empty state. */
  clear() {
    this.#places  = [];
    this.#loading = false;
    this.#render();
  }

  // ── private ──────────────────────────────────────────────────────────────

  #render() {
    if (this.#loading) {
      this.innerHTML = `
        <div class="np-loading">
          <div class="np-spinner"></div>
          <span>Searching for places…</span>
        </div>
      `;
      return;
    }

    if (this.#places.length === 0) {
      this.innerHTML = `
        <div class="np-empty">
          Plan a route to discover viewpoints, cafes, hotels and more along the way.
        </div>
      `;
      return;
    }

    // Build category filter chips
    const chipHtml = PLACE_CATEGORIES.map(cat => {
      const count   = this.#places.filter(p => p.category === cat.id).length;
      if (count === 0) return '';
      const enabled = this.#enabledCategories.has(cat.id);
      return `
        <button
          class="np-chip${enabled ? ' on' : ''}"
          data-cat="${cat.id}"
          title="${cat.label}"
          style="--chip-color:${cat.color}"
        >${cat.label} <span class="np-chip-count">${count}</span></button>
      `;
    }).join('');

    // Filter to visible categories and group
    const visible = this.#places.filter(p => this.#enabledCategories.has(p.category));

    const grouped = new Map();
    for (const cat of PLACE_CATEGORIES) {
      const items = visible.filter(p => p.category === cat.id);
      if (items.length > 0) grouped.set(cat, items);
    }

    const groupsHtml = [...grouped.entries()].map(([cat, items]) => {
      const itemsHtml = items.map(place => {
        const ratingHtml = place.rating != null
          ? `<span class="np-item-rating">★ ${place.rating.toFixed(1)}</span>`
          : '';
        const openHtml = place.isOpen === true
          ? '<span class="np-item-open">Open</span>'
          : (place.isOpen === false ? '<span class="np-item-closed">Closed</span>' : '');
        return `
          <li class="np-item" data-place-id="${place.id}" title="${place.name}">
            <div class="np-item-info">
              <span class="np-item-name">${place.name}</span>
              <span class="np-item-vicinity">${place.vicinity}</span>
            </div>
            <div class="np-item-meta">
              ${ratingHtml}${openHtml}
            </div>
          </li>
        `;
      }).join('');

      return `
        <div class="np-group">
          <div class="np-group-title" style="--cat-color:${cat.color}">
            <img src="${cat.icon}" class="np-group-icon" alt="" />
            ${cat.label}
          </div>
          <ul class="np-sublist">${itemsHtml}</ul>
        </div>
      `;
    }).join('');

    const totalVisible = visible.length;
    const totalAll     = this.#places.length;
    const countLabel   = totalVisible === totalAll
      ? `${totalAll} place${totalAll === 1 ? '' : 's'} found`
      : `${totalVisible} of ${totalAll} shown`;

    this.innerHTML = `
      <div class="np-filters">${chipHtml}</div>
      <div class="np-count">${countLabel}</div>
      <div class="np-list">${groupsHtml}</div>
    `;

    this.#bindEvents();
  }

  #bindEvents() {
    // Category filter chips
    this.querySelectorAll('.np-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const catId   = chip.dataset.cat;
        const enabled = !this.#enabledCategories.has(catId);
        if (enabled) {
          this.#enabledCategories.add(catId);
        } else {
          // Don't allow disabling all categories
          if (this.#enabledCategories.size > 1) {
            this.#enabledCategories.delete(catId);
          }
        }
        this.#render();
        this.dispatchEvent(new CustomEvent('nearby-category-toggle', {
          bubbles: true,
          detail:  { categoryId: catId, enabled },
        }));
      });
    });

    // Place row clicks → pan map
    this.querySelectorAll('.np-item').forEach(item => {
      item.addEventListener('click', () => {
        const placeId = item.dataset.placeId;
        this.dispatchEvent(new CustomEvent('nearby-place-focus', {
          bubbles: true,
          detail:  { placeId },
        }));
      });
    });
  }
}

customElements.define('nearby-places', NearbyPlacesPanel);
