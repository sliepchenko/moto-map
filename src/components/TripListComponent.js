import { estimateTripDistance, estimateTripDuration } from '../core/GeoUtils.js';

/**
 * Builds a Google Maps Directions URL for the given trip waypoints.
 * Uses the first waypoint as origin, last as destination, and all
 * intermediate waypoints as pipe-separated stops.
 *
 * @param {Array<{lat: number, lng: number}>} waypoints
 * @returns {string} Google Maps URL
 */
function buildGoogleMapsUrl(waypoints) {
  if (waypoints.length < 2) return 'https://www.google.com/maps';
  const origin      = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  url.searchParams.set('travelmode', 'driving');
  if (waypoints.length > 2) {
    const intermediates = waypoints.slice(1, -1).map(wp => `${wp.lat},${wp.lng}`);
    url.searchParams.set('waypoints', intermediates.join('|'));
  }
  return url.toString();
}

/**
 * `<trip-list>` — renders the "My Rides" sidebar list.
 *
 * Each trip item expands an inline details panel directly beneath itself
 * when clicked. Clicking the active trip collapses it; clicking a different
 * trip collapses the previous one and expands the new one.
 *
 * Attributes / properties:
 *  - none (data is provided programmatically via `setTrips()`)
 *
 * Dispatches:
 *  - `trip-select` — CustomEvent with `detail: { id: string | null }`
 *    when the user clicks a trip item (null when deselecting the active one).
 *
 * SOLID notes:
 *  - SRP: only handles the DOM representation and user interaction for trips.
 *  - OCP: extend to add trip metadata rows without modifying the select logic.
 *  - ISP: exposes only the surface needed by the app (`setTrips`, `setActive`).
 */
export class TripListComponent extends HTMLElement {
  /** @type {Object[]} */
  #trips = [];
  /** @type {string|null} */
  #activeId = null;

  connectedCallback() {
    this.#render();
  }

  /**
   * Populates the list with trip data and re-renders.
   * @param {Object[]} trips
   */
  setTrips(trips) {
    this.#trips = trips;
    this.#render();
  }

  /**
   * Updates the visually active trip and expands its inline details panel.
   * Collapses any previously expanded panel.
   * @param {string|null} id
   */
  setActive(id) {
    this.#activeId = id;
    this.querySelectorAll('.trip-item').forEach(el => {
      const isActive = el.dataset.tripId === id;
      el.classList.toggle('active', isActive);
      const details = el.querySelector('.trip-details');
      if (details) {
        details.classList.toggle('open', isActive);
      }
    });
  }

  /**
   * Updates the displayed distance for a single trip card with the accurate
   * road distance returned by the Directions API. Called asynchronously after
   * the initial render, so it only patches the relevant DOM nodes instead of
   * re-rendering the whole list.
   *
   * @param {string} tripId
   * @param {number} km
   */
  updateTripDistance(tripId, km) {
    // Keep the in-memory trip in sync so estimateTripDuration() also benefits.
    const trip = this.#trips.find(t => t.id === tripId);
    if (trip) trip._roadDistanceKm = km;

    const li = this.querySelector(`.trip-item[data-trip-id="${tripId}"]`);
    if (!li) return;

    const formatted = km.toFixed(1) + ' km';

    // Update the compact summary badge shown in the collapsed state.
    const badge = li.querySelector('.trip-distance');
    if (badge) badge.textContent = formatted;

    // Update the expanded details row.
    const rows = li.querySelectorAll('.trip-details-row');
    rows.forEach(row => {
      const label = row.querySelector('.trip-details-label');
      if (label?.textContent === 'Distance') {
        const value = row.querySelector('.trip-details-value');
        if (value) value.textContent = formatted;
      }
    });
  }


  #render() {
    this.innerHTML = '';

    const ul = document.createElement('ul');
    ul.id = 'trip-list';

    // Display newest trips first (reverse of the ascending-date storage order).
    [...this.#trips].reverse().forEach(trip => {
      const li = this.#createItem(trip);
      ul.appendChild(li);
    });

    this.appendChild(ul);

    // Restore active state after re-render
    if (this.#activeId) this.setActive(this.#activeId);
  }

  /** @param {Object} trip */
  #createItem(trip) {
    const li = document.createElement('li');
    li.className      = 'trip-item';
    li.dataset.tripId = trip.id;

    const date = new Date(trip.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    const distanceKm = estimateTripDistance(trip).toFixed(1);
    const duration   = estimateTripDuration(trip);

    const gmapsUrl = buildGoogleMapsUrl(trip.waypoints ?? []);

    li.innerHTML = `
      <div class="trip-summary">
        <span class="trip-title">${trip.title}</span>
        <span class="trip-meta">
          <span class="trip-date">${date}</span>
          <span class="trip-distance">${distanceKm} km</span>
        </span>
      </div>
      <div class="trip-details">
        <ul class="trip-details-list">
          <li class="trip-details-row">
            <span class="trip-details-label">Distance</span>
            <span class="trip-details-value">${distanceKm} km</span>
          </li>
          <li class="trip-details-row">
            <span class="trip-details-label">Est. time</span>
            <span class="trip-details-value">${duration}</span>
          </li>
          <li class="trip-details-row">
            <span class="trip-details-label">Date</span>
            <span class="trip-details-value">${date}</span>
          </li>
        </ul>
        <a
          class="trip-gmaps-btn"
          href="${gmapsUrl}"
          target="_blank"
          rel="noopener noreferrer"
        >Open in Google Maps</a>
      </div>
    `;

    li.addEventListener('click', () => {
      const isAlreadyActive = this.#activeId === trip.id;
      const newId = isAlreadyActive ? null : trip.id;
      this.dispatchEvent(new CustomEvent('trip-select', {
        bubbles:  true,
        composed: true,
        detail:   { id: newId },
      }));
    });

    // Prevent the Google Maps link click from toggling the trip selection
    const gmapsBtn = li.querySelector('.trip-gmaps-btn');
    if (gmapsBtn) {
      gmapsBtn.addEventListener('click', e => e.stopPropagation());
    }

    return li;
  }
}

customElements.define('trip-list', TripListComponent);
