const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;
const BASE    = 'https://api.openrouteservice.org';

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
    throw new Error(err?.error?.message || `ORS error ${res.status}`);
  }
  return res.json();
}

// Finds the nearest safe zone using travel time (not straight-line distance)
export async function findNearestSafeZone(lat, lon, zones) {
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

  const validIdxs = durations
    .map((d, i) => ({ d, i }))
    .filter(x => x.d !== null);

  if (validIdxs.length === 0) {
    throw new Error('No reachable safe zones found. Try a different location.');
  }

  const best = validIdxs.reduce((a, b) => (a.d < b.d ? a : b));

  return {
    zone:        zones[best.i],
    durationSec: Math.round(durations[best.i]),
    distanceM:   Math.round(distances[best.i]),
  };
}

// Returns the top N nearest safe zones sorted by drive time
export async function findTopNSafeZones(lat, lon, zones, n = 4) {
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

  return durations
    .map((d, i) => ({ zone: zones[i], durationSec: d, distanceM: distances[i] }))
    .filter(x => x.durationSec !== null)
    .sort((a, b) => a.durationSec - b.durationSec)
    .slice(0, n)
    .map(r => ({
      zone:        r.zone,
      durationSec: Math.round(r.durationSec),
      distanceM:   Math.round(r.distanceM),
    }));
}

// Gets the full driving route with turn-by-turn instructions
export async function getRoute(fromLat, fromLon, toLat, toLon) {

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
    // ORS returns [lon, lat], Leaflet needs [lat, lon]
    coords:      feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distanceM:   Math.round(summary.distance),
    durationSec: Math.round(summary.duration),
    steps: steps.map(s => ({
      instruction: s.instruction,
      distanceM:   Math.round(s.distance),
      durationSec: Math.round(s.duration),
      type:        s.type,
      name:        s.name || '',
    })),
  };
}
