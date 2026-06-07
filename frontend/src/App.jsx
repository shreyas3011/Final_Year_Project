import { useState, useCallback } from 'react';
import './App.css';
import { MapContainer, TileLayer, Marker, useMapEvents, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import {
  Droplets, Mountain, Wind, ThermometerSun, Waves, MapPin,
  Search, Navigation, Layers, Map, Loader, AlertTriangle,
  CheckCircle, XCircle, Crosshair
} from 'lucide-react';

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
  if (pct < 65) return '#f59e0b';
  return '#ef4444';
}

function getRiskTextClass(pct) {
  if (pct < 30) return 'risk-text-low';
  if (pct < 65) return 'risk-text-med';
  return 'risk-text-high';
}

function getRiskBorderClass(pct) {
  if (pct < 30) return 'risk-border-low';
  if (pct < 65) return 'risk-border-med';
  return 'risk-border-high';
}

function getRiskLabel(pct) {
  if (pct < 30) return 'Low Risk';
  if (pct < 65) return 'Moderate Risk';
  return 'High Risk';
}

function getRiskAdvice(pct) {
  if (pct < 30) return 'Normal activity. No immediate concern.';
  if (pct < 65) return 'Monitor local weather. Stay informed.';
  return 'Immediate action recommended. Seek safe ground.';
}

function getRiskIcon(pct) {
  if (pct < 30) return <CheckCircle size={20} className="risk-icon-low" />;
  if (pct < 65) return <AlertTriangle size={20} className="risk-icon-med" />;
  return <XCircle size={20} className="risk-icon-high" />;
}

// ── API call ──────────────────────────────────────────────────
async function fetchPrediction(lat, lon) {
  const response = await axios.post(`${API_BASE}/predict`, { lat, lon });
  return response.data;
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
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  const handleLocationSelect = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPrediction(lat, lon);
      setPrediction(data);
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
          <PredictionResult prediction={prediction} />
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
        </MapContainer>
      </div>
    </div>
  );
}

// ── TAB 2: Search & GPS ───────────────────────────────────────
function TabSearchGPS() {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  const runPrediction = useCallback(async (lat, lon, name = '') => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    try {
      const data = await fetchPrediction(lat, lon);
      setCoords({ lat, lon });
      setLocationName(name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      setPrediction(data);
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
        <div className="search-input-row">
          <input
            id="location-search-input"
            className="search-input"
            type="text"
            placeholder="e.g. Mumbai, Kedarnath, Bangladesh..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            id="location-search-btn"
            className="search-submit-btn"
            onClick={handleSearch}
            disabled={loading || gpsLoading}
          >
            {loading ? <div className="spinner-sm" /> : <Search size={18} />}
          </button>
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
const SAMPLE_POINTS = [
  { lat: 30.74, lon: 79.07, label: 'Kedarnath' },
  { lat: 9.55,  lon: 76.62, label: 'Kerala' },
  { lat: 19.07, lon: 72.87, label: 'Mumbai' },
  { lat: 26.14, lon: 91.74, label: 'Assam' },
  { lat: 25.00, lon: 10.00, label: 'Sahara' },
  { lat: 27.02, lon: 74.21, label: 'Rajasthan' },
  { lat: 23.25, lon: 77.41, label: 'Bhopal' },
  { lat: 13.08, lon: 80.27, label: 'Chennai' },
  { lat: 28.61, lon: 77.20, label: 'Delhi' },
];

function DualRiskMap({ points, riskKey, title, icon }) {
  return (
    <div className="dual-map-wrapper glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dual-map-header">
        {icon}
        <span>{title}</span>
      </div>
      <div style={{ height: 'calc(100% - 44px)' }}>
        <MapContainer center={[20.5937, 78.9629]} zoom={4} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {points.map((pt, i) => pt.prediction && (
            <CircleMarker
              key={i}
              center={[pt.lat, pt.lon]}
              radius={18}
              pathOptions={{
                fillColor: getRiskColor(pt.prediction.predictions[riskKey]),
                color: getRiskColor(pt.prediction.predictions[riskKey]),
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '140px' }}>
                  <strong>{pt.label}</strong><br />
                  <span style={{ color: getRiskColor(pt.prediction.predictions[riskKey]) }}>
                    {pt.prediction.predictions[riskKey]}% — {getRiskLabel(pt.prediction.predictions[riskKey])}
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function TabDualMaps() {
  const [points, setPoints] = useState(SAMPLE_POINTS.map(p => ({ ...p, prediction: null })));
  const [loadingAll, setLoadingAll] = useState(false);
  const [clickPt, setClickPt] = useState(null);
  const [clickLoading, setClickLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetched, setFetched] = useState(false);

  const loadAllPoints = async () => {
    setLoadingAll(true);
    setError(null);
    try {
      const updated = await Promise.all(
        points.map(async (pt) => {
          try {
            const pred = await fetchPrediction(pt.lat, pt.lon);
            return { ...pt, prediction: pred };
          } catch {
            return pt;
          }
        })
      );
      setPoints(updated);
      setFetched(true);
    } catch {
      setError('Failed to load predictions.');
    } finally {
      setLoadingAll(false);
    }
  };

  const handleMapClick = useCallback(async (lat, lon) => {
    setClickLoading(true);
    setError(null);
    try {
      const pred = await fetchPrediction(lat, lon);
      const newPt = { lat, lon, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, prediction: pred };
      setClickPt(newPt);
      setPoints(prev => {
        const idx = prev.findIndex(p => p.label === newPt.label);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = newPt;
          return updated;
        }
        return [...prev, newPt];
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Click prediction failed.');
    } finally {
      setClickLoading(false);
    }
  }, []);

  const allPoints = clickPt
    ? [...points.filter(p => p.label !== clickPt.label), clickPt]
    : points;

  return (
    <div className="dual-maps-layout">
      {/* Controls */}
      <div className="dual-maps-controls glass-card">
        <div className="dual-maps-controls-left">
          <Layers size={18} className="icon-blue" />
          <span className="dual-maps-title">Risk Heat Map — India &amp; Beyond</span>
          {clickLoading && <div className="spinner-sm" />}
        </div>
        <div className="dual-maps-controls-right">
          <div className="legend">
            <span className="legend-dot" style={{ background: '#10b981' }} /> 0–30% Low
            <span className="legend-dot" style={{ background: '#f59e0b', marginLeft: '10px' }} /> 30–65% Moderate
            <span className="legend-dot" style={{ background: '#ef4444', marginLeft: '10px' }} /> 65–100% High
          </div>
          <button
            id="load-all-predictions-btn"
            className="load-btn"
            onClick={loadAllPoints}
            disabled={loadingAll}
          >
            {loadingAll ? <><div className="spinner-sm" /> Loading...</> : 'Load Predictions'}
          </button>
        </div>
      </div>

      {error && <div className="error-card">{error}</div>}

      {!fetched && !loadingAll && (
        <div className="empty-card empty-card-lg" style={{ marginBottom: '1rem' }}>
          <Layers size={40} className="empty-icon" />
          <p>Click <strong>"Load Predictions"</strong> to fetch real-time data for sample locations, or click directly on the maps below to add your own point.</p>
        </div>
      )}

      {loadingAll && (
        <div className="loading-card" style={{ marginBottom: '1rem' }}>
          <div className="spinner" />
          <p className="loading-text">Fetching predictions for {SAMPLE_POINTS.length} locations...</p>
        </div>
      )}

      {/* Dual Maps */}
      <div className="dual-maps-grid">
        {/* Flood Map */}
        <div className="dual-map-container">
          <MapContainer center={[20.5937, 78.9629]} zoom={4} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <ClickCaptureLayer onMapClick={handleMapClick} />
            {allPoints.filter(pt => pt.prediction).map((pt, i) => (
              <CircleMarker
                key={`flood-${i}`}
                center={[pt.lat, pt.lon]}
                radius={18}
                pathOptions={{
                  fillColor: getRiskColor(pt.prediction.predictions.flood_risk_pct),
                  color: getRiskColor(pt.prediction.predictions.flood_risk_pct),
                  fillOpacity: 0.75,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '150px' }}>
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
          </div>
        </div>

        {/* Landslide Map */}
        <div className="dual-map-container">
          <MapContainer center={[20.5937, 78.9629]} zoom={4} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <ClickCaptureLayer onMapClick={handleMapClick} />
            {allPoints.filter(pt => pt.prediction).map((pt, i) => (
              <CircleMarker
                key={`ls-${i}`}
                center={[pt.lat, pt.lon]}
                radius={18}
                pathOptions={{
                  fillColor: getRiskColor(pt.prediction.predictions.landslide_risk_pct),
                  color: getRiskColor(pt.prediction.predictions.landslide_risk_pct),
                  fillOpacity: 0.75,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', minWidth: '150px' }}>
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
          </div>
        </div>
      </div>

      {/* Click result banner */}
      {clickPt && clickPt.prediction && (
        <div className="click-result glass-card">
          <div className="click-result-coords">
            <MapPin size={14} className="icon-blue" />
            {clickPt.label}
          </div>
          <div className="click-result-pills">
            <span className="pill" style={{ background: getRiskColor(clickPt.prediction.predictions.flood_risk_pct) + '33', color: getRiskColor(clickPt.prediction.predictions.flood_risk_pct), borderColor: getRiskColor(clickPt.prediction.predictions.flood_risk_pct) + '66' }}>
              <Droplets size={12} /> Flood {clickPt.prediction.predictions.flood_risk_pct}%
            </span>
            <span className="pill" style={{ background: getRiskColor(clickPt.prediction.predictions.landslide_risk_pct) + '33', color: getRiskColor(clickPt.prediction.predictions.landslide_risk_pct), borderColor: getRiskColor(clickPt.prediction.predictions.landslide_risk_pct) + '66' }}>
              <Mountain size={12} /> Landslide {clickPt.prediction.predictions.landslide_risk_pct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
const TABS = [
  { id: 'map',    label: 'Map Explorer',   Icon: Map },
  { id: 'search', label: 'Search & GPS',   Icon: Crosshair },
  { id: 'dual',   label: 'Dual Risk Maps', Icon: Layers },
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
        {activeTab === 'map'    && <TabMapExplorer />}
        {activeTab === 'search' && <TabSearchGPS />}
        {activeTab === 'dual'   && <TabDualMaps />}
      </main>
    </div>
  );
}
