/**
 * Renders a single trip on a Google Map as a road-following polyline.
 *
 * SOLID notes:
 *  - SRP: only responsible for drawing one trip; no data loading, no
 *          selection state.
 *  - OCP: override `#routeSegment` to swap the routing back-end without
 *          changing the rendering contract.
 */
export class TripRenderer {
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
   * Draws the trip on the map. Returns handles to the created map objects so
   * the caller can mutate or remove them later.
   *
   * @param {Object} trip - trip data with `waypoints`, `_color`
   * @returns {{ polyline: google.maps.Polyline, markers: google.maps.Marker[] }}
   */
  render(trip) {
    const color     = trip._color ?? trip.color ?? '#E55D2B';
    const waypoints = trip.waypoints;

    const path = new google.maps.MVCArray();

    // Layer 1 — solid colored base line that gives the route its color.
    const basePolyline = new google.maps.Polyline({
      map:           this.#map,
      path,
      geodesic:      true,
      strokeColor:   color,
      strokeOpacity: 1.0,
      strokeWeight:  5,
    });

    // Layer 2 — transparent line carrying white arrow icons so direction is
    // readable against the colored base regardless of the trip color.
    const arrowSymbol = {
      path:          google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale:         2,
      fillColor:     '#ffffff',
      fillOpacity:   0.9,
      strokeColor:   '#000000',
      strokeOpacity: 0.35,
      strokeWeight:  1,
    };

    const polyline = new google.maps.Polyline({
      map:           this.#map,
      path,
      geodesic:      true,
      strokeColor:   color,
      strokeOpacity: 0,
      strokeWeight:  5,
      icons: [{
        icon:   arrowSymbol,
        offset: '12px',
        repeat: '24px',
      }],
    });

    // Build road-following route asynchronously; both polylines share the
    // same MVCArray path so they update together.
    this.#buildRoute(waypoints, path);

    const markers = this.#renderWaypoints(waypoints, color);

    return { polyline, markers, _basePolyline: basePolyline };
  }

  // ── private ──────────────────────────────────────────────────────────────

  async #buildRoute(waypoints, path) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const origin      = new google.maps.LatLng(waypoints[i].lat,     waypoints[i].lng);
      const destination = new google.maps.LatLng(waypoints[i + 1].lat, waypoints[i + 1].lng);

      const { result, status } = await this.#routeSegment(origin, destination);

      if (status === google.maps.DirectionsStatus.OK) {
        result.routes[0].overview_path.forEach(pt => path.push(pt));
      } else {
        console.warn(`TripRenderer: directions failed (${status}) for segment ${i}→${i + 1}. Drawing straight line.`);
        path.push(origin);
        path.push(destination);
      }
    }
  }

  /** Wraps DirectionsService.route() in a Promise. */
  #routeSegment(origin, destination) {
    return new Promise(resolve => {
      new google.maps.DirectionsService().route(
        { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
        (result, status) => resolve({ result, status }),
      );
    });
  }

  /**
   * Creates visible markers for waypoints that have `isVisible: true`.
   *
   * @param {Object[]} waypoints
   * @param {string}   color
   * @returns {google.maps.Marker[]}
   */
  #renderWaypoints(waypoints, color) {
    return waypoints.reduce((acc, wp, i) => {
      if (!wp.isVisible) return acc;

      const isEndpoint = i === 0 || i === waypoints.length - 1;
      const marker = new google.maps.Marker({
        position: { lat: wp.lat, lng: wp.lng },
        map:      this.#map,
        title:    wp.label ?? `Point ${i + 1}`,
        icon: {
          path:        google.maps.SymbolPath.CIRCLE,
          scale:       isEndpoint ? 8 : 5,
          fillColor:   isEndpoint ? '#166534' : color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      if (wp.label || wp.note) {
        const infoWindow = new google.maps.InfoWindow({
          content: `<strong>${wp.label ?? ''}</strong>${wp.note ? `<br>${wp.note}` : ''}`,
        });
        marker.addListener('click', () => {
          this.#openInfoWindow.current?.close();
          infoWindow.open(this.#map, marker);
          this.#openInfoWindow.current = infoWindow;
        });
      }

      acc.push(marker);
      return acc;
    }, []);
  }
}
