// Zagreb coordinates
const ZAGREB_CENTER = { lat: 45.8150, lng: 15.9819 };
const DEFAULT_ZOOM = 12;

/**
 * Dynamically loads the Google Maps JavaScript API script.
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<void>}
 */
function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=directions`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  });
}

/**
 * Fetches the trip manifest and all individual trip JSON files.
 * @returns {Promise<Array>} - array of trip objects
 */
async function loadTrips() {
  const manifestResp = await fetch('data/trips/index.json');
  const manifest = await manifestResp.json();

  const trips = await Promise.all(
    manifest.trips.map(async (path) => {
      const resp = await fetch(`data/${path}`);
      return resp.json();
    })
  );

  return trips;
}

/**
 * Renders a single trip on the map using Google DirectionsService to follow
 * actual roads between waypoints. Falls back to a straight-line polyline if
 * the Directions API call fails.
 * @param {google.maps.Map} map
 * @param {Object} trip - trip data object
 */
function renderTrip(map, trip) {
  const color = trip.color ?? '#E55D2B';
  const waypoints = trip.waypoints;

  // Initialise the polyline that will accumulate road geometry
  const path = new google.maps.MVCArray();
  const poly = new google.maps.Polyline({
    map,
    path,
    geodesic: true,
    strokeColor: color,
    strokeOpacity: 1.0,
    strokeWeight: 4,
  });

  const service = new google.maps.DirectionsService();

  // Wrap DirectionsService.route() in a Promise so segments can be awaited in order
  function routeSegment(origin, destination) {
    return new Promise((resolve) => {
      service.route(
        { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
        (result, status) => resolve({ result, status })
      );
    });
  }

  // Request road-following directions for each consecutive pair of waypoints.
  // Segments are processed sequentially to guarantee point order in the shared
  // path array — parallel callbacks would race and produce lines between
  // non-neighbouring points.
  (async () => {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const origin = new google.maps.LatLng(waypoints[i].lat, waypoints[i].lng);
      const destination = new google.maps.LatLng(waypoints[i + 1].lat, waypoints[i + 1].lng);

      const { result, status } = await routeSegment(origin, destination);

      if (status === google.maps.DirectionsStatus.OK) {
        const overview = result.routes[0].overview_path;
        for (let j = 0; j < overview.length; j++) {
          path.push(overview[j]);
        }
      } else {
        // Fallback: draw a straight segment if routing fails
        console.warn(`Directions request failed (${status}). Drawing straight line for segment ${i}→${i + 1}.`);
        path.push(origin);
        path.push(destination);
      }
    }
  })();

  // Draw waypoint markers
  waypoints.forEach((wp, i) => {
    const isStart = i === 0;
    const isEnd = i === waypoints.length - 1;

    const marker = new google.maps.Marker({
      position: { lat: wp.lat, lng: wp.lng },
      map,
      title: wp.label ?? `Point ${i + 1}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isStart || isEnd ? 8 : 5,
        fillColor: isStart ? '#22c55e' : isEnd ? '#ef4444' : color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    if (wp.label || wp.note) {
      const infoWindow = new google.maps.InfoWindow({
        content: `<strong>${wp.label ?? ''}</strong>${wp.note ? `<br>${wp.note}` : ''}`,
      });
      marker.addListener('click', () => infoWindow.open(map, marker));
    }
  });
}

/**
 * Fits the map viewport to show all waypoints of all trips.
 * @param {google.maps.Map} map
 * @param {Array} trips
 */
function fitMapToTrips(map, trips) {
  const bounds = new google.maps.LatLngBounds();
  trips.forEach(trip => {
    trip.waypoints.forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }));
  });
  map.fitBounds(bounds);
}

/**
 * Initialises the Google Map centred on Zagreb, loads and renders all trips.
 * Returns a promise that resolves with an object exposing:
 *   - map: the google.maps.Map instance
 *   - on(event, handler): thin wrapper around map.addListener
 *
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<{ map: google.maps.Map, on: Function }>}
 */
export async function initMap(apiKey) {
  await loadGoogleMapsScript(apiKey);

  const map = new google.maps.Map(document.getElementById('map'), {
    center: ZAGREB_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeId: google.maps.MapTypeId.TERRAIN,
    zoomControl: true,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  });

  // Load and render all trips once the map tiles are ready
  google.maps.event.addListenerOnce(map, 'idle', async () => {
    try {
      const trips = await loadTrips();
      trips.forEach(trip => renderTrip(map, trip));
      if (trips.length > 0) {
        fitMapToTrips(map, trips);
      }
    } catch (err) {
      console.error('Failed to load trips:', err);
    }
  });

  // Provide a simple event bridge compatible with the Mapbox `.on()` pattern
  const wrapper = {
    map,
    on(event, handler) {
      if (event === 'load') {
        google.maps.event.addListenerOnce(map, 'idle', handler);
      } else {
        map.addListener(event, handler);
      }
    },
  };

  return wrapper;
}
