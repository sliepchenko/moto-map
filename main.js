import { initMap } from './src/mapController.js';

const GOOGLE_MAPS_API_KEY = 'AIzaSyD_XkQAhqeRRkLct-LBdcwP5QfIMvU0B4I';

const app = await initMap(GOOGLE_MAPS_API_KEY);

// ── Deep Linking ────────────────────────────────────────────────────────────

/**
 * Reads the `?trip=` query parameter from the current URL.
 * @returns {string|null}
 */
function getTripIdFromUrl() {
  return new URLSearchParams(window.location.search).get('trip');
}

/**
 * Updates the browser's address bar to reflect the selected trip without
 * causing a page reload.
 * @param {string|null} tripId - pass null to clear the parameter
 */
function pushTripToUrl(tripId) {
  const url = new URL(window.location.href);
  if (tripId) {
    url.searchParams.set('trip', tripId);
  } else {
    url.searchParams.delete('trip');
  }
  history.pushState({ id: tripId }, '', url.toString());
}

/**
 * Selects the trip identified by `tripId` and updates the sidebar highlight.
 * Does NOT push to history (used by popstate and initial load).
 * @param {string|null} tripId
 */
function applyTripSelection(tripId) {
  app.selectTrip(tripId ?? null);
  updateSidebarSelection(tripId ?? null);
}

// ── Sidebar UI ──────────────────────────────────────────────────────────────

/**
 * Builds and injects the sidebar trip list once trips are loaded.
 */
function buildSidebar(trips) {
  const sidebar = document.getElementById('sidebar');
  const list = document.getElementById('trip-list');
  list.innerHTML = '';

  trips.forEach(trip => {
    const item = document.createElement('li');
    item.dataset.tripId = trip.id;
    item.className = 'trip-item';

    const date = new Date(trip.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    item.innerHTML = `
      <span class="trip-title">${trip.title}</span>
      <span class="trip-date">${date}</span>
    `;

    item.addEventListener('click', () => {
      const currentId = getTripIdFromUrl();
      // Clicking the active trip deselects it
      if (currentId === trip.id) {
        pushTripToUrl(null);
        applyTripSelection(null);
      } else {
        pushTripToUrl(trip.id);
        applyTripSelection(trip.id);
      }
    });

    list.appendChild(item);
  });

  sidebar.classList.remove('hidden');
}

/**
 * Highlights the sidebar item matching `tripId` (removes highlight from others).
 * @param {string|null} tripId
 */
function updateSidebarSelection(tripId) {
  document.querySelectorAll('.trip-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tripId === tripId);
  });
}

// ── Initialisation ──────────────────────────────────────────────────────────

app.on('load', () => {
  console.log('Moto Map ready — centred on Zagreb.');

  buildSidebar(app.trips);

  // Apply any trip id present in the URL on initial page load
  const initialTripId = getTripIdFromUrl();
  if (initialTripId) {
    applyTripSelection(initialTripId);
  }
});

// ── Back / Forward button support ───────────────────────────────────────────

window.addEventListener('popstate', (event) => {
  const tripId = event.state?.id ?? getTripIdFromUrl();
  applyTripSelection(tripId ?? null);
});
