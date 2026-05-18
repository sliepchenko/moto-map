# **Gemini Research Plan — "Nice to Have" Features for Moto Map**

## **1\. Top Wishes (Ranked by Community Demand)**

The following features were identified as the most frequently requested "nice to have" additions across Reddit, forums, and app reviews.

| Feature Name | Description | Example Rider Quote | Sources |
| :---- | :---- | :---- | :---- |
| **Route Locking (No Reroute)** | Disable the algorithm's ability to automatically "optimize" or change the route to a faster alternative once the ride begins. | "Google... instead of letting me take \[my chosen\] route, you're going to change me... unless I click a button that I cannot click because my phone is in my pocket, I'm wearing gloves, and \- oh yeah \- I'm RIDING A MOTORCYCLE???" | 1 |
| **Curvy/Thrilling Routing** | Algorithms that prioritize twists, bends, and "scenic beauty" over speed or distance. | "The ability to get curviest route when planning rides is enough for me. When I first downloaded the app, it could not do curvy routing, and I emailed the author with this feature request." |  |
| **Offline Map Support** | The ability to download maps for use in areas without cellular data, particularly national forests. | "40% of my state (Idaho) is national forest... probably 55-60% of the state has no cell service. Being able to download and use offline maps is a literal lifesaver." | 3 |
| **Weather/Radar Overlays** | Real-time weather radar and wind direction overlays directly on the map. | "Weather at every stop, timed to your arrival. Live radar overlay — see precipitation moving along your route in real time." |  |
| **Dynamic Fuel HUD** | Specifically showing the *next* 3 or 5 gas stations *along the route* (not just nearby in any direction). | "POI on route should be shown for selected POI like gas station... it should be possible to set how many you want to see (f.e. Next 3 gas stations)." | 5 |
| **Waypoint Auto-Skip** | Automatically advancing to the next waypoint if the rider passes close enough to the current one. | "Choose from Scenic guiding you back to the original route, letting you find your own way, skip waypoints automatically or manual." | 6 |
| **Round Trip Generator** | Input a desired mileage or time and have the app generate a "loop" route starting and ending at home. | "Set how long you want a ride to be and then the app creates your route. Super handy\!" |  |
| **Road Surface Filters** | Differentiating between asphalt, gravel, and dirt/unpaved roads. | "I'd like a way to prioritize dirt roads and forest roads for adventure rides... Super Thrilling includes... dirt and gravel paths." |  |
| **Custom Waypoint Naming** | Preserving custom names for stops (e.g., "Lunch Spot" vs "Waypoint 14") during GPX export. | "Clicking on each single waypoint, naming it saving it... it's very time consuming and forgotten anyway by kurviger on a re-import." | 7 |
| **Telemetry Recording** | Logging lean angle, G-forces, and altitude for post-ride review. | "With the paid version you can record altitude, g forces, lean angle, top and average speed... you get an overview of how much you lean in each turn." | 9 |
| **Pack/Group Tracking** | Seeing the real-time location of friends in your riding group on the same map. | "The app will alert you if someone in the pack falls behind or asks for a break, so it's easy to make sure you all aren't separated." | 11 |
| **3D Trip Replay** | Visualizing recorded rides in a 3D animated environment for social sharing. | "reWind... lets you check out your previous trips on an interactive 3D map... Makes the BEST ride recaps." | 12 |

## **2\. Categorized Feature Wishes**

### **Road Type & Curvature**

* **Multi-Level Curviness:** Offering degrees of curvature (e.g., Fast Curvy vs. Extreme Curvy).
* **Avoid Unpaved/Gravel:** A toggle specifically to avoid dirt for road bikes, or seek it for dual-sport bikes.
* **Beauty Routing:** Using AI/ML to find roads with the most scenic views or landscapes.6

### **POI & Information**

* **Biker-Friendly Stops:** Community-rated cafes, secure parking, and hotels that specifically cater to riders.
* **Next Gas Station HUD:** A dedicated display of the distance to the next fuel stop on the current path.5
* **Specialized Mechanics:** Map layers for shops that offer motorcycle-specific services like tire balancing or puncture repair.

### **Road Conditions & Safety**

* **Hazard Reporting:** Real-time alerts for potholes, roadwork, gravel washouts, and slippery steel-grate bridges.
* **Wind Speed Alerts:** Warnings for high-wind areas or gusts that could affect lighter bikes.
* **Speed/Safety Camera Alerts:** Proximity warnings for fixed and mobile speed enforcement.

### **Trip Recording & Replay**

* **Heatmaps:** Overlaying all previous rides to identify "virgin" roads the rider hasn't explored yet.13
* **Ride Summary Reports:** Post-ride stats including maximum lean angle, average speed, and elevation gains.9
* **Multi-Day Statistics:** Merging individual ride logs into a single multi-day tour statistic.14

### **Planning UX**

* **Web-to-Mobile Sync:** Instant syncing of routes created on a desktop browser to the phone for navigation.
* **Waypoint Preservation:** Ensuring that exported GPX files contain all shaping points so the GPS doesn't recalculate.3
* **Drag-and-Drop Routing:** The ability to "rubber-band" or drag a route line to snap it to a preferred road.

### **Social & Community**

* **Discover Routes:** A community marketplace or searchable area where users can find and rate loop routes shared by others.14
* **Real-Time Pack Alerts:** Haptic or visual alerts if a member of your riding group falls more than a mile behind.11

### **Navigation On-Bike**

* **Glove-Friendly UI:** High-contrast buttons and the removal of "confirmation pop-ups" that require glove-touch interaction while moving.1
* **Recenter Timer Toggle:** Preventing the map from snapping back to your current position for 20-30 seconds after you manually pan or zoom.17
* **Dynamic Auto-Zoom:** Zooming out at high speeds for awareness and in at low speeds for complex turns.

## **3\. Gaps in Google Maps for Motorcyclists**

Riders consistently report several "deal-breakers" with Google Maps that justify using dedicated apps:

* **The "Faster Route" Forced Reroute:** Google often defaults back to highways even if a rider specifically chose a scenic backroad, forcing dangerous mid-ride phone interaction to "cancel" the reroute.1
* **Map Clutter:** Google prioritizes business names (advertising) over secondary road names, which are more useful for visual navigation.13
* **Waypoint Limits:** Google's limit of 10 stops is insufficient for long-distance tourers who use many "shaping points" to force a specific path.
* **Lack of "Motorcycle Mode":** No native setting to prefer winding roads or avoid major motorways entirely.2

## **4\. Features Already in Moto Map (Done)**

* Road-following trip polylines
* Route planner with multi-stop, avoid highways/tolls/ferries
* Alternative routes (A→B)
* Fuel station finder along route
* Nearby POIs: cafes, restaurants, hotels, viewpoints, campsites, museums, parking
* Export to Google Maps
* Download route as JSON

## **5\. Raw Notes & Observations**

* **Vibration Dampening Awareness:** Riders are highly sensitive to "killing" phone cameras via vibration. Many suggest using a "cheap, used nav phone" tethered to a primary device to save their main phone's camera.20
* **The Paper Map Paradox:** A niche of riders prefers a "minimalist" HUD that stays black except when a turn is coming, as they prefer to memorize route segments rather than follow a screen constantly.
* **Data Privacy:** A vocal minority is "100% not interested" in tracking top speeds or acceleration due to fears of data being subpoenaed by police for moving violations.13
* **Integration Priority:** Android Auto and CarPlay support are considered the "holy grail" for modern riders to move navigation off the handlebar and onto the bike's dashboard.14