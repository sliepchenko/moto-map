/**
 * Maps each POI type to its SVG icon asset.
 * @type {Record<string, string>}
 */
const POI_ICON_MAP = {
  fuel:      'assets/icons/fuel.svg',
  hotel:     'assets/icons/hotel.svg',
  cafe:      'assets/icons/cafe.svg',
  mechanic:  'assets/icons/mechanic.svg',
  water:     'assets/icons/water.svg',
  viewpoint: 'assets/icons/viewpoint.svg',
};

/**
 * Renders POI markers on a Google Map.
 *
 * SOLID notes:
 *  - SRP: only renders POI markers; no data fetching, no selection state.
 *  - OCP: extend `POI_ICON_MAP` to add new POI types without touching this
 *          class.
 */
export class PoiRenderer {
  /**
   * @param {google.maps.Map} map
   */
  constructor(map) {
    this.#map = map;
  }

  /** @type {google.maps.Map} */
  #map;

  /**
   * Renders all POIs and returns the created markers.
   *
   * @param {Object[]} pois
   * @returns {google.maps.Marker[]}
   */
  renderAll(pois) {
    if (!Array.isArray(pois) || pois.length === 0) return [];
    return pois.map(poi => this.#renderOne(poi));
  }

  // ── private ──────────────────────────────────────────────────────────────

  #renderOne(poi) {
    const iconUrl       = POI_ICON_MAP[poi.type] ?? null;
    const markerOptions = {
      position: { lat: poi.lat, lng: poi.lng },
      map:      this.#map,
      title:    poi.title ?? poi.type,
    };

    if (iconUrl) {
      markerOptions.icon = {
        url:        iconUrl,
        scaledSize: new google.maps.Size(32, 32),
        anchor:     new google.maps.Point(16, 16),
      };
    }

    const marker = new google.maps.Marker(markerOptions);

    // Build InfoWindow content
    const contentParts = [];
    if (poi.title) contentParts.push(`<strong>${poi.title}</strong>`);

    const mapsQuery = poi.address
      ? encodeURIComponent(poi.address)
      : `${poi.lat},${poi.lng}`;
    const mapsLink = `<a href="https://maps.google.com/?q=${mapsQuery}" target="_blank" rel="noopener noreferrer">🔗</a>`;

    contentParts.push(poi.description ? `${poi.description} ${mapsLink}` : mapsLink);

    const infoWindow = new google.maps.InfoWindow({ content: contentParts.join('<br>') });
    marker.addListener('click', () => infoWindow.open(this.#map, marker));

    // Attach for programmatic access
    marker._infoWindow = infoWindow;

    return marker;
  }
}
