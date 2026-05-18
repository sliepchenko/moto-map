# Gemini Research Plan — "Nice to Have" Features for Moto Map

## Context

**Moto Map** is a static, browser-only motorcycle trip tracker and route planner built on the
Google Maps JavaScript API. It lets riders:

- View and replay their recorded trips as road-following polylines on the map
- Plan new routes with multiple waypoints, avoid-options (highways/tolls/ferries), and alternative
  route selection
- Find fuel stations, cafes, viewpoints, hotels, campsites, and other POIs along a planned route
- Export routes to Google Maps or download them as JSON

The goal of this research is to find **real, rider-voiced wishes** — things motorcyclists say they
want from navigation apps, map tools, or riding companions — that could realistically be
implemented in this app. The output feeds directly into the project ROADMAP.

---

## Research Objective

Discover **"nice to have" features** that motorcyclists genuinely want in a map/navigation tool,
sourced from their own words on forums, Reddit, YouTube comments, app store reviews, and
community sites. Do **not** invent features — only report what riders themselves have asked for.

---

## Research Questions

For each source visited, try to answer:

1. What navigation or map feature do riders wish existed or worked better?
2. What information do riders want to see on a map that is missing or hard to find?
3. What does Google Maps / Waze / other apps do wrong or incompletely for motorcycle use?
4. What do riders do manually (e.g. export routes, mark points) that they wish was automated?
5. What safety or road-condition information would riders like to have?
6. What do riders want when trip planning from a computer (not on-bike navigation)?

---

## Sources to Search

### Reddit — highest priority

Search these subreddits. For each, search the queries listed below.

| Subreddit | URL |
|---|---|
| r/motorcycles | https://www.reddit.com/r/motorcycles/ |
| r/motocamping | https://www.reddit.com/r/motocamping/ |
| r/AdventureRiding | https://www.reddit.com/r/AdventureRiding/ |
| r/Tourers | https://www.reddit.com/r/Tourers/ |
| r/motogp (skip racing content, focus on road/touring comments) | https://www.reddit.com/r/motogp/ |
| r/SuggestAMotorcycle | https://www.reddit.com/r/SuggestAMotorcycle/ |

**Search queries to run on Reddit (use site:reddit.com in Google or Reddit search):**

- `"google maps" motorcycle wish feature`
- `"google maps" motorcycle missing`
- `"route planning" motorcycle app wish`
- `motorcycle navigation app "would be nice"`
- `motorcycle maps "I wish"`
- `motorcycle touring app feature request`
- `"two wheeler" google maps problem`
- `motorcycle route planner annoying`
- `best motorcycle route app missing feature`

---

### Motorcycle Forums

Visit and search these forums for feature wishes, complaints about maps/navigation, and
route planning discussions:

| Forum | URL | What to look for |
|---|---|---|
| ADVrider | https://advrider.com/f/ | "GPS", "maps", "navigation", "route planning" threads |
| Horizons Unlimited | https://www.horizonsunlimited.com/hubb/ | Trip planning tools, GPS wishes |
| MotorbikeWriter | https://motorbikewriter.com | Reader comments on navigation articles |
| Total Motorcycle Forums | https://www.totalmotorcycle.com/forums/ | Tech / gadgets section |
| The Bike Shed | https://www.thebikeshow.net | UK-focused, touring riders |
| HUBB (Horizons Unlimited Bulletin Board) | https://www.horizonsunlimited.com/hubb/tech/ | GPS/navigation tech |

**Search queries for forums:**

- `google maps motorcycle`
- `route planning app wish`
- `GPS feature request`
- `navigation app missing`
- `maps motorcycle curvature twisty roads`

---

### App Store Reviews

Search Google Play Store and Apple App Store reviews for these apps. Look specifically for
1–3 star reviews that describe a missing feature, and 4–5 star reviews that still mention
"wish it had" or "only thing missing":

| App | Why relevant |
|---|---|
| Google Maps | Riders complain about lack of motorcycle-specific features |
| Waze | Popular with riders; community feature requests |
| Kurviger | Motorcycle-specific route planner — reviews reveal what riders want beyond it |
| Rever | Motorcycle trip logger and social app |
| REVER | Same as above — check both variants |
| Calimoto | German motorcycle navigation app with "curvy roads" mode |
| Scenic | iOS motorcycle navigation — good review section |
| TomTom Rider | Dedicated moto GPS app |
| Sygic | Has a motorcycle profile |

**Search approach:**
- Google: `site:play.google.com "motorcycle" "I wish"` or `"would be nice"`
- Google: `"kurviger" review "missing" OR "wish" OR "feature request"`
- Read through curated review summary sites like AppFollow, AppBot if accessible

---

### YouTube Comments

Search YouTube for videos reviewing motorcycle navigation apps and read comments:

**Search queries:**
- `best motorcycle navigation app 2024 review`
- `google maps motorcycle problems`
- `kurviger vs rever vs scenic review`
- `motorcycle route planner tutorial`

Look for comments asking for features, expressing frustration, or suggesting improvements.
Channels to prioritize: Fortnine, RevZilla, ADVRider on YouTube, Bret Tkacs, Itchy Boots.

---

### Motorcycle Travel & Tech Blogs

| Site | URL |
|---|---|
| Webbikeworld | https://www.webbikeworld.com |
| MotorcycleRoads.com | https://www.motorcycleroads.com |
| Motorcycle.com | https://www.motorcycle.com |
| Ultimate Motorcycling | https://ultimatemotorcycling.com |
| RideApart | https://www.rideapart.com |
| Visordown | https://www.visordown.com |

Search for articles about GPS, route planning apps, or navigation tools. Read reader comments.

---

### Specialized Mapping & Routing Communities

| Community / Tool | URL | Notes |
|---|---|---|
| Kurviger community | https://community.kurviger.de | Feature requests section — goldmine of rider wishes |
| Rever community | https://community.rever.ai | Rider feature requests |
| Furkot forum/blog | https://www.furkot.com/blog | Multi-day trip planner used by tourers |
| Calimoto community | https://community.calimoto.com | Curvy road riders |

---

## What to Collect Per Feature Wish

For each wish or request found, record:

| Field | Description |
|---|---|
| Feature wish | Clear one-sentence description of what the rider wants |
| Source | URL or name of forum/app/site |
| Rider quote | Direct quote (or close paraphrase) if possible |
| Frequency | How many different people mentioned this (approx.) |
| Category | Navigation / POI / Trip Recording / Road Conditions / Safety / Planning UX |

---

## Output Format Requested

Return a structured Markdown document with these sections:

### 1. Top Wishes (10–15 items)
The most frequently requested features, ranked by how often they appear across sources.
Each item: feature name, one-line description, example rider quote, sources found in.

### 2. Categorized Feature Wishes

Group all found wishes into these categories:

- **Road Type & Curvature** — twisty roads, avoid motorways, prefer scenic routes
- **POI & Information** — what riders want to find on the map (fuel range, campsites, mechanics)
- **Road Conditions & Safety** — surface quality, weather overlays, speed cameras
- **Trip Recording & Replay** — logging, exports, stats
- **Planning UX** — how the planning interface could improve
- **Social & Community** — sharing routes, community-recommended roads
- **Navigation On-Bike** — HUD, voice, offline, Bluetooth helmet integration
- **Other** — anything that doesn't fit above

### 3. Gaps in Google Maps for Motorcyclists
Specific complaints about Google Maps that riders repeat most often.

### 4. Features Already in Moto Map (skip or note as "done")
Cross-reference against this list of already-implemented features so duplicates are skipped:
- Road-following trip polylines
- Route planner with multi-stop, avoid highways/tolls/ferries
- Alternative routes (A→B)
- Fuel station finder along route
- Nearby POIs: cafes, restaurants, hotels, viewpoints, campsites, museums, nature, parking
- Export to Google Maps
- Download route as JSON

### 5. Raw Notes
All other interesting observations that don't fit a specific feature but may inspire ideas.

---

## Constraints & Quality Rules

- Only include features that riders themselves have asked for — no invented ideas
- Prefer direct quotes over paraphrases where possible
- Note the source URL for every feature wish
- If a wish is too vague ("better routing"), try to find a more specific version from comments
- Ignore racing / track-day requests — Moto Map targets road touring and leisure riding
- Ignore hardware-specific requests (Bluetooth intercom specs, physical GPS mounts)
- Focus on software / data / UX features that a web map app could realistically provide
- Minimum 3 independent sources before calling a wish "frequently requested"

---

## Deliverable

A single Markdown document (`NICE_TO_HAVE_RESEARCH.md`) saved to the project root, containing
all sections above. Minimum 20 distinct feature wishes. Aim for 30–50.
