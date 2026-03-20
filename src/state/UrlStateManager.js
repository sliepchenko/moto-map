/**
 * Manages `?trip=` and `?poi=` URL search parameters as application state.
 *
 * SOLID notes:
 *  - SRP: only reads/writes URL state; no rendering, no map access.
 *  - OCP: add new URL parameters by extending `#params` without touching
 *          the push/read contract.
 */
export class UrlStateManager {
  /**
   * Reads the current `?trip=` parameter.
   * @returns {string|null}
   */
  getTripId() {
    return new URLSearchParams(window.location.search).get('trip');
  }

  /**
   * Reads the current `?poi=` parameter as a number.
   * @returns {number|null}
   */
  getPoiIndex() {
    const raw = new URLSearchParams(window.location.search).get('poi');
    if (raw === null) return null;
    const index = parseInt(raw, 10);
    return isNaN(index) ? null : index;
  }

  /**
   * Pushes a new history entry with `?trip=<id>` set and `?poi=` cleared.
   * @param {string|null} id - pass `null` to clear the trip param
   */
  pushTrip(id) {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('trip', id);
    } else {
      url.searchParams.delete('trip');
    }
    url.searchParams.delete('poi');
    history.pushState(null, '', url.toString());
  }

  /**
   * Pushes a new history entry with `?poi=<index>` set and `?trip=` cleared.
   * @param {number} index
   */
  pushPoi(index) {
    const url = new URL(window.location.href);
    url.searchParams.set('poi', String(index));
    url.searchParams.delete('trip');
    history.pushState(null, '', url.toString());
  }

  /**
   * Registers a handler for browser back/forward navigation.
   * The handler receives the current URL state.
   *
   * @param {(state: { tripId: string|null, poiIndex: number|null }) => void} handler
   * @returns {() => void} cleanup function
   */
  onNavigate(handler) {
    const listener = () => handler({
      tripId:   this.getTripId(),
      poiIndex: this.getPoiIndex(),
    });
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }
}
