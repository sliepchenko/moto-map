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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  });
}

/**
 * Initialises the Google Map centred on Zagreb.
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
    // Keep UI controls equivalent to Mapbox NavigationControl
    zoomControl: true,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  });

  // Provide a simple event bridge compatible with the Mapbox `.on()` pattern
  // used in main.js: map.on('load', handler)
  const wrapper = {
    map,
    on(event, handler) {
      if (event === 'load') {
        // Google Maps fires 'idle' after tiles finish loading; use it as
        // a one-time stand-in for Mapbox's 'load' event.
        google.maps.event.addListenerOnce(map, 'idle', handler);
      } else {
        map.addListener(event, handler);
      }
    },
  };

  return wrapper;
}
