/**
 * Fetches and provides POI data.
 *
 * SOLID notes:
 *  - SRP: only responsible for loading POI data.
 *  - DIP: consumers depend on the abstract `fetchAll()` contract.
 */
export class PoiRepository {
  /** @param {string} [basePath='data'] */
  constructor(basePath = 'data') {
    this.#basePath = basePath;
  }

  /** @type {string} */
  #basePath;

  /**
   * Loads `pois.json` and returns the POI array.
   * Returns an empty array when the file is missing or malformed, so the app
   * degrades gracefully.
   *
   * @returns {Promise<Object[]>}
   */
  async fetchAll() {
    try {
      const resp = await fetch(`${this.#basePath}/pois.json`);
      if (!resp.ok) {
        console.warn(`PoiRepository: failed to load pois.json (HTTP ${resp.status}). No POIs will be shown.`);
        return [];
      }
      const data = await resp.json();
      return Array.isArray(data.pois) ? data.pois : [];
    } catch (err) {
      console.warn('PoiRepository: unexpected error loading pois.json.', err);
      return [];
    }
  }
}
