/**
 * Manages URL state for the active trip.
 *
 * URL strategy:
 *  - When a trip is selected the address bar shows  …/trip/<tripId>/
 *    so that pasting the URL into Telegram/Teams/Discord hands the
 *    crawler the static per-trip snapshot (trip/<tripId>/index.html)
 *    which has the correct og:image, og:title, og:description baked in.
 *  - The static snapshot immediately redirects real users back to the
 *    root app with  ?trip=<tripId>  so the trip auto-loads.
 *  - On arrival with  ?trip=<tripId>  (from a snapshot redirect) the
 *    app reads it, selects the trip, then replaces the address-bar URL
 *    with the clean  …/trip/<tripId>/  form — no infinite loop because
 *    replaceState() / pushState() does not trigger a page navigation.
 *  - Back/forward navigation still works via the popstate event.
 *
 * SOLID notes:
 *  - SRP: only reads/writes URL state; no rendering, no map access.
 *  - OCP: add new URL parameters by extending the push/read contract.
 */
export class UrlStateManager {
  /**
   * Derives the base path of the app from the current page URL.
   *
   * Works for both root deployments (e.g. https://example.com/) and
   * sub-path deployments (e.g. https://user.github.io/moto-map/).
   *
   * The base path is everything up to (and including) the first segment
   * that is NOT "trip" — so on any page inside /trip/<id>/ we still
   * return the app root.
   *
   * @returns {string}  e.g. "/" or "/moto-map/"
   */
  #basePath() {
    // Strip any /trip/<id>/ suffix to find the app root path.
    const path = window.location.pathname.replace(/\/trip\/[^/]+\/?$/, '');
    // Ensure trailing slash.
    return path.endsWith('/') ? path : path + '/';
  }

  /**
   * Reads the current active trip ID from the URL.
   *
   * Supports two formats:
   *   1. Path-based:  …/trip/<tripId>/   (canonical, used for sharing)
   *   2. Query-based: …/?trip=<tripId>   (used by static snapshot redirects)
   *
   * @returns {string|null}
   */
  getTripId() {
    // 1. Path-based: /…/trip/<tripId>/
    const pathMatch = window.location.pathname.match(/\/trip\/([^/]+)\/?$/);
    if (pathMatch) return pathMatch[1];

    // 2. Query-based fallback: ?trip=<tripId>
    return new URLSearchParams(window.location.search).get('trip');
  }

  /**
   * Updates the address bar to the canonical trip URL  …/trip/<id>/
   * or back to the app root when id is null.
   *
   * Uses pushState so browser back/forward works as expected.
   *
   * @param {string|null} id
   */
  pushTrip(id) {
    const base = this.#basePath();
    let url;
    if (id) {
      // Canonical share URL — crawlers will find the static snapshot here.
      url = `${window.location.origin}${base}trip/${id}/`;
    } else {
      // Back to plain app root (no trip selected).
      url = `${window.location.origin}${base}`;
    }
    history.pushState(null, '', url);
  }

  /**
   * Replaces the current history entry with the canonical trip URL.
   * Used on initial load when the app arrives via a ?trip= redirect from
   * a static snapshot — this cleans up the query-param URL without adding
   * an extra history entry.
   *
   * @param {string} id
   */
  replaceWithTrip(id) {
    const base = this.#basePath();
    const url = `${window.location.origin}${base}trip/${id}/`;
    history.replaceState(null, '', url);
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
