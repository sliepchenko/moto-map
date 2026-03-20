// Zagreb coordinates
const ZAGREB_CENTER = { lat: 45.8150, lng: 15.9819 };
const DEFAULT_ZOOM = 12;

/**
 * Maps a POI type string to the corresponding icon URL in assets/icons/.
 * Falls back to a generic circle marker for unknown types.
 * @param {string} type - one of 'fuel' | 'hotel' | 'cafe' | 'mechanic' | 'water' | 'viewpoint'
 * @returns {string} relative URL to the SVG icon
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
 * Fetches the global POI list from data/pois.json.
 * @returns {Promise<Array>} - array of POI objects
 */
async function loadPois() {
  const resp = await fetch('data/pois.json');
  if (!resp.ok) {
    console.warn(`Failed to load pois.json (${resp.status}). No POIs will be shown.`);
    return [];
  }
  const data = await resp.json();
  return Array.isArray(data.pois) ? data.pois : [];
}

/**
 * Renders a single trip on the map using Google DirectionsService to follow
 * actual roads between waypoints. Falls back to a straight-line polyline if
 * the Directions API call fails.
 * @param {google.maps.Map} map
 * @param {Object} trip - trip data object
 * @returns {{ polyline: google.maps.Polyline, markers: google.maps.Marker[] }}
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
        console.warn(`Directions request failed (${status}). Drawing straight line for segment ${i}→${i + 1}.`);
        path.push(origin);
        path.push(destination);
      }
    }
  })();

  // Draw waypoint markers — hidden by default, shown only when isVisible: true
  const markers = [];
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

    markers.push(marker);
  });

  return { polyline: poly, markers };
}

/**
 * Renders POI markers from a flat POI array. Each POI uses a custom SVG icon
 * loaded from assets/icons/ and opens an InfoWindow on click.
 * @param {google.maps.Map} map
 * @param {Array} pois - array of POI objects
 * @returns {google.maps.Marker[]}
 */
function renderPois(map, pois) {
  if (!Array.isArray(pois) || pois.length === 0) return [];

  return pois.map((poi) => {
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
    if (poi.title) contentParts.push(`<strong>${poi.title}</strong>`);

    const mapsQuery = poi.address
      ? encodeURIComponent(poi.address)
      : `${poi.lat},${poi.lng}`;
    const mapsLink = `<a href="https://maps.google.com/?q=${mapsQuery}" target="_blank" rel="noopener noreferrer">🔗</a>`;

    if (poi.description) contentParts.push(`${poi.description} ${mapsLink}`);
    else                 contentParts.push(mapsLink);

    const infoWindow = new google.maps.InfoWindow({
      content: contentParts.join('<br>'),
    });
    marker.addListener('click', () => infoWindow.open(map, marker));

    // Store the infoWindow on the marker so it can be opened programmatically
    marker._infoWindow = infoWindow;

    return marker;
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
 * Fits the map viewport to a single trip's waypoints.
 * @param {google.maps.Map} map
 * @param {Object} trip
 */
function fitMapToTrip(map, trip) {
  const bounds = new google.maps.LatLngBounds();
  trip.waypoints.forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }));
  map.fitBounds(bounds);
}

/**
 * Initialises the Google Map centred on Zagreb, loads and renders all trips.
 * Returns a promise that resolves with an app object exposing:
 *   - map:          the google.maps.Map instance
 *   - trips:        loaded trip objects (available after 'load' fires)
 *   - selectTrip(id): highlight a trip and fly to it; pass null to deselect
 *   - on(event, handler): thin wrapper around map.addListener
 *
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<{ map: google.maps.Map, trips: Array, selectTrip: Function, on: Function }>}
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

  // tripLayers[id] = { trip, polyline, markers }
  const tripLayers = new Map();
  let loadedTrips = [];
  let loadedPois = [];
  let poiMarkers = [];
  let activeId = null;

  /**
   * Apply visual highlight / dim styles to all trip layers.
   * @param {string|null} selectedId - the currently selected trip id, or null for "all equal"
   */
  function applyHighlight(selectedId) {
    tripLayers.forEach(({ trip, polyline }, id) => {
      const isSelected = selectedId === null || id === selectedId;
      polyline.setOptions({
        strokeOpacity: isSelected ? 1.0 : 0.25,
        strokeWeight: isSelected && selectedId !== null ? 6 : 4,
      });
    });
  }

  /**
   * Select a trip by id: highlight it, fly to it, and update the active state.
   * Pass null to deselect (shows all trips equally).
   * @param {string|null} id
   */
  function selectTrip(id) {
    activeId = id;
    applyHighlight(id);

    if (id) {
      const layer = tripLayers.get(id);
      if (layer) {
        fitMapToTrip(map, layer.trip);
      }
    } else {
      if (loadedTrips.length > 0) fitMapToTrips(map, loadedTrips);
    }
  }

  // Provide a simple event bridge
  const loadCallbacks = [];
  let mapReady = false;

  // Load and render all trips once the map tiles are ready
  google.maps.event.addListenerOnce(map, 'idle', async () => {
    try {
      const [trips, pois] = await Promise.all([loadTrips(), loadPois()]);
      trips.sort((a, b) => new Date(a.date) - new Date(b.date));
      assignTripColors(trips);
      loadedTrips = trips;
      loadedPois = pois;

      trips.forEach(trip => {
        const { polyline, markers } = renderTrip(map, trip);
        tripLayers.set(trip.id, { trip, polyline, markers });
      });

      poiMarkers = renderPois(map, pois);

      if (trips.length > 0) {
        fitMapToTrips(map, trips);
      }
    } catch (err) {
      console.error('Failed to load trips:', err);
    }

    mapReady = true;
    loadCallbacks.forEach(cb => cb());
  });

  const wrapper = {
    map,
    get trips() { return loadedTrips; },
    get pois()  { return loadedPois; },

    selectTrip(id) {
      if (!mapReady) {
        // Queue until map is ready
        loadCallbacks.push(() => selectTrip(id));
      } else {
        selectTrip(id);
      }
    },

    /**
     * Fly to and open the InfoWindow for a specific POI by its global index.
     * @param {number} poiIndex - zero-based index in the global pois array
     */
    openPoi(poiIndex) {
      const doOpen = () => {
        const marker = poiMarkers[poiIndex];
        if (!marker) return;

        const pos = marker.getPosition();
        map.panTo(pos);
        map.setZoom(15);
        if (marker._infoWindow) {
          marker._infoWindow.open(map, marker);
        }
      };

      if (!mapReady) {
        loadCallbacks.push(doOpen);
      } else {
        doOpen();
      }
    },

    on(event, handler) {
      if (event === 'load') {
        if (mapReady) {
          handler();
        } else {
          loadCallbacks.push(handler);
        }
      } else {
        map.addListener(event, handler);
      }
    },
  };

  return wrapper;
}
