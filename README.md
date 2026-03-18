# Moto Map — Motorcycle Trip Tracker

A static website that visualizes motorcycle trips on an interactive map powered by **Google Maps JavaScript API**. Trip data is stored as plain JSON files, making it easy to add new trips without any backend or build pipeline changes.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture](#architecture)
4. [Directory Structure](#directory-structure)
5. [Data Format (Trip JSON)](#data-format-trip-json)
6. [Technology Stack](#technology-stack)
7. [Rendering Pipeline](#rendering-pipeline)
8. [UI / UX Design Decisions](#ui--ux-design-decisions)
9. [Mapbox Integration](#mapbox-integration)
10. [Static Hosting](#static-hosting)
11. [Development Workflow](#development-workflow)
12. [Future Enhancements](#future-enhancements)

---

## Project Overview

The site is a **personal portfolio of motorcycle trips**. Each trip is described by a JSON file that contains an ordered list of geographic waypoints (start point, optional intermediate points, end point). The application fetches those files at runtime, converts the waypoints into a GeoJSON `LineString`, and draws the route on a full-screen Google Map.

There is no server, no database, and no authentication. The entire application is a collection of static files that can be hosted for free on GitHub Pages, Netlify, Vercel, or any CDN.

---

## Goals & Non-Goals

### Goals
- Display one or more motorcycle trips as routes on an interactive map.
- Allow easy addition of new trips by dropping a JSON file into a folder.
- Provide a clean, minimal UI that keeps the map as the primary focus.
- Work entirely as a static site — zero server-side code.
- Be easily extensible (trip details panel, photos, statistics, etc.).

### Non-Goals
- Real-time GPS tracking.
- User accounts or trip sharing with authentication.
- Server-side rendering or a CMS backend.
- Mobile native app (responsive web is sufficient).

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌────────────┐    ┌──────────────────────────┐  │
│  │  index.html│───▶│  main.js (app entrypoint)│  │
│  └────────────┘    └──────────┬───────────────┘  │
│                               │                  │
│              ┌────────────────┼──────────────┐   │
│              ▼                ▼              ▼   │
│       ┌────────────┐  ┌──────────────┐  ┌──────┐ │
│       │ tripLoader │  │ mapController│  │ UI   │ │
│       │  (fetch    │  │ (Google Maps │  │(side-│ │
│       │  JSON      │  │  JS API)     │  │panel)│ │
│       │  files)    │  └──────────────┘  └──────┘ │
│       └─────┬──────┘                             │
│             │                                    │
│             ▼                                    │
│       ┌──────────────────────┐                   │
│       │  /data/trips/        │                   │
│       │    index.json        │                   │
│       │    trip-001.json     │                   │
│       │    trip-002.json     │                   │
│       │    ...               │                   │
│       └──────────────────────┘                   │
└──────────────────────────────────────────────────┘
```

**Key design choice:** A top-level `data/trips/index.json` acts as a manifest — it lists all available trip files. The app fetches the manifest first, then lazily loads individual trip files as needed. This avoids hardcoding trip filenames anywhere in JavaScript.

---

## Directory Structure

```
moto-map/
├── index.html              # Single HTML shell
├── style.css               # Global styles
├── main.js                 # Application entry point
├── src/
│   ├── tripLoader.js       # Fetches & validates trip JSON files
│   ├── mapController.js    # Mapbox map init, layer & source management
│   ├── tripPanel.js        # Sidebar / trip list UI component
│   └── utils.js            # GeoJSON helpers, distance calculation, etc.
├── data/
│   └── trips/
│       ├── index.json      # Manifest: list of all trip file paths
│       ├── trip-001.json   # Individual trip data files
│       └── trip-002.json
├── assets/
│   └── icons/              # Custom map marker icons (PNG/SVG)
└── README.md
```

---

## Data Format (Trip JSON)

Each trip is described by a single JSON file.

### Minimal example

```json
{
  "id": "trip-001",
  "title": "Carpathian Loop",
  "date": "2024-08-15",
  "waypoints": [
    { "lat": 48.9226, "lng": 24.7111 },
    { "lat": 48.6271, "lng": 25.0049 },
    { "lat": 48.2912, "lng": 25.9346 }
  ]
}
```

### Full example with optional fields

```json
{
  "id": "trip-002",
  "title": "Black Sea Coast Ride",
  "date": "2024-09-10",
  "description": "Three-day coastal ride along the Black Sea.",
  "distance_km": 740,
  "duration_hours": 18,
  "tags": ["coastal", "mountains", "3-day"],
  "color": "#E55D2B",
  "waypoints": [
    {
      "lat": 46.9651,
      "lng": 31.9966,
      "label": "Start — Mykolaiv",
      "note": "Fuel stop"
    },
    {
      "lat": 46.4825,
      "lng": 30.7233,
      "label": "Odesa"
    },
    {
      "lat": 44.6166,
      "lng": 33.5254,
      "label": "Sevastopol area"
    },
    {
      "lat": 44.9521,
      "lng": 34.1024,
      "label": "End — Simferopol"
    }
  ],
  "route": [
    { "lat": 46.9651, "lng": 31.9966 },
    { "lat": 46.9480, "lng": 31.9710 },
    { "lat": 46.9120, "lng": 31.9230 },
    { "lat": 46.8874, "lng": 31.8601 },
    { "lat": 46.8503, "lng": 31.7842 },
    { "lat": 46.7891, "lng": 31.5670 },
    { "lat": 46.7200, "lng": 31.3210 },
    { "lat": 46.6540, "lng": 31.1080 },
    { "lat": 46.5630, "lng": 30.9140 },
    { "lat": 46.4825, "lng": 30.7233 },
    { "lat": 46.2310, "lng": 30.7980 },
    { "lat": 45.9870, "lng": 30.9450 },
    { "lat": 45.7200, "lng": 31.2100 },
    { "lat": 45.4560, "lng": 31.5430 },
    { "lat": 45.1980, "lng": 31.8760 },
    { "lat": 44.9100, "lng": 32.6430 },
    { "lat": 44.7230, "lng": 33.2870 },
    { "lat": 44.6166, "lng": 33.5254 },
    { "lat": 44.6780, "lng": 33.6890 },
    { "lat": 44.7830, "lng": 33.8540 },
    { "lat": 44.9521, "lng": 34.1024 }
  ]
}
```

> **`route` vs `waypoints`:** `waypoints` are the named stops the rider planned the trip around (start, intermediate stops, end). `route` is the dense sequence of GPS coordinates that traces the **actual road geometry** — every turn, curve, and intersection the rider followed. It is produced by a routing engine (e.g. OSRM, GraphHopper, Google Directions API) or exported from a GPS device/GPX file, and contains enough points to faithfully render the road path on the map without straight-line shortcuts through buildings or terrain.

### Manifest file (`data/trips/index.json`)

```json
{
  "trips": [
    "trips/trip-001.json",
    "trips/trip-002.json"
  ]
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique identifier, matches filename |
| `title` | string | yes | Human-readable trip name |
| `date` | string (ISO 8601) | yes | Trip start date |
| `waypoints` | array | yes | Named stops: start, intermediate points, end |
| `waypoints[].lat` | number | yes | Latitude (WGS 84) |
| `waypoints[].lng` | number | yes | Longitude (WGS 84) |
| `waypoints[].label` | string | no | Point label shown on map hover |
| `waypoints[].note` | string | no | Additional tooltip text |
| `route` | array | no | Dense sequence of coordinates produced by a routing engine or GPS device, tracing the exact road geometry between waypoints (every turn and curve). Used to draw the polyline on the map. Falls back to straight lines between `waypoints` if omitted. |
| `route[].lat` | number | yes (if route) | Latitude (WGS 84) |
| `route[].lng` | number | yes (if route) | Longitude (WGS 84) |
| `description` | string | no | Free-text trip description |
| `distance_km` | number | no | Total distance in kilometres |
| `duration_hours` | number | no | Total riding time |
| `tags` | string[] | no | Searchable tags |
| `color` | string (CSS color) | no | Route line colour on the map |

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Markup | HTML5 | No framework needed for a static page |
| Styles | Vanilla CSS (custom properties) | Minimal footprint, no build step required |
| Logic | Vanilla JavaScript (ES Modules) | No bundler required for initial version |
| Mapping | **Google Maps JavaScript API** | Widely supported, reliable, rich SDK |
| Map tiles | Google Maps Terrain / Roadmap | Terrain style suits motorcycle routes |
| Hosting | GitHub Pages (initial) | Free, CI/CD via `git push` |
| Future bundler | Vite | Zero-config, fast HMR if the project grows |

---

## Rendering Pipeline

```
1. Browser loads index.html
        │
        ▼
2. main.js dynamically loads Google Maps JS API, then calls initMap (mapController.js)
        │
        ▼
3. tripLoader.js fetches data/trips/index.json (manifest)
        │
        ▼
4. For each trip in the manifest:
     a. fetch the individual trip JSON file
     b. validate required fields (id, title, date, waypoints)
     c. if `route` is present, use it as the polyline geometry; otherwise fall back to straight lines between `waypoints`
     d. convert to GeoJSON Feature (LineString for the route + Points for waypoints)
        │
        ▼
5. mapController.addTrip(geoJsonFeature):
     a. new google.maps.Polyline (route line)
     b. new google.maps.Marker (waypoint markers)
        │
        ▼
6. tripPanel.js renders the trip list in the sidebar
        │
        ▼
7. User clicks a trip → map.fitBounds(trip.bbox) + highlight layer
```

---

## UI / UX Design Decisions

- **Full-screen map** with a collapsible sidebar on the left.
- **Trip list in sidebar** — each entry shows title, date, and distance.
- Clicking a trip **flies the camera** to fit the route in view.
- Active trip route is **highlighted** (thicker line, brighter colour).
- Waypoints are shown as **small circle markers**; start and end use distinct icons.
- On hover/click, a **popup** (Google Maps `InfoWindow`) shows the waypoint label and note.
- The UI is **responsive**: on small screens the sidebar becomes a bottom sheet.
- **Map type toggle** (Terrain vs. Roadmap).

---

## Google Maps Integration

### Setup

1. Obtain an API key from the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Maps JavaScript API** for your project.
3. Store the key in a top-level `config.js` file (gitignored) or as an environment variable injected at build time. **Never commit the key in a public repository.**

```js
// config.js  (gitignored)
export const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE';
```

### Map initialisation

```js
import { initMap } from './src/mapController.js';

const mapWrapper = await initMap(GOOGLE_MAPS_API_KEY);

mapWrapper.on('load', () => {
  console.log('Map ready');
});
```

### Route rendering

```js
// Use the dense road-following route if available, otherwise fall back
// to straight lines between the named waypoints.
const pathCoords = (trip.route ?? trip.waypoints).map(pt => ({ lat: pt.lat, lng: pt.lng }));

const polyline = new google.maps.Polyline({
  path: pathCoords,
  geodesic: true,
  strokeColor: trip.color ?? '#E55D2B',
  strokeOpacity: 1.0,
  strokeWeight: 3,
  map,
});
```

---

## Static Hosting

### GitHub Pages

1. Push code to the `main` branch.
2. In repository **Settings → Pages**, set source to `main` branch, `/ (root)`.
3. Site is live at `https://<username>.github.io/moto-map/`.

### Netlify / Vercel (alternative)

- Connect repository, set **publish directory** to `/` (no build command required).
- Both platforms support custom domains and automatic HTTPS.

### Important: Google Maps API key on a public site

The API key will be visible in client-side code. Mitigate this by:
- **Restricting the key** in the Google Cloud Console to your domain(s) only (HTTP referrer restrictions).
- Rotating the key if it is ever exposed or abused.

---

## Development Workflow

### Prerequisites

- A modern browser (Chrome / Firefox / Safari).
- A local static file server — any of the following:

```bash
# Option 1 — Python (no install)
python3 -m http.server 8080

# Option 2 — Node.js (no install beyond Node)
npx serve .

# Option 3 — VS Code Live Server extension
```

### Adding a new trip

1. Create `data/trips/trip-NNN.json` following the data format above.
2. Populate `waypoints` with the named stops (start, intermediate, end).
3. Populate `route` with the dense road-following coordinates exported from a GPS device, GPX file, or a routing engine (OSRM, GraphHopper, Google Directions API). Without `route` the map will draw straight lines between waypoints.
4. Add the path to `data/trips/index.json`.
5. Refresh the browser — the trip appears automatically.

### Linting & formatting (optional, recommended)

```bash
npx eslint src/
npx prettier --write .
```

---

## Future Enhancements

The following features are planned for future iterations, in rough priority order:

1. **Trip statistics panel** — total distance, elevation gain (from external elevation API), average speed.
2. **Photo gallery per trip** — lightbox of trip photos linked from the JSON file.
3. **Elevation profile chart** — SVG/Canvas chart drawn below or beside the map.
4. **Trip search & filtering** — filter by tag, date range, or distance.
5. **Vite bundler** — add a build step for asset hashing, CSS bundling, and environment variable management (Google Maps API key via `.env`).
6. **GPX / KML import** — parse GPX files from a GPS device and auto-generate trip JSON.
7. **Offline support** — service worker to cache tiles and trip data for offline viewing.
8. **Animated route drawing** — draw the route progressively on the map for a storytelling effect.
9. **Custom map style** — design a bespoke Google Maps style via the Cloud Console styling wizard optimised for road routes.
10. **Multi-language support** — i18n for trip descriptions.

---

## Contributing

This is a personal project. If you want to fork it and use it for your own trips, everything in `data/trips/` is yours to replace. See [Data Format](#data-format-trip-json) for the JSON schema.

---

*Last updated: March 2026*
