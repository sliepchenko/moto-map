# Moto Map — Motorcycle Trip Tracker

A fully static website that visualizes personal motorcycle trips on an interactive Google Maps map. Trip data and Points of Interest are stored as plain JSON files — no backend, no database, no build pipeline.

---

## Table of Contents

1. [Project Status](#project-status)
2. [Project Overview](#project-overview)
3. [Features](#features)
4. [Architecture](#architecture)
5. [Directory Structure](#directory-structure)
6. [Code Guide — OOP, SOLID & Web Components](#code-guide--oop-solid--web-components)
7. [Data Format](#data-format)
8. [Technology Stack](#technology-stack)
9. [Development Workflow](#development-workflow)
10. [Static Hosting](#static-hosting)
11. [Future Enhancements](#future-enhancements)

---

## Project Status

**Current phase: OOP / SOLID / WebComponents refactor — complete.**

The codebase was fully rewritten from a flat-function style to a class-based, SOLID-documented, Web Component-driven architecture. All features below are implemented and working.

| Area | Status |
|---|---|
| Google Maps integration (Terrain + custom style) | Done |
| Road-following trip polylines via Directions API | Done |
| Automatic trip color gradient by date | Done |
| Waypoint markers with InfoWindows | Done |
| Points of Interest with custom SVG icons | Done |
| Collapsible sidebar with accordion sections | Done |
| Trip selection, highlight, deselect | Done |
| Deep linking via `?trip=` / `?poi=` URL params | Done |
| Browser back/forward navigation | Done |
| Responsive bottom-sheet layout (mobile) | Done |

---

## Project Overview

**Moto Map** is a personal portfolio of motorcycle trips. Each trip is a JSON file with an ordered list of geographic waypoints. At runtime the app fetches those files, calls the Google Maps Directions API to resolve road-following routes between waypoints, and draws the result on a full-screen map.

Points of Interest (cafes, fuel stations, viewpoints, water spots) are loaded from a separate `pois.json` file and rendered with custom SVG icons.

There is no server, no database, and no authentication. The entire application is a collection of static files hostable for free on GitHub Pages, Netlify, or any CDN.

---

## Features

### Map

- Full-screen Google Maps with **TERRAIN** map type and a custom grayscale style (`theme.json`) — desaturated roads, blue water, business and transit icons hidden for clarity.
- Default center: **Zagreb, Croatia** (45.8150, 15.9819), zoom 12.
- Map controls: zoom, map type toggle, fullscreen. Street view is disabled.
- `fitBounds()` auto-zoom: on initial load the viewport fits all trips; selecting a trip zooms to that trip's waypoints.

### Trip Rendering

- Each trip's route is drawn as a **road-following polyline** using the Google Maps **DirectionsService** API. The renderer calls a separate route request per consecutive waypoint pair, assembles the `overview_path` points into an `MVCArray`, and falls back to a straight line if the API fails.
- Trip colors are **auto-assigned** by date using a 3-stop gradient: gray-green (oldest) → dark green (middle) → bright green `#22c55e` (newest). A `color` field in the trip JSON overrides the gradient.
- Waypoints with `isVisible: true` are rendered as circle markers: endpoints are larger (scale 8, dark green), intermediate visible stops are smaller (scale 5, trip color). Waypoints with a `label` or `note` show a `google.maps.InfoWindow` on click.
- Selecting a trip makes its polyline bold (`strokeWeight: 6`); all others fade (`strokeOpacity: 0.25`). Clicking an already-active trip deselects it and restores full opacity for all trips.

### Points of Interest (POI)

- POIs are loaded from `data/pois.json`, independent of trips.
- 6 supported POI types: `fuel`, `hotel`, `cafe`, `mechanic`, `water`, `viewpoint` — each with a dedicated SVG icon in `assets/icons/`.
- Each POI marker opens an `InfoWindow` on click showing title, description, and a deep-link to Google Maps.
- `openPoi(index)` pans the map to the POI, sets zoom to 15, and programmatically opens its InfoWindow.

### Sidebar UI

- Semi-transparent dark sidebar with backdrop blur, 260px wide, hidden on load and revealed after data is ready.
- Two **accordion sections**: "My Rides" (open by default) and "My POI".
- Accordion toggle: clicking an open section closes it; clicking a closed section opens it and closes all others.
- Trip list items show the trip title and formatted date. The active trip gets a green left border.
- POI list items show an emoji icon, title, and truncated description. The active POI is highlighted similarly.
- Clicking a trip or POI fires a `CustomEvent` that bubbles to `App`.

### URL State / Deep Linking

- `?trip=<id>` — selecting a trip updates the URL; the bookmarked URL restores the selected trip on load.
- `?poi=<index>` — same for POIs (zero-based index).
- Browser back/forward (`popstate`) is fully handled: map and sidebar both update to match the navigated state.
- Trip and POI params are mutually exclusive (setting one clears the other).

### Responsive Design

- On screens ≤ 600px the sidebar becomes a **bottom sheet** (full width, max-height 320px, anchored to bottom).
- Trip list switches to a horizontal scroll row of cards.
- POI list switches to a horizontal scroll row; group titles and descriptions are hidden (only icon + title visible).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                            Browser                               │
│                                                                  │
│  index.html                                                      │
│     └── <app-sidebar>  ◄── WebComponent (UI layer)              │
│     └── <div id="map"> ◄── Map container                        │
│                                                                  │
│  main.js  (App — thin orchestrator)                             │
│     ├── MapController     ◄── extends EventEmitter              │
│     │    ├── MapLoader        (loads API + theme.json)          │
│     │    ├── TripRepository   (fetches trip JSON files)         │
│     │    ├── PoiRepository    (fetches pois.json)               │
│     │    ├── TripRenderer     (draws polylines + markers)       │
│     │    └── PoiRenderer      (draws POI markers)               │
│     ├── AppSidebarComponent  ◄── <app-sidebar> WebComponent     │
│     │    ├── TripListComponent  ◄── <trip-list> WebComponent    │
│     │    └── PoiListComponent   ◄── <poi-list> WebComponent     │
│     └── UrlStateManager    ◄── reads/writes ?trip= / ?poi=      │
│                                                                  │
│  data/                                                           │
│     ├── trips/index.json   (manifest)                           │
│     ├── trips/trip_*.json  (individual trips)                   │
│     └── pois.json          (Points of Interest)                 │
└──────────────────────────────────────────────────────────────────┘
```

**Key design choices:**

- `data/trips/index.json` is a manifest — it lists all trip files. No trip filenames are hardcoded in JavaScript.
- `MapController` accepts `TripRepository` and `PoiRepository` as constructor arguments (dependency injection with sensible defaults), making them swappable without modifying the controller.
- WebComponents communicate upward via `CustomEvent` with `bubbles: true, composed: true`. `MapController` communicates outward via its `EventEmitter` base. No shared global state.

---

## Directory Structure

```
moto-map/
├── index.html                      # Minimal HTML shell (17 lines)
├── main.js                         # App entry point / orchestrator
├── style.css                       # Global CSS: sidebar, accordion, responsive
├── theme.json                      # Google Maps custom style (grayscale + blue water)
├── README.md
├── ROADMAP.MD
├── assets/
│   └── icons/                      # SVG marker icons (cafe, fuel, hotel, mechanic, viewpoint, water)
├── data/
│   ├── pois.json                   # Points of Interest
│   └── trips/
│       ├── index.json              # Trip manifest
│       ├── trip_22-02-26.json      # "Ride to Zagorje"
│       └── trip_18-03-26.json      # "Ride to Čiče lake"
└── src/
    ├── components/
    │   ├── AppSidebarComponent.js  # <app-sidebar> WebComponent
    │   ├── TripListComponent.js    # <trip-list> WebComponent
    │   └── PoiListComponent.js     # <poi-list> WebComponent
    ├── core/
    │   ├── EventEmitter.js         # Reusable pub/sub base class
    │   ├── ColorUtils.js           # Trip color gradient utilities
    │   └── GeoUtils.js             # Haversine distance math (prepared, not yet wired)
    ├── data/
    │   ├── TripRepository.js       # Fetches trips from JSON files
    │   └── PoiRepository.js        # Fetches POIs from pois.json
    ├── map/
    │   ├── MapController.js        # Central map orchestrator (extends EventEmitter)
    │   ├── MapLoader.js            # Loads Google Maps API script + theme.json
    │   ├── TripRenderer.js         # Draws trip polylines + waypoint markers
    │   └── PoiRenderer.js          # Draws POI markers with InfoWindows
    └── state/
        └── UrlStateManager.js      # Manages ?trip= and ?poi= URL params
```

---

## Code Guide — OOP, SOLID & Web Components

This section explains the architectural principles applied throughout the codebase and shows where to find concrete examples.

### Object-Oriented Programming

Every meaningful unit of logic is a class with a clear single responsibility. Private fields use the native ES2022 `#` syntax to enforce encapsulation. Public APIs are minimal and explicit.

```
src/core/EventEmitter.js        — reusable base class; subclassed by MapController
src/map/MapController.js        — extends EventEmitter, owns map state
src/data/TripRepository.js      — encapsulates all trip fetch() calls
src/state/UrlStateManager.js    — encapsulates all URL read/write
src/components/*.js             — each WebComponent is a class extending HTMLElement
```

**`App` in `main.js`** is the thin top-level orchestrator — it only wires collaborators together and reacts to events. It contains no rendering or data-fetching logic:

```js
class App {
  #map;       // MapController
  #sidebar;   // AppSidebarComponent
  #urlState;  // UrlStateManager

  async start() {
    await this.#map.init();
    this.#map.on('load', () => this.#onMapLoaded());
    this.#urlState.onNavigate(state => this.#onNavigate(state));
    this.#sidebar.addEventListener('trip-select', e => this.#onTripSelect(e));
    this.#sidebar.addEventListener('poi-select',  e => this.#onPoiSelect(e));
  }
}
```

---

### SOLID Principles

Every class file carries a `SOLID notes:` JSDoc comment. The principles are applied as follows:

#### S — Single Responsibility Principle

Each class does exactly one thing:

| Class | Responsibility |
|---|---|
| `MapLoader` | Loads the Google Maps `<script>` tag and fetches `theme.json` |
| `TripRepository` | Fetches the trip manifest and individual trip JSON files |
| `TripRenderer` | Draws one trip's polyline and waypoint markers on the map |
| `PoiRenderer` | Draws all POI markers with InfoWindows |
| `UrlStateManager` | Reads and writes `?trip=` / `?poi=` URL parameters |
| `EventEmitter` | Pub/sub event subscription and dispatch only |

#### O — Open/Closed Principle

Classes are open for extension, closed for modification.

- **`PoiRenderer`**: add a new POI type by extending the `POI_ICON_MAP` constant — no changes to the class body.
- **`ColorUtils`**: add or change gradient colors by modifying the `COLOR_STOPS` array.
- **`AppSidebarComponent`**: add a new accordion section by extending the `SECTIONS` config.

#### L — Liskov Substitution Principle

- All three WebComponents (`AppSidebarComponent`, `TripListComponent`, `PoiListComponent`) extend `HTMLElement` and fully honour its contract — they can be used anywhere a standard element is expected.
- `MapController` extends `EventEmitter` without narrowing its interface.

#### I — Interface Segregation Principle

Each WebComponent exposes only the methods its consumers actually need:

- `TripListComponent` — `setTrips(trips)`, `setActive(id)`
- `PoiListComponent` — `setPoiList(pois)`, `setActive(index)`
- `AppSidebarComponent` — `show()`, `openSection(name)`, `.tripList`, `.poiList`

#### D — Dependency Inversion Principle

`MapController` accepts its data sources as constructor arguments — concrete implementations are injected, not hard-coded:

```js
export class MapController extends EventEmitter {
  constructor(
    apiKey,
    container,
    tripRepo = new TripRepository(),   // injectable
    poiRepo  = new PoiRepository(),    // injectable
  ) { ... }
}
```

Swapping to a mock or alternative repository requires no changes to `MapController` itself.

---

### Web Components

The entire UI layer is built with the native **Custom Elements API** (no Shadow DOM — styles come from global `style.css`). Three custom elements are registered:

| Tag | Class | File |
|---|---|---|
| `<app-sidebar>` | `AppSidebarComponent` | `src/components/AppSidebarComponent.js` |
| `<trip-list>` | `TripListComponent` | `src/components/TripListComponent.js` |
| `<poi-list>` | `PoiListComponent` | `src/components/PoiListComponent.js` |

**Lifecycle**: all three use `connectedCallback()` as their single lifecycle hook — DOM building and event binding happen there.

**Upward communication**: components dispatch `CustomEvent`s with `bubbles: true, composed: true` so the root `App` can listen on the sidebar element without needing direct references to the child components.

```js
// Inside TripListComponent — fires when the user clicks a trip card
this.dispatchEvent(new CustomEvent('trip-select', {
  detail: { id: trip.id },
  bubbles: true,
  composed: true,
}));

// Inside App — listens at the sidebar boundary
this.#sidebar.addEventListener('trip-select', e => this.#onTripSelect(e));
```

**Registration**: each component file calls `customElements.define()` at module scope. They are imported in `main.js` before the DOM parser encounters their tags:

```js
import './src/components/TripListComponent.js';
import './src/components/PoiListComponent.js';
import './src/components/AppSidebarComponent.js';
```

---

### EventEmitter Base Class

`src/core/EventEmitter.js` is a minimal typed pub/sub class. `MapController` extends it to emit a `'load'` event once all data is rendered:

```js
export class EventEmitter {
  #listeners = new Map();

  on(event, handler)   { ... }  // subscribe; returns unsubscribe fn
  once(event, handler) { ... }  // subscribe once; auto-removes after first call
  off(event, handler)  { ... }  // unsubscribe
  emit(event, payload) { ... }  // dispatch to all handlers
}
```

---

### Repository Pattern

`TripRepository` and `PoiRepository` encapsulate all `fetch()` calls. They expose a single `fetchAll()` method. Data consumers never call `fetch()` directly.

```js
export class TripRepository {
  async fetchAll() {
    const manifest = await this.#fetchManifest();          // data/trips/index.json
    const trips    = await Promise.all(
      manifest.trips.map(path => this.#fetchTrip(path)),   // parallel fetch
    );
    return trips.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
}
```

---

## Data Format

### Trip JSON

```json
{
  "id": "trip_22-02-26",
  "title": "Ride to Zagorje",
  "date": "2026-02-22",
  "waypoints": [
    { "lat": 45.8150, "lng": 15.9819, "label": "Start — Zagreb" },
    { "lat": 45.9800, "lng": 15.8700, "label": "Zagorje", "isVisible": true },
    { "lat": 45.8150, "lng": 15.9819, "label": "End — Zagreb" }
  ]
}
```

### Full field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique identifier, matches filename |
| `title` | string | yes | Human-readable trip name |
| `date` | string (ISO 8601) | yes | Trip start date |
| `waypoints` | array | yes | Named stops: start, intermediate points, end |
| `waypoints[].lat` | number | yes | Latitude (WGS 84) |
| `waypoints[].lng` | number | yes | Longitude (WGS 84) |
| `waypoints[].label` | string | no | Point label shown in InfoWindow |
| `waypoints[].note` | string | no | Additional InfoWindow text |
| `waypoints[].isVisible` | boolean | no | Render a circle marker for this waypoint |
| `description` | string | no | Free-text trip description |
| `distance_km` | number | no | Total distance in kilometres |
| `duration_hours` | number | no | Total riding time |
| `tags` | string[] | no | Searchable tags |
| `color` | string (CSS color) | no | Route line color (overrides auto-gradient) |

### POI JSON (`data/pois.json`)

```json
[
  {
    "title": "Viewpoint Medvednica",
    "type": "viewpoint",
    "lat": 45.9123,
    "lng": 15.9700,
    "description": "Great view over Zagreb.",
    "address": "Medvednica, Zagreb"
  }
]
```

Supported `type` values: `cafe`, `fuel`, `hotel`, `mechanic`, `water`, `viewpoint`.

### Trip manifest (`data/trips/index.json`)

```json
{
  "trips": [
    "trips/trip_22-02-26.json",
    "trips/trip_15-03-26.json"
  ]
}
```

---

## Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Markup | HTML5 | 17-line shell; `<app-sidebar>` custom element in body |
| Styles | Vanilla CSS with custom properties | No preprocessor; no framework |
| Logic | Vanilla ES2022 Modules | Private class fields (`#`); no bundler |
| Mapping | Google Maps JavaScript API + Directions library | Loaded dynamically at runtime |
| Map style | Google Maps TERRAIN + custom JSON style | `theme.json` passed as `styles` option |
| Routing | Google Maps `DirectionsService` | DRIVING mode, per-segment |
| Hosting | GitHub Pages / Netlify / Vercel | Zero-config static deployment |
| Build tools | None | Zero dependencies, no `package.json` |

---

## Development Workflow

### Prerequisites

A modern browser and a local static file server:

```bash
# Python (no install required)
python3 -m http.server 8080

# Node.js
npx serve .
```

Open `http://localhost:8080` in the browser.

### Adding a new trip

1. Create `data/trips/trip_DD-MM-YY.json` following the data format above.
2. Add `waypoints` with the named stops (start, intermediate, end).
3. Add the relative path to `data/trips/index.json`.
4. Refresh the browser — the trip appears and the color gradient updates automatically.

The Directions API will resolve the road-following route from the waypoints. No dense coordinate array is needed.

### Google Maps API key

The key is hardcoded in `main.js` (line 24). For a public deployment, restrict it to your domain via **HTTP referrer restrictions** in the Google Cloud Console to prevent unauthorized use.

---

## Static Hosting

### GitHub Pages

1. Push code to the `main` branch.
2. In repository **Settings → Pages**, set source to `main` branch, `/ (root)`.
3. Site is live at `https://<username>.github.io/moto-map/`.

### Netlify / Vercel

Connect the repository and set the **publish directory** to `/` (no build command needed). Both platforms support custom domains and automatic HTTPS.

---

## Future Enhancements

Planned features in rough priority order:

1. **Trip statistics panel** — total distance (via `GeoUtils.haversineKm`, already implemented), elevation gain, average speed.
2. **Photo gallery per trip** — lightbox of trip photos linked from the JSON.
3. **Elevation profile chart** — SVG/Canvas chart rendered alongside the map.
4. **GPX / KML import** — parse GPX files from a GPS device and auto-generate trip JSON.
5. **Trip search & filtering** — filter by tag, date range, or distance.
6. **Animated route drawing** — draw the route progressively for a storytelling effect.
7. **Offline support** — service worker to cache map tiles and trip data.
8. **Vite bundler** — add a build step for asset hashing and `.env`-based API key management.
9. **Multi-language support** — i18n for trip descriptions.

---

## Contributing

This is a personal project. To fork it for your own trips, replace everything in `data/` with your own JSON files and update the map center in `src/map/MapController.js`. See [Data Format](#data-format) for the full schema.

---

*Last updated: March 2026*
