/**
 * Handles loading the Google Maps JavaScript API script and the map theme.
 *
 * SOLID notes:
 *  - SRP: only deals with external resource loading; no rendering or business
 *          logic.
 *  - OCP: swap `themeUrl` or the API endpoint without touching other modules.
 */
export class MapLoader {
  /**
   * @param {string} apiKey     - Google Maps JavaScript API key
   * @param {string} [themeUrl='theme.json'] - URL to the MapTypeStyle JSON
   */
  constructor(apiKey, themeUrl = 'theme.json') {
    this.#apiKey   = apiKey;
    this.#themeUrl = themeUrl;
  }

  /** @type {string} */
  #apiKey;

  /** @type {string} */
  #themeUrl;

  /**
   * Loads both the Google Maps script and the theme file in parallel.
   * Resolves with the parsed theme style array.
   *
   * @returns {Promise<google.maps.MapTypeStyle[]>}
   */
  async load() {
    const [, styles] = await Promise.all([
      this.#loadScript(),
      this.#loadTheme(),
    ]);
    return styles;
  }

  // ── private ──────────────────────────────────────────────────────────────

  #loadScript() {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      const script    = document.createElement('script');
      script.src      = `https://maps.googleapis.com/maps/api/js?key=${this.#apiKey}&libraries=directions,places`;
      script.async    = true;
      script.defer    = true;
      script.onload   = resolve;
      script.onerror  = () => reject(new Error('Failed to load Google Maps API'));
      document.head.appendChild(script);
    });
  }

  async #loadTheme() {
    try {
      const resp = await fetch(this.#themeUrl);
      if (!resp.ok) {
        console.warn(`MapLoader: failed to load theme (HTTP ${resp.status}). Default styling will be used.`);
        return [];
      }
      return resp.json();
    } catch {
      console.warn('MapLoader: unexpected error loading theme. Default styling will be used.');
      return [];
    }
  }
}
