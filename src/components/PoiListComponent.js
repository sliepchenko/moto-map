/**
 * Emoji labels for each known POI type.
 * @type {Record<string, string>}
 */
const POI_EMOJI = {
  cafe:      '☕',
  fuel:      '⛽',
  hotel:     '🏨',
  mechanic:  '🔧',
  water:     '💧',
  viewpoint: '🔭',
  castle:    '🏰',
};

/**
 * `<poi-list>` — renders the "My POI" sidebar list.
 *
 * Dispatches:
 *  - `poi-select` — CustomEvent with `detail: { index: number }`
 *    when the user clicks a POI item.
 *
 * SOLID notes:
 *  - SRP: only responsible for POI DOM rendering and user interaction.
 *  - OCP: extend `POI_EMOJI` map or override `#createItem` for new types.
 *  - ISP: surface limited to `setPoiList()` and `setActive()`.
 */
export class PoiListComponent extends HTMLElement {
  /** @type {Object[]} */
  #pois = [];
  /** @type {number|null} */
  #activeIndex = null;

  connectedCallback() {
    this.#render();
  }

  /**
   * Populates the list with POI data and re-renders.
   * @param {Object[]} pois
   */
  setPoiList(pois) {
    this.#pois = pois;
    this.#render();
  }

  /**
   * Highlights the POI item at `index` without a full re-render.
   * Pass `null` to clear the selection.
   * @param {number|null} index
   */
  setActive(index) {
    this.#activeIndex = index;
    this.querySelectorAll('.poi-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.poiIndex, 10) === index);
    });
  }

  // ── private ──────────────────────────────────────────────────────────────

  #render() {
    this.innerHTML = '';

    const ul = document.createElement('ul');
    ul.id = 'poi-list';

    this.#pois.forEach((poi, i) => {
      ul.appendChild(this.#createItem(poi, i));
    });

    this.appendChild(ul);

    if (this.#activeIndex !== null) this.setActive(this.#activeIndex);
  }

  /**
   * @param {Object} poi
   * @param {number} index
   */
  #createItem(poi, index) {
    const li           = document.createElement('li');
    li.className       = 'poi-item';
    li.dataset.poiIndex = String(index);

    const emoji = POI_EMOJI[poi.type] ?? '📍';

    li.innerHTML = `
      <span class="poi-icon">${emoji}</span>
      <span class="poi-details">
        <span class="poi-title">${poi.title ?? poi.type}</span>
        ${poi.description ? `<span class="poi-desc">${poi.description}</span>` : ''}
      </span>
    `;

    li.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('poi-select', {
        bubbles:  true,
        composed: true,
        detail:   { index },
      }));
    });

    return li;
  }
}

customElements.define('poi-list', PoiListComponent);
