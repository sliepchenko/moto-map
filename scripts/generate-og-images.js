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

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const OUT_DIR   = resolve(ROOT, 'assets', 'og');

mkdirSync(OUT_DIR, { recursive: true });

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
 *  - "Moto Map" branding bottom-right
 *
 * Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
 * (identical to the app's font-family in style.css)
 */
function buildHtml({ title, distanceFmt, durationFmt, dateFmt, isSiteDefault }) {
  const safeTitle    = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const titleSize    = safeTitle.length > 40 ? '52px' : safeTitle.length > 28 ? '60px' : '68px';

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
    ? '<p class="subtitle">Browse your motorcycle routes and POIs on an interactive map.</p>'
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
    background: #121814;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 64px 80px;
    overflow: hidden;
  }
  /* top accent bar */
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 6px;
    background: linear-gradient(90deg, #22c55e 0%, #16a34a 60%, #15803d 100%);
  }
  /* faint road stripe pattern bottom-right */
  .card::after {
    content: '';
    position: absolute;
    bottom: -60px; right: -60px;
    width: 520px; height: 520px;
    border-radius: 50%;
    background: radial-gradient(circle at center, rgba(34,197,94,0.07) 0%, transparent 70%);
  }
  .tag {
    font-size: 13px;
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
    font-size: 26px;
    color: #9ca3af;
    margin-bottom: 36px;
    max-width: 800px;
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
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .chip-value {
    font-size: 26px;
    font-weight: 700;
    color: #f3f4f6;
  }
  .branding {
    position: absolute;
    bottom: 36px;
    right: 80px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #4b5563;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .branding-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #22c55e;
    opacity: 0.7;
  }
  /* moto icon top-right */
  .moto-icon {
    position: absolute;
    top: 48px;
    right: 80px;
    opacity: 0.18;
  }
</style>
</head>
<body>
<div class="card">
  <!-- Motorcycle silhouette SVG -->
  <svg class="moto-icon" width="180" height="100" viewBox="0 0 200 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- rear wheel -->
    <circle cx="42" cy="82" r="26" stroke="#22c55e" stroke-width="8" fill="none"/>
    <!-- front wheel -->
    <circle cx="158" cy="82" r="26" stroke="#22c55e" stroke-width="8" fill="none"/>
    <!-- body frame -->
    <path d="M42 82 L72 38 L118 34 L158 82" stroke="#22c55e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- seat / tank -->
    <path d="M72 38 L100 28 L130 32 L118 34" stroke="#22c55e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- handlebar -->
    <path d="M148 38 L158 30 M148 38 L158 46" stroke="#22c55e" stroke-width="5" stroke-linecap="round" fill="none"/>
    <!-- fork -->
    <path d="M148 38 L158 82" stroke="#22c55e" stroke-width="5" stroke-linecap="round" fill="none"/>
    <!-- exhaust -->
    <path d="M72 65 L42 72" stroke="#22c55e" stroke-width="4" stroke-linecap="round" fill="none"/>
    <!-- rider helmet suggestion -->
    <circle cx="108" cy="22" r="10" stroke="#22c55e" stroke-width="5" fill="none"/>
  </svg>

  <div class="tag">Moto Map · Ride</div>
  <h1>${safeTitle}</h1>
  ${subtitle}
  ${stats}

  <div class="branding">
    <div class="branding-dot"></div>
    moto-map
  </div>
</div>
</body>
</html>`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
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

  // Generate per-trip images
  for (const trip of trips) {
    const km       = distanceKm(trip);
    const html     = buildHtml({
      title:       trip.title ?? trip.id,
      distanceFmt: km.toFixed(1) + ' km',
      durationFmt: formatDuration(trip),
      dateFmt:     formatDate(trip.date),
      isSiteDefault: false,
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const outPath = resolve(OUT_DIR, `${trip.id}.png`);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`  ✓  ${trip.id}.png`);
  }

  // Generate site default image
  const defaultHtml = buildHtml({
    title:         'Moto Map',
    isSiteDefault: true,
  });
  await page.setContent(defaultHtml, { waitUntil: 'domcontentloaded' });
  const defaultPath = resolve(OUT_DIR, 'default.png');
  await page.screenshot({ path: defaultPath, type: 'png' });
  console.log('  ✓  default.png');

  await browser.close();
  console.log(`\nDone — ${trips.length + 1} images written to assets/og/`);
}

main().catch(err => { console.error(err); process.exit(1); });
