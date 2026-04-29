# Moto Map — Code Overview

> Quick reference for AI agents. Read this instead of re-analysing the source.
> Update this file whenever you change class APIs, add files, or move logic.

---

## Stack at a glance

- Vanilla ES2022 modules — no bundler, no framework, no build step
- Google Maps JS API (dynamic script) with `directions` + `places` libraries
- Native Custom Elements (no Shadow DOM) — global `style.css`
- Static JSON data — no backend
- Service worker (`sw.js`) for offline/caching
- Entry: `index.html` → `main.js` (type="module")

---

## File map

```
index.html                          31 lines — minimal PWA shell
main.js                            643 lines — App class; entry point
style.css                                    — global CSS (sidebar, accordion, responsive)
theme.json                                   — Google Maps light style
dark-theme.json                              — Google Maps dark style
sw.js                                        — Service Worker
src/version.js                      10 lines — APP_VERSION_DATE (UTC ISO string)

src/core/
  EventEmitter.js                   60 lines — pub/sub base class
  ColorUtils.js                     48 lines — trip color palette
  GeoUtils.js                       83 lines — haversine, distance, duration

src/data/
  TripRepository.js                 49 lines — fetches trips manifest + files
  PoiRepository.js                  38 lines — fetches pois.json

src/state/
  UrlStateManager.js                70 lines — ?trip= / ?poi= URL params

src/map/
  MapLoader.js                      70 lines — injects Maps <script>, loads theme
  MapController.js                 565 lines — central orchestrator (extends EventEmitter)
  TripRenderer.js                  193 lines — draws trip polylines + waypoint markers
  PoiRenderer.js                    94 lines — draws POI markers + InfoWindows
  RouteRenderer.js                 581 lines — draws planned route + alternatives
  FuelStationRenderer.js           268 lines — fuel station search + markers
  NearbyPlacesRenderer.js          370 lines — nearby-places search + markers

src/components/
  AppSidebarComponent.js           192 lines — <app-sidebar> — accordion shell
  TripListComponent.js             202 lines — <trip-list>
  PoiListComponent.js              108 lines — <poi-list>
  RoutePlannerComponent.js         727 lines — <route-planner>
  AppSettingsComponent.js          199 lines — <app-settings>
  NearbyPlacesPanel.js             219 lines — <nearby-places>
  TripStatsPanel.js                 89 lines — <trip-stats-panel> (unused / legacy)

data/
  trips/index.json                           — trip manifest (list of file paths)
  trips/trip_*.json                          — individual trip files
  pois.json                                  — Points of Interest

assets/icons/                                — SVG icons for POIs and nearby places
```

---

## Class index

| Class | File | Extends |
|---|---|---|
| `App` | `main.js` | — |
| `EventEmitter` | `src/core/EventEmitter.js` | — |
| `MapController` | `src/map/MapController.js` | `EventEmitter` |
| `MapLoader` | `src/map/MapLoader.js` | — |
| `TripRenderer` | `src/map/TripRenderer.js` | — |
| `PoiRenderer` | `src/map/PoiRenderer.js` | — |
| `RouteRenderer` | `src/map/RouteRenderer.js` | — |
| `FuelStationRenderer` | `src/map/FuelStationRenderer.js` | — |
| `NearbyPlacesRenderer` | `src/map/NearbyPlacesRenderer.js` | — |
| `TripRepository` | `src/data/TripRepository.js` | — |
| `PoiRepository` | `src/data/PoiRepository.js` | — |
| `UrlStateManager` | `src/state/UrlStateManager.js` | — |
| `AppSidebarComponent` | `src/components/AppSidebarComponent.js` | `HTMLElement` |
| `TripListComponent` | `src/components/TripListComponent.js` | `HTMLElement` |
| `PoiListComponent` | `src/components/PoiListComponent.js` | `HTMLElement` |
| `RoutePlannerComponent` | `src/components/RoutePlannerComponent.js` | `HTMLElement` |
| `AppSettingsComponent` | `src/components/AppSettingsComponent.js` | `HTMLElement` |
| `NearbyPlacesPanel` | `src/components/NearbyPlacesPanel.js` | `HTMLElement` |
| `TripStatsPanel` | `src/components/TripStatsPanel.js` | `HTMLElement` |

---

## App (main.js:643)

**Instantiation order in `constructor()`:**
1. `UrlStateManager`
2. `document.querySelector('app-sidebar')` → `#sidebar`
3. `new MapController(GOOGLE_MAPS_API_KEY, '#map')`

**Key private fields:**
```js
#map: MapController
#sidebar: AppSidebarComponent
#urlState: UrlStateManager
#lastRouteSummaries: Array<summary>     // from last renderPlannedRoute()
#lastRoutePath: Array<{lat,lng}>        // active route path for nearby-places refresh
#activeSection: string|null             // 'rides'|'poi'|'planner'|null — default 'rides'
```

**Wiring in `start()`:**
- `#map.on('load', ...)` → `#onMapLoaded()` — populate sidebar, apply URL state + settings
- `#map.on('trip-distance', ...)` → `tripList.updateTripDistance()`
- `#map.on('map-pick', ...)` → `planner.addMapPoint()`
- `#sidebar.addEventListener('trip-select', ...)`
- `#sidebar.addEventListener('poi-select', ...)`
- `#sidebar.addEventListener('section-change', ...)` → `#onSectionChange()`
- `#sidebar.addEventListener('route-*', ...)` — all route planner events
- `#sidebar.addEventListener('setting-change', ...)` → `#onSettingChange()`
- `#sidebar.addEventListener('nearby-*', ...)` — nearby places events
- `#urlState.onNavigate(...)` → `#onNavigate()`

**GOOGLE_MAPS_API_KEY** hardcoded at `main.js:28`.

**Trip JSON download** (`#onRouteSave`): filename format `trip_DD-MM-YY.json`; first/last waypoints get `isVisible: true`.

**Google Maps export** (`#onRouteExportGMaps`): `travelmode=driving` (not `two-wheeler`), max 8 intermediate waypoints.

---

## MapController (src/map/MapController.js:565)

`extends EventEmitter`. Central map hub — owns all renderers and shared state.

**Key private fields:**
```js
#map: google.maps.Map|null
#trips: Object[]
#pois: Object[]
#tripLayers: Map<tripId, { trip, polyline, basePolyline, markers }>
#poiMarkers: google.maps.Marker[]
#activeId: string|null
#openInfoWindow: { current: google.maps.InfoWindow|null }  // shared ref — one InfoWindow at a time
#showRouteDirections: boolean                              // default true
#routeRenderer: RouteRenderer|null
#fuelRenderer: FuelStationRenderer|null
#nearbyPlacesRenderer: NearbyPlacesRenderer|null
#tripRenderer: TripRenderer|null
#geocoder: google.maps.Geocoder|null
#pickingMode: boolean
// Pending handlers (stored before init() completes):
#pendingDblClickHandler
#pendingMarkerDragHandler
#pendingAltPolylineClickHandler
#pendingAddToRouteHandler
#pendingFuelAddToRouteHandler
```

**Public API:**
```js
async init()                                      // load map + data + renderers; emits 'load'
selectTrip(id: string|null)                       // highlight trip, fit viewport
openPoi(index: number)                            // pan + zoom 15 + open InfoWindow
async geocode(address: string) → {lat,lng}|null
setRouteDoubleClickHandler(fn)
setMarkerDragHandler(fn)
setAltPolylineClickHandler(fn)
async renderPlannedRoute(waypoints, avoidOptions?) → Array<summary>
selectAlternativeRoute(index: number)
clearPlannedRoute()
async showFuelStations(routePath) → count: number
clearFuelStations()
async showNearbyPlaces(routePath, enabledCategories?) → NearbyPlace[]
clearNearbyPlaces()
setNearbyPlaceCategoryVisibility(categoryId, visible)
focusNearbyPlace(placeId)
setNearbyPlaceAddToRouteHandler(fn)
setFuelStationAddToRouteHandler(fn)
setRouteDirections(enabled: boolean)
setPoiVisibility(enabled: boolean)
setTripLayersVisibility(enabled: boolean)
setPlannedRouteVisibility(enabled: boolean)       // delegates to 3 renderers
setTerrainEnabled(enabled: boolean)
async setDarkMap(dark: boolean)
enablePickMode()                                  // crosshair cursor; emits 'map-pick' on click
disablePickMode()
```

**Events emitted:**
- `'load'` — all data rendered
- `'trip-distance'` — `{ tripId, km }` — after Directions API resolves a trip
- `'map-pick'` — `{ lat, lng }` — after user clicks in pick mode

**Hardcoded values:**
- `ZAGREB_CENTER = { lat: 45.8150, lng: 15.9819 }` — default map center
- `DEFAULT_ZOOM = 12`
- Trip highlight: selected `strokeWeight:6`; dimmed `strokeOpacity:0.25`
- Arrow overlay: selected fill `0.9`/stroke `0.35`; dimmed fill `0.2`/stroke `0.1`

---

## TripRenderer (src/map/TripRenderer.js:193)

```js
constructor(map, openInfoWindow)
render(trip, onDistanceReady?) → { polyline, markers, _basePolyline }
```

- Two stacked polylines share one `MVCArray` path: base (solid colored) + arrow overlay (transparent + `FORWARD_CLOSED_ARROW` symbols)
- Route via `DirectionsService` (`TravelMode.TWO_WHEELER`) per waypoint pair; straight-line fallback on error
- Sets `trip._roadDistanceKm` on trip object after API responds
- Waypoint markers: endpoints scale 8 fill `#166534`; intermediates scale 5 with trip `_color`; only `isVisible:true` waypoints rendered
- `avoidHighways`, `avoidTolls`, `avoidFerries` passed through from trip JSON

---

## PoiRenderer (src/map/PoiRenderer.js:94)

```js
constructor(map, openInfoWindow)
renderAll(pois: Object[]) → google.maps.Marker[]
```

- `POI_ICON_MAP`: `{ fuel, hotel, cafe, mechanic, water, viewpoint, castle, campsite }` → `assets/icons/*.svg`
- Icon size 32×32, anchor (16,16)
- InfoWindow uses `headerContent` (new Maps API pattern)
- Google Maps link uses `address` if present, else `lat,lng`

---

## RouteRenderer (src/map/RouteRenderer.js:581)

```js
static ROUTE_COLORS = ['#3b82f6', '#f59e0b', '#10b981']  // blue, amber, teal

constructor(map, openInfoWindow)
setDoubleClickHandler(fn)            // fn(lat, lng, segmentIndex)
setMarkerDragHandler(fn)             // fn(index, lat, lng)
setAltPolylineClickHandler(fn)       // fn(index)
async render(waypoints) → Array<summary>
selectAlternative(index: number)
clear()
setVisibility(visible: boolean)
setAvoidOptions({ avoidHighways?, avoidTolls?, avoidFerries? })
```

**summary object:** `{ distanceKm, durationMin, legs, routePath, hasTolls, color }`

- Single-leg (2 waypoints): `provideRouteAlternatives:true`, up to 3 routes
- Multi-leg (3+ waypoints): one segment at a time, no alternatives
- Travel mode: `TWO_WHEELER`
- Alt polylines: opacity 0.45, weight 4; hover → 0.8/weight+1; active → 0.9, weight 5
- Draggable numbered markers; endpoints scale 14 fill `#1d4ed8`; intermediates scale 11 with route color
- Double-click on polyline → `#nearestSegmentIndex` heuristic → inserts new stop

---

## FuelStationRenderer (src/map/FuelStationRenderer.js:268)

```js
constructor(map, openInfoWindow)
setAddToRouteHandler(fn)             // fn({ name, lat, lng })
async render(routePath) → count: number
clear()
setVisibility(visible: boolean)
```

- `SEARCH_RADIUS_M = 500`, `SAMPLE_INTERVAL_M = 10_000` (10 km)
- Type: `gas_station` via legacy `PlacesService`
- Deduplicated by `place_id`; icon `assets/icons/fuel.svg` 32×32; zIndex 150
- "Add to Route" button in InfoWindow wired via `domready`

---

## NearbyPlacesRenderer (src/map/NearbyPlacesRenderer.js:370)

```js
constructor(map, openInfoWindow)
setAddToRouteHandler(fn)
async render(routePath, enabledCategories?) → NearbyPlace[]
clear()
setVisibility(visible: boolean)
setMarkerVisibility(categoryId, visible)
focusPlace(placeId)                  // pan + zoom 15 + open InfoWindow
```

**Exported:** `PLACE_CATEGORIES` (array)

| id | type | color |
|---|---|---|
| viewpoint | point_of_interest (kw:"viewpoint") | #22c55e |
| tourist_places | tourist_attraction (kw:"tourist places") | #a78bfa |
| cafe | cafe | #f59e0b |
| restaurant | restaurant | #fb923c |
| hotel | lodging | #38bdf8 |
| museum | museum | #e879f9 |
| natural_feature | natural_feature | #34d399 |
| parking | parking | #94a3b8 |
| fuel | gas_station | #f97316 |
| campsite | campground | #16a34a |

- `SEARCH_RADIUS_M = 3_000`, `SAMPLE_INTERVAL_M = 15_000` (15 km)
- All `(category × samplePoint)` searches in parallel; deduplicated by `place_id`; sorted by rating desc
- Icon size 28×28; zIndex 140; `marker._placeId`, `marker._categoryId` set on each marker
- Icons starting with `emoji-` are SVG circles with emoji character

**NearbyPlace typedef:** `{ id, name, vicinity, category, lat, lng, rating, isOpen }`

---

## MapLoader (src/map/MapLoader.js:70)

```js
constructor(apiKey, themeUrl = 'theme.json')
async load() → google.maps.MapTypeStyle[]
```

- Loads `<script>` with `libraries=directions,places`; skips if `window.google?.maps` already exists
- Fetches theme JSON in parallel; returns `[]` on error

---

## EventEmitter (src/core/EventEmitter.js:60)

```js
on(event, handler) → () => void        // returns unsubscribe fn
once(event, handler) → () => void
off(event, handler)
emit(event, payload?)
```

---

## ColorUtils (src/core/ColorUtils.js:48)

```js
assignTripColors(trips: Object[])       // mutates trips; adds trip._color
```

- Input must be sorted ascending by date
- Rank 0 = newest (last in array) = `#5FC25E`; rank 6+ = `#D9D9D9`
- `RECENCY_PALETTE`: `['#5FC25E','#7BB37A','#93A492','#A6A6A6','#C2C2C2','#D9D9D9']`
- `trip.color` field overrides palette

---

## GeoUtils (src/core/GeoUtils.js:83)

```js
haversineKm(a, b) → number             // a,b = { lat, lng }
estimateTripDistance(trip) → number    // priority: _roadDistanceKm → roadDistanceKm → haversine
estimateTripDuration(trip, avgSpeedKph = 50) → string   // "1 h 23 min" | "45 min" | "1 h"
```

---

## TripRepository (src/data/TripRepository.js:49)

```js
constructor(basePath = 'data')
async fetchAll() → Object[]            // sorted ascending by date
```

- Fetches `data/trips/index.json` (manifest), then all trip files in parallel
- `display order note`: `TripListComponent` reverses for newest-first display

---

## PoiRepository (src/data/PoiRepository.js:38)

```js
constructor(basePath = 'data')
async fetchAll() → Object[]            // returns [] on any error; reads data.pois array
```

---

## UrlStateManager (src/state/UrlStateManager.js:70)

Stateless — reads from `window.location` on every call.

```js
getTripId() → string|null
getPoiIndex() → number|null
pushTrip(id: string|null)             // sets ?trip=; clears ?poi=
pushPoi(index: number)                // sets ?poi=; clears ?trip=
onNavigate(handler) → () => void      // listens popstate; handler({ tripId, poiIndex })
```

---

## AppSidebarComponent (src/components/AppSidebarComponent.js:192)

Custom element `<app-sidebar>`. No Shadow DOM.

```js
show()
openSection(name: 'rides'|'poi'|'planner')   // closes all others; emits section-change
get tripList()    → TripListComponent
get poiList()     → PoiListComponent
get routePlanner() → RoutePlannerComponent
get settings()    → AppSettingsComponent
get nearbyPlaces() → NearbyPlacesPanel
```

- Accordion state persisted to `localStorage` key `'moto-map:accordion'`; default open `'rides'`
- Always emits `section-change` on page load (initial state restore)
- Clicking open section → collapses (null state); clicking closed section → opens
- `<app-settings>` lives in `sidebar-bottom` (not inside accordion body)
- `<nearby-places>` lives inside the "Plan Route" accordion body

**Emits:** `section-change` — `{ section: string|null }`

---

## TripListComponent (src/components/TripListComponent.js:202)

Custom element `<trip-list>`.

```js
setTrips(trips: Object[])             // stores + re-renders; displays newest-first
setActive(id: string|null)            // toggles .active + .open on items
updateTripDistance(tripId, km)        // patches badge without full re-render
```

**Emits:** `trip-select` — `{ id: string|null }` (null = deselect)

- Date format: `en-GB` locale `{ day:'numeric', month:'short', year:'numeric' }`
- Module-level `buildGoogleMapsUrl(waypoints)` builds Google Maps Directions URL

---

## PoiListComponent (src/components/PoiListComponent.js:108)

Custom element `<poi-list>`.

```js
setPoiList(pois: Object[])
setActive(index: number|null)
```

**Emits:** `poi-select` — `{ index: number }`

- `POI_EMOJI` map includes typo key `'abadoned'` (should be 'abandoned') — do not "fix" without also fixing data

---

## RoutePlannerComponent (src/components/RoutePlannerComponent.js:727)

Custom element `<route-planner>`. Max 10 waypoints.

```js
addMapPoint(lat, lng, label?)         // from map pick or map-pick event
insertMapPoint(lat, lng, index)       // from route double-click
updateWaypointPosition(index, lat, lng)   // from marker drag
resolveWaypoint(id, lat, lng)         // after geocoding
setStatus(msg, isError = false)       // error color #f87171
setRouteSummary(summary)
setRouteSummaries(summaries, waypoints, activeIndex = 0)
selectAltCard(index)                  // syncs UI without emitting event

get resolvedWaypoints                 // filtered: lat/lng not null
get avoidHighways / avoidTolls / avoidFerries
```

**Events dispatched:**
- `route-geocode` — `{ id, address }`
- `route-plan` — `{ waypoints, avoidHighways, avoidTolls, avoidFerries }`
- `route-alternative-select` — `{ index }`
- `route-save` — `{ waypoints, routePath, distanceKm, durationMin, avoidHighways, avoidTolls, avoidFerries }`
- `route-export-gmaps` — `{ waypoints }`
- `route-clear`
- `route-pick-start`, `route-pick-cancel`

**Non-obvious:**
- Drag-and-drop reorders live during `dragover`
- Double-click on label → inline edit (`#editingId`); Enter/blur commits; Escape cancels
- `selectAltCard` vs `#onAltCardClick`: former is silent UI sync (called when map polyline clicked), latter also emits event
- Alternatives panel only rendered when `#allSummaries.length > 1`

---

## AppSettingsComponent (src/components/AppSettingsComponent.js:199)

Custom element `<app-settings>`.

```js
get values()    // { showRouteDirections, showPoi, showTerrain, darkMap }
```

**Emits:** `setting-change` — `{ key: string, value: boolean }`

- Persisted to `localStorage` key `'moto-map:settings'`
- Defaults: `{ showRouteDirections:true, showPoi:true, showTerrain:true, darkMap:false }`
- `#formatVersion()` converts `APP_VERSION_DATE` UTC → local `YYYY-MM-DD HH:MM`

---

## NearbyPlacesPanel (src/components/NearbyPlacesPanel.js:219)

Custom element `<nearby-places>`.

```js
get enabledCategories()     // string[] — default ['fuel'] only
setPlaces(places)
setLoading(loading)
clear()
```

**Emits:**
- `nearby-place-focus` — `{ placeId }`
- `nearby-place-add-to-route` — `{ name, lat, lng }`
- `nearby-category-toggle` — `{ categoryId, enabled }`

**Rules:**
- Minimum 1 category must remain enabled (cannot disable all)
- Categories with 0 matching places are omitted from chip list
- Places grouped by category in display; sorted by `PLACE_CATEGORIES` order

---

## TripStatsPanel (src/components/TripStatsPanel.js:89)

Custom element `<trip-stats-panel>`. **Currently unused** — superseded by inline details in `TripListComponent`.

```js
show(trip)
hide()
```

---

## Event flow reference

### User selects trip in sidebar
```
TripListComponent → trip-select { id }
  → App.#onTripSelect()
    → UrlStateManager.pushTrip(id)
    → MapController.selectTrip(id)
    → TripListComponent.setActive(id)
```

### User plans a route
```
RoutePlannerComponent → route-geocode { id, address }
  → App.#onRouteGeocode() → MapController.geocode() → planner.resolveWaypoint()

RoutePlannerComponent → route-plan { waypoints, ... }
  → App.#onRoutePlan()
    → MapController.renderPlannedRoute()
      → RouteRenderer.render()
    → MapController.showFuelStations()
    → App.#refreshNearbyPlaces()
```

### User drags route marker
```
RouteRenderer (dragend)
  → App.#map.setMarkerDragHandler callback
    → RoutePlannerComponent.updateWaypointPosition()
    → App.#recalculateRoute()
```

### Browser back/forward
```
UrlStateManager popstate
  → App.#onNavigate({ tripId, poiIndex })
    → MapController.selectTrip() | openPoi()
    → sidebar components .setActive()
```

### Accordion section change
```
AppSidebarComponent → section-change { section }
  → App.#onSectionChange()
    → MapController.setTripLayersVisibility()
    → MapController.setPoiVisibility()
    → MapController.setPlannedRouteVisibility()
```

---

## Tab → map layer visibility

| Active section | Trips | POIs | Planned route |
|---|---|---|---|
| `rides` | yes | no | no |
| `poi` | no | yes* | no |
| `planner` | no | no | yes |
| `null` (all collapsed) | yes | yes* | yes |

\* POIs also gated by `showPoi` setting (AND logic)

---

## Data formats

### Trip JSON
```json
{
  "id": "trip_22-02-26",
  "title": "Ride to Zagorje",
  "date": "2026-02-22",
  "waypoints": [
    { "lat": 45.8150, "lng": 15.9819, "label": "Start", "isVisible": true },
    { "lat": 45.8150, "lng": 15.9819, "label": "End",   "isVisible": true }
  ],
  "roadDistanceKm": 87.4,
  "avoidHighways": false,
  "avoidTolls": false,
  "avoidFerries": false,
  "color": "#ff0000"
}
```

Optional fields: `description`, `distance_km`, `duration_hours`, `tags[]`, `color`, `roadDistanceKm`, `avoidHighways/Tolls/Ferries`

### POI JSON (`data/pois.json`)
```json
[{ "title": "...", "type": "viewpoint", "lat": 0, "lng": 0, "description": "...", "address": "..." }]
```
Supported types: `cafe`, `fuel`, `hotel`, `mechanic`, `water`, `viewpoint`, `castle`

### Trip manifest (`data/trips/index.json`)
```json
{ "trips": ["trips/trip_22-02-26.json"] }
```
Paths relative to `data/`. No JS changes needed to add a trip — just add file + manifest entry.

---

## Key hardcoded values

| Value | Location | Notes |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | `main.js:28` | Restrict via HTTP referrer for public deploy |
| `ZAGREB_CENTER` `{45.8150, 15.9819}` | `MapController.js` | Default map center |
| `DEFAULT_ZOOM = 12` | `MapController.js` | |
| Route colors | `RouteRenderer.ROUTE_COLORS` | `['#3b82f6','#f59e0b','#10b981']` |
| Trip recency palette | `ColorUtils.RECENCY_PALETTE` | 6 colors, oldest fallback `#D9D9D9` |
| Fuel search radius | `FuelStationRenderer` | 500 m, every 10 km |
| Nearby search radius | `NearbyPlacesRenderer` | 3 km, every 15 km |
| Settings localStorage key | `AppSettingsComponent` | `'moto-map:settings'` |
| Accordion localStorage key | `AppSidebarComponent` | `'moto-map:accordion'` |

---

## Known issues / gotchas

1. **`TravelMode.TWO_WHEELER`** not available in all countries — falls back to straight line with `console.warn`.
2. **No alternatives for multi-stop routes** — Google API limitation.
3. **Legacy `PlacesService`** — may be deprecated; no caching between recalculations.
4. **`PoiListComponent` typo** — `POI_EMOJI` has key `'abadoned'`; do not fix unless data is also fixed.
5. **`TripStatsPanel`** is registered but never instantiated in `main.js`.
6. **API key is public** — visible in source; restrict by HTTP referrer.
7. **`GeoUtils.haversineKm` fallback** is shorter than real road distance; prefer `_roadDistanceKm`.
8. **No Shadow DOM** — all CSS is global; new components must not introduce class name conflicts.
9. **Service worker** — `sw.js` must be updated when new asset paths are added.
10. **`PoiRepository.fetchAll()`** returns `[]` silently on HTTP error; check `data/pois.json` path if POIs are missing.

---

## Version update rule

After every task that touches application code or data:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Set `APP_VERSION_DATE` in `src/version.js` to the result. Never skip this.
