/**
 * Fetches and provides trip data.
 *
 * SOLID notes:
 *  - SRP: only responsible for loading trip data; no rendering, no map.
 *  - DIP: consumers depend on the abstract `fetchAll()` contract, not on
 *          concrete fetch calls scattered throughout the app.
 */
export class TripRepository {
  /** @param {string} [basePath='data'] */
  constructor(basePath = 'data') {
    this.#basePath = basePath;
  }

  /** @type {string} */
  #basePath;

  /**
   * Loads the trip manifest and all individual trip JSON files in parallel.
   * Trips are returned sorted by date ascending.
   *
   * @returns {Promise<Object[]>}
   */
  async fetchAll() {
    const manifest = await this.#fetchManifest();
    const trips    = await Promise.all(
      manifest.trips.map(path => this.#fetchTrip(path)),
    );
    return trips.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // ── private ──────────────────────────────────────────────────────────────

  async #fetchManifest() {
    const resp = await fetch(`${this.#basePath}/trips/index.json`);
    if (!resp.ok) {
      throw new Error(`Failed to load trip manifest (HTTP ${resp.status})`);
    }
    return resp.json();
  }

  async #fetchTrip(relativePath) {
    const resp = await fetch(`${this.#basePath}/${relativePath}`);
    if (!resp.ok) {
      throw new Error(`Failed to load trip "${relativePath}" (HTTP ${resp.status})`);
    }
    return resp.json();
  }
}
