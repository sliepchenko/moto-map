/**
 * A minimal, typed EventEmitter.
 *
 * SOLID notes:
 *  - SRP: only responsible for event subscription / dispatch.
 *  - OCP: consumers extend or compose it; it never needs modification for
 *          new event types.
 *  - LSP: subclasses inherit the full contract without surprises.
 */
export class EventEmitter {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * Subscribes `handler` to `event`. Returns an unsubscribe function.
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  on(event, handler) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribes `handler` to `event` and automatically removes it after the
   * first invocation.
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  once(event, handler) {
    const wrapper = (...args) => {
      handler(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Removes a previously registered handler.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this.#listeners.get(event)?.delete(handler);
  }

  /**
   * Dispatches `event` to all registered handlers with optional `payload`.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    this.#listeners.get(event)?.forEach(fn => fn(payload));
  }
}
