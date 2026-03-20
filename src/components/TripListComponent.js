/**
 * `<trip-list>` — renders the "My Rides" sidebar list.
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
   * Updates the visually active trip without re-rendering the whole list.
   * @param {string|null} id
   */
  setActive(id) {
    this.#activeId = id;
    this.querySelectorAll('.trip-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tripId === id);
    });
  }

  // ── private ──────────────────────────────────────────────────────────────

  #render() {
    this.innerHTML = '';

    const ul = document.createElement('ul');
    ul.id = 'trip-list';

    this.#trips.forEach(trip => {
      const li = this.#createItem(trip);
      ul.appendChild(li);
    });

    this.appendChild(ul);

    // Restore active state after re-render
    if (this.#activeId) this.setActive(this.#activeId);
  }

  /** @param {Object} trip */
  #createItem(trip) {
    const li   = document.createElement('li');
    li.className        = 'trip-item';
    li.dataset.tripId   = trip.id;

    const date = new Date(trip.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    li.innerHTML = `
      <span class="trip-title">${trip.title}</span>
      <span class="trip-date">${date}</span>
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

    return li;
  }
}

customElements.define('trip-list', TripListComponent);
