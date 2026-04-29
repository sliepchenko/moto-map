/**
 * Maps each POI type to its SVG icon asset.
 * Uses the same colored-circle icon style as NearbyPlacesRenderer
 * so POI markers are visually consistent with route-planning markers.
 * @type {Record<string, string>}
 */
const POI_ICON_MAP = {
  fuel:      'assets/icons/fuel.svg',
  hotel:     'assets/icons/emoji-hotel.svg',
  cafe:      'assets/icons/cafe.svg',
  mechanic:  'assets/icons/poi-mechanic.svg',
  water:     'assets/icons/poi-water.svg',
  viewpoint: 'assets/icons/viewpoint.svg',
  castle:    'assets/icons/poi-castle.svg',
  campsite:  'assets/icons/emoji-campsite.svg',
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
   * @param {google.maps.Map}                          map
   * @param {{ current: google.maps.InfoWindow|null }} openInfoWindow
   *   Shared holder so all renderers and the controller close the same window.
   */
  constructor(map, openInfoWindow) {
    this.#map            = map;
    this.#openInfoWindow = openInfoWindow;
  }

  /** @type {google.maps.Map} */
  #map;

  /** @type {{ current: google.maps.InfoWindow|null }} */
  #openInfoWindow;

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
      position: { lat: Number(poi.lat), lng: Number(poi.lng) },
      map:      this.#map,
      title:    poi.title ?? poi.type,
    };

    if (iconUrl) {
      markerOptions.icon = {
        url:        iconUrl,
        scaledSize: new google.maps.Size(36, 36),
        anchor:     new google.maps.Point(18, 18),
      };
    }

    const marker = new google.maps.Marker(markerOptions);

    // Build InfoWindow content
    const mapsQuery = poi.address
      ? encodeURIComponent(poi.address)
      : `${poi.lat},${poi.lng}`;
    const mapsLink = `<a href="https://maps.google.com/?q=${mapsQuery}" target="_blank" rel="noopener noreferrer">🔗</a>`;

    const bodyContent = poi.description ? `${poi.description} ${mapsLink}` : mapsLink;

    const infoWindow = new google.maps.InfoWindow({
      headerContent: poi.title ?? poi.type,
      content:       bodyContent,
    });
    marker.addListener('click', () => {
      this.#openInfoWindow.current?.close();
      infoWindow.open(this.#map, marker);
      this.#openInfoWindow.current = infoWindow;
    });

    // Attach for programmatic access
    marker._infoWindow = infoWindow;

    return marker;
  }
}
