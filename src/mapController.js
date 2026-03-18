// Zagreb coordinates
const ZAGREB_CENTER = { lat: 45.8150, lng: 15.9819 };
const DEFAULT_ZOOM = 12;

/**
 * Maps a POI type string to the corresponding icon URL in assets/icons/.
 * Falls back to a generic circle marker for unknown types.
 * @param {string} type - one of 'fuel' | 'hotel' | 'cafe' | 'mechanic'
 * @returns {string} relative URL to the SVG icon
 */
const POI_ICON_MAP = {
  fuel:     'assets/icons/fuel.svg',
  hotel:    'assets/icons/hotel.svg',
  cafe:     'assets/icons/cafe.svg',
  mechanic: 'assets/icons/mechanic.svg',
  water:     'assets/icons/water.svg',
};

/**
 * Returns the great-circle distance in kilometres between two lat/lng points
 * using the Haversine formula.
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number} distance in km
 */
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    sinDLng * sinDLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Estimates the total route length of a trip by summing Haversine distances
 * between consecutive points. Uses `route` if present, otherwise `waypoints`.
 * @param {Object} trip
 * @returns {number} estimated distance in km
 */
function estimateTripDistance(trip) {
  const pts = trip.route ?? trip.waypoints;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += haversineKm(pts[i], pts[i + 1]);
  }
  return total;
}

/**
 * Interpolates a CSS hex colour across three stops based on trip age:
 *   t = 0.0 (oldest)  → gray-green  #6b7c6e  rgb(107, 124, 110)
 *   t = 0.5 (mid-age) → dark green  #166534  rgb( 22, 101,  52)
 *   t = 1.0 (newest)  → bright green #22c55e  rgb( 34, 197,  94)
 * @param {number} t - normalised position [0, 1]
 * @returns {string} hex colour string, e.g. '#3a8f5c'
 */
function lerpColor(t) {
  // Three colour stops
  const stops = [
    { r: 107, g: 124, b: 110 }, // gray-green  (#6b7c6e) — oldest
    { r:  22, g: 101, b:  52 }, // dark green  (#166534) — middle age
    { r:  34, g: 197, b:  94 }, // bright green (#22c55e) — newest
  ];

  // Map t into a segment index and local position within that segment
  const segments = stops.length - 1;          // 2 segments
  const scaled   = Math.min(t * segments, segments - 1e-10);
  const idx      = Math.floor(scaled);         // 0 or 1
  const u        = scaled - idx;               // local [0, 1)

  const a = stops[idx];
  const b = stops[idx + 1];

  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const bv = Math.round(a.b + (b.b - a.b) * u);
  return '#' + [r, g, bv].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Given an array of trips, assigns a `_color` property to each based on its
 * date using a three-stop gradient:
 *   oldest  → gray-green  (#6b7c6e)
 *   middle  → dark green  (#166534)
 *   newest  → bright green (#22c55e)
 * If a trip already has a `color` field it is left unchanged.
 * @param {Array} trips
 */
function assignTripColors(trips) {
  const timestamps = trips.map(trip => new Date(trip.date).getTime());
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const range = max - min;

  trips.forEach((trip, i) => {
    if (trip.color) {
      // Author-specified colour takes precedence
      trip._color = trip.color;
    } else {
      const t = range === 0 ? 0 : (timestamps[i] - min) / range;
      trip._color = lerpColor(t);
    }
  });
}

/**
 * Loads the Google Maps styling configuration from theme.json at the project root.
 * @returns {Promise<Array>} - Google Maps MapTypeStyle array
 */
async function loadMapTheme() {
  const resp = await fetch('theme.json');
  if (!resp.ok) {
    console.warn(`Failed to load theme.json (${resp.status}). Map will use default styling.`);
    return [];
  }
  return resp.json();
}

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
  // _color is set by assignTripColors() before rendering; fall back to the
  // legacy static orange only if somehow called before colour assignment.
  const color = trip._color ?? trip.color ?? '#E55D2B';
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

  // Draw waypoint markers — hidden by default, shown only when isVisible: true
  waypoints.forEach((wp, i) => {
    if (!wp.isVisible) return;

    const isStart = i === 0;
    const isEnd = i === waypoints.length - 1;

    const marker = new google.maps.Marker({
      position: { lat: wp.lat, lng: wp.lng },
      map,
      title: wp.label ?? `Point ${i + 1}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isStart || isEnd ? 8 : 5,
        fillColor: isStart ? '#166534' : isEnd ? '#166534' : color,
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
 * Renders POI markers for a single trip. Each POI uses a custom SVG icon
 * loaded from assets/icons/ and opens an InfoWindow on click.
 * @param {google.maps.Map} map
 * @param {Object} trip - trip data object (may have a `poi` array)
 */
function renderPois(map, trip) {
  if (!Array.isArray(trip.poi) || trip.poi.length === 0) return;

  trip.poi.forEach((poi) => {
    const iconUrl = POI_ICON_MAP[poi.type] ?? null;

    const markerOptions = {
      position: { lat: poi.lat, lng: poi.lng },
      map,
      title: poi.title ?? poi.type,
    };

    if (iconUrl) {
      markerOptions.icon = {
        url: iconUrl,
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16),
      };
    }

    const marker = new google.maps.Marker(markerOptions);

    const contentParts = [];
    if (poi.title)       contentParts.push(`<strong>${poi.title}</strong>`);
    if (poi.description) contentParts.push(poi.description);
    if (poi.address)     contentParts.push(`<a href="https://maps.google.com/?q=${encodeURIComponent(poi.address)}" target="_blank" rel="noopener noreferrer">${poi.address}</a>`);

    if (contentParts.length > 0) {
      const infoWindow = new google.maps.InfoWindow({
        content: contentParts.join('<br>'),
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
  const [, mapStyles] = await Promise.all([
    loadGoogleMapsScript(apiKey),
    loadMapTheme(),
  ]);

  const map = new google.maps.Map(document.getElementById('map'), {
    center: ZAGREB_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeId: google.maps.MapTypeId.TERRAIN,
    styles: mapStyles,
    zoomControl: true,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  });

  // Load and render all trips once the map tiles are ready
  google.maps.event.addListenerOnce(map, 'idle', async () => {
    try {
      const trips = await loadTrips();
      trips.sort((a, b) => new Date(a.date) - new Date(b.date));
      assignTripColors(trips);
      trips.forEach(trip => {
        renderTrip(map, trip);
        renderPois(map, trip);
      });
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
