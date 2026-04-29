# Moto Map — Roadmap

A collection of feature ideas grouped by the Google Maps API capability that powers them.
All libraries are available under the existing API key. Ideas are sorted by rider usefulness.

---

## Currently Implemented

| API / Library | Feature | Status |
|---|---|---|
| `directions` | Road-following polylines for recorded trips & route planner | Done |
| `Geocoder` | Address → coordinates in route planner waypoints | Done |
| `Polyline` + `SymbolPath` | Colored trip lines with directional arrows | Done |
| `Marker` + `InfoWindow` | Trip start/end markers and POI popups | Done |
| `places` (`PlacesService`) | Nearby POI search along planned route (10 categories) | Done |
| `places` (`PlacesService`) | Fuel station finder — auto-triggered after route calculation | Done |
| `directions` | Avoid highways / tolls / ferries toggles in route planner | Done |
| `directions` | Alternative routes — up to 3 displayed as selectable polylines | Done |

---

## Elevation Library (`elevation`)

**`google.maps.ElevationService`**

### Elevation Profile per Trip
Plot a height-over-distance chart below the map when a trip is selected.
Riders care about passes, climbs, and total ascent — this surfaces it directly from the recorded waypoints.

### Route Elevation Preview
When planning a new route, show an elevation profile before you ride it.
Highlight the steepest segments so the rider knows what to expect.

### Highest/Lowest Point Markers
Auto-place a summit marker at the highest elevation point of a trip, and a valley marker at the lowest.
Displayed in the trip stats panel alongside distance/duration.

---

## Places Library (`places`)

**`Place`, `PlacesService`, `AutocompleteService`, `PlaceAutocompleteElement`**

### Smart Waypoint Autocomplete
Replace the plain text inputs in the route planner with `PlaceAutocompleteElement`.
Users get live suggestions as they type — much faster than typing full addresses.

### Mechanic / Dealer Locator
Search for motorcycle dealerships and repair shops near any map point.
Essential for breakdowns on a trip far from home.

---

## Routes Library (`routes`) — New Routes API

**`Route`, `RouteMatrix`** — replaces the legacy `DirectionsService`

### Toll Cost Estimation
`routes` can return toll prices for a route (where data is available).
Show the estimated toll cost in the route summary panel.

### Optimised Stop Order
When planning a multi-stop ride, use `optimizeWaypointOrder: true` to find the most efficient
order to visit all stops. Great for day-ride planning with multiple destinations.

---

## Geometry Library (`geometry`)

**`google.maps.geometry.spherical`, `google.maps.geometry.poly`, `google.maps.geometry.encoding`**

### Snap-to-Nearest-Trip
Given the user's current GPS location, use `geometry.spherical.computeDistanceBetween()`
to find which recorded trip they are closest to and auto-select it.

### Route Buffer / Corridor Polygon
Draw a transparent polygon around a planned route using `geometry.spherical.computeOffset()`
to visualise the area within X km. Useful for searching POIs inside the corridor.

### Encode/Decode Polylines
Use `geometry.encoding.encodePath()` to store trip polylines as compact Encoded Polyline
strings in the trip JSON — reduces file size significantly for long rides.

---

## Street View Library (`streetView`)

**`StreetViewPanorama`, `StreetViewService`**

### Street View Preview from POI
Add a "Street View" button inside POI InfoWindows.
Opens an embedded panorama so the rider can check road surface, parking, access road before visiting.

### Road Surface Scouting
Let the user click any point on the map in a dedicated "scout mode" to open Street View.
Useful for pre-checking gravel, road conditions, or tricky junctions before a ride.

---

## Advanced Markers (`marker`)

**`AdvancedMarkerElement`, `PinElement`**

### HTML/CSS Rich Markers
Replace the current SVG icon markers with `AdvancedMarkerElement` + HTML content.
Enables richer POI cards (photo, name, rating snippet) directly on the map without InfoWindows.

### Collision-Aware Marker Clustering
Use `AdvancedMarkerElement` with `collisionBehavior` to prevent marker overlap when zoomed out.
Auto-cluster nearby POIs into a count badge that expands on zoom.

### Animated Current-Location Marker
A pulsing dot showing the rider's live GPS position, built with an HTML marker so
the CSS animation is smooth and does not require canvas.

---

## Geolocation (Browser API + Maps integration)

**`navigator.geolocation` + `google.maps.Marker` / `AdvancedMarkerElement`**

### Live "Ride Me" Mode
Show the rider's current GPS position as a moving marker on the map.
Auto-pan to keep the marker centred. Useful when using the app on a phone mount.

### Auto-Centre on My Location
A single button that flies the map to the user's current location at a useful zoom level.
Standard feature every map app needs — currently missing.

### Distance to Next Waypoint
While in navigation/route mode, display the straight-line distance from the current GPS
position to the next planned waypoint in a persistent HUD overlay.

---

## Traffic Layer

**`TrafficLayer`** — no extra library needed

### Live Traffic Layer
One toggle in Settings to overlay real-time traffic conditions on the map.
Helps riders identify and avoid congestion before or during a trip.
`new google.maps.TrafficLayer()` — zero extra API cost beyond the map load.

---

## KML / GeoJSON Data Layer

**`KmlLayer`, `google.maps.Data`** — no extra library needed

### Import GPX / KML Tracks
Allow riders to drag-and-drop a GPX or KML file exported from a GPS device (Garmin, TomTom)
and render it on the map as a trip. Convert GPX to GeoJSON client-side, then use `Data.addGeoJson()`.

### Export Trip as KML
Add a "Download KML" button alongside the existing "Download JSON" in the route planner,
so the route can be imported directly into Google Maps mobile for turn-by-turn navigation.

---

## Marker Clustering (open-source: `@googlemaps/markerclusterer`)

*No API key cost — pure JS library*

### POI Clustering
When many POIs are visible at low zoom, cluster them into a single marker with a count.
Prevents the map from being cluttered when the POI list grows.

---

## Visualization Library (`visualization`)

**`HeatmapLayer`**

### Ride Frequency Heatmap
Aggregate all trip waypoints into a heatmap layer showing which roads you ride most often.
Gives a visual "territory map" of your riding habits — great as a summary view.

---

## Ideas Requiring Minor Backend / Proxy

These are achievable with a small serverless function or edge proxy — still fits the
zero-dependency static-file philosophy if self-hosted on Cloudflare Workers / Netlify Functions.

| Feature | API | Notes |
|---|---|---|
| Reverse geocode trip start/end to city name | Geocoding API | Show "Zagreb → Ljubljana" in trip card |
| Road speed limits along route | Roads API `speedLimits` | Display max speed per segment |
| Distance matrix between all POIs | Distance Matrix | "How far are all my saved stops from each other?" |

---

## Priority Suggestion

| Priority | Feature | API | Effort |
|---|---|---|---|
| High | Elevation profile per trip | `elevation` | Medium |
| High | Smart waypoint autocomplete | `places` | Low |
| High | Live GPS position marker | Browser geolocation | Low |
| Medium | Auto-centre on my location button | Browser geolocation | Low |
| Medium | Street View from POI | `streetView` | Low |
| Medium | Live traffic layer | `TrafficLayer` | Low |
| Medium | GPX/KML import | `Data` layer | Medium |
| Medium | Toll cost estimation | `routes` | Medium |
| Medium | Optimised stop order | `routes` | Medium |
| Low | Ride frequency heatmap | `visualization` | Medium |
| Low | POI clustering | `@googlemaps/markerclusterer` | Low |
| Low | HTML/CSS rich markers | `marker` | Medium |
