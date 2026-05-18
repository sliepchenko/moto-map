# Moto Map — Roadmap

A collection of feature ideas grouped by theme and source.
All Google Maps libraries listed are available under the existing API key.
Items marked **Done** are fully implemented and included for reference.

---

## Currently Implemented

| Feature | Notes |
|---|---|
| Road-following polylines for recorded trips | `DirectionsService` + `TWO_WHEELER` mode |
| Route planner — multi-stop, avoid highways / tolls / ferries | Up to 10 waypoints |
| Alternative routes (A→B) — up to 3, selectable polylines | Single-leg only (Google API limitation) |
| Fuel station finder — auto-triggered after route calculation | 10 km sample interval, 500 m radius |
| Nearby POIs along route — 10 categories | Viewpoints, cafes, hotels, campsites, etc. |
| Address → coordinates (Geocoder) in route planner | Plain text input, not autocomplete |
| Colored trip lines with directional arrows | Two stacked polylines sharing one path |
| Trip start/end markers and POI popups | `Marker` + `InfoWindow` |
| Drag-and-drop waypoint reordering | Live reorder during `dragover` |
| Drag route marker to reposition stop | Draggable numbered markers |
| Double-click polyline to insert new stop | Nearest-segment heuristic |
| Inline waypoint label rename | Double-click label → edit → Enter/Escape |
| Export route to Google Maps (new tab) | `travelmode=driving`, max 8 intermediate stops |
| Download route as JSON | Filename: `trip_DD-MM-YY.json` |
| Dark map / terrain / route-arrow toggles | Persisted to `localStorage` |
| Open recorded trip in Google Maps | Per-trip button in My Rides list |

---

## Planned Features

### High Priority

#### Smart Waypoint Autocomplete
**API:** `places` (`PlaceAutocompleteElement`)

Replace the plain text inputs in the route planner with `PlaceAutocompleteElement`.
Users get live suggestions as they type — much faster than typing full addresses.
Effort: Low.

---

#### Elevation Profile per Trip
**API:** `elevation` (`ElevationService`)

Plot a height-over-distance chart below the map when a trip is selected.
Riders care about passes, climbs, and total ascent — this surfaces it directly from the recorded waypoints.
Optionally show an elevation preview when planning a new route, and auto-place summit/valley markers.
Effort: Medium.

---

#### Dynamic Fuel HUD — Next Stations Along Route
**Source:** Community wish (research.md §1)

Show the *next* 3–5 fuel stations specifically along the current route path (not just nearby in any direction).
Display distance-to-station in a persistent HUD overlay rather than requiring the user to open the map panel.
Builds on the existing `FuelStationRenderer` — add ordering by route position and a distance counter.
Effort: Medium.

---

#### Live GPS Position Marker
**API:** Browser `navigator.geolocation`

Show the rider's current GPS position as a moving marker on the map.
A single "Centre on Me" button flies the map to the current location at a useful zoom level.
Optionally auto-pan to keep the marker centred in "ride mode".
Effort: Low.

---

#### Round Trip Generator
**Source:** Community wish (research.md §1)

Input a desired distance (km) or duration and have the app generate a loop route starting and ending at the same location.
Useful for spontaneous rides where the rider knows how long they want to be out.
Effort: High (requires route generation heuristic or external API).

---

### Medium Priority

#### Curvy / Thrilling Routing
**Source:** Community wish (research.md §1, §2)

Offer routing modes that prioritise twisty, scenic roads over the fastest path.
Multiple curviness levels (e.g. "Scenic", "Curvy", "Extreme").
Also includes an "avoid unpaved / prefer dirt" toggle for dual-sport bikes.
Effort: High (requires curvature data source or third-party routing API such as Kurviger).

---

#### Road Surface Filters
**Source:** Community wish (research.md §1, §2)

Differentiate between asphalt, gravel, and dirt/unpaved roads.
Allow road bikes to avoid gravel; allow adventure/dual-sport bikes to seek it.
Requires an external road-surface dataset (OpenStreetMap `surface` tag via Overpass API).
Effort: High.

---

#### Glove-Friendly UI / On-Bike Mode
**Source:** Community wish (research.md §2, §3)

High-contrast, large-tap-target buttons suitable for use with motorcycle gloves.
Remove confirmation pop-ups that require precise interaction while riding.
Dynamic auto-zoom: zoom out at high speed for route overview, zoom in at low speed for complex turns.
"Recenter timer toggle": prevent the map snapping back to current position for 20–30 s after a manual pan.
Effort: Medium.

---

#### Street View Preview from POI
**API:** `streetView` (`StreetViewPanorama`, `StreetViewService`)

Add a "Street View" button inside POI InfoWindows.
Opens an embedded panorama so the rider can check road surface, parking, and access road before visiting.
Also useful as a "scout mode": click any map point to preview the road before a ride.
Effort: Low.

---

#### Live Traffic Layer
**API:** `TrafficLayer` (no extra library cost)

One toggle in Settings to overlay real-time traffic conditions on the map.
`new google.maps.TrafficLayer()` — zero extra API cost beyond the map load.
Effort: Low.

---

#### GPX / KML Import & Export
**API:** `google.maps.Data` (`KmlLayer`)

Allow riders to drag-and-drop a GPX or KML file exported from a GPS device (Garmin, TomTom)
and render it on the map as a trip. Convert GPX to GeoJSON client-side, then use `Data.addGeoJson()`.
Also add a "Download KML" button alongside the existing "Download JSON" so routes can be imported
directly into Google Maps mobile for turn-by-turn navigation.
Effort: Medium.

---

#### Toll Cost Estimation
**API:** `routes` (New Routes API)

The Routes API can return toll prices for a route (where data is available).
Show the estimated toll cost in the route summary panel.
Effort: Medium.

---

#### Optimised Stop Order
**API:** `routes`

When planning a multi-stop ride, use `optimizeWaypointOrder: true` to find the most efficient
order to visit all stops. Great for day-ride planning with multiple destinations.
Effort: Medium.

---

#### Waypoint Auto-Skip
**Source:** Community wish (research.md §1)

Automatically advance to the next waypoint when the rider passes close enough to the current one,
without requiring manual interaction.
Requires live GPS position (see above) + proximity check per route update.
Effort: Medium.

---

#### Hazard Reporting
**Source:** Community wish (research.md §2)

Real-time community alerts for potholes, roadwork, gravel washouts, and slippery steel-grate bridges.
Could integrate with Waze-style data or a lightweight self-hosted report store.
Effort: High (requires backend or third-party data feed).

---

### Lower Priority

#### Ride Frequency Heatmap
**API:** `visualization` (`HeatmapLayer`)

Aggregate all trip waypoints into a heatmap layer showing which roads you ride most often.
Gives a visual "territory map" of riding habits — also highlights roads not yet explored.
Effort: Medium.

---

#### Multi-Day Statistics & Ride Summary Reports
**Source:** Community wish (research.md §2)

Post-ride stats panel: max speed, elevation gain, average speed (requires telemetry recording).
Merge individual ride logs into a single multi-day tour statistic view.
Effort: Medium–High (depends on whether telemetry recording is added first).

---

#### POI Clustering
**Library:** `@googlemaps/markerclusterer` (no API key cost)

When many POIs are visible at low zoom, cluster them into a single marker with a count badge.
Prevents the map from being cluttered when the POI list grows.
Effort: Low.

---

#### HTML / CSS Rich Markers
**API:** `marker` (`AdvancedMarkerElement`, `PinElement`)

Replace the current SVG icon markers with `AdvancedMarkerElement` + HTML content.
Enables richer POI cards (photo, name, rating snippet) directly on the map without InfoWindows.
Also enables collision-aware marker clustering via `collisionBehavior`.
Effort: Medium.

---

#### Biker-Friendly POI Layer
**Source:** Community wish (research.md §2)

A dedicated map layer for community-rated cafes, secure parking, and hotels that specifically cater to riders.
Requires either a community data source or a curated static dataset.
Effort: Medium–High.

---

#### Pack / Group Tracking
**Source:** Community wish (research.md §1)

See the real-time location of friends in a riding group on the same map.
Alert when a group member falls behind.
Requires a real-time backend (WebSocket or Firebase).
Effort: High (needs backend).

---

#### Discover Routes (Community Sharing)
**Source:** Community wish (research.md §2)

A searchable area where users can find, rate, and import loop routes shared by others.
Requires a backend or hosted data store.
Effort: High (needs backend).

---

## Features Requiring Minor Backend / Proxy

Achievable with a small serverless function or edge proxy (Cloudflare Workers / Netlify Functions).

| Feature | API | Notes |
|---|---|---|
| Reverse geocode trip start/end to city name | Geocoding API | Show "Zagreb → Ljubljana" in trip card |
| Road speed limits along route | Roads API `speedLimits` | Display max speed per segment |
| Distance matrix between all POIs | Distance Matrix | "How far are all my saved stops from each other?" |

---

## Priority Summary

| Priority | Feature | Effort |
|---|---|---|
| High | Smart waypoint autocomplete | Low |
| High | Live GPS position + auto-centre | Low |
| High | Elevation profile per trip | Medium |
| High | Dynamic fuel HUD (next stations along route) | Medium |
| High | Round trip generator | High |
| Medium | Glove-friendly / on-bike UI mode | Medium |
| Medium | Street View from POI | Low |
| Medium | Live traffic layer | Low |
| Medium | GPX / KML import & export | Medium |
| Medium | Toll cost estimation | Medium |
| Medium | Optimised stop order | Medium |
| Medium | Curvy / thrilling routing | High |
| Medium | Road surface filters | High |
| Medium | Waypoint auto-skip | Medium |
| Medium | Hazard reporting | High |
| Low | Ride frequency heatmap | Medium |
| Low | Multi-day statistics & ride summary | Medium–High |
| Low | POI clustering | Low |
| Low | HTML / CSS rich markers | Medium |
| Low | Biker-friendly POI layer | Medium–High |
| Low | Pack / group tracking | High |
| Low | Discover routes (community sharing) | High |
