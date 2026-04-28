# Moto Map — Knowledge Base

> A fully static motorcycle trip tracker and route planner built with Vanilla JS ES2022 modules and the Google Maps JavaScript API.
> No build pipeline, no framework, no backend — all code runs in the browser from static files.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Core Design Principles](#core-design-principles)
4. [Data Layer](#data-layer)
5. [Map Layer](#map-layer)
6. [UI Layer — Web Components](#ui-layer--web-components)
7. [State Management](#state-management)
8. [Event Flow](#event-flow)
9. [Google Maps API Usage](#google-maps-api-usage)
10. [Trip Color System](#trip-color-system)
11. [Route Planner](#route-planner)
12. [Nearby Places & Fuel Stations](#nearby-places--fuel-stations)
13. [Settings System](#settings-system)
14. [Versioning System](#versioning-system)
15. [Data Formats](#data-formats)
16. [Known Limitations & Caveats](#known-limitations--caveats)

---

## Architecture Overview

```
Browser
│
├── index.html               — 17-line shell; mounts <app-sidebar> and #map div
│
├── main.js (App)            — thin orchestrator; wires all collaborators
│    ├── MapController       — central map hub (extends EventEmitter)
│    │    ├── MapLoader      — loads Google Maps API + theme.json
│    │    ├── TripRepository — fetches trip JSON files
│    │    ├── PoiRepository  — fetches pois.json
│    │    ├── TripRenderer   — draws road-following trip polylines + markers
│    │    ├── PoiRenderer    — draws POI markers with InfoWindows
│    │    ├── RouteRenderer  — draws planned route with alternatives
│    │    ├── FuelStationRenderer  — finds/draws fuel stations along route
│    │    └── NearbyPlacesRenderer — finds/draws tourist places along route
│    ├── AppSidebarComponent — <app-sidebar> WebComponent (sidebar shell)
│    │    ├── TripListComponent    — <trip-list>
│    │    ├── PoiListComponent     — <poi-list>
│    │    ├── RoutePlannerComponent — <route-planner>
│    │    ├── AppSettingsComponent  — <app-settings>
│    │    └── NearbyPlacesPanel    — nearby places list
│    └── UrlStateManager     — reads/writes ?trip= / ?poi= URL params
│
├── data/
│    ├── trips/index.json    — trip manifest (list of file paths)
│    ├── trips/trip_*.json   — individual trip files
│    └── pois.json           — Points of Interest
│
└── assets/icons/            — SVG marker icons
```

**Key invariants:**
- No shared global state. All communication is via `CustomEvent` (components → App) or `EventEmitter` (MapController → App).
- `App` in `main.js` is the only place collaborators are wired together.
- `data/trips/index.json` is a manifest — trip filenames are never hardcoded in JS.
- All renderers share a single `#openInfoWindow = { current: null }` reference held by `MapController` so only one InfoWindow can be open at a time.

---

## File Structure

```
moto-map/
├── index.html
├── main.js                          # App entry point / orchestrator
├── style.css                        # Global CSS: sidebar, accordion, responsive
├── theme.json                       # Google Maps light style (grayscale + blue water)
├── dark-theme.json                  # Google Maps dark style
├── sw.js                            # Service Worker for offline/caching
├── README.md
├── ROADMAP.md
├── KNOWLEDGE.md
├── AGENTS.md
├── assets/
│   └── icons/                       # SVG icons: cafe, fuel, hotel, mechanic, viewpoint, water, castle
├── data/
│   ├── pois.json
│   └── trips/
│       ├── index.json               # Trip manifest
│       └── trip_*.json              # Individual trips
└── src/
    ├── components/
    │   ├── AppSidebarComponent.js   # <app-sidebar> — sidebar shell with accordion
    │   ├── TripListComponent.js     # <trip-list>
    │   ├── PoiListComponent.js      # <poi-list>
    │   ├── RoutePlannerComponent.js # <route-planner> — waypoint input + alternatives
    │   ├── AppSettingsComponent.js  # <app-settings> — map display toggles + version label
    │   ├── NearbyPlacesPanel.js     # nearby places list + category chips
    │   └── TripStatsPanel.js        # trip distance/duration statistics
    ├── core/
    │   ├── EventEmitter.js          # Minimal pub/sub base class
    │   ├── ColorUtils.js            # Trip color gradient (gray-green → bright green by date)
    │   └── GeoUtils.js              # Haversine distance (prepared, not wired to UI yet)
    ├── data/
    │   ├── TripRepository.js        # Fetches trip manifest + individual trip files
    │   └── PoiRepository.js         # Fetches pois.json
    ├── map/
    │   ├── MapController.js         # Central map orchestrator (extends EventEmitter)
    │   ├── MapLoader.js             # Loads Google Maps API script + theme.json
    │   ├── TripRenderer.js          # Draws trip polylines + waypoint markers
    │   ├── PoiRenderer.js           # Draws POI markers with InfoWindows
    │   ├── RouteRenderer.js         # Draws planned route + alternatives
    │   ├── FuelStationRenderer.js   # Finds/draws fuel stations along route
    │   └── NearbyPlacesRenderer.js  # Finds/draws tourist places along route
    ├── state/
    │   └── UrlStateManager.js       # Manages ?trip= and ?poi= URL params
    └── version.js                   # APP_VERSION_DATE — updated by agent after each task
```

---

## Core Design Principles

### OOP with ES2022 Private Fields

All classes use native `#` private fields (no underscore convention). Public APIs are minimal and explicit.

```js
class MapController extends EventEmitter {
  #map = null;        // private, inaccessible from outside
  get map() { return this.#map; }   // explicit public accessor
}
```

### SOLID

Every class file carries a `SOLID notes:` JSDoc block. Applied principles:

| Principle | Implementation |
|---|---|
| SRP | Each class does one thing: `MapLoader` only loads the API, `TripRenderer` only draws trips, `UrlStateManager` only manages URL |
| OCP | `PoiRenderer`: add a POI type by extending `POI_ICON_MAP`. `NearbyPlacesRenderer`: extend `PLACE_CATEGORIES`. No class body changes needed |
| LSP | All WebComponents extend `HTMLElement` and honor its contract. `MapController` extends `EventEmitter` without narrowing the interface |
| ISP | Each WebComponent exposes only what its consumers need: e.g. `TripListComponent` → `setTrips()`, `setActive()` |
| DIP | `MapController` accepts `TripRepository` and `PoiRepository` as constructor arguments with sensible defaults — concrete implementations are injected |

### Web Components (no Shadow DOM)

All UI is built with the native **Custom Elements API**. Shadow DOM is **not** used — styles come from global `style.css`. This makes styling straightforward but means component styles are not encapsulated.

Three communication directions:
1. **Downward** (App → Component): direct method calls (`setTrips()`, `setActive()`, `show()`)
2. **Upward** (Component → App): `CustomEvent` with `bubbles: true, composed: true`
3. **Map → App**: `EventEmitter` `emit()` / `on()` pattern

---

## Data Layer

### TripRepository (`src/data/TripRepository.js`)

1. Fetches `data/trips/index.json` (the manifest).
2. Parallel-fetches all individual trip JSON files.
3. Returns trips sorted ascending by date.

The manifest contains only relative paths — filenames are never hardcoded in JS.

### PoiRepository (`src/data/PoiRepository.js`)

Fetches `data/pois.json` and returns the array directly.

### ColorUtils (`src/core/ColorUtils.js`)

`assignTripColors(trips)` — assigns a `_color` to each trip based on its date position within the full date range.

3-stop gradient: gray-green (`#6b7280`) → dark green (`#166534`) → bright green (`#22c55e`). The newest trip always gets the brightest color. A `color` field in the trip JSON overrides the gradient entirely.

---

## Map Layer

### MapLoader (`src/map/MapLoader.js`)

Dynamically injects the Google Maps `<script>` tag and fetches `theme.json` in parallel.
Returns the parsed `styles` array for use in the Map constructor.

### MapController (`src/map/MapController.js`)

Central orchestrator. Key responsibilities:
- Initialises the `google.maps.Map` instance (TERRAIN type, custom styles, Zagreb center)
- Loads data via repositories (parallel with `Promise.all`)
- Creates and holds all renderer instances
- Manages trip highlight / deselect state
- Exposes public API for `App` to call: `selectTrip()`, `openPoi()`, `geocode()`, `renderPlannedRoute()`, etc.
- Emits `'load'` after all data is rendered

**Shared InfoWindow pattern:**
```js
// All renderers receive this reference in their constructor:
#openInfoWindow = { current: null }
// Before opening any new InfoWindow:
this.#openInfoWindow.current?.close();
// After opening:
this.#openInfoWindow.current = newInfoWindow;
```
This guarantees only one InfoWindow is ever open at once, regardless of which renderer created it.

**Pending handler pattern:** Handlers for route double-click, marker drag, and alt polyline click are stored as `#pendingXxxHandler` if `MapController.init()` has not finished yet. Once renderers are created, the pending handlers are applied retroactively.

### TripRenderer (`src/map/TripRenderer.js`)

Draws a single trip as **two stacked polylines** sharing one `MVCArray` path:
1. **Base polyline** — solid colored line (`strokeColor: trip._color`)
2. **Arrow overlay polyline** — transparent stroke carrying white `FORWARD_CLOSED_ARROW` symbols

This two-layer approach ensures direction arrows are always white and readable regardless of the trip color.

Route-following is done via Google Maps `DirectionsService` (DRIVING mode) per consecutive waypoint pair. Falls back to straight-line segment on API failure.

Trip JSON may include `avoidHighways`, `avoidTolls`, `avoidFerries` booleans — passed through to `DirectionsService`.

### PoiRenderer (`src/map/PoiRenderer.js`)

Renders all POIs from `data/pois.json` using custom SVG icons from `assets/icons/`. Each marker opens an InfoWindow with title, description, and a deep-link to Google Maps.

Supported POI types: `cafe`, `fuel`, `hotel`, `mechanic`, `water`, `viewpoint`.

---

## UI Layer — Web Components

### Registration order (main.js)

All components must be imported before the DOM parser encounters their tags:
```js
import './src/components/TripListComponent.js';
import './src/components/PoiListComponent.js';
import './src/components/AppSidebarComponent.js';
import './src/components/RoutePlannerComponent.js';
import './src/components/AppSettingsComponent.js';
import './src/components/NearbyPlacesPanel.js';
```

### Component Summary

| Tag | Class | Responsibility |
|---|---|---|
| `<app-sidebar>` | `AppSidebarComponent` | Sidebar shell with accordion sections |
| `<trip-list>` | `TripListComponent` | List of recorded trips; fires `trip-select`; "Open in Google Maps" button per trip |
| `<poi-list>` | `PoiListComponent` | List of POIs; fires `poi-select` |
| `<route-planner>` | `RoutePlannerComponent` | Waypoint inputs, avoid options, route summary cards |
| `<app-settings>` | `AppSettingsComponent` | Toggles: route arrows, POI visibility, terrain, dark mode |
| (no tag) | `NearbyPlacesPanel` | Category chips + nearby places list |
| (no tag) | `TripStatsPanel` | Distance/duration stats for selected trip |

### Accordion sections in AppSidebarComponent

| Section key | Label | Default state |
|---|---|---|
| `rides` | My Rides | open |
| `poi` | My POI | closed |
| `planner` | Plan Route | closed |
| `nearby` | Nearby Places | closed |
| `settings` | Settings | closed |

Clicking an open section closes it. Clicking a closed section opens it and closes all others.
`openSection(name)` can be called programmatically from `App`.

---

## State Management

There is no Vuex/Redux/MobX state store. State is distributed:

| State | Lives in | How updated |
|---|---|---|
| Active trip ID | `MapController.#activeId` | `selectTrip(id)` |
| POI list highlight | `PoiListComponent` | `setActive(index)` |
| Trip list highlight | `TripListComponent` | `setActive(id)` |
| URL `?trip=` / `?poi=` | Browser URL | `UrlStateManager.pushTrip()` / `pushPoi()` |
| Settings (persist) | `localStorage` (via AppSettingsComponent) | `setting-change` event |
| Last route summaries | `App.#lastRouteSummaries` | After each `renderPlannedRoute()` |
| Last route path | `App.#lastRoutePath` | After each `renderPlannedRoute()` |

---

## Event Flow

### User clicks a trip in the sidebar

```
TripListComponent
  → CustomEvent 'trip-select' { id }
    → App.#onTripSelect()
      → UrlStateManager.pushTrip(id)
      → MapController.selectTrip(id)
      → TripListComponent.setActive(id)
```

### User plans a route

```
RoutePlannerComponent
  → 'route-geocode' { id, address }    — App geocodes, resolveWaypoint()
  → 'route-plan' { waypoints, ... }    — App calls MapController.renderPlannedRoute()
                                          → RouteRenderer.render()
                                          → MapController.showFuelStations()
                                          → App.#refreshNearbyPlaces()
```

### User drags a route stop marker

```
RouteRenderer  (dragend listener)
  → #onMarkerDragEnd(index, lat, lng)
    → App.#map.setMarkerDragHandler callback
      → RoutePlannerComponent.updateWaypointPosition()
      → App.#recalculateRoute()
```

### Browser back/forward

```
UrlStateManager  (popstate listener)
  → onNavigate callback
    → App.#onNavigate({ tripId, poiIndex })
      → MapController.selectTrip() or openPoi()
      → Sidebar.setActive() on appropriate component
```

---

## Google Maps API Usage

| API / Library | Where used | Purpose |
|---|---|---|
| `google.maps.Map` | `MapController.init()` | Map instance |
| `MapTypeId.TERRAIN` | `MapController.init()` | Default map type |
| `DirectionsService` | `TripRenderer`, `RouteRenderer` | Road-following routes |
| `TravelMode.TWO_WHEELER` | `RouteRenderer.#routeSegment()` | Motorcycle-aware routing |
| `TravelMode.DRIVING` | `TripRenderer` | Trip replay routing |
| `Geocoder` | `MapController.geocode()` | Address → lat/lng |
| `Polyline` + `MVCArray` | `TripRenderer`, `RouteRenderer` | Route lines; shared path array |
| `SymbolPath.FORWARD_CLOSED_ARROW` | `TripRenderer` | Directional arrows on trips |
| `Marker` + `InfoWindow` | All renderers | POI and waypoint markers |
| `LatLngBounds` + `fitBounds()` | `MapController` | Auto-zoom to trip or all trips |
| `PlacesService` (legacy) | `NearbyPlacesRenderer`, `FuelStationRenderer` | Nearby place search |

**API key location:** `main.js` line 28 (`GOOGLE_MAPS_API_KEY`). For public deployment, restrict via HTTP referrer restrictions in Google Cloud Console.

**Important — `TravelMode.TWO_WHEELER`:** The route planner uses `TWO_WHEELER` mode. This is a Google Maps premium feature and may fall back to `DRIVING` in regions where it is unavailable. The trip renderer uses `DRIVING` (more universally supported for historical replay).

**DirectionsService alternatives:** For single-leg routes (A→B only), `provideRouteAlternatives: true` is passed. Google returns up to 3 alternatives. Multi-leg routes do not support alternatives — only the primary route is returned per segment.

---

## Trip Color System

`ColorUtils.assignTripColors(trips)` adds a `_color` property to each trip object.

- Trips are expected sorted by date ascending before this function is called.
- Gradient has 3 stops: `#6b7280` (oldest) → `#166534` (middle) → `#22c55e` (newest).
- Position in the gradient is determined by date, not by array index.
- A trip with a `color` field in its JSON skips the gradient and uses that color directly.
- The `_color` property is not persisted — it is recomputed on every load.

---

## Route Planner

`RouteRenderer` (`src/map/RouteRenderer.js`) handles all planned-route drawing.

### Route colors

```js
static ROUTE_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];
// Index 0 = active/primary (blue), 1 = first alt (amber), 2 = second alt (teal)
```

### Two rendering strategies

| Strategy | When | Behaviour |
|---|---|---|
| Single-leg | exactly 2 waypoints | Requests up to 3 alternatives; draws all simultaneously |
| Multi-leg | 3+ waypoints | One `DirectionsService` call per segment pair; no alternatives |

### Interactive features

- **Double-click** on the active polyline → inserts a new stop at that position → recalculates.
- **Dragging** a numbered stop marker → updates the waypoint position → recalculates.
- **Clicking** an alternative polyline on the map → selects it as active (same as sidebar card click).
- **Hovering** an alternative polyline → brightens it temporarily.

### Avoid options

`avoidHighways`, `avoidTolls`, `avoidFerries` booleans are stored on `RouteRenderer` and passed to every `DirectionsService` call. They are also persisted in saved trip JSON.

### Save to JSON

`App.#onRouteSave()` builds a trip JSON object from the resolved waypoints and triggers a browser download. Filename format: `trip_DD-MM-YY.json`. The saved file includes `roadDistanceKm` (from the Directions API) so "My Rides" can show the accurate distance without recalling the API.

### Export to Google Maps

`App.#onRouteExportGMaps()` constructs a Google Maps Directions URL and opens it in a new tab (`travelmode=driving`, up to 8 intermediate waypoints).

---

## Nearby Places & Fuel Stations

### NearbyPlacesRenderer (`src/map/NearbyPlacesRenderer.js`)

Searches at sample points along the route using `google.maps.places.PlacesService` (legacy API).

| Constant | Value | Meaning |
|---|---|---|
| `SEARCH_RADIUS_M` | 3 000 m | Search radius around each sample point |
| `SAMPLE_INTERVAL_M` | 15 000 m | One sample point every ~15 km of route |

**Place categories:**

| ID | Places API type | Label |
|---|---|---|
| `viewpoint` | `point_of_interest` + keyword | Viewpoints |
| `tourist_attraction` | `tourist_attraction` | Attractions |
| `cafe` | `cafe` | Cafes |
| `restaurant` | `restaurant` | Restaurants |
| `hotel` | `lodging` | Hotels |
| `museum` | `museum` | Museums |
| `natural_feature` | `natural_feature` | Nature |

Results are deduplicated by `place_id`. Markers carry category color badges. Each InfoWindow has an "Add to Route" button that inserts the place as a waypoint in the planner.

### FuelStationRenderer (`src/map/FuelStationRenderer.js`)

Same `PlacesService` approach, specifically for `gas_station` type. Automatically triggered after every route calculation.

### Category visibility toggle

`NearbyPlacesPanel` emits `nearby-category-toggle { categoryId, enabled }`. App calls `MapController.setNearbyPlaceCategoryVisibility()` to show/hide markers on the map immediately, and re-fetches only when enabling (to load results not yet fetched).

---

## Settings System

`AppSettingsComponent` persists its values to `localStorage`. On map load, `App` reads the current values and applies them:

| Setting key | Default | Effect |
|---|---|---|
| `showRouteDirections` | `true` | Shows/hides direction arrows on trip polylines |
| `showPoi` | `true` | Shows/hides all POI markers |
| `showTerrain` | `true` | Switches between TERRAIN and ROADMAP map type |
| `darkMap` | `false` | Loads `dark-theme.json` or `theme.json` map styles |

Settings changes propagate via `setting-change { key, value }` event → `App.#onSettingChange()` → corresponding `MapController` method.

**Dark mode:** Implemented by fetching a different `theme.json` and calling `map.setOptions({ styles })`. The two theme files live at the project root.

**Version label:** The bottom of the settings panel displays an "Updated: YYYY-MM-DD" label sourced from `src/version.js` (`APP_VERSION_DATE`). This date must be updated by the agent after every task — see AGENTS.md.

---

## Versioning System

The app uses a simple date-based versioning scheme:

- **File:** `src/version.js`
- **Export:** `APP_VERSION_DATE` — an ISO 8601 date string (`YYYY-MM-DD`)
- **Display:** imported by `AppSettingsComponent` and rendered as `"Updated: YYYY-MM-DD"` in the Settings panel footer
- **Update rule:** every agent task that modifies application code or data must set `APP_VERSION_DATE` to today's date

```js
// src/version.js
export const APP_VERSION_DATE = '2026-04-28';
```

No build step or semver is needed — the date alone is sufficient for a personal static project.

---

## Data Formats

### Trip JSON (`data/trips/trip_*.json`)

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

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must match filename (without `.json`) |
| `title` | string | yes | Displayed in sidebar |
| `date` | string (ISO 8601) | yes | Used for color gradient ordering |
| `waypoints` | array | yes | Ordered stops |
| `waypoints[].lat` | number | yes | WGS 84 latitude |
| `waypoints[].lng` | number | yes | WGS 84 longitude |
| `waypoints[].label` | string | no | InfoWindow title |
| `waypoints[].note` | string | no | InfoWindow body text |
| `waypoints[].isVisible` | boolean | no | Render a circle marker at this waypoint |
| `color` | string (CSS) | no | Overrides auto-gradient color |
| `description` | string | no | Free-text trip description |
| `distance_km` | number | no | Manual override (visual only) |
| `roadDistanceKm` | number | no | Accurate road distance from Directions API (written by Save Route) |
| `duration_hours` | number | no | Riding time |
| `tags` | string[] | no | Searchable tags (future use) |
| `avoidHighways` | boolean | no | Persisted from route planner |
| `avoidTolls` | boolean | no | Persisted from route planner |
| `avoidFerries` | boolean | no | Persisted from route planner |

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
    "trips/trip_18-03-26.json"
  ]
}
```

Paths are relative to the `data/` directory. Add new trips here — no JS changes needed.

---

## Known Limitations & Caveats

1. **Google Maps API key is hardcoded** in `main.js:28`. For public deployment, restrict it via HTTP referrer in Google Cloud Console. A `.env`-based key with a Vite build is a planned improvement.

2. **`TravelMode.TWO_WHEELER` availability** — not available in all countries. If the Directions API returns an error for a segment, `RouteRenderer` falls back to a straight-line segment. This is logged as a `console.warn`.

3. **No alternatives for multi-stop routes** — Google Directions API only returns alternatives for single-leg (A→B) requests. For 3+ waypoints the route planner always shows a single route.

4. **Legacy `PlacesService`** — `NearbyPlacesRenderer` and `FuelStationRenderer` use the legacy `google.maps.places.PlacesService`. The newer Places API (New) uses different methods. A migration may be needed if Google deprecates the legacy API.

5. **`PlacesService` quota** — each route calculation triggers multiple nearby place searches (one per sample point per category). On long routes this can issue many API requests quickly. There is currently no caching between route recalculations.

6. **No Shadow DOM** — WebComponents do not use Shadow DOM. CSS is global. Adding a new component requires care to avoid unintended style conflicts.

7. **`GeoUtils.haversineKm`** — implemented in `src/core/GeoUtils.js` but not yet wired to the UI (trip stats panel). Distance display in the sidebar currently uses `roadDistanceKm` from saved JSON or the raw `distance_km` field.

8. **Service Worker** — `sw.js` is registered in `main.js`. The caching strategy should be verified and updated when new asset paths are added (e.g. new icon files or theme JSON files).

11. **"Open in Google Maps" per trip** — each trip's expanded details panel contains a link that opens the trip in Google Maps Directions (`https://www.google.com/maps/dir/?api=1&...`). The URL is built in `buildGoogleMapsUrl()` (top of `TripListComponent.js`) using the first waypoint as origin, last as destination, and all intermediate waypoints as pipe-separated `waypoints` param. Clicking the link does **not** trigger trip selection (click propagation is stopped).

9. **No trip editing** — trips are static JSON files. There is no in-app editor. To add/modify a trip, edit the JSON file directly and add it to the manifest.

10. **Map center is hardcoded to Zagreb** (`ZAGREB_CENTER = { lat: 45.8150, lng: 15.9819 }` in `MapController.js`). To fork the project for a different region, change this constant and the default zoom level.
