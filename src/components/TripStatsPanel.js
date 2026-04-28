/**
 * `<trip-stats-panel>` — a details panel that surfaces key statistics for the
 * currently selected trip.
 *
 * Displayed stats:
 *  - Distance   (road distance from Google Directions API when available,
 *                otherwise straight-line Haversine estimate, in km)
 *  - Est. duration (distance / assumed avg speed of 50 km/h)
 *  - Date       (formatted, same locale as TripListComponent)
 *
 * Usage:
 *  - Call `show(trip)` when a trip is selected.
 *  - Call `hide()` when deselected.
 *
 * SOLID notes:
 *  - SRP: pure display component — only formats and renders stats, no data
 *    fetching, no event dispatch.
 *  - OCP: new stat rows can be added to STATS_CONFIG without touching render
 *    logic.
 */

import { estimateTripDistance, estimateTripDuration } from '../core/GeoUtils.js';

export class TripStatsPanel extends HTMLElement {
  connectedCallback() {
    this.classList.add('hidden');
    this.setAttribute('aria-live', 'polite');
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Renders stats for `trip` and makes the panel visible.
   * @param {object} trip
   */
  show(trip) {
    this.#render(trip);
    this.classList.remove('hidden');
  }

  /** Hides the panel and clears its content. */
  hide() {
    this.classList.add('hidden');
    this.innerHTML = '';
  }

  // ── private ──────────────────────────────────────────────────────────────

  /** @param {object} trip */
  #render(trip) {
    const distance  = estimateTripDistance(trip);
    const duration  = estimateTripDuration(trip);
    const date      = new Date(trip.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    const accentStyle = trip._color ? `color: ${trip._color}` : '';

    this.innerHTML = `
      <div class="stats-panel">
        <div class="stats-panel-header">
          <span class="stats-panel-title" style="${accentStyle}">${trip.title ?? ''}</span>
        </div>
        <ul class="stats-list">
          ${TripStatsPanel.#row('Distance',   `${distance.toFixed(1)} km`)}
          ${TripStatsPanel.#row('Est. time',  duration)}
          ${TripStatsPanel.#row('Date',       date)}
        </ul>
      </div>
    `;
  }

  /**
   * Returns markup for a single label + value row.
   * @param {string} label
   * @param {string} value
   * @returns {string}
   */
  static #row(label, value) {
    return `
      <li class="stats-row">
        <span class="stats-label">${label}</span>
        <span class="stats-value">${value}</span>
      </li>
    `;
  }
}

customElements.define('trip-stats-panel', TripStatsPanel);
