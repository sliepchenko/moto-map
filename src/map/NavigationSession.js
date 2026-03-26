/**
 * Manages a single navigation session from the user's current location to a
 * chosen destination, using Google Maps DirectionsService.
 *
 * Responsibilities:
 *  - Request a driving route from origin → destination.
 *  - Expose the full route path (for drawing the nav polyline).
 *  - Advance through steps as the user moves and emit `'step'` events.
 *  - Emit `'arrived'` when the user is within the arrival radius.
 *
 * Usage:
 *   const session = new NavigationSession();
 *   session.onStep(step => { … });      // { instruction, distance, duration, stepIndex, totalSteps }
 *   session.onArrived(() => { … });
 *   session.onError(msg => { … });
 *   const route = await session.start(originLatLng, destinationLatLng);
 *   // route: { path: LatLng[], steps: Step[], distanceKm, durationMin }
 *   session.updatePosition({ lat, lng });   // call from LocationTracker
 *   session.stop();
 *
 * SOLID notes:
 *  - SRP: owns only routing + step-advancement logic; no map drawing.
 *  - OCP: rendering is done by NavigationRenderer (separate class).
 */
export class NavigationSession {
  /** @type {boolean} */
  #active = false;

  /** @type {Array<object>} Parsed step objects from the Directions response. */
  #steps = [];

  /** @type {number} Index of the current step the rider is approaching. */
  #currentStepIndex = 0;

  /** @type {Array<function>} */
  #stepCallbacks = [];

  /** @type {Array<function>} */
  #arrivedCallbacks = [];

  /** @type {Array<function>} */
  #errorCallbacks = [];

  /**
   * Metres within which the user is considered to have "reached" a step's
   * end point or the final destination.
   */
  static STEP_RADIUS_M   = 35;
  static ARRIVE_RADIUS_M = 50;

  // ── public API ────────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get active() { return this.#active; }

  /** @returns {number} */
  get currentStepIndex() { return this.#currentStepIndex; }

  /** @returns {Array<object>} */
  get steps() { return this.#steps; }

  /**
   * @param {function({ instruction: string, distance: string, duration: string,
   *                    stepIndex: number, totalSteps: number, maneuver: string }): void} fn
   */
  onStep(fn)    { this.#stepCallbacks.push(fn); }
  onArrived(fn) { this.#arrivedCallbacks.push(fn); }
  onError(fn)   { this.#errorCallbacks.push(fn); }

  /**
   * Requests a route and, on success, returns the route data.
   *
   * @param {{ lat: number, lng: number }} origin
   * @param {{ lat: number, lng: number }} destination
   * @returns {Promise<{ path: Array<{lat:number,lng:number}>, steps: object[], distanceKm: number, durationMin: number }|null>}
   */
  async start(origin, destination) {
    this.stop(); // reset any previous session

    const result = await this.#requestRoute(origin, destination);
    if (!result) return null;

    const route = result.routes[0];
    const leg   = route.legs[0];

    // Parse steps
    this.#steps = leg.steps.map((s, i) => ({
      index:       i,
      instruction: this.#stripHtml(s.instructions),
      distance:    s.distance?.text ?? '',
      duration:    s.duration?.text ?? '',
      maneuver:    s.maneuver ?? '',
      endLat:      s.end_location.lat(),
      endLng:      s.end_location.lng(),
    }));

    this.#currentStepIndex = 0;
    this.#active           = true;

    // Build flat path array for drawing
    const path = route.overview_path.map(pt => ({ lat: pt.lat(), lng: pt.lng() }));

    const distanceKm  = (leg.distance?.value  ?? 0) / 1000;
    const durationMin = (leg.duration?.value  ?? 0) / 60;

    // Emit the first step instruction immediately
    this.#emitStep();

    return { path, steps: this.#steps, distanceKm, durationMin };
  }

  /**
   * Should be called on every new GPS position from `LocationTracker`.
   * Advances through steps and emits `'arrived'` when destination is reached.
   *
   * @param {{ lat: number, lng: number }} position
   */
  updatePosition(position) {
    if (!this.#active || this.#steps.length === 0) return;

    const step = this.#steps[this.#currentStepIndex];
    const dist = this.#haversine(position, { lat: step.endLat, lng: step.endLng });

    const isLastStep = this.#currentStepIndex === this.#steps.length - 1;

    if (isLastStep) {
      if (dist < NavigationSession.ARRIVE_RADIUS_M) {
        this.#active = false;
        this.#arrivedCallbacks.forEach(fn => fn());
      }
    } else if (dist < NavigationSession.STEP_RADIUS_M) {
      this.#currentStepIndex++;
      this.#emitStep();
    }
  }

  /** Cancels the active navigation session. */
  stop() {
    this.#active           = false;
    this.#steps            = [];
    this.#currentStepIndex = 0;
  }

  // ── private ──────────────────────────────────────────────────────────────

  #emitStep() {
    const step = this.#steps[this.#currentStepIndex];
    if (!step) return;
    this.#stepCallbacks.forEach(fn => fn({
      instruction: step.instruction,
      distance:    step.distance,
      duration:    step.duration,
      maneuver:    step.maneuver,
      stepIndex:   this.#currentStepIndex,
      totalSteps:  this.#steps.length,
    }));
  }

  /** @returns {Promise<google.maps.DirectionsResult|null>} */
  #requestRoute(origin, destination) {
    return new Promise(resolve => {
      new google.maps.DirectionsService().route(
        {
          origin:      new google.maps.LatLng(origin.lat, origin.lng),
          destination: new google.maps.LatLng(destination.lat, destination.lng),
          travelMode:  google.maps.TravelMode.TWO_WHEELER,
          provideRouteAlternatives: false,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            resolve(result);
          } else {
            this.#errorCallbacks.forEach(fn => fn(`Directions failed: ${status}`));
            resolve(null);
          }
        },
      );
    });
  }

  /** Haversine great-circle distance in metres. */
  #haversine(a, b) {
    const R  = 6371000;
    const φ1 = a.lat * Math.PI / 180;
    const φ2 = b.lat * Math.PI / 180;
    const Δφ = (b.lat - a.lat) * Math.PI / 180;
    const Δλ = (b.lng - a.lng) * Math.PI / 180;
    const s  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  /** Removes HTML tags from a Google Directions instruction string. */
  #stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
