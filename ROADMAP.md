# Technical Roadmap: Motorcycle Web Ecosystem (PWA)

**Objective:** Evolve the current base (ride history and POIs) into a high-performance Progressive Web App (PWA)
focusing on offline reliability, experience-based routing, and proactive safety.

**Current stack:** Vanilla JS (ES2022 modules), Google Maps JavaScript API, zero build tooling, zero dependencies.
All features below are assessed against this baseline.

---

## Difficulty tiers

Features are ordered from easiest to hardest within each tier. Effort estimates assume a single frontend developer.

---

## Tier 1 — Low Hanging Fruit (days)

*These features require minimal new infrastructure. They extend code that already exists.*

| # | Feature | Technical Implementation | Effort |
|:--|:--------|:------------------------|:-------|
| 1 | **Wire `GeoUtils.js` into the UI** | `GeoUtils.estimateTripDistance()` already exists but is unused. Connect it to `TripListComponent` to display km per trip card. Zero new code required — one import + one render call. | ~2 h |
| 2 | **PWA Manifest** | Add `manifest.json` (name, icons, `display: standalone`, `theme_color`) and `<link rel="manifest">` in `index.html`. Unlocks "Add to Home Screen" on mobile. No logic changes. | ~2 h |
| 3 | **Trip Statistics Panel** | Surface distance (already computable), estimated duration, and waypoint count inside each trip's InfoWindow or a sidebar details panel. Pure data wiring. | ~4 h |
| 4 | **Maintenance Garage — Basic Alerts** | A static JSON config file (e.g., `maintenance.json`) with intervals per component (chain, tires, brake fluid). Read it on load, compare against trip mileage totals, show a banner if overdue. No backend required. | ~1 day |
| 5 | **High-Contrast Cockpit / Riding Mode** | A CSS class toggle (`body.riding-mode`) that enlarges UI elements, boosts contrast, and hides the sidebar. A floating FAB button activates it. Pairs well with `prefers-color-scheme: dark`. Pure CSS + one JS toggle. | ~1 day |

---

## Tier 2 — Moderate Effort (weeks)

*These features require new modules or third-party integrations but fit naturally into the existing vanilla-JS architecture.*

| # | Feature | Technical Implementation | Effort |
|:--|:--------|:------------------------|:-------|
| 6 | **Service Worker — Static Asset Caching** | Register a service worker (`sw.js`) using the Cache API to cache `index.html`, `style.css`, all JS modules, `theme.json`, and data JSONs. `stale-while-revalidate` strategy. Prerequisite for full PWA hardening. | ~2 days |
| 7 | **GPX Export** | Serialize existing trip waypoints into a valid GPX 1.1 XML string and trigger a `Blob` download. No new data needed — all coordinates are already in `trip.json` files. | ~2 days |
| 8 | **Dark Theme UI** | Extend `theme.json` (already a custom grayscale Google Maps style) with a full dark-mode CSS pass using `prefers-color-scheme`. Sidebar, cards, and InfoWindows need styling. | ~2 days |
| 9 | **GPX Import** | Use `FileReader` API to parse GPX XML (`DOMParser`), extract `<trkpt>` elements, and render the route as a `google.maps.Polyline`. No new dependencies needed — the DOM already has an XML parser. | ~3 days |
| 10 | **Surface Type Visualization** | Fetch OpenStreetMap Overpass API data for road segments along a route. Overlay as color-coded dashed/solid polylines on top of the Google Maps base layer. Free tier available; no API key needed. | ~1 week |
| 11 | **Route-Timed Weather Forecasting** | Integrate a weather API (Open-Meteo is free, no key required) at each waypoint. Estimate ETA per waypoint using avg speed, query forecast for that timestamp and location. Display wind speed, wind chill, and rain radar in the trip detail panel. | ~1 week |
| 12 | **Adaptive Power Management** | Implement an adaptive GPS sampling algorithm: high frequency (`1 s`) at low speed or cornering, low frequency (`5–10 s`) on straights. Reduces battery drain during live tracking. | ~1 week |

---

## Tier 3 — High Effort (months)

*These features introduce significant architectural complexity, require backend infrastructure, or depend on APIs with major limitations in a browser PWA context.*

| # | Feature | Technical Implementation | Effort |
|:--|:--------|:------------------------|:-------|
| 13 | **Offline Map Tile Caching (IndexedDB)** | Service workers cannot intercept Google Maps tile requests (cross-origin, no CORS headers). Requires migrating the map engine from Google Maps to **Mapbox GL JS** or **MapLibre GL** (both support offline tile packs via `addSourceType` + IndexedDB). This is a full map engine swap — the largest single refactor in the roadmap. | ~1 month |
| 14 | **Curvy / Scenic Routing Engine** | Replace Google Maps `DirectionsService` (DRIVING mode only) with **GraphHopper** or **Kurviger API**. Both offer "windingness" parameters. Requires a new `RoutingService` abstraction layer, a UI toggle (fastest vs. curviest), and re-testing all existing trip rendering logic against the new API response format. | ~1 month |
| 15 | **Real-time Group Tracking** | Requires a persistent backend (WebSocket server or Firebase Realtime Database). Browser PWAs cannot push location data without user-granted background geolocation. Architecture: session creation (QR/link), WebSocket channel per session, server-side fan-out to group members, marker updates via `google.maps.Marker.setPosition()`. Privacy and data retention policies are also required. | ~1–2 months |
| 16 | **Lean Angle & G-Force Logging** | `DeviceOrientationEvent` and `DeviceMotionEvent` require HTTPS and user permission. Critically: **iOS Safari throttles `DeviceMotionEvent` to 60 Hz and requires explicit user gesture approval.** Lean angle derivation from phone orientation is inherently inaccurate without a dedicated mount. Data volume at 1 Hz for a 2-hour ride = ~7 200 records. Needs IndexedDB storage and a post-ride analysis renderer. | ~2 months |
| 17 | **Speeding Refutation Tool** | Continuous GPS speed logging vs. speed limit data. Speed limit data is **not available in any free API** at sufficient granularity — Google Maps Roads API charges per request; OSM `maxspeed` tags are incomplete. Legal admissibility of PWA-generated logs is jurisdiction-dependent and untested. Requires robust background geolocation (see crash detection constraints below). | ~2 months |
| 18 | **Maintenance Garage — Parts Lifecycle Tracking** | Full CRUD UI for tracking individual component replacements (chain, tires, brake pads) with install date and odometer. Requires persistent local storage (IndexedDB) or a user account + backend. Sync across devices needs auth. Builds on Tier 1 basic alerts but requires a full data model and edit UI. | ~2 months |

---

## Tier 4 — Extremely Hard / Near-Impossible in a PWA (6+ months or infeasible)

*These features push against hard browser platform constraints. They may require a native app wrapper (Capacitor/Tauri) or may be fundamentally unreliable in a web context.*

| # | Feature | Technical Implementation | Blockers & Why It's Hard |
|:--|:--------|:------------------------|:--------------------------|
| 19 | **Background GPS Tracking (screen off)** | Required by crash detection, speeding refutation, and group tracking. **Hard blocker:** iOS Safari **terminates all JS execution** when the screen locks, with no exceptions for PWAs. Android Chrome allows it conditionally with `background-sync` + a persistent `Wake Lock`, but battery management kills it within minutes on most OEM skins (Samsung, Xiaomi). A native wrapper (Capacitor) is the only reliable cross-platform solution. | iOS PWA platform limitation — no workaround without native code |
| 20 | **Web-based Crash Detection** | Depends on background sensor access (blocked on iOS, unreliable on Android — see above). Even with perfect sensor data, distinguishing a crash from road vibration, speed bumps, or dropping the phone requires a trained ML model, not a simple threshold. False positives triggering an SOS SMS are a serious safety and legal liability. The 60-second cancellation window is a UX pattern from Apple Watch — replicating its reliability in a browser is not currently feasible. | Background execution + sensor accuracy + false positive liability |
| 21 | **SOS SMS Dispatch from Browser** | `navigator.share` can share text but cannot send SMS programmatically. Dispatching an SMS requires either: (a) a `tel:` + `sms:` URI scheme (opens the native SMS app — user must manually send), or (b) a backend with Twilio/AWS SNS integration. A fully automated SOS — with no user interaction, sent while the rider is incapacitated — **cannot be implemented as a PWA**. | Browser security model prohibits autonomous SMS |
| 22 | **Bluetooth Headset Integration (Sena/Cardo)** | The Web Bluetooth API has **no support in iOS Safari** (as of 2026, blocked by Apple policy). Android Chrome supports it, but Sena and Cardo use proprietary BLE GATT profiles that are not publicly documented. Web Audio API can generate audio cues, but routing them to a Bluetooth headset as the exclusive audio output requires OS-level control not available in a browser. | iOS Web Bluetooth blocked by Apple; proprietary BLE profiles |
| 23 | **Offline Map Tiles on iOS as PWA** | Even after migrating to Mapbox/MapLibre (Tier 3), iOS limits PWA storage to **~50 MB** total (`Cache API` + `IndexedDB` combined) before aggressive eviction. A single offline region at moderate zoom covers hundreds of MB. This makes meaningful offline tile caching impossible on iOS without a native app wrapper. | iOS PWA storage quota — hard platform limit |

---

## Technical Constraints & Guardrails

These apply across all tiers and should inform every implementation decision.

1. **API Key Security:** The Google Maps API key is currently hardcoded in `main.js`. Before any public deployment, move it to a server-side proxy or introduce a build step (Vite + `.env`) to inject it at build time. It is currently exposed in the public repository.
2. **Background Operation:** GPS logging, crash detection, and group tracking all require background execution. This is **unreliable or impossible** in a PWA on iOS. Document this limitation clearly before committing engineering time to Tier 4 features.
3. **Privacy & Compliance:** Live location sharing (group tracking) and crash history must be encrypted in transit (HTTPS/WSS), stored with user consent, and comply with GDPR deletion requests. This is a non-trivial legal surface area — factor it into any backend design.
4. **Power Management:** Sensor polling and continuous GPS are battery-intensive. Adaptive sampling (Tier 2, #12) should be implemented before any Tier 3+ sensor feature ships.
5. **Map Engine Dependency:** Several Tier 3+ features (offline tiles, curvy routing) require migrating away from Google Maps. This is a foundational decision that should be made early — retrofitting it later becomes exponentially more expensive as the codebase grows.
