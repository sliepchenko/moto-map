/**
 * Moto Map — Service Worker
 *
 * Strategy:
 *  - Static shell assets  → Cache-first (install-time pre-cache)
 *  - Google Maps API      → Network-only (cannot be cached; requires live auth)
 *  - App data (JSON)      → Stale-while-revalidate (serve cached, refresh in bg)
 *  - Everything else      → Network-first with cache fallback
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE  = `moto-map-static-${CACHE_VERSION}`;
const DATA_CACHE    = `moto-map-data-${CACHE_VERSION}`;

// All static assets that make up the app shell — pre-cached at install time.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/theme.json',
  '/manifest.json',
  // src modules
  '/src/map/MapController.js',
  '/src/map/MapLoader.js',
  '/src/map/TripRenderer.js',
  '/src/map/PoiRenderer.js',
  '/src/data/TripRepository.js',
  '/src/data/PoiRepository.js',
  '/src/state/UrlStateManager.js',
  '/src/components/AppSidebarComponent.js',
  '/src/components/TripListComponent.js',
  '/src/components/PoiListComponent.js',
  '/src/components/TripStatsPanel.js',
  '/src/core/EventEmitter.js',
  '/src/core/ColorUtils.js',
  '/src/core/GeoUtils.js',
  // Icons
  '/assets/icons/cafe.svg',
  '/assets/icons/fuel.svg',
  '/assets/icons/hotel.svg',
  '/assets/icons/mechanic.svg',
  '/assets/icons/viewpoint.svg',
  '/assets/icons/water.svg',
  '/assets/icon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
];

// Data files — stale-while-revalidate.
const DATA_ASSETS = [
  '/data/pois.json',
  '/data/trips/index.json',
  '/data/trips/trip_22-02-26.json',
  '/data/trips/trip_18-03-26.json',
];

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
      caches.open(DATA_CACHE).then(cache => cache.addAll(DATA_ASSETS)),
    ]).then(() => self.skipWaiting()),
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  // Remove any caches from previous versions.
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map(key => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Google Maps API — always network-only (live key auth required).
  if (url.hostname.includes('maps.googleapis.com') ||
      url.hostname.includes('maps.gstatic.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. App data JSON — stale-while-revalidate.
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // 3. Static shell — cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 4. All other origins — network-first with cache fallback.
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ── Strategies ───────────────────────────────────────────────────────────────

/**
 * Cache-first: return cached response immediately; fall back to network and
 * store the result for next time.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — resource not in cache.', { status: 503 });
  }
}

/**
 * Stale-while-revalidate: serve cached copy instantly; refresh cache in the
 * background so the next visit gets fresh data.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached ?? (await networkFetch) ?? new Response('Offline — data unavailable.', { status: 503 });
}

/**
 * Network-first: try the network; fall back to cache on failure.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline — resource not available.', { status: 503 });
  }
}
