const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;
const BASE    = 'https://api.openrouteservice.org';

// ORS Matrix API allows max 50 locations (1 source + 49 destinations)
const ORS_MATRIX_MAX = 49;

async function orsPost(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: ORS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `ORS API error (${res.status})`);
  }
  return res.json();
}

// ── Haversine straight-line distance (km) ─────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Pre-filters the full zone list to the N nearest by straight-line distance,
 * so we never exceed ORS Matrix API's 50-location limit.
 */
function preFilterZones(lat, lon, zones, maxCount = ORS_MATRIX_MAX) {
  return zones
    .map(z => ({ ...z, _slKm: haversineKm(lat, lon, z.lat, z.lon) }))
    .sort((a, b) => a._slKm - b._slKm)
    .slice(0, maxCount);
}

/**
 * Fallback: returns top-N zones ranked purely by straight-line distance.
 * Used when ORS Matrix can't find drivable routes (remote/mountainous areas).
 */
function fallbackByDistance(lat, lon, allZones, n = 8) {
  return allZones
    .map(z => ({
      zone: z,
      distanceM: Math.round(haversineKm(lat, lon, z.lat, z.lon) * 1000),
      durationSec: null, // unknown — no road data
      isFallback: true,
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, n);
}

// ── findTopNSafeZones ──────────────────────────────────────────────────────────
// Returns top-N nearest safe zones sorted by drive time.
// Falls back to straight-line distance if ORS Matrix fails or returns all nulls.
export async function findTopNSafeZones(lat, lon, allZones, n = 8) {
  const zones = preFilterZones(lat, lon, allZones);

  try {
    const locations = [
      [lon, lat],
      ...zones.map(z => [z.lon, z.lat]),
    ];

    const data = await orsPost('/v2/matrix/driving-car', {
      locations,
      sources:      [0],
      destinations: zones.map((_, i) => i + 1),
      metrics:      ['duration', 'distance'],
    });

    const durations = data.durations[0];
    const distances = data.distances[0];

    const valid = durations
      .map((d, i) => ({ zone: zones[i], durationSec: d, distanceM: distances[i] }))
      .filter(x => x.durationSec !== null && x.distanceM !== null);

    if (valid.length === 0) {
      // ORS returned all nulls (remote area) — fall back to straight-line
      console.warn('[ORS] Matrix returned all nulls — using straight-line fallback');
      return fallbackByDistance(lat, lon, allZones, n);
    }

    return valid
      .sort((a, b) => a.durationSec - b.durationSec)
      .slice(0, n)
      .map(r => ({
        zone:        r.zone,
        durationSec: Math.round(r.durationSec),
        distanceM:   Math.round(r.distanceM),
        isFallback:  false,
      }));

  } catch (err) {
    // ORS Matrix call itself failed — fall back to straight-line
    console.warn('[ORS] Matrix API failed:', err.message, '— using straight-line fallback');
    return fallbackByDistance(lat, lon, allZones, n);
  }
}

// ── getRoute ──────────────────────────────────────────────────────────────────
// Gets the full driving route with turn-by-turn instructions.
// Falls back to a straight-line "as-the-crow-flies" path if ORS Directions fails.
export async function getRoute(fromLat, fromLon, toLat, toLon) {
  try {
    const data = await orsPost('/v2/directions/driving-car/geojson', {
      coordinates:  [[fromLon, fromLat], [toLon, toLat]],
      instructions: true,
      language:     'en',
      units:        'm',
    });

    const feature = data.features[0];
    const summary = feature.properties.summary;
    const steps   = feature.properties.segments.flatMap(seg => seg.steps);

    return {
      coords:      feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      distanceM:   Math.round(summary.distance),
      durationSec: Math.round(summary.duration),
      isFallback:  false,
      steps: steps.map(s => ({
        instruction: s.instruction,
        distanceM:   Math.round(s.distance),
        durationSec: Math.round(s.duration),
        type:        s.type,
        name:        s.name || '',
      })),
    };

  } catch (err) {
    // ORS Directions failed (e.g. remote/off-road location) — draw straight line
    console.warn('[ORS] Directions failed:', err.message, '— using straight-line path');
    const distM = Math.round(haversineKm(fromLat, fromLon, toLat, toLon) * 1000);
    // Rough walking estimate: 5 km/h
    const durationSec = Math.round((distM / 1000 / 5) * 3600);
    return {
      coords:      [[fromLat, fromLon], [toLat, toLon]],
      distanceM:   distM,
      durationSec: durationSec,
      isFallback:  true,
      steps: [{
        instruction: `Head directly towards ${toLat.toFixed(4)}°N, ${toLon.toFixed(4)}°E`,
        distanceM:   distM,
        durationSec: durationSec,
        type:        6,
        name:        '',
      }],
    };
  }
}
