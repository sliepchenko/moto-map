/**
 * Wraps the browser Geolocation API (`navigator.geolocation.watchPosition`)
 * and provides a clean, event-driven interface.
 *
 * Usage:
 *   const tracker = new LocationTracker();
 *   tracker.onPosition(({ lat, lng, accuracy, heading, speed }) => { … });
 *   tracker.onError(err => { … });
 *   tracker.start();
 *   tracker.stop();
 *
 * SOLID notes:
 *  - SRP: only wraps browser geolocation — no map or UI concerns.
 *  - OCP: extend with additional callbacks without modifying core watch logic.
 */
export class LocationTracker {
  /** @type {number|null} watchPosition ID */
  #watchId = null;

  /** @type {Array<function>} */
  #positionCallbacks = [];

  /** @type {Array<function>} */
  #errorCallbacks = [];

  /** @type {{ lat: number, lng: number, accuracy: number, heading: number|null, speed: number|null }|null} */
  #lastPosition = null;

  /** @returns {boolean} Whether the tracker is currently active. */
  get active() { return this.#watchId !== null; }

  /** @returns {object|null} The most recently received position, or null. */
  get lastPosition() { return this.#lastPosition; }

  /**
   * Registers a callback to be called with each new position.
   * @param {function({ lat: number, lng: number, accuracy: number, heading: number|null, speed: number|null }): void} fn
   */
  onPosition(fn) {
    this.#positionCallbacks.push(fn);
  }

  /**
   * Registers a callback to be called on geolocation error.
   * @param {function(GeolocationPositionError): void} fn
   */
  onError(fn) {
    this.#errorCallbacks.push(fn);
  }

  /**
   * Starts watching the device position.
   * Safe to call multiple times — subsequent calls are no-ops if already active.
   */
  start() {
    if (this.#watchId !== null) return;

    if (!navigator.geolocation) {
      this.#errorCallbacks.forEach(fn =>
        fn({ code: 0, message: 'Geolocation is not supported by this browser.' }),
      );
      return;
    }

    this.#watchId = navigator.geolocation.watchPosition(
      pos => this.#handlePosition(pos),
      err => this.#handleError(err),
      {
        enableHighAccuracy: true,
        maximumAge:         2000,   // accept cached positions up to 2 s old
        timeout:            10000,  // 10 s before firing an error
      },
    );
  }

  /**
   * Stops watching the device position and resets state.
   */
  stop() {
    if (this.#watchId === null) return;
    navigator.geolocation.clearWatch(this.#watchId);
    this.#watchId     = null;
    this.#lastPosition = null;
  }

  // ── private ──────────────────────────────────────────────────────────────

  #handlePosition(pos) {
    const position = {
      lat:      pos.coords.latitude,
      lng:      pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading:  pos.coords.heading,
      speed:    pos.coords.speed,
    };
    this.#lastPosition = position;
    this.#positionCallbacks.forEach(fn => fn(position));
  }

  #handleError(err) {
    this.#errorCallbacks.forEach(fn => fn(err));
  }
}
