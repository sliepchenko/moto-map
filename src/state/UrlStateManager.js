/**
 * Manages `?trip=` URL search parameter as application state.
 *
 * SOLID notes:
 *  - SRP: only reads/writes URL state; no rendering, no map access.
 *  - OCP: add new URL parameters by extending the push/read contract.
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
   * Pushes a new history entry with `?trip=<id>` set.
   * @param {string|null} id - pass `null` to clear the trip param
   */
  pushTrip(id) {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('trip', id);
    } else {
      url.searchParams.delete('trip');
    }
    history.pushState(null, '', url.toString());
  }

  /**
   * Registers a handler for browser back/forward navigation.
   * The handler receives the current URL state.
   *
   * @param {(state: { tripId: string|null }) => void} handler
   * @returns {() => void} cleanup function
   */
  onNavigate(handler) {
    const listener = () => handler({
      tripId: this.getTripId(),
    });
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }
}
