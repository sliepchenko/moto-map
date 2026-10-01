#!/usr/bin/env node
/**
 * generate-og-images.js
 *
 * Generates a 1200×630 PNG Open Graph preview image for every trip in
 * data/trips/index.json, plus a default.png for the site homepage.
 *
 * Output: assets/og/<tripId>.png  and  assets/og/default.png
 *
 * Usage (from the project root):
 *   node scripts/generate-og-images.js
 *
 * Requirements:
 *   npm install --save-dev puppeteer
 *   (or: npx --yes puppeteer@latest ... but installing once is faster)
 *
 * The script renders a self-contained HTML string in a headless browser
 * viewport and screenshots it. No server needed — everything is inline.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const ROOT        = resolve(__dirname, '..');
const OUT_DIR     = resolve(ROOT, 'assets', 'og');
const TRIP_DIR    = resolve(ROOT, 'trip');   // per-trip static HTML snapshots

// Load moto.png as base64 data URI so it renders inline in Puppeteer HTML
const motoPngPath = resolve(ROOT, 'assets', 'moto.png');
const motoPngB64  = readFileSync(motoPngPath).toString('base64');
const motoPngDataUri = `data:image/png;base64,${motoPngB64}`;

mkdirSync(OUT_DIR,  { recursive: true });
mkdirSync(TRIP_DIR, { recursive: true });


// ── helpers ───────────────────────────────────────────────────────────────────

/** Haversine distance in km between two {lat, lng} points. */
function haversineKm(a, b) {
  const R     = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat  = toRad(b.lat - a.lat);
  const dLng  = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Same priority logic as GeoUtils.estimateTripDistance(). */
function distanceKm(trip) {
  if (trip._roadDistanceKm > 0) return trip._roadDistanceKm;
  if (trip.roadDistanceKm  > 0) return trip.roadDistanceKm;
  const pts = trip.waypoints;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += haversineKm(pts[i], pts[i + 1]);
  return total;
}

/** Same logic as GeoUtils.estimateTripDuration(). */
function formatDuration(trip, avgSpeedKph = 50) {
  const km       = distanceKm(trip);
  const totalMin = Math.round((km / avgSpeedKph) * 60);
  const h   = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min} min`;
  if (min === 0) return `${h} h`;
  return `${h} h ${min} min`;
}

/** en-GB date like "5 Jul 2026". */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── HTML template ─────────────────────────────────────────────────────────────

/**
 * Renders a 1200×630 OG image as an HTML string.
 *
 * Design:
 *  - Dark background matching the app sidebar (#121814 at full opacity)
 *  - Green accent line at the top (same #22c55e as the app)
 *  - Motorcycle SVG icon (top-right)
 *  - Large trip title
 *  - Three stat chips: distance · est. time · date
 *
 * Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
 * (identical to the app's font-family in style.css)
 */
function buildHtml({ title, distanceFmt, durationFmt, dateFmt, isSiteDefault, motoPngUri }) {
  const safeTitle    = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const titleSize    = safeTitle.length > 40 ? '78px' : safeTitle.length > 28 ? '90px' : '102px';

  const stats = isSiteDefault ? '' : `
    <div class="chips">
      <div class="chip">
        <span class="chip-label">Distance</span>
        <span class="chip-value">${distanceFmt}</span>
      </div>
      <div class="chip">
        <span class="chip-label">Est. time</span>
        <span class="chip-value">${durationFmt}</span>
      </div>
      <div class="chip">
        <span class="chip-label">Date</span>
        <span class="chip-value">${dateFmt}</span>
      </div>
    </div>
  `;

  const subtitle = isSiteDefault
    ? '<p class="subtitle">Browse my motorcycle routes and POIs on an interactive map.</p>'
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0e1410;
    color: #f3f4f6;
  }
  .card {
    width: 1200px;
    height: 630px;
    /* Layer 1: dark background */
    background: #121814;
    position: relative;
    display: flex;
    flex-direction: column;
    /* Text/content pinned to the bottom */
    justify-content: flex-end;
    padding: 56px 150px;
    overflow: hidden;
  }
  /* top accent bar — sits above moto image (z-index via stacking context) */
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 6px;
    background: linear-gradient(90deg, #22c55e 0%, #16a34a 60%, #15803d 100%);
    z-index: 3;
  }
  /* faint radial glow bottom-right — above moto, below text */
  .card::after {
    content: '';
    position: absolute;
    bottom: -60px; right: -60px;
    width: 520px; height: 520px;
    border-radius: 50%;
    background: radial-gradient(circle at center, rgba(34,197,94,0.07) 0%, transparent 70%);
    z-index: 2;
  }
  /* Layer 2: moto image — sits directly on the background, below all text */
  .moto-icon {
    position: absolute;
    /* Span most of the card height, anchored bottom-right */
    bottom: 0;
    right: 40px;
    width: 560px;
    height: auto;
    opacity: 0.60;
    z-index: 1;
    /* White glow */
    filter: drop-shadow(0 0 18px rgba(255,255,255,0.55))
            drop-shadow(0 0 48px rgba(255,255,255,0.25));
  }
  /* Layer 3+: all text content is in .content — above the moto image */
  .content {
    position: relative;
    z-index: 3;
  }
  .tag {
    font-size: 19.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #22c55e;
    margin-bottom: 20px;
  }
  h1 {
    font-size: ${titleSize};
    font-weight: 700;
    line-height: 1.1;
    color: #f9fafb;
    margin-bottom: 36px;
    max-width: 900px;
    word-break: break-word;
  }
  .subtitle {
    font-size: 39px;
    color: #9ca3af;
    margin-bottom: 36px;
    max-width: 900px;
    line-height: 1.4;
  }
  .chips {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  .chip {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 12px;
    padding: 14px 24px;
    min-width: 150px;
  }
  .chip-label {
    font-size: 19.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .chip-value {
    font-size: 39px;
    font-weight: 700;
    color: #f3f4f6;
  }
</style>
</head>
<body>
<div class="card">
  <!-- Layer 1: background (handled by .card CSS) -->

  <!-- Layer 2: moto PNG — behind all content -->
  <img class="moto-icon" src="${motoPngUri}" alt="" />

  <!-- Layer 3: main text content — pinned to bottom -->
  <div class="content">
    <div class="tag">Moto Map · Ride</div>
    <h1>${safeTitle}</h1>
    ${subtitle}
    ${stats}
  </div>
</div>
</body>
</html>`;
}

// ── Static HTML snapshot template ─────────────────────────────────────────────

/**
 * Builds a tiny static HTML page for a specific trip.
 *
 * This page is placed at  trip/<tripId>/index.html  and serves two purposes:
 *
 *  1. **Crawlers (Telegram, Teams, Discord, Twitter/X)** — they fetch the URL
 *     without executing JavaScript.  They read the <meta> OG tags baked into
 *     this file and render the rich preview card with the correct image, title
 *     and description.
 *
 *  2. **Real users** — the page immediately redirects them via a JS
 *     window.location.replace() to the real app at  /?trip=<tripId>  so they
 *     land on the live interactive map.  NOTE: <meta http-equiv="refresh"> is
 *     intentionally NOT used — Telegram's crawler follows instant (delay=0)
 *     meta-refresh redirects and would land on the SPA root instead of reading
 *     the OG tags baked into this snapshot.  The JS redirect is sufficient for
 *     all real browsers; non-JS users see the fallback link in <body>.
 *
 * The `og:image` URL must be **absolute** — relative paths are not accepted by
 * most crawlers.  Callers should pass the full origin
 * (e.g. "https://moto-map.app") via the `baseUrl` parameter.
 *
 * @param {{
 *   tripId:       string,
 *   title:        string,
 *   description:  string,   // e.g. "158.4 km · 3 h 10 min · 16 Aug 2026"
 *   baseUrl:      string,   // origin without trailing slash, read from a config or env
 * }} opts
 */
function buildTripSnapshotHtml({ tripId, title, description, baseUrl }) {
  const safeTitle    = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDesc     = description.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Canonical URL for this snapshot page — must match the path crawlers actually fetch.
  // Telegram, WhatsApp and similar crawlers re-fetch og:url to verify OG tags; if og:url
  // points to the SPA root (/?trip=…) instead of this static snapshot path, they fall back
  // to the generic site-level preview (default.png + "Moto Map" title) instead of the
  // trip-specific one.  Keep og:url == the snapshot's own URL.
  const canonicalUrl = `${baseUrl}/trip/${tripId}/`;
  // Redirect target for real users — the live interactive app
  const appUrl       = `${baseUrl}/?trip=${tripId}`;
  const imageUrl     = `${baseUrl}/assets/og/${tripId}.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} — Moto Map</title>

  <!-- Open Graph -->
  <meta property="og:type"         content="website" />
  <meta property="og:site_name"    content="Moto Map" />
  <meta property="og:url"          content="${canonicalUrl}" />
  <meta property="og:title"        content="${safeTitle}" />
  <meta property="og:description"  content="${safeDesc}" />
  <meta property="og:image"        content="${imageUrl}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image"       content="${imageUrl}" />

  <!-- Standard description -->
  <meta name="description" content="${safeDesc}" />
</head>
<body>
  <p>Redirecting to <a href="${appUrl}">Moto Map — ${safeTitle}</a>…</p>
  <script>window.location.replace("${appUrl}");</script>
</body>
</html>`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Base URL for absolute og:image links.
  // Set SITE_URL env var on your CI/CD, or update the fallback below.
  // Example: SITE_URL=https://moto-map.app npm run generate-og
  const baseUrl = (process.env.SITE_URL ?? 'https://sliepchenko.github.io/moto-map')
    .replace(/\/$/, '');

  const manifest  = JSON.parse(readFileSync(resolve(ROOT, 'data', 'trips', 'index.json'), 'utf8'));
  const tripFiles = manifest.trips ?? [];

  const trips = tripFiles.flatMap(relPath => {
    const abs = resolve(ROOT, 'data', relPath);
    try {
      return [JSON.parse(readFileSync(abs, 'utf8'))];
    } catch {
      console.warn(`  ⚠  skipping missing file: ${relPath}`);
      return [];
    }
  });

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });

  // Generate per-trip images + static HTML snapshots
  for (const trip of trips) {
    const km          = distanceKm(trip);
    const distanceFmt = km.toFixed(1) + ' km';
    const durationFmt = formatDuration(trip);
    const dateFmt     = formatDate(trip.date);
    const description = `${distanceFmt} · ${durationFmt} · ${dateFmt}`;

    // 1. OG image PNG
    const html = buildHtml({
      title:       trip.title ?? trip.id,
      distanceFmt,
      durationFmt,
      dateFmt,
      isSiteDefault: false,
      motoPngUri:  motoPngDataUri,
    });

    await page.setContent(html, { waitUntil: 'load' });
    const outPath = resolve(OUT_DIR, `${trip.id}.png`);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`  ✓  assets/og/${trip.id}.png`);

    // 2. Static HTML snapshot (for crawlers that don't execute JS)
    const snapshotDir  = resolve(TRIP_DIR, trip.id);
    mkdirSync(snapshotDir, { recursive: true });
    const snapshotHtml = buildTripSnapshotHtml({
      tripId:      trip.id,
      title:       trip.title ?? trip.id,
      description,
      baseUrl,
    });
    writeFileSync(resolve(snapshotDir, 'index.html'), snapshotHtml, 'utf8');
    console.log(`  ✓  trip/${trip.id}/index.html`);
  }

  // Generate site default image
  const defaultHtml = buildHtml({
    title:         'Moto Map',
    isSiteDefault: true,
    motoPngUri:    motoPngDataUri,
  });
  await page.setContent(defaultHtml, { waitUntil: 'load' });
  const defaultPath = resolve(OUT_DIR, 'default.png');
  await page.screenshot({ path: defaultPath, type: 'png' });
  console.log('  ✓  assets/og/default.png');

  await browser.close();
  console.log(`\nDone — ${trips.length + 1} OG images + ${trips.length} HTML snapshots`);
  console.log(`Share trip links as:  ${baseUrl}/trip/<tripId>/`);
}

main().catch(err => { console.error(err); process.exit(1); });
