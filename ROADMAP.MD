# Technical Roadmap: Moto Map Enhancements

## Phase 1: Moto-Friendly Places (POIs)
**Goal:** Display specific points of interest (hotels, gas stations, cafes) with custom markers.

### 1.1 Data Schema Update
Update the individual trip JSON files to include a `poi` array.
```json
"poi": [
  {
    "type": "fuel | hotel | cafe | mechanic",
    "lat": 48.1234,
    "lng": 24.5678,
    "title": "WOG Gas Station",
    "description": "Last high-quality fuel before the mountain pass."
  }
]
```

### 1.2 Logic: Marker Management
* **Icon Mapping:** Create a constant in `mapController.js` that maps `type` to specific SVG/PNG icons stored in `assets/icons/`.
* **Rendering:** In the `addTrip` function, iterate through the `poi` array.
* **Interaction:** Use `google.maps.InfoWindow` to show the `title` and `description` when a POI marker is clicked.

### 1.3 First place
Add this place as a first stop
Ul. Stjepana Fabijančića Jape 116, 10410, Velika Gorica

---

## Phase 2: Deep Linking & State Management
**Goal:** Allow users to share specific trips or POIs via a unique URL (e.g., `?trip=carpathian-2024`).

### 2.1 URL Parsing on Load
Modify `main.js` to check for URL parameters during initialization.
```javascript
const urlParams = new URLSearchParams(window.location.search);
const tripId = urlParams.get('trip');

if (tripId) {
  // Logic to trigger trip selection automatically
  app.selectTrip(tripId);
}
```

### 2.2 Updating State without Refresh
When a user selects a trip from the sidebar, update the browser's address bar using the **History API**.
* **Implementation:** Inside the trip selection event handler, call:
  `history.pushState({ id: tripId }, '', `?trip=${tripId}`);`
* **Back Button Support:** Add a `popstate` event listener to `window` so the map updates if the user clicks the browser's "Back" button.

---

## Phase 3: GPX Export Utility
**Goal:** Enable users to download the route as a `.gpx` file for use in GPS navigators (Garmin, OsmAnd, etc.).

### 3.1 GPX XML Generator
Create a utility function in `src/utils.js` that converts the `route` array into a standard GPX XML string.
* **Structure:** Wrap coordinates in `<trk><trkseg><trkpt>` tags.
* **Metadata:** Include the trip title and date in the `<metadata>` section of the XML.

### 3.2 Client-Side Download Trigger
Since there is no backend, generate the file on-the-fly in the browser.
1.  **Blob Creation:** Convert the XML string into a `Blob` with `type: 'application/gpx+xml'`.
2.  **Virtual Link:** Create a temporary `<a>` element, set its `href` to `URL.createObjectURL(blob)`, and trigger a `.click()`.
3.  **UI:** Add a "Download GPX" button to the `tripPanel.js` that appears only when a trip is selected.

---

## Technical Priority Matrix

| Feature | Difficulty | File Impact | Priority |
| :--- | :--- | :--- | :--- |
| **Deep Linking** | Low | `main.js` | **High** (Essential for sharing) |
| **Moto-Friendly POIs** | Medium | `data/*.json`, `mapController.js` | **Medium** (Content richness) |
| **GPX Export** | Medium | `utils.js`, `tripPanel.js` | **Low** (Utility for others) |

---

### Next Steps
Would you like me to provide the specific **JavaScript code for the GPX generator** function, or should we focus on the **CSS layout for the new POI icons** in the sidebar?