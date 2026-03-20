import { initMap } from './src/mapController.js';

const GOOGLE_MAPS_API_KEY = 'AIzaSyD_XkQAhqeRRkLct-LBdcwP5QfIMvU0B4I';

const app = await initMap(GOOGLE_MAPS_API_KEY);

// ── URL helpers ──────────────────────────────────────────────────────────────

/** Reads `?trip=` from the current URL. */
function getTripIdFromUrl() {
  return new URLSearchParams(window.location.search).get('trip');
}

/**
 * Reads `?poi=<index>` from the current URL.
 * @returns {number | null}
 */
function getPoiFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('poi');
  if (raw === null) return null;
  const index = parseInt(raw, 10);
  return isNaN(index) ? null : index;
}

/**
 * Pushes a new URL state. Pass `{ trip }` or `{ poi }` to set the respective
 * param and clear the other one.
 * @param {{ trip?: string|null, poi?: number|null }} opts
 */
function pushState(opts) {
  const url = new URL(window.location.href);

  if ('trip' in opts) {
    if (opts.trip) {
      url.searchParams.set('trip', opts.trip);
    } else {
      url.searchParams.delete('trip');
    }
    url.searchParams.delete('poi');
  }

  if ('poi' in opts) {
    if (opts.poi !== null && opts.poi !== undefined) {
      url.searchParams.set('poi', String(opts.poi));
    } else {
      url.searchParams.delete('poi');
    }
    url.searchParams.delete('trip');
  }

  history.pushState(null, '', url.toString());
}

// ── Sidebar accordion ────────────────────────────────────────────────────────

/**
 * Opens the accordion section matching `name` ('rides' | 'poi') and closes
 * all others.
 * @param {string} name
 */
function openAccordionSection(name) {
  document.querySelectorAll('.accordion-section').forEach(section => {
    section.classList.toggle('open', section.dataset.section === name);
  });
}

document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    const section = header.closest('.accordion-section');
    const isOpen = section.classList.contains('open');
    // Close all, then open this one (unless it was already open — keep it open)
    document.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
    if (!isOpen) {
      section.classList.add('open');
    }
  });
});

// ── Sidebar: My Rides ────────────────────────────────────────────────────────

/**
 * Selects the trip by id, updates the sidebar highlight, and does NOT push
 * to history (used by popstate and initial load).
 */
function applyTripSelection(tripId) {
  app.selectTrip(tripId ?? null);
  updateRideSelection(tripId ?? null);
}

/**
 * Builds and injects the trip list once trips are loaded.
 */
function buildRidesList(trips) {
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
      if (currentId === trip.id) {
        pushState({ trip: null });
        applyTripSelection(null);
      } else {
        pushState({ trip: trip.id });
        applyTripSelection(trip.id);
      }
    });

    list.appendChild(item);
  });
}

/** Highlights the sidebar ride item matching `tripId`. */
function updateRideSelection(tripId) {
  document.querySelectorAll('.trip-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tripId === tripId);
  });
}

// ── Sidebar: My POI ──────────────────────────────────────────────────────────

/** Emoji labels for each POI type. */
const POI_EMOJI = {
  cafe:      '☕',
  fuel:      '⛽',
  hotel:     '🏨',
  mechanic:  '🔧',
  water:     '💧',
  viewpoint: '🔭',
};

/**
 * Builds and injects the POI list from the global pois array.
 */
function buildPoiList(pois) {
  const list = document.getElementById('poi-list');
  list.innerHTML = '';

  pois.forEach((poi, index) => {
    const item = document.createElement('li');
    item.className = 'poi-item';
    item.dataset.poiIndex = index;

    const emoji = POI_EMOJI[poi.type] ?? '📍';

    item.innerHTML = `
      <span class="poi-icon">${emoji}</span>
      <span class="poi-details">
        <span class="poi-title">${poi.title ?? poi.type}</span>
        ${poi.description ? `<span class="poi-desc">${poi.description}</span>` : ''}
      </span>
    `;

    item.addEventListener('click', () => {
      pushState({ poi: index });
      applyPoiOpen(index);
    });

    list.appendChild(item);
  });
}

/**
 * Opens the POI on the map and highlights its sidebar item.
 * Does NOT push to history.
 */
function applyPoiOpen(index) {
  app.openPoi(index);
  updatePoiSelection(index);
}

/** Highlights the POI sidebar item matching index. */
function updatePoiSelection(index) {
  document.querySelectorAll('.poi-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.poiIndex, 10) === index);
  });
}

/** Clears the POI selection highlight. */
function clearPoiSelection() {
  document.querySelectorAll('.poi-item').forEach(el => el.classList.remove('active'));
}

// ── Initialisation ───────────────────────────────────────────────────────────

app.on('load', () => {
  const sidebar = document.getElementById('sidebar');

  buildRidesList(app.trips);
  buildPoiList(app.pois);

  sidebar.classList.remove('hidden');

  // Apply URL state on initial page load
  const initialTripId = getTripIdFromUrl();
  const initialPoi = getPoiFromUrl();

  if (initialPoi !== null) {
    // Open POI accordion section and open the POI
    openAccordionSection('poi');
    applyPoiOpen(initialPoi);
  } else if (initialTripId) {
    applyTripSelection(initialTripId);
  }
});

// ── Back / Forward button support ────────────────────────────────────────────

window.addEventListener('popstate', () => {
  const tripId = getTripIdFromUrl();
  const poi = getPoiFromUrl();

  if (poi !== null) {
    openAccordionSection('poi');
    clearPoiSelection();
    applyPoiOpen(poi);
  } else if (tripId) {
    openAccordionSection('rides');
    clearPoiSelection();
    applyTripSelection(tripId);
  } else {
    applyTripSelection(null);
    clearPoiSelection();
  }
});
