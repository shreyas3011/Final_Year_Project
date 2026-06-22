import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Polyline,
  Popup, Tooltip, useMapEvents, useMap,
} from 'react-leaflet';
import L from 'leaflet';
// leaflet.css already imported in App.jsx
import { findTopNSafeZones, getRoute } from '../services/orsService';
import { SAFE_ZONES, ZONE_COLORS } from '../data/safeZones';

// ── Icon setup ────────────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Inject CSS once ───────────────────────────────────────────────────────────
if (!document.getElementById('evac-map-style')) {
  const s = document.createElement('style');
  s.id = 'evac-map-style';
  s.textContent = `
    @keyframes evac-pulse {
      0%   { transform: scale(1); opacity: 0.4; }
      70%  { transform: scale(2.4); opacity: 0; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes evac-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes evac-slide-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes evac-gps-ring {
      0%  { transform: scale(0.8); opacity: 1; }
      100%{ transform: scale(2.2); opacity: 0; }
    }
    .evac-sidebar-card { animation: evac-slide-in 0.3s ease forwards; }
    .evac-spinner {
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid rgba(99,102,241,0.2);
      border-top-color: #6366f1;
      animation: evac-spin 0.8s linear infinite;
      margin: 0 auto 10px;
    }
    .evac-sm-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(99,102,241,0.25);
      border-top-color: #818cf8;
      animation: evac-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    .evac-step-row:hover { background: rgba(99,102,241,0.06); border-radius: 6px; }
    .evac-preset-chip {
      padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
      border: 1px solid rgba(99,102,241,0.3); background: rgba(99,102,241,0.1);
      color: #a5b4fc; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
      font-family: inherit;
    }
    .evac-preset-chip:hover { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #c7d2fe; }
    .evac-loc-input {
      flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(148,163,184,0.2);
      border-radius: 8px; padding: 8px 10px; color: #e2e8f0; font-size: 12px;
      font-family: inherit; outline: none; transition: border 0.2s;
    }
    .evac-loc-input::placeholder { color: #475569; }
    .evac-loc-input:focus { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.06); }
    .evac-gps-btn {
      width: 100%; padding: 10px 12px; border-radius: 10px; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      font-size: 13px; font-weight: 700; font-family: inherit;
      background: linear-gradient(135deg,#6366f1,#8b5cf6);
      color: #fff; box-shadow: 0 4px 14px rgba(99,102,241,0.4);
      transition: opacity 0.2s, transform 0.15s;
    }
    .evac-gps-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
    .evac-gps-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .evac-search-btn {
      padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(99,102,241,0.4);
      background: rgba(99,102,241,0.15); color: #a5b4fc; cursor: pointer;
      font-size: 12px; font-weight: 600; font-family: inherit;
      transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
    }
    .evac-search-btn:hover:not(:disabled) { background: rgba(99,102,241,0.25); }
    .evac-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `;
  document.head.appendChild(s);
}

// ── Map pin icon factory ──────────────────────────────────────────────────────
function makeIcon(bgColor, emoji, pulse = false) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:44px">
        ${pulse ? `
          <div style="
            position:absolute;top:-4px;left:-4px;
            width:44px;height:44px;border-radius:50%;
            background:${bgColor};opacity:0.3;
            animation:evac-pulse 1.8s ease-out infinite
          "></div>` : ''}
        <div style="
          width:36px;height:36px;
          border-radius:50% 50% 50% 0;
          background:linear-gradient(135deg,${bgColor},${bgColor}cc);
          border:2.5px solid #fff;
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 3px 12px rgba(0,0,0,0.4)
        ">
          <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span>
        </div>
      </div>`,
    iconSize:    [36, 44],
    iconAnchor:  [18, 44],
    popupAnchor: [0, -46],
  });
}

const ICONS = {
  user:        makeIcon('#f59e0b', '📍', true),   // user's location (amber pulse)
  hospital:    makeIcon(ZONE_COLORS.hospital,    '🏥'),
  relief_camp: makeIcon(ZONE_COLORS.relief_camp, '⛺'),
  shelter:     makeIcon(ZONE_COLORS.shelter,     '🏠'),
  nearest:     makeIcon('#7c3aed',               '✅', true),
};

// ── Turn direction arrows ─────────────────────────────────────────────────────
const STEP_ARROWS = { 0:'⬅️',1:'↩️',2:'↰',3:'➡️',4:'↪️',5:'↱',6:'⬆️',10:'🏁',11:'⬆️' };

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtDist = m => {
  if (m == null || isNaN(m)) return '—';
  const km = m / 1000;
  if (km >= 100) return `${Math.round(km)} km`;
  if (km >= 10)  return `${km.toFixed(1)} km`;
  if (km >= 1)   return `${km.toFixed(2)} km`;
  return `${km.toFixed(3)} km`;  // sub-km: show as 0.xxx km
};
const fmtTime = s => {
  if (s == null || isNaN(s)) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
};

// ── Quick preset flood-prone locations ────────────────────────────────────────
const PRESETS = [
  { label: 'Guwahati',   lat: 26.1445, lng: 91.7362 },
  { label: 'Kedarnath',  lat: 30.7352, lng: 79.0669 },
  { label: 'Patna',      lat: 25.5941, lng: 85.1376 },
  { label: 'Mumbai',     lat: 19.0760, lng: 72.8777 },
  { label: 'Kerala',     lat: 10.5276, lng: 76.2144 },
  { label: 'Bhubaneswar',lat: 20.2961, lng: 85.8245 },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function ClickHandler({ onClick }) {
  useMapEvents({ click: ({ latlng }) => onClick(latlng) });
  return null;
}

function BoundsFitter({ bounds }) {
  const map = useMap();
  useEffect(() => { if (bounds) map.fitBounds(bounds, { padding: [60, 60] }); }, [bounds, map]);
  return null;
}

// Smoothly fly map to a given lat/lng when it changes
function MapFlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], 11, { duration: 1.5 });
  }, [position, map]);
  return null;
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function EvacuationMap({ floodRiskPoint = null }) {
  // Route state
  const [userPoint,   setUserPoint]   = useState(null);
  const [nearestZone, setNearestZone] = useState(null);
  const [nearbyZones, setNearbyZones] = useState([]);
  const [route,       setRoute]       = useState(null);
  const [isFallback,  setIsFallback]  = useState(false); // true when ORS fails & we use straight-line
  const [status,      setStatus]      = useState('idle');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [routeBounds, setRouteBounds] = useState(null);
  const [stepsOpen,   setStepsOpen]   = useState(false);
  const [mapFlyTarget,setMapFlyTarget]= useState(null);

  // Location input state
  const [searchQuery,   setSearchQuery]   = useState('');
  const [gpsLoading,    setGpsLoading]    = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [locError,      setLocError]      = useState('');
  const searchInputRef = useRef(null);

  const runEvacuation = useCallback(async ({ lat, lng, label }) => {
    setUserPoint({ lat, lng, label: label || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E` });
    setMapFlyTarget({ lat, lng });
    setRoute(null);
    setNearestZone(null);
    setNearbyZones([]);
    setIsFallback(false);
    setErrorMsg('');
    setStatus('loading');
    setStepsOpen(false);
    setLocError('');
    try {
      const topZones = await findTopNSafeZones(lat, lng, SAFE_ZONES, 8);
      if (!topZones || topZones.length === 0) throw new Error('No safe zones found near this location.');

      // Skip zones where the destination IS essentially the user's location (< 100m away)
      const usable = topZones.filter(r => r.distanceM == null || r.distanceM > 100);
      const candidates = usable.length > 0 ? usable : topZones;

      setNearbyZones(topZones);
      const nearest = candidates[0];
      setNearestZone(nearest.zone);
      const routeData = await getRoute(lat, lng, nearest.zone.lat, nearest.zone.lon);
      setRoute(routeData);
      setIsFallback(!!(nearest.isFallback || routeData.isFallback));
      setRouteBounds(L.latLngBounds(routeData.coords));
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }, []);

  // ── GPS handler ────────────────────────────────────────────────────────────
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        runEvacuation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: '📡 Your GPS Location',
        });
      },
      (err) => {
        setGpsLoading(false);
        setLocError(`GPS error: ${err.message}. Please allow location access in your browser.`);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }, [runEvacuation]);

  // ── Place name search (Nominatim) ──────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setLocError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'TerraGuard-AI/1.0' } }
      );
      const data = await res.json();
      if (!data || data.length === 0) {
        setLocError('Location not found. Try a different name or spelling.');
        setSearchLoading(false);
        return;
      }
      const { lat, lon, display_name } = data[0];
      const shortName = display_name.split(',').slice(0, 2).join(', ');
      setSearchLoading(false);
      runEvacuation({ lat: parseFloat(lat), lng: parseFloat(lon), label: shortName });
    } catch {
      setLocError('Search failed. Check your internet connection.');
      setSearchLoading(false);
    }
  }, [searchQuery, runEvacuation]);

  // ── Auto-run when prediction prop is passed ────────────────────────────────
  useEffect(() => {
    if (floodRiskPoint) runEvacuation({ ...floodRiskPoint, label: '⚠️ Flood Risk Point' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floodRiskPoint]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStatus('idle');
    setUserPoint(null);
    setRoute(null);
    setNearestZone(null);
    setNearbyZones([]);
    setIsFallback(false);
    setRouteBounds(null);
    setSearchQuery('');
    setLocError('');
    setMapFlyTarget(null);
  }, []);

  // ── Design tokens ──────────────────────────────────────────────────────────
  const C = {
    surface:     '#1e293b',
    surfaceAlt:  '#162032',
    border:      'rgba(99,102,241,0.18)',
    borderLight: 'rgba(148,163,184,0.12)',
    accent:      '#6366f1',
    accentGlow:  'rgba(99,102,241,0.22)',
    success:     '#10b981',
    successBg:   'rgba(16,185,129,0.1)',
    danger:      '#ef4444',
    amber:       '#f59e0b',
    text:        '#e2e8f0',
    textMuted:   '#94a3b8',
    textFaint:   '#475569',
  };

  const card = {
    background: C.surface,
    border: `1px solid ${C.borderLight}`,
    borderRadius: '14px',
    padding: '14px',
    color: C.text,
  };

  const isAnyLoading = gpsLoading || searchLoading || status === 'loading';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '660px', gap: '14px', fontFamily: "'Inter', sans-serif" }}>

      {/* ══ LEFT: Map ══ */}
      <div style={{
        flex: 1, borderRadius: '16px', overflow: 'hidden',
        border: `1px solid ${C.border}`,
        boxShadow: `0 0 0 1px ${C.accentGlow}, 0 8px 32px rgba(0,0,0,0.5)`,
        position: 'relative',
      }}>
        {/* Map floating hint */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(8px)',
          border: `1px solid ${C.border}`, borderRadius: '30px',
          padding: '6px 16px', fontSize: '11px', color: C.textMuted,
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {status === 'loading'
            ? '⏳ Calculating fastest route to safe zone…'
            : '🖱️ Use sidebar to set location, or click directly on the map'}
        </div>

        <MapContainer center={[22.5, 82.5]} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Map interactivity */}
          <ClickHandler onClick={(latlng) => runEvacuation({ lat: latlng.lat, lng: latlng.lng })} />
          {routeBounds && <BoundsFitter bounds={routeBounds} />}
          {mapFlyTarget && !routeBounds && <MapFlyTo position={mapFlyTarget} />}

          {/* Nearby zone markers — shown only after user sets location */}
          {nearbyZones.map(({ zone: z, distanceM, durationSec }, idx) => (
            <Marker
              key={z.id}
              position={[z.lat, z.lon]}
              icon={idx === 0 ? ICONS.nearest : (ICONS[z.type] ?? ICONS.shelter)}
              zIndexOffset={idx === 0 ? 1000 : 0}
            >
              <Tooltip direction="top" offset={[0, -44]}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '12px' }}>{z.name}</span>
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '13px', minWidth: '185px' }}>
                  <strong>{z.name}</strong><br />
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                    {z.type.replace('_', ' ')} · {z.state}
                  </span><br />
                  <span style={{ fontSize: '11px', color: '#475569' }}>
                    📏 {fmtDist(distanceM)} · 🕒 {fmtTime(durationSec)}
                  </span>
                  {idx === 0 && (
                    <><br /><span style={{ color: '#10b981', fontWeight: 700, fontSize: '11px' }}>
                      ✅ Your evacuation destination
                    </span></>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* User's location marker */}
          {userPoint && (
            <Marker position={[userPoint.lat, userPoint.lng]} icon={ICONS.user}>
              <Popup>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '13px' }}>
                  <strong>📍 Your Location</strong><br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{userPoint.label}</span><br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {userPoint.lat.toFixed(5)}°N, {userPoint.lng.toFixed(5)}°E
                  </span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Evacuation route polylines — layered for glow effect */}
          {route && route.coords && route.coords.length > 1 && (
            <>
              {/* Outer glow */}
              <Polyline positions={route.coords} pathOptions={{ color: '#6366f1', weight: 18, opacity: 0.08 }} />
              {/* Shadow */}
              <Polyline positions={route.coords} pathOptions={{ color: '#000000', weight: 10, opacity: 0.35 }} />
              {/* Main route line */}
              <Polyline positions={route.coords} pathOptions={{ color: '#6366f1', weight: 6, opacity: 1 }} />
              {/* Animated dashes on top */}
              <Polyline positions={route.coords} pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.9, dashArray: '10 14' }} />
              {/* Bright center highlight */}
              <Polyline positions={route.coords} pathOptions={{ color: '#a5b4fc', weight: 1, opacity: 0.6 }} />
            </>
          )}
        </MapContainer>
      </div>

      {/* ══ RIGHT: Sidebar ══ */}
      <div style={{
        width: '305px', display: 'flex', flexDirection: 'column',
        gap: '10px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px',
      }}>

        {/* ── Header ── */}
        <div style={{
          ...card,
          background: `linear-gradient(135deg,${C.surface},rgba(99,102,241,0.14))`,
          border: `1px solid ${C.border}`, padding: '13px 15px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '10px',
              background: 'linear-gradient(135deg,#6366f1,#818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', boxShadow: '0 4px 12px rgba(99,102,241,0.4)', flexShrink: 0,
            }}>🚨</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>Evacuation Planner</div>
              <div style={{ fontSize: '10px', color: C.textMuted }}>Powered by OpenRouteService API</div>
            </div>
          </div>
        </div>

        {/* ── Location Input Panel (always visible) ── */}
        <div style={{ ...card }} className="evac-sidebar-card">
          <div style={{ fontWeight: 700, fontSize: '12px', color: C.text, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>📍</span> Set Your Location
          </div>

          {/* GPS Button */}
          <button
            className="evac-gps-btn"
            onClick={handleGPS}
            disabled={isAnyLoading}
            style={{ marginBottom: '10px' }}
          >
            {gpsLoading ? (
              <><div className="evac-sm-spinner" style={{ borderTopColor: '#fff' }} /> Acquiring GPS signal…</>
            ) : (
              <><span style={{ fontSize: '16px' }}>🎯</span> Use My Current Location</>
            )}
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '10px',
          }}>
            <div style={{ flex: 1, height: 1, background: C.borderLight }} />
            <span style={{ fontSize: '10px', color: C.textFaint, fontWeight: 600, letterSpacing: '0.06em' }}>OR SEARCH</span>
            <div style={{ flex: 1, height: 1, background: C.borderLight }} />
          </div>

          {/* Search by place name */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <input
              ref={searchInputRef}
              className="evac-loc-input"
              type="text"
              placeholder="e.g. Kedarnath, Guwahati, Patna…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              disabled={isAnyLoading}
            />
            <button
              className="evac-search-btn"
              onClick={handleSearch}
              disabled={isAnyLoading || !searchQuery.trim()}
            >
              {searchLoading ? <div className="evac-sm-spinner" /> : '🔍'}
            </button>
          </div>

          {/* Quick presets */}
          <div style={{ marginBottom: locError ? '10px' : 0 }}>
            <div style={{ fontSize: '10px', color: C.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Quick — Flood-Prone Cities
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  className="evac-preset-chip"
                  onClick={() => {
                    setSearchQuery(p.label);
                    runEvacuation({ lat: p.lat, lng: p.lng, label: p.label });
                  }}
                  disabled={isAnyLoading}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location error */}
          {locError && (
            <div style={{
              marginTop: '8px', padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: '11px', color: '#fca5a5', lineHeight: 1.5,
            }}>
              ⚠️ {locError}
            </div>
          )}
        </div>

        {/* ── IDLE STATE: Legend ── */}
        {status === 'idle' && (
          <div style={{ ...card }} className="evac-sidebar-card">
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '12px', color: C.text }}>
              How it works
            </p>
            <p style={{ margin: '0 0 12px', fontSize: '11px', color: C.textMuted, lineHeight: 1.7 }}>
              Enter your location above (GPS, search, or preset), or click directly on the map.
              The system finds the nearest safe zone by <strong style={{ color: C.text }}>drive time</strong> using ORS Matrix API and draws the fastest route.
            </p>

            {/* Legend */}
            <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: '10px' }}>
              <p style={{ margin: '0 0 7px', fontSize: '9px', fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Map Legend
              </p>
              {[
                ['📍', C.amber,                'Your location'],
                ['🏥', ZONE_COLORS.hospital,    'Hospital'],
                ['⛺', ZONE_COLORS.relief_camp,  'Relief camp'],
                ['🏠', ZONE_COLORS.shelter,      'Cyclone shelter'],
                ['✅', '#7c3aed',               'Nearest safe zone'],
              ].map(([ic, col, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: col + '20', border: `1.5px solid ${col}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0,
                  }}>{ic}</span>
                  <span style={{ fontSize: '11px', color: C.textMuted }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOADING STATE ── */}
        {status === 'loading' && (
          <div style={{ ...card, textAlign: 'center', padding: '28px 16px' }} className="evac-sidebar-card">
            <div className="evac-spinner" />
            <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: C.text }}>
              Finding nearest safe zone…
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: C.textMuted, lineHeight: 1.6 }}>
              Scanning {SAFE_ZONES.length} facilities across India<br />
              Finding nearest hospitals &amp; relief camps…
            </p>
            {userPoint && (
              <div style={{
                marginTop: '12px', padding: '7px 10px', borderRadius: '8px',
                background: `rgba(245,158,11,0.1)`, border: '1px solid rgba(245,158,11,0.2)',
                fontSize: '11px', color: '#fcd34d',
              }}>
                📍 {userPoint.label}
              </div>
            )}
          </div>
        )}

        {/* ── ERROR STATE ── */}
        {status === 'error' && (
          <div style={{
            ...card, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          }} className="evac-sidebar-card">
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '13px', color: '#fca5a5' }}>
              ⚠️ Route calculation failed
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#f87171', lineHeight: 1.6 }}>
              {errorMsg}
            </p>
            <div style={{
              marginTop: '10px', padding: '8px 10px', background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.6,
            }}>
              💡 Try a location near a major road, or check <code>VITE_ORS_API_KEY</code> in <code>.env</code>
            </div>
            <button
              onClick={handleReset}
              style={{
                marginTop: '10px', width: '100%', padding: '8px', fontSize: '12px',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                background: 'rgba(239,68,68,0.12)', cursor: 'pointer', color: '#fca5a5',
                fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              ↩ Try Again
            </button>
          </div>
        )}

        {/* ── DONE STATE: Route results ── */}
        {status === 'done' && route && nearestZone && (
          <>
            {/* From location banner */}
            {userPoint && (
              <div style={{
                ...card, padding: '10px 14px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
              }} className="evac-sidebar-card">
                <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#fbbf24', marginBottom: '3px' }}>
                  Your Location
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fde68a' }}>{userPoint.label}</div>
                <div style={{ fontSize: '10px', color: '#fcd34d', marginTop: '2px' }}>
                  {userPoint.lat.toFixed(4)}°N, {userPoint.lng.toFixed(4)}°E
                </div>
              </div>
            )}

            {/* Fallback warning banner */}
            {isFallback && (
              <div style={{
                ...card, padding: '9px 13px',
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              }} className="evac-sidebar-card">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '15px', flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#fcd34d', marginBottom: '2px' }}>
                      Limited Road Access Detected
                    </div>
                    <div style={{ fontSize: '10px', color: '#fbbf24', lineHeight: 1.6 }}>
                      No drivable roads found near this location (remote/mountainous area).
                      Showing <strong>straight-line distances</strong> to nearest facilities.
                      Actual travel may require different routes.
                    </div>
                  </div>
                </div>
              </div>
            )}
            {nearbyZones.length > 0 && (
              <div style={{ ...card, padding: 0, overflow: 'hidden' }} className="evac-sidebar-card">
                <div style={{
                  padding: '11px 14px', borderBottom: `1px solid ${C.borderLight}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: C.text }}>🏥 Nearby Facilities</span>
                  <span style={{
                    fontSize: '10px', color: C.accent, background: C.accentGlow,
                    padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                  }}>{nearbyZones.length} found</span>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {nearbyZones.map(({ zone: z, distanceM, durationSec }, idx) => {
                    const typeIcon = z.type === 'hospital' ? '🏥' : z.type === 'relief_camp' ? '⛺' : '🏠';
                    const typeColor = ZONE_COLORS[z.type] ?? '#94a3b8';
                    const isNearest = idx === 0;
                    return (
                      <div key={z.id} style={{
                        padding: '10px 14px',
                        borderBottom: idx < nearbyZones.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                        background: isNearest ? 'rgba(16,185,129,0.07)' : 'transparent',
                        display: 'flex', gap: '10px', alignItems: 'flex-start',
                      }}>
                        {/* Rank badge */}
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          background: isNearest ? 'rgba(16,185,129,0.2)' : C.accentGlow,
                          border: `1.5px solid ${isNearest ? '#10b981' : C.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 800,
                          color: isNearest ? '#34d399' : C.textMuted,
                        }}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '11px', fontWeight: 700,
                            color: isNearest ? '#a7f3d0' : C.text,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {typeIcon} {z.name}
                          </div>
                          <div style={{ fontSize: '10px', color: typeColor, marginTop: '1px', textTransform: 'capitalize' }}>
                            {z.type.replace('_', ' ')} · {z.state}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <span style={{
                              fontSize: '10px', color: C.textMuted,
                              background: 'rgba(148,163,184,0.08)', padding: '1px 6px', borderRadius: '4px',
                            }}>📏 {fmtDist(distanceM)}</span>
                            {durationSec != null && (
                              <span style={{
                                fontSize: '10px', color: C.textMuted,
                                background: 'rgba(148,163,184,0.08)', padding: '1px 6px', borderRadius: '4px',
                              }}>🕒 {fmtTime(durationSec)}</span>
                            )}
                            {durationSec == null && (
                              <span style={{
                                fontSize: '10px', color: '#f59e0b',
                                background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '4px',
                              }}>📐 Straight-line only</span>
                            )}
                          </div>
                          {isNearest && (
                            <div style={{ fontSize: '10px', color: '#34d399', marginTop: '4px', fontWeight: 700 }}>
                              ✅ Route calculated to this facility
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats card */}
            <div style={{ ...card }} className="evac-sidebar-card">
              <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '13px', color: C.text }}>
                🗺️ Evacuation Route
              </p>

              {/* Distance + Time + Steps — 3-column stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginBottom: '12px' }}>
                <div style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '11px 6px', textAlign: 'center', border: `1px solid ${C.accent}33` }}>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#a5b4fc' }}>{fmtDist(route.distanceM)}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '8px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distance</p>
                </div>
                <div style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '11px 6px', textAlign: 'center', border: `1px solid ${C.success}33` }}>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#6ee7b7' }}>{fmtTime(route.durationSec)}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '8px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isFallback ? 'Walk est.' : 'Drive time'}
                  </p>
                </div>
                <div style={{ background: C.surfaceAlt, borderRadius: '10px', padding: '11px 6px', textAlign: 'center', border: `1px solid rgba(248,113,113,0.2)` }}>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fca5a5' }}>{route.steps?.length ?? '—'}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '8px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Turns</p>
                </div>
              </div>

              {/* Nearest safe zone banner */}
              <div style={{
                background: C.successBg, border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: '10px', padding: '12px',
              }}>
                <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#34d399' }}>
                  Nearest Safe Zone
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 700, color: '#a7f3d0' }}>{nearestZone.name}</p>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#6ee7b7', textTransform: 'capitalize' }}>
                  {nearestZone.type.replace('_', ' ')} · {nearestZone.state}
                </p>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button
                  onClick={() => runEvacuation(userPoint)}
                  style={{
                    flex: 1, padding: '7px', fontSize: '11px', fontWeight: 600,
                    border: `1px solid ${C.borderLight}`, borderRadius: '8px',
                    background: 'transparent', cursor: 'pointer', color: C.textMuted, fontFamily: 'inherit',
                  }}
                >
                  🔄 Recalculate
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    flex: 1, padding: '7px', fontSize: '11px', fontWeight: 600,
                    border: `1px solid ${C.borderLight}`, borderRadius: '8px',
                    background: 'transparent', cursor: 'pointer', color: C.textMuted, fontFamily: 'inherit',
                  }}
                >
                  🗺️ New Location
                </button>
              </div>
            </div>

            {/* Turn-by-turn accordion */}
            <div style={{ ...card, padding: 0, overflow: 'hidden', border: `1px solid ${C.borderLight}` }} className="evac-sidebar-card">
              <button
                onClick={() => setStepsOpen(o => !o)}
                style={{
                  width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', color: C.text,
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600 }}>🧭 Turn-by-turn ({route.steps.length} steps)</span>
                <span style={{
                  fontSize: '10px', color: C.accent, background: C.accentGlow,
                  padding: '3px 8px', borderRadius: '20px', fontWeight: 600,
                }}>
                  {stepsOpen ? '▲ hide' : '▼ show'}
                </span>
              </button>

              {stepsOpen && (
                <div style={{ borderTop: `1px solid ${C.borderLight}`, maxHeight: '300px', overflowY: 'auto' }}>
                  {route.steps.map((step, i) => (
                    <div key={i} className="evac-step-row" style={{
                      padding: '8px 14px', borderBottom: `1px solid ${C.borderLight}`,
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                    }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', background: C.accentGlow,
                        border: `1px solid ${C.border}`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0,
                      }}>
                        {STEP_ARROWS[step.type] ?? '➡️'}
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, color: C.text }}>{step.instruction}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: C.textMuted }}>
                          {fmtDist(step.distanceM)} · {fmtTime(step.durationSec)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div style={{
                    padding: '10px 16px', background: C.successBg,
                    fontSize: '12px', fontWeight: 700, color: '#6ee7b7',
                    display: 'flex', alignItems: 'center', gap: '6px',
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
