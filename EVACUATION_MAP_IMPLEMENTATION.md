# Evacuation Route Map — Full Implementation Prompt
# For: Final Year Project — Flood & Landslide Prediction System
# Tool: Antigravity Vibe Coding

---

## PROJECT CONTEXT

This is a final year engineering project that predicts flood and landslide risk
using machine learning. The stack is:
- Frontend: React (Vite) — currently has a prediction form and result display
- Backend: FastAPI (Python) — returns flood/landslide prediction with probability score
- The FastAPI prediction response looks like this:
  {
    "flood_probability": 0.87,
    "landslide_probability": 0.43,
    "risk_level": "HIGH",
    "lat": 26.14,
    "lon": 91.73,
    "district": "Kamrup"
  }

---

## FEATURE TO IMPLEMENT

Add an interactive evacuation route map that:
1. Shows a Leaflet.js map of India with all pre-defined safe zones (hospitals,
   relief camps, cyclone shelters) marked as coloured pins
2. When a flood prediction result comes back with risk > 70%, automatically
   finds the nearest safe zone using the ORS Matrix API and draws the fastest
   driving route using the ORS Directions API
3. Shows a sidebar with: distance, estimated drive time, destination name,
   and collapsible turn-by-turn directions
4. User can also manually click any point on the map to get the evacuation route

---

## API DETAILS

### OpenRouteService (ORS) — the ONLY external API needed

- Base URL: https://api.openrouteservice.org
- API Key: Add to .env file as VITE_ORS_API_KEY=YOUR_KEY_HERE
  (User must paste their own key from openrouteservice.org dashboard)
- Free tier: 2,000 requests/day, no credit card needed
- The key goes in the Authorization header (no "Bearer" prefix)

### Two ORS endpoints used:

ENDPOINT 1 — Matrix API (finds nearest safe zone)
  POST https://api.openrouteservice.org/v2/matrix/driving-car
  Headers: { Authorization: <key>, Content-Type: application/json }
  Body:
  {
    "locations": [[lon, lat], [lon2, lat2], ...],  // index 0 = flood point, rest = safe zones
    "sources": [0],
    "destinations": [1, 2, 3, ...],                // indices of safe zones
    "metrics": ["duration", "distance"]
  }
  Response: { "durations": [[sec1, sec2, ...]], "distances": [[m1, m2, ...]] }
  Logic: pick index with minimum duration (= nearest safe zone)

ENDPOINT 2 — Directions API (gets the actual route)
  POST https://api.openrouteservice.org/v2/directions/driving-car/geojson
  Headers: { Authorization: <key>, Content-Type: application/json }
  Body:
  {
    "coordinates": [[fromLon, fromLat], [toLon, toLat]],
    "instructions": true,
    "language": "en",
    "units": "m"
  }
  Response: GeoJSON FeatureCollection
    - feature.geometry.coordinates = array of [lon, lat] pairs (convert to [lat, lon] for Leaflet)
    - feature.properties.summary = { distance, duration }
    - feature.properties.segments[0].steps = array of turn-by-turn steps
      Each step: { instruction, distance, duration, type, name }
      type values: 0=left, 1=slight-left, 2=sharp-left, 3=right, 4=slight-right,
                   5=sharp-right, 6=straight, 10=arrive, 11=depart

### Map tiles — OpenStreetMap (completely free, no key needed)
  URL template: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png

---

## PACKAGES TO INSTALL

  npm install leaflet react-leaflet

No other packages needed. ORS is called with plain fetch().

---

## FILE STRUCTURE TO CREATE

Create these files inside the existing React src/ directory:

  src/
  ├── services/
  │   └── orsService.js
  ├── data/
  │   └── safeZones.js
  └── components/
      └── EvacuationMap.jsx

---

## FILE 1 — src/services/orsService.js

Complete implementation:

```javascript
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
    [lon, lat],                         // index 0: the flood risk point
    ...zones.map(z => [z.lon, z.lat]),  // index 1..N: all safe zones
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
```

---

## FILE 2 — src/data/safeZones.js

Pre-loaded hospitals and relief camps across India's flood-prone states:

```javascript
export const SAFE_ZONES = [
  // Uttarakhand
  { id: 1,  name: 'AIIMS Rishikesh',                    lat: 30.0869, lon: 78.2676, type: 'hospital',    state: 'Uttarakhand' },
  { id: 2,  name: 'Doon Medical College Dehradun',       lat: 30.3243, lon: 78.0322, type: 'hospital',    state: 'Uttarakhand' },
  { id: 3,  name: 'NDRF Base Camp Dehradun',             lat: 30.3165, lon: 78.0322, type: 'relief_camp', state: 'Uttarakhand' },

  // Assam
  { id: 4,  name: 'Gauhati Medical College',             lat: 26.1445, lon: 91.7362, type: 'hospital',    state: 'Assam' },
  { id: 5,  name: 'NDRF 9th Battalion Guwahati',         lat: 26.1158, lon: 91.7086, type: 'relief_camp', state: 'Assam' },
  { id: 6,  name: 'Silchar Medical College',             lat: 24.8333, lon: 92.7789, type: 'hospital',    state: 'Assam' },

  // Kerala
  { id: 7,  name: 'Govt Medical College Thrissur',       lat: 10.5276, lon: 76.2144, type: 'hospital',    state: 'Kerala' },
  { id: 8,  name: 'High Ground Camp Munnar',             lat: 10.0889, lon: 77.0595, type: 'relief_camp', state: 'Kerala' },
  { id: 9,  name: 'DDMA Relief Camp Ernakulam',          lat: 10.0159, lon: 76.3419, type: 'relief_camp', state: 'Kerala' },

  // Bihar
  { id: 10, name: 'PMCH Patna',                          lat: 25.6093, lon: 85.1376, type: 'hospital',    state: 'Bihar' },
  { id: 11, name: 'Relief Camp Muzaffarpur',              lat: 26.1197, lon: 85.3910, type: 'relief_camp', state: 'Bihar' },
  { id: 12, name: 'SNMMCH Darbhanga',                    lat: 26.1542, lon: 85.8918, type: 'hospital',    state: 'Bihar' },

  // Odisha
  { id: 13, name: 'SCBMCH Cuttack',                      lat: 20.4625, lon: 85.8830, type: 'hospital',    state: 'Odisha' },
  { id: 14, name: 'Cyclone Shelter Puri',                 lat: 19.8135, lon: 85.8312, type: 'shelter',     state: 'Odisha' },
  { id: 15, name: 'NDRF 2nd Battalion Mundali',           lat: 20.4048, lon: 85.7759, type: 'relief_camp', state: 'Odisha' },

  // West Bengal
  { id: 16, name: 'NRS Medical College Kolkata',          lat: 22.5726, lon: 88.3639, type: 'hospital',    state: 'West Bengal' },
  { id: 17, name: 'Relief Camp Howrah',                   lat: 22.5958, lon: 88.2636, type: 'relief_camp', state: 'West Bengal' },

  // Himachal Pradesh
  { id: 18, name: 'IGMC Shimla',                          lat: 31.1048, lon: 77.1734, type: 'hospital',    state: 'Himachal Pradesh' },
  { id: 19, name: 'Emergency Camp Manali',                lat: 32.2432, lon: 77.1892, type: 'relief_camp', state: 'Himachal Pradesh' },
];

// Colours for map pin icons per type
export const ZONE_COLORS = {
  hospital:    '#1D9E75',
  relief_camp: '#378ADD',
  shelter:     '#EF9F27',
};
```

---

## FILE 3 — src/components/EvacuationMap.jsx

Complete component. Note: `import 'leaflet/dist/leaflet.css'` is REQUIRED.

```jsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, Polyline,
  Popup, Tooltip, useMapEvents, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { findNearestSafeZone, getRoute } from '../services/orsService';
import { SAFE_ZONES, ZONE_COLORS } from '../data/safeZones';

// Fix Leaflet's broken default icons in Vite/webpack builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Inject pulse animation CSS once
if (!document.getElementById('evac-map-style')) {
  const s = document.createElement('style');
  s.id = 'evac-map-style';
  s.textContent = `
    @keyframes evac-pulse {
      0%   { transform: scale(1); opacity: 0.3; }
      70%  { transform: scale(2); opacity: 0; }
      100% { transform: scale(2); opacity: 0; }
    }
  `;
  document.head.appendChild(s);
}

// Creates custom teardrop-shaped div icons
function makeIcon(bgColor, emoji, pulse = false) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:44px">
        ${pulse ? `
          <div style="
            position:absolute;top:-4px;left:-4px;
            width:44px;height:44px;border-radius:50%;
            background:${bgColor};opacity:0.25;
            animation:evac-pulse 1.8s ease-out infinite
          "></div>` : ''}
        <div style="
          width:36px;height:36px;
          border-radius:50% 50% 50% 0;
          background:${bgColor};
          border:2px solid #fff;
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.28)
        ">
          <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span>
        </div>
      </div>`,
    iconSize:    [36, 44],
    iconAnchor:  [18, 44],
    popupAnchor: [0, -44],
  });
}

const ICONS = {
  flood:       makeIcon('#E24B4A', '🌊', true),
  hospital:    makeIcon(ZONE_COLORS.hospital,    '🏥'),
  relief_camp: makeIcon(ZONE_COLORS.relief_camp, '⛺'),
  shelter:     makeIcon(ZONE_COLORS.shelter,     '🏠'),
  nearest:     makeIcon('#534AB7',               '✓'),
};

// Step type number → direction emoji
const STEP_ARROWS = {
  0: '⬅️', 1: '↩️', 2: '⬅️', 3: '➡️', 4: '↪️', 5: '➡️',
  6: '⬆️', 10: '🏁', 11: '⬆️',
};

// Helper: metres → "12.4 km" or "800 m"
const fmtDist = m =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;

// Helper: seconds → "1 hr 20 min" or "45 min"
const fmtTime = s => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
};

// Sub-component: captures map click events
function ClickHandler({ onClick }) {
  useMapEvents({ click: ({ latlng }) => onClick(latlng) });
  return null;
}

// Sub-component: fits map view to show full route
function BoundsFitter({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [60, 60] });
  }, [bounds, map]);
  return null;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
//
// Props:
//   floodRiskPoint: { lat, lng } | null
//     - If provided, automatically calculates evacuation route for that point
//     - If null, user must click the map to choose a point
//     - Pass this from your FastAPI prediction result when flood_probability > 0.7
//
// Usage in your prediction results page:
//   <EvacuationMap floodRiskPoint={{ lat: prediction.lat, lng: prediction.lon }} />
//
export default function EvacuationMap({ floodRiskPoint = null }) {
  const [floodPoint,  setFloodPoint]  = useState(null);
  const [nearestZone, setNearestZone] = useState(null);
  const [route,       setRoute]       = useState(null);
  const [status,      setStatus]      = useState('idle'); // idle | loading | done | error
  const [errorMsg,    setErrorMsg]    = useState('');
  const [routeBounds, setRouteBounds] = useState(null);
  const [stepsOpen,   setStepsOpen]   = useState(false);

  // Auto-run when a flood prediction point is passed from parent component
  useEffect(() => {
    if (floodRiskPoint) runEvacuation(floodRiskPoint);
  }, [floodRiskPoint]);

  const runEvacuation = useCallback(async ({ lat, lng }) => {
    setFloodPoint({ lat, lng });
    setRoute(null);
    setNearestZone(null);
    setErrorMsg('');
    setStatus('loading');
    setStepsOpen(false);

    try {
      const { zone } = await findNearestSafeZone(lat, lng, SAFE_ZONES);
      setNearestZone(zone);

      const routeData = await getRoute(lat, lng, zone.lat, zone.lon);
      setRoute(routeData);
      setRouteBounds(L.latLngBounds(routeData.coords));
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }, []);

  // ── Styles (inline so no separate CSS file needed) ──────────────────────────
  const card = {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '10px',
  };

  const statGrid = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '10px',
  };

  const statBox = {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center',
  };

  const successBanner = {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '10px 12px',
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '620px', gap: '12px', fontFamily: 'inherit' }}>

      {/* Left: Map */}
      <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <MapContainer center={[22.5, 82.5]} zoom={5} style={{ height: '100%', width: '100%' }}>

          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          />

          <ClickHandler onClick={runEvacuation} />
          {routeBounds && <BoundsFitter bounds={routeBounds} />}

          {/* All safe zone markers */}
          {SAFE_ZONES.map(z => (
            <Marker
              key={z.id}
              position={[z.lat, z.lon]}
              icon={nearestZone?.id === z.id ? ICONS.nearest : (ICONS[z.type] ?? ICONS.shelter)}
              zIndexOffset={nearestZone?.id === z.id ? 1000 : 0}
            >
              <Tooltip direction="top" offset={[0, -44]}>
                {z.name}
              </Tooltip>
              <Popup>
                <strong>{z.name}</strong><br />
                <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                  {z.type.replace('_', ' ')} · {z.state}
                </span>
                {nearestZone?.id === z.id && (
                  <><br /><span style={{ color: '#059669', fontWeight: 600, fontSize: '12px' }}>
                    ✓ Selected evacuation destination
                  </span></>
                )}
              </Popup>
            </Marker>
          ))}

          {/* Flood risk point marker */}
          {floodPoint && (
            <Marker position={[floodPoint.lat, floodPoint.lng]} icon={ICONS.flood}>
              <Popup>
                <strong>Flood risk location</strong><br />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {floodPoint.lat.toFixed(5)}, {floodPoint.lng.toFixed(5)}
                </span>
              </Popup>
            </Marker>
          )}

          {/* Evacuation route — white shadow + blue dashed line */}
          {route && (
            <>
              <Polyline
                positions={route.coords}
                pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.6 }}
              />
              <Polyline
                positions={route.coords}
                pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.9, dashArray: '10 5' }}
              />
            </>
          )}

        </MapContainer>
      </div>

      {/* Right: Info Sidebar */}
      <div style={{ width: '270px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>

        {/* IDLE STATE */}
        {status === 'idle' && (
          <div style={card}>
            <p style={{ margin: '0 0 6px', fontWeight: 500, fontSize: '14px' }}>
              🗺️ Click a location on the map
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
              The system will find the nearest hospital or relief camp and show the fastest driving route.
            </p>

            {/* Legend */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Legend
              </p>
              {[
                ['🌊', '#E24B4A', 'Flood risk location'],
                ['🏥', ZONE_COLORS.hospital,    'Hospital'],
                ['⛺', ZONE_COLORS.relief_camp,  'Relief camp'],
                ['🏠', ZONE_COLORS.shelter,      'Cyclone shelter'],
              ].map(([ic, col, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: col, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '11px',
                  }}>
                    {ic}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {status === 'loading' && (
          <div style={{ ...card, textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>
              Finding nearest safe zone…
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              Calling ORS Matrix + Directions API
            </p>
          </div>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <div style={{
            ...card,
            background: '#fef2f2',
            border: '1px solid #fecaca',
          }}>
            <p style={{ margin: '0 0 4px', fontWeight: 500, fontSize: '13px', color: '#991b1b' }}>
              ⚠️ Could not find route
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', lineHeight: 1.5 }}>
              {errorMsg}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#dc2626' }}>
              Check VITE_ORS_API_KEY in .env and restart dev server.
            </p>
          </div>
        )}

        {/* DONE STATE — Route summary */}
        {status === 'done' && route && nearestZone && (
          <>
            {/* Stats card */}
            <div style={card}>
              <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: '14px' }}>
                Evacuation route
              </p>

              {/* Distance + Time */}
              <div style={statGrid}>
                <div style={statBox}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                    {fmtDist(route.distanceM)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>Distance</p>
                </div>
                <div style={statBox}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                    {fmtTime(route.durationSec)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>Drive time</p>
                </div>
              </div>

              {/* Nearest safe zone */}
              <div style={successBanner}>
                <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#166534' }}>
                  Nearest safe zone
                </p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#14532d' }}>
                  {nearestZone.name}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#166534', textTransform: 'capitalize' }}>
                  {nearestZone.type.replace('_', ' ')} · {nearestZone.state}
                </p>
              </div>

              {/* Recalculate button */}
              <button
                onClick={() => runEvacuation(floodPoint)}
                style={{
                  marginTop: '10px', width: '100%', padding: '7px',
                  fontSize: '12px', border: '1px solid #e5e7eb',
                  borderRadius: '8px', background: 'transparent',
                  cursor: 'pointer', color: '#6b7280',
                }}
              >
                🔄 Recalculate
              </button>
            </div>

            {/* Turn-by-turn accordion */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setStepsOpen(o => !o)}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', fontSize: '13px', fontWeight: 500,
                  color: '#111827',
                }}
              >
                <span>Turn-by-turn ({route.steps.length} steps)</span>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                  {stepsOpen ? '▲ hide' : '▼ show'}
                </span>
              </button>

              {stepsOpen && (
                <div style={{ borderTop: '1px solid #f3f4f6', maxHeight: '300px', overflowY: 'auto' }}>
                  {route.steps.map((step, i) => (
                    <div key={i} style={{
                      padding: '9px 14px',
                      borderBottom: '1px solid #f9fafb',
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                    }}>
                      <span style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: '#eff6ff', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, flexShrink: 0,
                      }}>
                        {STEP_ARROWS[step.type] ?? '➡️'}
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#374151' }}>
                          {step.instruction}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                          {fmtDist(step.distanceM)} · {fmtTime(step.durationSec)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Arrival */}
                  <div style={{
                    padding: '10px 14px',
                    background: '#f0fdf4',
                    fontSize: '12px', fontWeight: 600, color: '#14532d',
                  }}>
                    🏁 Arrive at {nearestZone.name}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
```

---

## HOW TO USE IN EXISTING PREDICTION PAGE

In your prediction result component (wherever you show flood_probability), add:

```jsx
// At the top of the file:
import EvacuationMap from './components/EvacuationMap';

// Inside your component, after showing the prediction result:
{prediction && (
  <div style={{ marginTop: '24px' }}>
    <h3>Evacuation Route</h3>
    <EvacuationMap
      floodRiskPoint={
        prediction.flood_probability > 0.7
          ? { lat: prediction.lat, lng: prediction.lon }
          : null
      }
    />
  </div>
)}
```

If your FastAPI uses different field names, adjust accordingly:
- "latitude" instead of "lat" → use prediction.latitude
- "longitude" instead of "lon" → use prediction.longitude
- "flood_prob" instead of "flood_probability" → use prediction.flood_prob

---

## .ENV FILE (create in project root, next to package.json)

```
VITE_ORS_API_KEY=PASTE_YOUR_NEW_KEY_HERE
```

IMPORTANT: Never commit .env to GitHub. Make sure .env is in .gitignore.

---

## COMMON ERRORS AND FIXES

ERROR: White/blank map
FIX: Make sure `import 'leaflet/dist/leaflet.css'` is at the top of EvacuationMap.jsx

ERROR: 401 Unauthorized
FIX: Check .env file has correct key. RESTART dev server after editing .env.

ERROR: Broken/missing map pin icons
FIX: The `delete L.Icon.Default.prototype._getIconUrl` block in the file fixes this.

ERROR: "No reachable safe zones"
FIX: Clicked point may be in ocean or remote area. Click closer to a road.

ERROR: Cannot find module 'leaflet'
FIX: Run `npm install leaflet react-leaflet` and restart dev server.

---

## SUMMARY CHECKLIST FOR ANTIGRAVITY

[ ] Run: npm install leaflet react-leaflet
[ ] Create .env with VITE_ORS_API_KEY=<user's key>
[ ] Create src/services/orsService.js with code above
[ ] Create src/data/safeZones.js with code above
[ ] Create src/components/EvacuationMap.jsx with code above
[ ] Import and use <EvacuationMap> in prediction result page
[ ] Restart dev server
[ ] Click a point on the map in India to test

---
END OF IMPLEMENTATION PROMPT
