import { useState, useCallback, useEffect, useRef } from 'react';
import './App.css';
import { MapContainer, TileLayer, Marker, useMapEvents, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import {
  Droplets, Mountain, Wind, ThermometerSun, Waves, MapPin,
  Search, Navigation, Layers, Map, Loader, AlertTriangle,
  CheckCircle, XCircle, Crosshair, FlaskConical, SlidersHorizontal, Hospital
} from 'lucide-react';
import NearbyFacilities from './components/NearbyFacilities';
import { findTopNSafeZones } from './services/orsService';
import { SAFE_ZONES, ZONE_COLORS } from './data/safeZones';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE = 'http://localhost:8000';

// ── Helper utilities ──────────────────────────────────────────
function getRiskColor(pct) {
  if (pct < 30) return '#10b981';
  if (pct < 60) return '#f59e0b';
  return '#ef4444';
}

function getRiskTextClass(pct) {
  if (pct < 30) return 'risk-text-low';
  if (pct < 60) return 'risk-text-med';
  return 'risk-text-high';
}

function getRiskBorderClass(pct) {
  if (pct < 30) return 'risk-border-low';
  if (pct < 60) return 'risk-border-med';
  return 'risk-border-high';
}

function getRiskLabel(pct) {
  if (pct < 30) return 'Low Risk';
  if (pct < 60) return 'Moderate Risk';
  return 'High Risk';
}

function getRiskAdvice(pct) {
  if (pct < 30) return 'Normal activity. No immediate concern.';
  if (pct < 60) return 'Monitor local weather. Stay informed.';
  return 'Immediate action recommended. Seek safe ground.';
}

function getRiskIcon(pct) {
  if (pct < 30) return <CheckCircle size={20} className="risk-icon-low" />;
  if (pct < 60) return <AlertTriangle size={20} className="risk-icon-med" />;
  return <XCircle size={20} className="risk-icon-high" />;
}

// ── API call ──────────────────────────────────────────────────
async function fetchPrediction(lat, lon) {
  const response = await axios.post(`${API_BASE}/predict`, { lat, lon });
  return response.data;
}

// ── Formatting helpers ────────────────────────────────────────
const fmtDist = m => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
const fmtTime = s => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h} hr ${m} min` : `${m} min`; };

const ZONE_META = {
  hospital:    { emoji: '🏥', label: 'Hospital',      color: ZONE_COLORS.hospital },
  relief_camp: { emoji: '⛺', label: 'Relief Camp',   color: ZONE_COLORS.relief_camp },
  shelter:     { emoji: '🏠', label: 'Shelter',       color: ZONE_COLORS.shelter },
};

// Creates a small coloured div icon for safe-zone map markers
function makeSafeZoneIcon(type) {
  const meta = ZONE_META[type] || ZONE_META.shelter;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      background:${meta.color};border:2px solid #fff;
      transform:rotate(-45deg);display:flex;align-items:center;
      justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35)
    "><span style="transform:rotate(45deg);font-size:13px;line-height:1">${meta.emoji}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -32],
  });
}

// ── Nearest Safe Zones Panel ──────────────────────────────────
function NearestSafeZonesPanel({ zones, loading }) {
  if (!loading && zones.length === 0) return null;
  return (
    <div className="glass-card" style={{ marginTop: '12px', padding: '14px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '12px',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
        }}>🚨</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', color: '#e2e8f0' }}>Nearest Safe Zones</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Ranked by drive time via ORS API</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: '#94a3b8', fontSize: '12px' }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          Finding nearest hospitals & relief camps…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {zones.map((item, i) => {
            const meta = ZONE_META[item.zone.type] || ZONE_META.shelter;
            return (
              <div key={item.zone.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '10px', borderRadius: '10px',
                background: i === 0 ? `${meta.color}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${i === 0 ? meta.color + '44' : 'rgba(255,255,255,0.06)'}`,
                position: 'relative',
              }}>
                {i === 0 && (
                  <div style={{
                    position: 'absolute', top: -6, right: 8,
                    background: meta.color, color: '#fff',
                    fontSize: '9px', fontWeight: 800, padding: '2px 7px',
                    borderRadius: '20px', letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>Nearest</div>
                )}
                <div style={{
                  width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                  background: meta.color + '22', border: `1.5px solid ${meta.color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
                }}>{ meta.emoji }</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.zone.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px', textTransform: 'capitalize' }}>
                    {meta.label} · {item.zone.state}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color: meta.color,
                      background: meta.color + '18', padding: '2px 7px',
                      borderRadius: '20px', border: `1px solid ${meta.color}33`,
                    }}>📍 {fmtDist(item.distanceM)}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color: '#a5b4fc',
                      background: 'rgba(99,102,241,0.12)', padding: '2px 7px',
                      borderRadius: '20px', border: '1px solid rgba(99,102,241,0.25)',
                    }}>🕒 {fmtTime(item.durationSec)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

// LocationMarker for Tab 1 (Map Explorer)
function LocationMarker({ position, setPosition, onLocationSelect }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return position === null ? null : <Marker position={position} />;
}

// ClickableMap for Tab 3 — fires callback on click
function ClickCaptureLayer({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Risk card shown after prediction
function PredictionResult({ prediction }) {
  const fp = prediction.predictions.flood_risk_pct;
  const lp = prediction.predictions.landslide_risk_pct;
  const lf = prediction.live_factors;

  return (
    <div className="result-grid">
      {/* Flood Risk Card */}
      <div className={`risk-card ${getRiskBorderClass(fp)}`}>
        <div className="risk-card-header">
          <div className="risk-icon-wrap risk-icon-wrap-blue">
            <Droplets size={22} />
          </div>
          <div>
            <div className="risk-card-title">Flood Risk</div>
            <div className="risk-card-sub">ML · Physics-Gated · AUC 98.2%</div>
          </div>
          <div className={`risk-pct ${getRiskTextClass(fp)}`}>{fp}%</div>
        </div>
        <div className="risk-bar-wrap">
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{ width: `${fp}%`, background: getRiskColor(fp) }} />
          </div>
        </div>
        <div className="risk-status-row">
          {getRiskIcon(fp)}
          <span className="risk-status-label">{getRiskLabel(fp)} — {getRiskAdvice(fp)}</span>
        </div>
      </div>

      {/* Landslide Risk Card */}
      <div className={`risk-card ${getRiskBorderClass(lp)}`}>
        <div className="risk-card-header">
          <div className="risk-icon-wrap risk-icon-wrap-amber">
            <Mountain size={22} />
          </div>
          <div>
            <div className="risk-card-title">Landslide Risk</div>
            <div className="risk-card-sub">ML · Physics-Gated · AUC 96.5%</div>
          </div>
          <div className={`risk-pct ${getRiskTextClass(lp)}`}>{lp}%</div>
        </div>
        <div className="risk-bar-wrap">
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{ width: `${lp}%`, background: getRiskColor(lp) }} />
          </div>
        </div>
        <div className="risk-status-row">
          {getRiskIcon(lp)}
          <span className="risk-status-label">{getRiskLabel(lp)} — {getRiskAdvice(lp)}</span>
        </div>
      </div>

      {/* Live Factors */}
      <div className="live-factors-card">
        <div className="live-factors-title">Live Satellite Factors</div>
        <div className="live-factors-grid">
          <div className="factor-item">
            <Droplets size={14} /><span>Daily Rain</span>
            <strong>{lf.rainfall_mm} mm</strong>
          </div>
          <div className="factor-item">
            <Waves size={14} /><span>7-Day Rain</span>
            <strong>{lf.antecedent_7day_mm} mm</strong>
          </div>
          <div className="factor-item">
            <Mountain size={14} /><span>Elevation</span>
            <strong>{lf.elevation_m} m</strong>
          </div>
          <div className="factor-item">
            <ThermometerSun size={14} /><span>Soil Moisture</span>
            <strong>{(lf.soil_moisture * 100).toFixed(1)}%</strong>
          </div>
          <div className="factor-item">
            <Waves size={14} /><span>River Discharge</span>
            <strong>{lf.river_discharge} m³/s</strong>
          </div>
          <div className="factor-item">
            <Wind size={14} /><span>Humidity</span>
            <strong>{lf.humidity_pct}%</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB 1: Map Explorer ───────────────────────────────────────
function TabMapExplorer() {
  const [position,     setPosition]     = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [prediction,   setPrediction]   = useState(null);
  const [error,        setError]        = useState(null);
  const [nearestZones, setNearestZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [selLat,       setSelLat]       = useState(null);
  const [selLon,       setSelLon]       = useState(null);

  const handleLocationSelect = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    setNearestZones([]);
    setSelLat(lat);
    setSelLon(lon);
    try {
      const data = await fetchPrediction(lat, lon);
      setPrediction(data);
      // Fire nearest zones lookup in background (non-blocking)
      setZonesLoading(true);
      findTopNSafeZones(lat, lon, SAFE_ZONES, 3)
        .then(zones => { setNearestZones(zones); setZonesLoading(false); })
        .catch(() => setZonesLoading(false));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch predictions');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="tab-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="glass-card">
          <div className="sidebar-coord">
            <MapPin size={16} className="icon-blue" />
            <span>{position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Click anywhere on the map'}</span>
          </div>
        </div>

        <div className="glass-card">
          <div className="section-label">Historical Case Studies</div>
          {[
            { name: 'Kedarnath, Himalayas', desc: 'Extreme Landslide Risk Zone', lat: 30.74, lon: 79.07 },
            { name: 'Kerala, India', desc: 'High Flood & Landslide Zone', lat: 9.55, lon: 76.62 },
            { name: 'Sahara Desert', desc: 'Zero Risk Reference', lat: 25.00, lon: 10.00 },
            { name: 'Mumbai, India', desc: 'High Urban Flood Zone', lat: 19.07, lon: 72.87 },
          ].map(loc => (
            <button
              key={loc.name}
              className="case-study-btn"
              onClick={() => { setPosition({ lat: loc.lat, lng: loc.lon }); handleLocationSelect(loc.lat, loc.lon); }}
            >
              <div className="case-study-name">{loc.name}</div>
              <div className="case-study-desc">{loc.desc}</div>
            </button>
          ))}
        </div>

        {error && <div className="error-card">{error}</div>}

        {loading ? (
          <div className="loading-card">
            <div className="spinner" />
            <p className="loading-text">Analyzing satellite telemetry...</p>
          </div>
        ) : prediction ? (
          <>
            <PredictionResult prediction={prediction} />
            <NearestSafeZonesPanel zones={nearestZones} loading={zonesLoading} />
          </>
        ) : (
          <div className="empty-card">
            <MapPin size={40} className="empty-icon" />
            <p>Select a location on the map to run the AI prediction models.</p>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="map-container glass-card" style={{ padding: 0 }}>
        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} onLocationSelect={handleLocationSelect} />
          {/* Nearest safe zone markers on the map */}
          {nearestZones.map((item, i) => (
            <Marker
              key={`nz-${item.zone.id}`}
              position={[item.zone.lat, item.zone.lon]}
              icon={makeSafeZoneIcon(item.zone.type)}
              zIndexOffset={i === 0 ? 1000 : 0}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '160px' }}>
                  {i === 0 && <div style={{ color: '#10b981', fontWeight: 700, fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}>⭐ Nearest Safe Zone</div>}
                  <strong>{item.zone.name}</strong><br />
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                    {item.zone.type.replace('_', ' ')} · {item.zone.state}
                  </span><br />
                  <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>
                    📍 {fmtDist(item.distanceM)} &nbsp;🕒 {fmtTime(item.durationSec)} drive
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

// ── TAB 2: Search & GPS ───────────────────────────────────────
function TabSearchGPS() {
  const [query,        setQuery]        = useState('');
  const [coords,       setCoords]       = useState(null);
  const [locationName, setLocationName] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [prediction,   setPrediction]   = useState(null);
  const [error,        setError]        = useState(null);
  const [nearestZones, setNearestZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);

  const [suggestions,        setSuggestions]        = useState([]);
  const [showSuggestions,    setShowSuggestions]    = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isTyping,           setIsTyping]           = useState(false);
  const wrapperRef = useRef(null);

  const runPrediction = useCallback(async (lat, lon, name = '') => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setNearestZones([]);
    try {
      const data = await fetchPrediction(lat, lon);
      setCoords({ lat, lon });
      setLocationName(name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      setPrediction(data);
      // Fire nearest zones lookup in background (non-blocking)
      setZonesLoading(true);
      findTopNSafeZones(lat, lon, SAFE_ZONES, 3)
        .then(zones => { setNearestZones(zones); setZonesLoading(false); })
        .catch(() => setZonesLoading(false));
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: { q: query, format: 'json', limit: 1 },
          headers: { 'User-Agent': 'TerraGuard-AI/1.0' },
        }
      );
      if (!res.data || res.data.length === 0) {
        setError('Location not found. Try a different name.');
        setLoading(false);
        return;
      }
      const { lat, lon, display_name } = res.data[0];
      await runPrediction(parseFloat(lat), parseFloat(lon), display_name.split(',').slice(0, 2).join(', '));
    } catch {
      setError('Geocoding failed. Check your internet connection.');
      setLoading(false);
    }
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsLoading(false);
        runPrediction(latitude, longitude, 'Your Current Location');
      },
      (err) => {
        setGpsLoading(false);
        setError(`GPS error: ${err.message}. Please allow location access or type a location manually.`);
      },
      { timeout: 10000 }
    );
  };

  const handleSelectSuggestion = (sug) => {
    setIsTyping(false);
    const shortName = sug.display_name.split(',').slice(0, 2).join(', ');
    setQuery(shortName);
    setSuggestions([]);
    setShowSuggestions(false);
    runPrediction(parseFloat(sug.lat), parseFloat(sug.lon), shortName);
  };

  const handleSearchClick = () => {
    setIsTyping(false);
    setShowSuggestions(false);
    handleSearch();
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef]);

  useEffect(() => {
    if (!query.trim() || query.length < 2 || !isTyping) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSuggestionsLoading(true);
      setShowSuggestions(true);
      try {
        const res = await axios.get(
          `https://nominatim.openstreetmap.org/search`,
          {
            params: { q: query, format: 'json', limit: 5 },
            headers: { 'User-Agent': 'TerraGuard-AI/1.0' },
          }
        );
        if (res.data) {
          setSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, isTyping]);

  return (
    <div className="search-gps-layout">
      {/* Input Panel */}
      <div className="search-panel glass-card">
        <div className="search-panel-title">
          <Crosshair size={20} className="icon-blue" />
          Detect My Location (GPS)
        </div>
        <p className="search-panel-desc">Allow location access on your device to get an instant risk assessment for your current position.</p>
        <button
          id="gps-detect-btn"
          className={`gps-btn ${gpsLoading ? 'gps-btn-loading' : ''}`}
          onClick={handleGPS}
          disabled={gpsLoading || loading}
        >
          {gpsLoading ? (
            <><div className="spinner-sm" /> Detecting Location...</>
          ) : (
            <><Navigation size={18} /> Use My Current Location</>
          )}
        </button>

        <div className="divider"><span>OR</span></div>

        <div className="search-panel-title">
          <Search size={20} className="icon-blue" />
          Search by Place Name
        </div>
        <p className="search-panel-desc">Type a city, region, or landmark name to check flood and landslide risks.</p>
        <div className="search-input-container" ref={wrapperRef}>
          <div className="search-input-row">
            <input
              id="location-search-input"
              className="search-input"
              type="text"
              placeholder="e.g. Mumbai, Kedarnath, Bangladesh..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setIsTyping(true);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setIsTyping(false);
                  setShowSuggestions(false);
                  handleSearch();
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            />
            <button
              id="location-search-btn"
              className="search-submit-btn"
              onClick={handleSearchClick}
              disabled={loading || gpsLoading}
            >
              {loading ? <div className="spinner-sm" /> : <Search size={18} />}
            </button>
          </div>

          {showSuggestions && (
            <div className="suggestions-list">
              {suggestionsLoading ? (
                <div className="suggestions-loading">
                  <div className="spinner-sm" />
                  <span>Searching locations...</span>
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((sug, idx) => (
                  <button
                    key={sug.place_id || idx}
                    className="suggestion-item"
                    onClick={() => handleSelectSuggestion(sug)}
                  >
                    <MapPin size={14} className="icon-blue" style={{ marginRight: '0.5rem', flexShrink: 0 }} />
                    <span className="suggestion-text">{sug.display_name}</span>
                  </button>
                ))
              ) : (
                query.trim().length >= 2 && <div className="suggestions-no-results">No locations found</div>
              )}
            </div>
          )}
        </div>

        {/* Quick Presets */}
        <div className="section-label" style={{ marginTop: '1.25rem' }}>Quick Locations</div>
        <div className="quick-locs">
          {[
            { name: 'Kedarnath', lat: 30.74, lon: 79.07 },
            { name: 'Kerala', lat: 9.55, lon: 76.62 },
            { name: 'Mumbai', lat: 19.07, lon: 72.87 },
            { name: 'Assam', lat: 26.14, lon: 91.74 },
            { name: 'Sahara', lat: 25.00, lon: 10.00 },
            { name: 'Rajasthan', lat: 27.02, lon: 74.21 },
          ].map(loc => (
            <button
              key={loc.name}
              className="quick-loc-btn"
              onClick={() => { setQuery(loc.name); runPrediction(loc.lat, loc.lon, loc.name); }}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Result Panel */}
      <div className="result-panel">
        {error && <div className="error-card">{error}</div>}

        {loading && !gpsLoading ? (
          <div className="loading-card loading-card-lg">
            <div className="spinner" />
            <p className="loading-text">Analyzing satellite telemetry...</p>
            {query && <p className="loading-sub">Resolving: {query}</p>}
          </div>
        ) : prediction ? (
          <>
            <div className="glass-card location-banner">
              <MapPin size={16} className="icon-blue" />
              <div>
                <div className="location-banner-name">{locationName}</div>
                {coords && <div className="location-banner-coords">{coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}</div>}
              </div>
            </div>
            <PredictionResult prediction={prediction} />
            <NearestSafeZonesPanel zones={nearestZones} loading={zonesLoading} />
          </>
        ) : !gpsLoading && (
          <div className="empty-card empty-card-lg">
            <Navigation size={48} className="empty-icon" />
            <p>Use GPS or search for a location to get real-time flood &amp; landslide risk predictions.</p>
          </div>
        )}

        {gpsLoading && (
          <div className="loading-card loading-card-lg">
            <div className="gps-pulse-ring">
              <Navigation size={28} className="icon-blue" />
            </div>
            <p className="loading-text">Acquiring GPS signal...</p>
            <p className="loading-sub">Please allow location access on your device.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB 3: Dual Risk Maps ─────────────────────────────────────
// All coordinates are on Indian land territory only (no ocean/sea points)
// Both maps share the same fetched predictions — filtered differently per map

// Comprehensive list covering all major risk zones across India
const ALL_RISK_POINTS = [
  // ── Northeast India (high flood + landslide) ──────────────────
  { lat: 28.20, lon: 94.41, label: 'Arunachal Pradesh (E)' },
  { lat: 27.10, lon: 93.62, label: 'Arunachal Pradesh (W)' },
  { lat: 26.14, lon: 91.74, label: 'Guwahati, Assam' },
  { lat: 26.70, lon: 94.20, label: 'Upper Assam' },
  { lat: 24.52, lon: 92.80, label: 'Silchar, Assam' },
  { lat: 25.57, lon: 91.88, label: 'Shillong, Meghalaya' },
  { lat: 25.47, lon: 90.36, label: 'West Meghalaya' },
  { lat: 24.80, lon: 93.94, label: 'Imphal, Manipur' },
  { lat: 23.73, lon: 92.72, label: 'Aizawl, Mizoram' },
  { lat: 25.67, lon: 94.12, label: 'Kohima, Nagaland' },
  { lat: 23.94, lon: 91.98, label: 'Agartala, Tripura' },
  // ── Himalayas & North ────────────────────────────────────────
  { lat: 30.74, lon: 79.07, label: 'Kedarnath, Uttarakhand' },
  { lat: 30.09, lon: 78.29, label: 'Rishikesh, Uttarakhand' },
  { lat: 29.38, lon: 79.45, label: 'Almora, Uttarakhand' },
  { lat: 32.22, lon: 77.19, label: 'Kullu, Himachal Pradesh' },
  { lat: 31.63, lon: 77.11, label: 'Shimla, Himachal Pradesh' },
  { lat: 32.73, lon: 74.86, label: 'Jammu Foothills' },
  { lat: 34.08, lon: 74.80, label: 'Kashmir Valley' },
  // ── Darjeeling & Sikkim ──────────────────────────────────────
  { lat: 27.03, lon: 88.26, label: 'Darjeeling, WB' },
  { lat: 27.33, lon: 88.61, label: 'Gangtok, Sikkim' },
  { lat: 27.59, lon: 88.51, label: 'North Sikkim' },
  // ── Bihar & UP Flood Plains ──────────────────────────────────
  { lat: 25.60, lon: 85.14, label: 'Patna, Bihar' },
  { lat: 26.12, lon: 87.47, label: 'Supaul, Bihar (Kosi)' },
  { lat: 26.83, lon: 84.50, label: 'Gopalganj, Bihar' },
  { lat: 25.45, lon: 82.00, label: 'Varanasi, UP' },
  { lat: 26.85, lon: 80.95, label: 'Lucknow, UP' },
  { lat: 27.57, lon: 81.60, label: 'Bahraich, UP' },
  // ── West Bengal ──────────────────────────────────────────────
  { lat: 22.57, lon: 88.36, label: 'Kolkata, WB' },
  { lat: 24.07, lon: 88.27, label: 'Murshidabad, WB' },
  // ── Odisha & Andhra ─────────────────────────────────────────
  { lat: 20.46, lon: 85.88, label: 'Bhubaneswar, Odisha' },
  { lat: 19.32, lon: 84.79, label: 'South Odisha Coast' },
  { lat: 17.69, lon: 83.22, label: 'Visakhapatnam, AP' },
  { lat: 16.51, lon: 81.75, label: 'Konaseema, AP' },
  // ── Telangana & Karnataka ────────────────────────────────────
  { lat: 17.38, lon: 78.49, label: 'Hyderabad Basin' },
  { lat: 16.20, lon: 77.36, label: 'Raichur, Karnataka' },
  // ── Western Ghats ────────────────────────────────────────────
  { lat: 9.55,  lon: 76.62, label: 'Kottayam, Kerala' },
  { lat: 10.07, lon: 77.06, label: 'Munnar, Kerala' },
  { lat: 11.35, lon: 76.18, label: 'Ooty, Tamil Nadu' },
  { lat: 12.30, lon: 75.78, label: 'Coorg, Karnataka' },
  { lat: 15.45, lon: 74.99, label: 'N. Goa-Karnataka Ghats' },
  // ── Konkan & Mumbai ──────────────────────────────────────────
  { lat: 19.07, lon: 72.87, label: 'Mumbai Coast' },
  { lat: 17.30, lon: 73.31, label: 'Ratnagiri, Konkan' },
  { lat: 18.52, lon: 73.86, label: 'Pune, Maharashtra' },
  // ── Central India ────────────────────────────────────────────
  { lat: 21.10, lon: 81.63, label: 'Raipur, Chhattisgarh' },
  { lat: 22.72, lon: 82.70, label: 'Bilaspur, CG' },
  // ── Tamil Nadu & Chennai ─────────────────────────────────────
  { lat: 13.08, lon: 80.27, label: 'Chennai Coast' },
  { lat: 11.00, lon: 77.97, label: 'Thanjavur Delta' },
  // ── Rajasthan (Aravalli flash floods) ────────────────────────
  { lat: 24.58, lon: 73.68, label: 'Udaipur, Rajasthan' },
  { lat: 26.92, lon: 75.82, label: 'Jaipur, Rajasthan' },
  // ── Delhi NCR ────────────────────────────────────────────────
  { lat: 28.61, lon: 77.20, label: 'Delhi (Yamuna)' },
];

const FLOOD_THRESHOLD     = 30;
const LANDSLIDE_THRESHOLD = 30;

function TabDualMaps() {
  const [gridData, setGridData]       = useState([]);   // fetched predictions
  const [clickPoints, setClickPoints] = useState([]);   // user-clicked extra points
  const [loadingAll, setLoadingAll]   = useState(false);
  const [progress, setProgress]       = useState(0);
  const [clickLoading, setClickLoading] = useState(false);
  const [error, setError]             = useState(null);
  const [fetched, setFetched]         = useState(false);
  const [lastClick, setLastClick]     = useState(null);

  // Fetch all known risk points in batches of 10
  const loadAllPoints = async () => {
    setLoadingAll(true);
    setError(null);
    setProgress(0);
    const BATCH = 10;
    const results = [];
    try {
      for (let i = 0; i < ALL_RISK_POINTS.length; i += BATCH) {
        const batch = ALL_RISK_POINTS.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map(async pt => {
            try {
              const pred = await fetchPrediction(pt.lat, pt.lon);
              return { ...pt, prediction: pred };
            } catch {
              return { ...pt, prediction: null };
            }
          })
        );
        results.push(...batchResults);
        setProgress(Math.round((results.length / ALL_RISK_POINTS.length) * 100));
      }
      setGridData(results);
      setFetched(true);
    } catch {
      setError('Failed to load predictions.');
    } finally {
      setLoadingAll(false);
    }
  };

  // Clicking on either map adds to shared clickPoints — both maps update
  const handleMapClick = useCallback(async (lat, lon) => {
    setClickLoading(true);
    setError(null);
    try {
      const pred = await fetchPrediction(lat, lon);
      const id   = `c_${lat.toFixed(3)}_${lon.toFixed(3)}`;
      const newPt = { lat, lon, label: `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`, id, prediction: pred };
      setLastClick(newPt);
      setClickPoints(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx >= 0) { const u = [...prev]; u[idx] = newPt; return u; }
        return [...prev, newPt];
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Click prediction failed.');
    } finally {
      setClickLoading(false);
    }
  }, []);

  // Merge grid + click points; filter by threshold for each map
  const allPts       = [...gridData, ...clickPoints].filter(pt => pt.prediction);
  const floodVisible = allPts.filter(pt => pt.prediction.predictions.flood_risk_pct     >= FLOOD_THRESHOLD);
  const lsVisible    = allPts.filter(pt => pt.prediction.predictions.landslide_risk_pct >= LANDSLIDE_THRESHOLD);

  return (
    <div className="dual-maps-layout">
      {/* Controls */}
      <div className="dual-maps-controls glass-card">
        <div className="dual-maps-controls-left">
          <Layers size={18} className="icon-blue" />
          <span className="dual-maps-title">Risk Heat Map — India &amp; Beyond</span>
          {(clickLoading || loadingAll) && <div className="spinner-sm" />}
        </div>
        <div className="dual-maps-controls-right">
          <div className="legend">
            <span className="legend-dot" style={{ background: '#f59e0b' }} /> 30–60% Moderate
            <span className="legend-dot" style={{ background: '#ef4444', marginLeft: '10px' }} /> 60–100% High
          </div>
          <button
            id="load-all-predictions-btn"
            className="load-btn"
            onClick={loadAllPoints}
            disabled={loadingAll}
          >
            {loadingAll
              ? <><div className="spinner-sm" /> Scanning {progress}%</>
              : fetched ? 'Re-Load Risk Zones' : 'Load Risk Zones'}
          </button>
        </div>
      </div>

      {error && <div className="error-card">{error}</div>}

      {!fetched && !loadingAll && (
        <div className="empty-card empty-card-lg" style={{ marginBottom: '1rem' }}>
          <Layers size={40} className="empty-icon" />
          <p>
            Click <strong>"Load Risk Zones"</strong> to fetch predictions for <strong>{ALL_RISK_POINTS.length} locations</strong> across India.
            Only locations with ≥30% risk will be shown — 🟡 yellow (30–60%) or 🔴 red (60%+).
          </p>
        </div>
      )}

      {loadingAll && (
        <div className="loading-card" style={{ marginBottom: '1rem' }}>
          <div className="spinner" />
          <p className="loading-text">Loading risk data... {progress}% ({Math.round(progress * ALL_RISK_POINTS.length / 100)}/{ALL_RISK_POINTS.length} locations)</p>
          <p className="loading-sub">Fetching in batches — India-only land coordinates</p>
        </div>
      )}

      {/* Dual Maps */}
      <div className="dual-maps-grid">
        {/* Flood Risk Map */}
        <div className="dual-map-container">
          <MapContainer center={[22, 82]} zoom={4} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <ClickCaptureLayer onMapClick={handleMapClick} />
            {floodVisible.map((pt, i) => (
              <CircleMarker
                key={`flood-${pt.id ?? i}`}
                center={[pt.lat, pt.lon]}
                radius={14}
                pathOptions={{
                  fillColor: getRiskColor(pt.prediction.predictions.flood_risk_pct),
                  color:     getRiskColor(pt.prediction.predictions.flood_risk_pct),
                  fillOpacity: 0.78,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '160px' }}>
                    <strong>{pt.label}</strong><br />
                    <span style={{ color: '#60a5fa' }}>🌊 Flood Risk: </span>
                    <span style={{ color: getRiskColor(pt.prediction.predictions.flood_risk_pct), fontWeight: 600 }}>
                      {pt.prediction.predictions.flood_risk_pct}%
                    </span><br />
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>{getRiskLabel(pt.prediction.predictions.flood_risk_pct)}</span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <div className="map-label-overlay">
            <Droplets size={14} className="icon-blue" /> Flood Risk Map
            {fetched && <span style={{ marginLeft: 6, fontSize: '11px', opacity: 0.7 }}>({floodVisible.length} zones ≥30%)</span>}
          </div>
        </div>

        {/* Landslide Risk Map */}
        <div className="dual-map-container">
          <MapContainer center={[22, 82]} zoom={4} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <ClickCaptureLayer onMapClick={handleMapClick} />
            {lsVisible.map((pt, i) => (
              <CircleMarker
                key={`ls-${pt.id ?? i}`}
                center={[pt.lat, pt.lon]}
                radius={14}
                pathOptions={{
                  fillColor: getRiskColor(pt.prediction.predictions.landslide_risk_pct),
                  color:     getRiskColor(pt.prediction.predictions.landslide_risk_pct),
                  fillOpacity: 0.78,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '160px' }}>
                    <strong>{pt.label}</strong><br />
                    <span style={{ color: '#f59e0b' }}>⛰️ Landslide Risk: </span>
                    <span style={{ color: getRiskColor(pt.prediction.predictions.landslide_risk_pct), fontWeight: 600 }}>
                      {pt.prediction.predictions.landslide_risk_pct}%
                    </span><br />
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>{getRiskLabel(pt.prediction.predictions.landslide_risk_pct)}</span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <div className="map-label-overlay map-label-overlay-amber">
            <Mountain size={14} className="icon-amber" /> Landslide Risk Map
            {fetched && <span style={{ marginLeft: 6, fontSize: '11px', opacity: 0.7 }}>({lsVisible.length} zones ≥30%)</span>}
          </div>
        </div>
      </div>

      {/* Last clicked result */}
      {lastClick?.prediction && (
        <div className="click-result glass-card">
          <div className="click-result-coords">
            <MapPin size={14} className="icon-blue" />
            <strong style={{ marginRight: 8 }}>{lastClick.label}</strong>
            <span className="pill" style={{ background: getRiskColor(lastClick.prediction.predictions.flood_risk_pct) + '33', color: getRiskColor(lastClick.prediction.predictions.flood_risk_pct), borderColor: getRiskColor(lastClick.prediction.predictions.flood_risk_pct) + '66' }}>
              <Droplets size={12} /> Flood {lastClick.prediction.predictions.flood_risk_pct}%
            </span>
            <span className="pill" style={{ marginLeft: 8, background: getRiskColor(lastClick.prediction.predictions.landslide_risk_pct) + '33', color: getRiskColor(lastClick.prediction.predictions.landslide_risk_pct), borderColor: getRiskColor(lastClick.prediction.predictions.landslide_risk_pct) + '66' }}>
              <Mountain size={12} /> Landslide {lastClick.prediction.predictions.landslide_risk_pct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB 4: Manual Parameter Test (Separate Flood & Landslide) ─

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Helper function to auto-calculate flood engineered features
function calculateFloodEngineered(raw) {
  const rain = raw.rainfall_mm;
  const hum = raw.humidity_pct;
  const elev = raw.elevation_m;
  const discharge = raw.river_discharge_m3s;
  const precip_hours = raw.precipitation_hours;

  let rain_cat = 0;
  if (rain > 150) rain_cat = 5;
  else if (rain > 75) rain_cat = 4;
  else if (rain > 30) rain_cat = 3;
  else if (rain > 15) rain_cat = 2;
  else if (rain > 5) rain_cat = 1;

  const month = raw.month || 7;
  const seasonMap = {1:0, 2:0, 3:1, 4:1, 5:1, 6:2, 7:2, 8:2, 9:2, 10:3, 11:3, 12:3};
  const season = seasonMap[month] !== undefined ? seasonMap[month] : 2;

  let hum_risk = 0;
  if (hum > 75) hum_risk = 3;
  else if (hum > 50) hum_risk = 2;
  else if (hum > 30) hum_risk = 1;

  const low_elev = elev < 100 ? 1 : 0;
  const high_disc = discharge > 1000 ? 1 : 0;

  const log_rain = Math.log1p(Math.max(0, rain));
  const log_disc = Math.log1p(Math.max(0, discharge));
  const log_elev = Math.log1p(Math.max(0, elev));

  const rain_hum = (rain * hum) / 100;
  const precip_eff = precip_hours > 0 ? rain / precip_hours : 0;
  const temp_range = raw.temp_max_c - raw.temp_min_c;

  const norm_clamp = (val, min, max) => {
    const rng = max - min;
    return rng > 0 ? Math.max(0.0, Math.min(1.0, (val - min) / rng)) : 0.0;
  };
  const r_norm = norm_clamp(rain, 0, 500);
  const h_norm = norm_clamp(hum, 10, 100);
  const p_norm = norm_clamp(precip_hours, 0, 24);
  const e_norm = norm_clamp(elev, 0, 5000);
  const d_norm = norm_clamp(discharge, 0, 8000);

  const score = 0.30 * r_norm + 0.20 * h_norm + 0.20 * p_norm + 0.15 * (1.0 - e_norm) + 0.15 * d_norm;

  return {
    rainfall_category: rain_cat,
    season: season,
    humidity_risk: hum_risk,
    low_elevation: low_elev,
    high_discharge: high_disc,
    log_rainfall_mm: parseFloat(log_rain.toFixed(2)),
    log_river_discharge_m3s: parseFloat(log_disc.toFixed(2)),
    log_elevation_m: parseFloat(log_elev.toFixed(2)),
    rain_humidity_index: parseFloat(rain_hum.toFixed(2)),
    precip_efficiency: parseFloat(precip_eff.toFixed(2)),
    temp_range_c: parseFloat(temp_range.toFixed(2)),
    flood_risk_score: parseFloat(score.toFixed(3)),
  };
}

// Helper function to auto-calculate landslide engineered features
function calculateLandslideEngineered(raw) {
  const rain = raw.rainfall_mm;
  const ante = raw.antecedent_7day_mm;
  const elev = raw.elevation_m;
  const hum = raw.humidity_pct;
  const sm = raw.soil_moisture;

  const rain_int = raw.precipitation_hours > 0 ? rain / raw.precipitation_hours : 0;

  let elev_cat = 0;
  if (elev > 3000) elev_cat = 4;
  else if (elev > 1500) elev_cat = 3;
  else if (elev > 750) elev_cat = 2;
  else if (elev > 250) elev_cat = 1;

  const slope = elev > 0 ? Math.log1p(Math.max(0, elev)) / 10 : 0;
  const twi = slope > 0 ? sm / (slope + 0.01) : 0;
  const comb_rain = 0.6 * rain + 0.4 * ante;

  const month = raw.month || 7;
  const seasonMap = {1:0, 2:0, 3:1, 4:1, 5:1, 6:2, 7:2, 8:2, 9:2, 10:3, 11:3, 12:3};
  const season = seasonMap[month] !== undefined ? seasonMap[month] : 2;

  const crit_zone = (elev > 500 && rain > 30) ? 1 : 0;

  const log_rain = Math.log1p(Math.max(0, rain));
  const log_ante = Math.log1p(Math.max(0, ante));
  const log_elev = Math.log1p(Math.max(0, elev));
  const temp_range = raw.temp_max_c - raw.temp_min_c;

  const norm_clamp = (val, min, max) => {
    const rng = max - min;
    return rng > 0 ? Math.max(0.0, Math.min(1.0, (val - min) / rng)) : 0.0;
  };
  const r_norm = norm_clamp(rain, 0, 500);
  const a_norm = norm_clamp(ante, 0, 800);
  const e_norm = norm_clamp(elev, 0, 5000);
  const h_norm = norm_clamp(hum, 10, 100);
  const s_norm = norm_clamp(slope, 0, 1);
  const sm_norm = norm_clamp(sm, 0, 1);

  const score = 0.25 * r_norm + 0.20 * a_norm + 0.20 * e_norm + 0.15 * h_norm + 0.10 * s_norm + 0.10 * sm_norm;

  return {
    rainfall_intensity: parseFloat(rain_int.toFixed(2)),
    elevation_cat: elev_cat,
    slope_proxy: parseFloat(slope.toFixed(2)),
    twi_proxy: parseFloat(twi.toFixed(2)),
    combined_rain_index: parseFloat(comb_rain.toFixed(2)),
    season: season,
    critical_zone: crit_zone,
    log_rainfall_mm: parseFloat(log_rain.toFixed(2)),
    log_antecedent_7day_mm: parseFloat(log_ante.toFixed(2)),
    log_elevation_m: parseFloat(log_elev.toFixed(2)),
    temp_range: parseFloat(temp_range.toFixed(2)),
    landslide_risk_score: parseFloat(score.toFixed(3)),
  };
}

// ── Flood-specific configs ──
const FLOOD_DEFAULT_PARAMS = {
  // Raw
  rainfall_mm:          50,
  temp_max_c:           30,
  temp_min_c:           20,
  humidity_pct:         75,
  wind_speed_kmh:       20,
  precipitation_hours:  6,
  evapotranspiration_mm:3,
  elevation_m:          500,
  river_discharge_m3s:  300,
  month:                7,
  year:                 2024,
  // Engineered
  rainfall_category:    3,
  season:               2,
  humidity_risk:        2,
  low_elevation:        0,
  high_discharge:       0,
  log_rainfall_mm:      3.93,
  log_river_discharge_m3s: 5.71,
  log_elevation_m:      6.22,
  rain_humidity_index:  37.5,
  precip_efficiency:    8.33,
  temp_range_c:         10.0,
  flood_risk_score:     0.35,
};

const FLOOD_RAW_CONFIG = [
  ['rainfall_mm',           'Daily Rainfall',          'mm',    0,    400,  1,    'Rainfall in the last 24 hours — primary flood trigger'],
  ['temp_max_c',            'Max Temperature',         '°C',    -10,  50,   0.5,  'Maximum daily temperature'],
  ['temp_min_c',            'Min Temperature',         '°C',    -20,  40,   0.5,  'Minimum daily temperature'],
  ['humidity_pct',          'Relative Humidity',       '%',     0,    100,  1,    'Maximum relative humidity (%)'],
  ['wind_speed_kmh',        'Wind Speed',              'km/h',  0,    150,  1,    'Maximum wind speed'],
  ['precipitation_hours',   'Precipitation Hours',     'hrs',   0,    24,   0.5,  'Number of hours with precipitation during the day'],
  ['evapotranspiration_mm', 'Evapotranspiration',      'mm',    0,    20,   0.1,  'Daily reference ET (FAO-56)'],
  ['elevation_m',           'Elevation',               'm',     0,    6000, 10,   'Terrain elevation above sea level'],
  ['river_discharge_m3s',   'River Discharge',         'm³/s',  0,    10000,10,   'River flow rate from GloFAS (m³/second)'],
  ['month',                 'Month',                   '',      1,    12,   1,    'Month of the year (1=Jan, 12=Dec)'],
];

const FLOOD_ENGINEERED_CONFIG = [
  ['rainfall_category',     'Rainfall Category',       '',      0,    5,    1,    'Binned rainfall category (0–5)'],
  ['season',                'Season',                  '',      0,    3,    1,    'Binned season code (0–3)'],
  ['humidity_risk',         'Humidity Risk',           '',      0,    3,    1,    'Binned humidity risk (0–3)'],
  ['low_elevation',         'Low Elevation',           '',      0,    1,    1,    'Binary flag: 1 if elevation < 100m'],
  ['high_discharge',        'High Discharge',          '',      0,    1,    1,    'Binary flag: 1 if river discharge > 1000 m³/s'],
  ['log_rainfall_mm',       'Log Rainfall',            '',      0,    7,    0.01, 'log₁ₚ(rainfall_mm)'],
  ['log_river_discharge_m3s','Log River Discharge',    '',      0,    10,   0.01, 'log₁ₚ(river_discharge_m3s)'],
  ['log_elevation_m',       'Log Elevation',           '',      0,    9,    0.01, 'log₁ₚ(elevation_m)'],
  ['rain_humidity_index',   'Rain-Humidity Index',     '',      0,    400,  0.1,  'rainfall_mm × humidity_pct / 100'],
  ['precip_efficiency',     'Precip Efficiency',       '',      0,    100,  0.1,  'rainfall_mm / precipitation_hours'],
  ['temp_range_c',          'Temp Range',              '°C',    0,    50,   0.5,  'temp_max_c − temp_min_c'],
  ['flood_risk_score',      'Flood Risk Score',        '',      0,    1,    0.01, 'Weighted normalized score (0–1)'],
];

// ── Landslide-specific configs ──
const LANDSLIDE_DEFAULT_PARAMS = {
  // Raw
  rainfall_mm:          50,
  antecedent_7day_mm:   80,
  temp_max_c:           25,
  temp_min_c:           18,
  humidity_pct:         80,
  wind_speed_kmh:       12,
  precipitation_hours:  8,
  evapotranspiration_mm:3,
  soil_moisture:        0.25,
  elevation_m:          800,
  river_discharge_m3s:  50,
  flood_nearby:         0,
  month:                7,
  year:                 2024,
  // Engineered
  rainfall_intensity:   6.25,
  elevation_cat:        2,
  slope_proxy:          0.67,
  twi_proxy:            0.37,
  combined_rain_index:  62.0,
  season:               2,
  critical_zone:        1,
  log_rainfall_mm:      3.93,
  log_antecedent_7day_mm: 4.39,
  log_elevation_m:      6.69,
  temp_range:           7.0,
  landslide_risk_score: 0.45,
};

const LANDSLIDE_RAW_CONFIG = [
  ['rainfall_mm',           'Daily Rainfall',          'mm',    0,    400,  1,    'Rainfall in the last 24 hours'],
  ['antecedent_7day_mm',    '7-Day Antecedent Rain',   'mm',    0,    600,  1,    'Cumulative rainfall over the past 7 days — critical landslide trigger'],
  ['temp_max_c',            'Max Temperature',         '°C',    -10,  50,   0.5,  'Maximum daily temperature'],
  ['temp_min_c',            'Min Temperature',         '°C',    -20,  40,   0.5,  'Minimum daily temperature'],
  ['humidity_pct',          'Relative Humidity',       '%',     0,    100,  1,    'Maximum relative humidity (%)'],
  ['wind_speed_kmh',        'Wind Speed',              'km/h',  0,    150,  1,    'Maximum wind speed'],
  ['precipitation_hours',   'Precipitation Hours',     'hrs',   0,    24,   0.5,  'Number of hours with precipitation'],
  ['evapotranspiration_mm', 'Evapotranspiration',      'mm',    0,    20,   0.1,  'Daily reference ET (FAO-56)'],
  ['soil_moisture',         'Soil Moisture',           '0-1',   0,    1,    0.01, 'Volumetric soil moisture 0–7cm depth'],
  ['elevation_m',           'Elevation',               'm',     0,    6000, 10,   'Terrain elevation — proxy for slope steepness'],
  ['river_discharge_m3s',   'River Discharge',         'm³/s',  0,    10000,10,   'River flow rate (m³/second)'],
  ['month',                 'Month',                   '',      1,    12,   1,    'Month of the year (1=Jan, 12=Dec)'],
];

const LANDSLIDE_ENGINEERED_CONFIG = [
  ['rainfall_intensity',    'Rainfall Intensity',      'mm/hr', 0,    100,  0.1,  'rainfall_mm / precipitation_hours'],
  ['elevation_cat',         'Elevation Category',      '',      0,    4,    1,    'Binned elevation category (0–4)'],
  ['slope_proxy',           'Slope Proxy',             '',      0,    1,    0.01, 'log₁ₚ(elevation_m) / 10'],
  ['twi_proxy',             'TWI Proxy',               '',      0,    10,   0.01, 'soil_moisture / (slope_proxy + 0.01)'],
  ['combined_rain_index',   'Combined Rain Index',     'mm',    0,    640,  0.1,  '0.6 × rainfall_mm + 0.4 × antecedent_7day_mm'],
  ['season',                'Season',                  '',      0,    3,    1,    'Binned season code (0–3)'],
  ['critical_zone',         'Critical Zone',           '',      0,    1,    1,    'Binary flag: 1 if elevation > 500m AND rainfall > 30mm'],
  ['log_rainfall_mm',       'Log Rainfall',            '',      0,    7,    0.01, 'log₁ₚ(rainfall_mm)'],
  ['log_antecedent_7day_mm','Log Antecedent Rain',     '',      0,    7,    0.01, 'log₁ₚ(antecedent_7day_mm)'],
  ['log_elevation_m',       'Log Elevation',           '',      0,    9,    0.01, 'log₁ₚ(elevation_m)'],
  ['temp_range',            'Temp Range',              '°C',    0,    50,   0.5,  'temp_max_c − temp_min_c'],
  ['landslide_risk_score',  'Landslide Risk Score',    '',      0,    1,    0.01, 'Weighted normalized score (0–1)'],
];

function ManualResultBar({ label, mlPct, finalPct, capPct, color, icon }) {
  return (
    <div className="manual-result-block">
      <div className="manual-result-header">
        {icon}
        <span className="manual-result-title">{label}</span>
        <span className="manual-result-final" style={{ color }}>{finalPct}%</span>
      </div>
      <div className="manual-result-bars">
        <div className="manual-bar-row">
          <span className="manual-bar-label">Raw ML Model</span>
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{ width: `${mlPct}%`, background: '#60a5fa' }} />
          </div>
          <span className="manual-bar-val">{mlPct}%</span>
        </div>
        <div className="manual-bar-row">
          <span className="manual-bar-label">Physics Cap</span>
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{ width: `${capPct}%`, background: '#a78bfa' }} />
          </div>
          <span className="manual-bar-val">{capPct}%</span>
        </div>
        <div className="manual-bar-row">
          <span className="manual-bar-label">Final Risk</span>
          <div className="risk-bar-track">
            <div className="risk-bar-fill" style={{ width: `${finalPct}%`, background: color }} />
          </div>
          <span className="manual-bar-val" style={{ color, fontWeight: 700 }}>{finalPct}%</span>
        </div>
      </div>
      <div className="risk-status-row" style={{ marginTop: '0.5rem' }}>
        {getRiskIcon(finalPct)}
        <span className="risk-status-label">{getRiskLabel(finalPct)} — {getRiskAdvice(finalPct)}</span>
      </div>
    </div>
  );
}

// ── Flood Manual Test Sub-Tab ──
function FloodManualTest() {
  const [params, setParams] = useState(FLOOD_DEFAULT_PARAMS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoCalc, setAutoCalc] = useState(true);

  const handleRawChange = (key, val) => {
    const numericVal = parseFloat(val);
    setParams(prev => {
      const nextParams = { ...prev, [key]: numericVal };
      if (autoCalc) {
        const engineered = calculateFloodEngineered(nextParams);
        return { ...nextParams, ...engineered };
      }
      return nextParams;
    });
  };

  const handleEngineeredChange = (key, val) => {
    setAutoCalc(false); // Disable auto-calculate if user overrides an engineered parameter manually
    setParams(prev => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handlePreset = (preset) => {
    let raw = {};
    if (preset === 'extreme') raw = {
      rainfall_mm: 236.6, temp_max_c: 27.1, temp_min_c: 25.6, humidity_pct: 97,
      wind_speed_kmh: 43.3, precipitation_hours: 24, evapotranspiration_mm: 1.1,
      elevation_m: 85, river_discharge_m3s: 0.66, month: 6, year: 2017,
    };
    if (preset === 'moderate') raw = {
      rainfall_mm: 21.8, temp_max_c: 30.6, temp_min_c: 23.5, humidity_pct: 100,
      wind_speed_kmh: 13.3, precipitation_hours: 13, evapotranspiration_mm: 3.62,
      elevation_m: 8, river_discharge_m3s: 4.68, month: 11, year: 2022,
    };
    if (preset === 'safe') raw = {
      rainfall_mm: 0, temp_max_c: 42.2, temp_min_c: 29.4, humidity_pct: 58,
      wind_speed_kmh: 21.1, precipitation_hours: 0, evapotranspiration_mm: 9.96,
      elevation_m: 204, river_discharge_m3s: 0, month: 5, year: 2026,
    };
    const engineered = calculateFloodEngineered(raw);
    setParams({ ...raw, ...engineered });
    setResult(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/predict-flood-manual`, {
        rainfall_mm: params.rainfall_mm,
        temp_max_c: params.temp_max_c,
        temp_min_c: params.temp_min_c,
        humidity_pct: params.humidity_pct,
        wind_speed_kmh: params.wind_speed_kmh,
        precipitation_hours: params.precipitation_hours,
        evapotranspiration_mm: params.evapotranspiration_mm,
        elevation_m: params.elevation_m,
        river_discharge_m3s: params.river_discharge_m3s,
        
        rainfall_category: Math.round(params.rainfall_category),
        season: Math.round(params.season),
        humidity_risk: Math.round(params.humidity_risk),
        low_elevation: Math.round(params.low_elevation),
        high_discharge: Math.round(params.high_discharge),
        log_rainfall_mm: params.log_rainfall_mm,
        log_river_discharge_m3s: params.log_river_discharge_m3s,
        log_elevation_m: params.log_elevation_m,
        rain_humidity_index: params.rain_humidity_index,
        precip_efficiency: params.precip_efficiency,
        temp_range_c: params.temp_range_c,
        flood_risk_score: params.flood_risk_score,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manual-layout">
      <div className="manual-form-panel">
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <div className="manual-form-title">
            <Droplets size={20} className="icon-blue" />
            Flood Prediction — Manual Training Parameters Test
          </div>
          <p className="search-panel-desc">
            Directly test the flood model by passing the <strong>exact features used in training</strong>.
            You can modify the engineered features manually to test the ML model's limits.
          </p>
          <div className="manual-model-badge" style={{ background: '#3b82f622', borderColor: '#3b82f644', color: '#60a5fa' }}>
            <Droplets size={14} /> Model: SVM (Calibrated) · AUC: 0.9807 · 21 total features · 1,870 training rows
          </div>

          <div className="section-label">Quick Presets (Real Events)</div>
          <div className="quick-locs">
            <button className="quick-loc-btn" onClick={() => handlePreset('extreme')} style={{ borderColor: '#ef444455' }}>🌊 Bangladesh 2017</button>
            <button className="quick-loc-btn" onClick={() => handlePreset('moderate')} style={{ borderColor: '#f59e0b55' }}>🌧️ Indonesia Sumatra 2022</button>
            <button className="quick-loc-btn" onClick={() => handlePreset('safe')} style={{ borderColor: '#10b98155' }}>☀️ Dry Day (No Rain)</button>
          </div>
        </div>

        {/* Raw Parameters section */}
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <div className="section-label" style={{ marginBottom: '1rem' }}>📋 Raw Inputs ({FLOOD_RAW_CONFIG.length})</div>
          <div className="manual-params-grid">
            {FLOOD_RAW_CONFIG.map(([key, label, unit, min, max, step, desc]) => (
              <div key={key} className="manual-param-row">
                <div className="manual-param-header">
                  <span className="manual-param-label">{label}</span>
                  <span className="manual-param-unit">
                    {key === 'month' ? MONTH_NAMES[Math.round(params[key]) - 1] : `${params[key]}${unit}`}
                  </span>
                </div>
                <p className="manual-param-desc">{desc}</p>
                <input type="range" min={min} max={max} step={step} value={params[key] || 0}
                  onChange={e => handleRawChange(key, e.target.value)} className="manual-slider" />
                <div className="manual-slider-bounds"><span>{min}{unit}</span><span>{max}{unit}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* Engineered Parameters section */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #ffffff11', paddingBottom: '0.5rem' }}>
            <span className="section-label" style={{ margin: 0 }}>⚙️ Engineered Features ({FLOOD_ENGINEERED_CONFIG.length})</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '13px', cursor: 'pointer', color: '#60a5fa' }}>
              <input type="checkbox" checked={autoCalc} onChange={e => {
                setAutoCalc(e.target.checked);
                if (e.target.checked) {
                  setParams(prev => ({ ...prev, ...calculateFloodEngineered(prev) }));
                }
              }} style={{ cursor: 'pointer' }} />
              Auto-Calculate
            </label>
          </div>
          
          <div className="manual-params-grid">
            {FLOOD_ENGINEERED_CONFIG.map(([key, label, unit, min, max, step, desc]) => (
              <div key={key} className="manual-param-row" style={{ opacity: autoCalc ? 0.75 : 1, transition: 'opacity 0.2s' }}>
                <div className="manual-param-header">
                  <span className="manual-param-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {label} {autoCalc && <span style={{ fontSize: '10px', background: '#3b82f633', color: '#60a5fa', padding: '1px 4px', borderRadius: '4px' }}>Auto</span>}
                  </span>
                  <span className="manual-param-unit" style={{ color: autoCalc ? '#60a5fa' : '#fbbf24' }}>
                    {params[key] !== undefined ? params[key] : 0}{unit}
                  </span>
                </div>
                <p className="manual-param-desc">{desc}</p>
                <input type="range" min={min} max={max} step={step} value={params[key] !== undefined ? params[key] : 0}
                  onChange={e => handleEngineeredChange(key, e.target.value)} className="manual-slider" />
                <div className="manual-slider-bounds"><span>{min}{unit}</span><span>{max}{unit}</span></div>
              </div>
            ))}
          </div>

          <button id="flood-manual-predict-btn" className="gps-btn" style={{ marginTop: '1.5rem', width: '100%' }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? <><div className="spinner-sm" /> Running Model...</> : <><Droplets size={18} /> Predict Flood Risk</>}
          </button>
        </div>
      </div>

      <div className="manual-result-panel">
        {error && <div className="error-card">{error}</div>}
        {!result && !loading && (
          <div className="empty-card empty-card-lg">
            <Droplets size={48} className="empty-icon" />
            <p>Set flood parameters on the left and click <strong>Predict Flood Risk</strong>.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '13px', opacity: 0.6 }}>Passes all 21 training features directly to the ML model for evaluation.</p>
          </div>
        )}
        {loading && (
          <div className="loading-card loading-card-lg">
            <div className="spinner" />
            <p className="loading-text">Running flood model...</p>
            <p className="loading-sub">Passing 21 training features directly to ML model</p>
          </div>
        )}
        {result && (
          <>
            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <div className="manual-summary-title"><Droplets size={16} className="icon-blue" /> Flood Prediction Result</div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="manual-result-big" style={{ color: getRiskColor(result.flood_risk_pct) }}>{result.flood_risk_pct}%</span>
                <span className="pill" style={{ background: getRiskColor(result.flood_risk_pct) + '33', color: getRiskColor(result.flood_risk_pct), borderColor: getRiskColor(result.flood_risk_pct) + '66', fontSize: '15px', padding: '6px 14px' }}>
                  {getRiskLabel(result.flood_risk_pct)}
                </span>
              </div>
            </div>
            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <ManualResultBar label="Flood Risk Details" mlPct={result.raw_ml_probability} capPct={result.physics_cap}
                finalPct={result.flood_risk_pct} color={getRiskColor(result.flood_risk_pct)}
                icon={<Droplets size={18} className="icon-blue" />} />
            </div>
            <div className="glass-card live-factors-card">
              <div className="live-factors-title">Evaluation Logic</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7 }}>
                <p>① <span style={{ color: '#60a5fa' }}>Raw ML ({result.raw_ml_probability}%)</span> — SVM Model evaluated directly on the 21 input features.</p>
                <p>② <span style={{ color: '#a78bfa' }}>Physics Cap ({result.physics_cap}%)</span> — Calculated using rain, river discharge, and elevation.</p>
                <p>③ <span style={{ color: '#e2e8f0' }}>Final Risk ({result.flood_risk_pct}%)</span> — Capped by physical feasibility: min(ML, Physics Cap).</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Landslide Manual Test Sub-Tab ──
function LandslideManualTest() {
  const [params, setParams] = useState(LANDSLIDE_DEFAULT_PARAMS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoCalc, setAutoCalc] = useState(true);

  const handleRawChange = (key, val) => {
    const numericVal = parseFloat(val);
    setParams(prev => {
      const nextParams = { ...prev, [key]: numericVal };
      if (autoCalc) {
        const engineered = calculateLandslideEngineered(nextParams);
        return { ...nextParams, ...engineered };
      }
      return nextParams;
    });
  };

  const handleEngineeredChange = (key, val) => {
    setAutoCalc(false); // Disable auto-calculate if user overrides an engineered parameter manually
    setParams(prev => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handlePreset = (preset) => {
    let raw = {};
    if (preset === 'extreme') raw = {
      rainfall_mm: 379.2, antecedent_7day_mm: 190.7, temp_max_c: 24.3, temp_min_c: 22.8,
      humidity_pct: 100, wind_speed_kmh: 26.3, precipitation_hours: 24, evapotranspiration_mm: 0.42,
      soil_moisture: 0.43, elevation_m: 142, river_discharge_m3s: 15.52, flood_nearby: 0,
      month: 4, year: 2022,
    };
    if (preset === 'moderate') raw = {
      rainfall_mm: 7.8, antecedent_7day_mm: 147.5, temp_max_c: 24.5, temp_min_c: 21.6,
      humidity_pct: 89, wind_speed_kmh: 5.8, precipitation_hours: 10, evapotranspiration_mm: 1.61,
      soil_moisture: 0.497, elevation_m: 888, river_discharge_m3s: 5.22, flood_nearby: 0,
      month: 6, year: 2022,
    };
    if (preset === 'safe') raw = {
      rainfall_mm: 0, antecedent_7day_mm: 0.3, temp_max_c: 41.8, temp_min_c: 26.4,
      humidity_pct: 60, wind_speed_kmh: 16.4, precipitation_hours: 0, evapotranspiration_mm: 8.94,
      soil_moisture: 0.044, elevation_m: 204, river_discharge_m3s: 0, flood_nearby: 0,
      month: 5, year: 2026,
    };
    const engineered = calculateLandslideEngineered(raw);
    setParams({ ...raw, ...engineered });
    setResult(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/predict-landslide-manual`, {
        rainfall_mm: params.rainfall_mm,
        antecedent_7day_mm: params.antecedent_7day_mm,
        temp_max_c: params.temp_max_c,
        temp_min_c: params.temp_min_c,
        humidity_pct: params.humidity_pct,
        wind_speed_kmh: params.wind_speed_kmh,
        precipitation_hours: params.precipitation_hours,
        evapotranspiration_mm: params.evapotranspiration_mm,
        soil_moisture: params.soil_moisture,
        elevation_m: params.elevation_m,
        river_discharge_m3s: params.river_discharge_m3s,
        flood_nearby: params.flood_nearby ? 1 : 0,

        rainfall_intensity: params.rainfall_intensity,
        elevation_cat: Math.round(params.elevation_cat),
        slope_proxy: params.slope_proxy,
        twi_proxy: params.twi_proxy,
        combined_rain_index: params.combined_rain_index,
        season: Math.round(params.season),
        critical_zone: Math.round(params.critical_zone),
        log_rainfall_mm: params.log_rainfall_mm,
        log_antecedent_7day_mm: params.log_antecedent_7day_mm,
        log_elevation_m: params.log_elevation_m,
        temp_range: params.temp_range,
        landslide_risk_score: params.landslide_risk_score,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manual-layout">
      <div className="manual-form-panel">
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <div className="manual-form-title">
            <Mountain size={20} className="icon-amber" />
            Landslide Prediction — Manual Training Parameters Test
          </div>
          <p className="search-panel-desc">
            Directly test the landslide model by passing the <strong>exact features used in training</strong>.
            You can modify the engineered features manually to test the ML model's limits.
          </p>
          <div className="manual-model-badge" style={{ background: '#f59e0b22', borderColor: '#f59e0b44', color: '#fbbf24' }}>
            <Mountain size={14} /> Model: Random Forest · AUC: 1.0 · 24 total features · 777 training rows
          </div>

          <div className="section-label">Quick Presets (Real Events)</div>
          <div className="quick-locs">
            <button className="quick-loc-btn" onClick={() => handlePreset('extreme')} style={{ borderColor: '#ef444455' }}>⛰️ Philippines Leyte 2022</button>
            <button className="quick-loc-btn" onClick={() => handlePreset('moderate')} style={{ borderColor: '#f59e0b55' }}>🏔️ India Nagaland 2022</button>
            <button className="quick-loc-btn" onClick={() => handlePreset('safe')} style={{ borderColor: '#10b98155' }}>☀️ Safe Location (No Rain)</button>
          </div>
        </div>

        {/* Raw Parameters section */}
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <div className="section-label" style={{ marginBottom: '1rem' }}>📋 Raw Inputs ({LANDSLIDE_RAW_CONFIG.length + 1})</div>
          <div className="manual-params-grid">
            {LANDSLIDE_RAW_CONFIG.map(([key, label, unit, min, max, step, desc]) => (
              <div key={key} className="manual-param-row">
                <div className="manual-param-header">
                  <span className="manual-param-label">{label}</span>
                  <span className="manual-param-unit">
                    {key === 'month' ? MONTH_NAMES[Math.round(params[key]) - 1] : `${params[key]}${unit}`}
                  </span>
                </div>
                <p className="manual-param-desc">{desc}</p>
                <input type="range" min={min} max={max} step={step} value={params[key] || 0}
                  onChange={e => handleRawChange(key, e.target.value)} className="manual-slider" />
                <div className="manual-slider-bounds"><span>{min}{unit}</span><span>{max}{unit}</span></div>
              </div>
            ))}

            {/* Flood Nearby toggle */}
            <div className="manual-param-row">
              <div className="manual-param-header">
                <span className="manual-param-label">Flood Nearby</span>
                <span className="manual-param-unit">{params.flood_nearby ? 'Yes' : 'No'}</span>
              </div>
              <p className="manual-param-desc">Is there a flood event nearby?</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className={`quick-loc-btn ${params.flood_nearby ? 'active' : ''}`}
                  style={{ flex: 1, background: params.flood_nearby ? '#60a5fa22' : 'transparent', borderColor: params.flood_nearby ? '#60a5fa' : undefined }}
                  onClick={() => setParams(p => ({ ...p, flood_nearby: 1 }))}>Yes</button>
                <button className={`quick-loc-btn ${!params.flood_nearby ? 'active' : ''}`}
                  style={{ flex: 1, background: !params.flood_nearby ? '#10b98122' : 'transparent', borderColor: !params.flood_nearby ? '#10b981' : undefined }}
                  onClick={() => setParams(p => ({ ...p, flood_nearby: 0 }))}>No</button>
              </div>
            </div>
          </div>
        </div>

        {/* Engineered Parameters section */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #ffffff11', paddingBottom: '0.5rem' }}>
            <span className="section-label" style={{ margin: 0 }}>⚙️ Engineered Features ({LANDSLIDE_ENGINEERED_CONFIG.length})</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '13px', cursor: 'pointer', color: '#60a5fa' }}>
              <input type="checkbox" checked={autoCalc} onChange={e => {
                setAutoCalc(e.target.checked);
                if (e.target.checked) {
                  setParams(prev => ({ ...prev, ...calculateLandslideEngineered(prev) }));
                }
              }} style={{ cursor: 'pointer' }} />
              Auto-Calculate
            </label>
          </div>
          
          <div className="manual-params-grid">
            {LANDSLIDE_ENGINEERED_CONFIG.map(([key, label, unit, min, max, step, desc]) => (
              <div key={key} className="manual-param-row" style={{ opacity: autoCalc ? 0.75 : 1, transition: 'opacity 0.2s' }}>
                <div className="manual-param-header">
                  <span className="manual-param-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {label} {autoCalc && <span style={{ fontSize: '10px', background: '#3b82f633', color: '#60a5fa', padding: '1px 4px', borderRadius: '4px' }}>Auto</span>}
                  </span>
                  <span className="manual-param-unit" style={{ color: autoCalc ? '#60a5fa' : '#fbbf24' }}>
                    {params[key] !== undefined ? params[key] : 0}{unit}
                  </span>
                </div>
                <p className="manual-param-desc">{desc}</p>
                <input type="range" min={min} max={max} step={step} value={params[key] !== undefined ? params[key] : 0}
                  onChange={e => handleEngineeredChange(key, e.target.value)} className="manual-slider" />
                <div className="manual-slider-bounds"><span>{min}{unit}</span><span>{max}{unit}</span></div>
              </div>
            ))}
          </div>

          <button id="landslide-manual-predict-btn" className="gps-btn" style={{ marginTop: '1.5rem', width: '100%' }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? <><div className="spinner-sm" /> Running Model...</> : <><Mountain size={18} /> Predict Landslide Risk</>}
          </button>
        </div>
      </div>

      <div className="manual-result-panel">
        {error && <div className="error-card">{error}</div>}
        {!result && !loading && (
          <div className="empty-card empty-card-lg">
            <Mountain size={48} className="empty-icon" />
            <p>Set landslide parameters on the left and click <strong>Predict Landslide Risk</strong>.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '13px', opacity: 0.6 }}>Passes all 24 training features directly to the ML model for evaluation.</p>
          </div>
        )}
        {loading && (
          <div className="loading-card loading-card-lg">
            <div className="spinner" />
            <p className="loading-text">Running landslide model...</p>
            <p className="loading-sub">Passing 24 training features directly to ML model</p>
          </div>
        )}
        {result && (
          <>
            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <div className="manual-summary-title"><Mountain size={16} className="icon-amber" /> Landslide Prediction Result</div>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="manual-result-big" style={{ color: getRiskColor(result.landslide_risk_pct) }}>{result.landslide_risk_pct}%</span>
                <span className="pill" style={{ background: getRiskColor(result.landslide_risk_pct) + '33', color: getRiskColor(result.landslide_risk_pct), borderColor: getRiskColor(result.landslide_risk_pct) + '66', fontSize: '15px', padding: '6px 14px' }}>
                  {getRiskLabel(result.landslide_risk_pct)}
                </span>
              </div>
            </div>
            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <ManualResultBar label="Landslide Risk Details" mlPct={result.raw_ml_probability} capPct={result.physics_cap}
                finalPct={result.landslide_risk_pct} color={getRiskColor(result.landslide_risk_pct)}
                icon={<Mountain size={18} className="icon-amber" />} />
            </div>
            <div className="glass-card live-factors-card">
              <div className="live-factors-title">Evaluation Logic</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7 }}>
                <p>① <span style={{ color: '#60a5fa' }}>Raw ML ({result.raw_ml_probability}%)</span> — Random Forest Model evaluated directly on the 24 input features.</p>
                <p>② <span style={{ color: '#a78bfa' }}>Physics Cap ({result.physics_cap}%)</span> — Calculated using rain, slope (elevation), and soil moisture.</p>
                <p>③ <span style={{ color: '#e2e8f0' }}>Final Risk ({result.landslide_risk_pct}%)</span> — Capped by physical feasibility: min(ML, Physics Cap).</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab wrapper with Flood / Landslide sub-tabs ──
function TabManualTest() {
  const [subTab, setSubTab] = useState('flood');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sub-tab navigation */}
      <div className="manual-subtabs">
        <button className={`manual-subtab ${subTab === 'flood' ? 'manual-subtab-active manual-subtab-flood' : ''}`}
          onClick={() => setSubTab('flood')}>
          <Droplets size={16} /> Flood Prediction
        </button>
        <button className={`manual-subtab ${subTab === 'landslide' ? 'manual-subtab-active manual-subtab-landslide' : ''}`}
          onClick={() => setSubTab('landslide')}>
          <Mountain size={16} /> Landslide Prediction
        </button>
      </div>
      {/* Sub-tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'flood' && <FloodManualTest />}
        {subTab === 'landslide' && <LandslideManualTest />}
      </div>
    </div>
  );
}

// ── TAB 5: Nearby Facilities ──────────────────────────────────
function TabEvacuation() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <NearbyFacilities />
    </div>
  );
}


// ── Root App ──────────────────────────────────────────────────
const TABS = [
  { id: 'map',      label: 'Map Explorer',     Icon: Map },
  { id: 'search',   label: 'Search & GPS',     Icon: Crosshair },
  { id: 'dual',     label: 'Dual Risk Maps',   Icon: Layers },
  { id: 'manual',   label: 'Manual Test',      Icon: FlaskConical },
  { id: 'evacuation', label: 'Nearby Help', Icon: Hospital },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('map');

  return (
    <div className="app-shell">
      {/* Top Navigation */}
      <header className="top-nav glass">
        <div className="nav-brand">
          <div className="nav-brand-icon">
            <Droplets size={18} />
          </div>
          <div>
            <span className="nav-brand-name">TerraGuard AI</span>
            <span className="nav-brand-sub">Flood &amp; Landslide Prediction</span>
          </div>
        </div>
        <nav className="nav-tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              className={`nav-tab ${activeTab === id ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Page Content */}
      <main className="page-content">
        {activeTab === 'map'        && <TabMapExplorer />}
        {activeTab === 'search'     && <TabSearchGPS />}
        {activeTab === 'dual'       && <TabDualMaps />}
        {activeTab === 'manual'     && <TabManualTest />}
        {activeTab === 'evacuation' && <TabEvacuation />}
      </main>
    </div>
  );
}
