/**
 * Manages Open Graph, Twitter Card, and <title> meta tags.
 *
 * Updates the page <head> so that when a user copies the URL of a selected
 * trip and shares it, messaging apps (Telegram, Discord, Slack, Twitter/X)
 * can display a rich preview showing the trip name, distance, duration, and date.
 *
 * How it works:
 *  - On page load, static fallback OG tags are already present in index.html.
 *  - When the user selects a trip, `updateForTrip()` patches them in place so
 *    the URL a user copies has the right og:title and og:image already set
 *    in the live DOM.
 *  - `og:image` points to a pre-generated PNG file at /assets/og/<tripId>.png.
 *    These files are produced by running `node scripts/generate-og-images.js`.
 *  - `og:url` is updated to the current page URL (including ?trip= param) so
 *    crawlers that follow the canonical URL see the right content.
 *
 * SOLID notes:
 *  - SRP: only reads/writes <head> meta tags and <title>; zero rendering logic.
 *  - OCP: add new meta tags by extending the `#setMeta` helper calls in each method.
 */
export class OgMetaManager {
  /** Base URL of the deployment — used to build absolute og:image URLs. */
  #baseUrl;

  /**
   * @param {string} [baseUrl] — Origin for absolute URLs (default: window.location.origin).
   */
  constructor(baseUrl = window.location.origin) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Updates all OG / Twitter Card meta tags and the page <title> for a specific trip.
   *
   * @param {{
   *   id: string,
   *   title: string,
   *   date: string,
   *   _roadDistanceKm?: number|null,
   *   roadDistanceKm?: number|null,
   *   waypoints: {lat:number, lng:number}[]
   * }} trip
   * @param {string} distanceFormatted  — e.g. "383.5 km"
   * @param {string} durationFormatted  — e.g. "7 h 41 min"
   */
  updateForTrip(trip, distanceFormatted, durationFormatted) {
    const date = new Date(trip.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    const pageTitle   = trip.title;
    const description = `${distanceFormatted} · ${durationFormatted} · ${date}`;
    const imageUrl    = `${this.#baseUrl}/assets/og/${trip.id}.png`;
    const pageUrl     = window.location.href;

    document.title = pageTitle;

    this.#setMeta('property', 'og:title',       pageTitle);
    this.#setMeta('property', 'og:description', description);
    this.#setMeta('property', 'og:image',       imageUrl);
    this.#setMeta('property', 'og:url',         pageUrl);
    this.#setMeta('property', 'og:type',        'website');

    this.#setMeta('name', 'twitter:card',        'summary_large_image');
    this.#setMeta('name', 'twitter:title',       pageTitle);
    this.#setMeta('name', 'twitter:description', description);
    this.#setMeta('name', 'twitter:image',       imageUrl);

    this.#setMeta('name', 'description', description);
  }

  /**
   * Resets all OG meta tags back to the site-level defaults.
   * Called when the user deselects a trip.
   */
  reset() {
    const defaultTitle = 'Moto Map';
    const defaultDesc  = 'Browse your motorcycle routes and points of interest on an interactive map.';
    const defaultImage = `${this.#baseUrl}/assets/og/default.png`;
    const defaultUrl   = `${this.#baseUrl}/`;

    document.title = defaultTitle;

    this.#setMeta('property', 'og:title',       defaultTitle);
    this.#setMeta('property', 'og:description', defaultDesc);
    this.#setMeta('property', 'og:image',       defaultImage);
    this.#setMeta('property', 'og:url',         defaultUrl);
    this.#setMeta('property', 'og:type',        'website');

    this.#setMeta('name', 'twitter:card',        'summary_large_image');
    this.#setMeta('name', 'twitter:title',       defaultTitle);
    this.#setMeta('name', 'twitter:description', defaultDesc);
    this.#setMeta('name', 'twitter:image',       defaultImage);

    this.#setMeta('name', 'description', defaultDesc);
  }

  /**
   * Creates or updates a <meta> tag identified by an attribute selector.
   *
   * @param {'property'|'name'} attr   — the meta tag's key attribute
   * @param {string}            value  — the attribute's value (e.g. 'og:title')
   * @param {string}            content — the `content` attribute to set
   */
  #setMeta(attr, value, content) {
    let el = document.querySelector(`meta[${attr}="${value}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, value);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }
}
