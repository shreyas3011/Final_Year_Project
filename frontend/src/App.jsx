import { useState, useCallback } from 'react';
import './App.css';
import { MapContainer, TileLayer, Marker, useMapEvents, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import {
  Droplets, Mountain, Wind, ThermometerSun, Waves, MapPin,
  Search, Navigation, Layers, Map, Loader, AlertTriangle,
  CheckCircle, XCircle, Crosshair, FlaskConical, SlidersHorizontal
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

// ── TAB 4: Manual Parameter Test ─────────────────────────────
const DEFAULT_PARAMS = {
  rainfall_mm:          50,
  antecedent_7day_mm:   80,
  temp_max_c:           30,
  temp_min_c:           20,
  humidity_pct:         75,
  wind_speed_kmh:       20,
  precipitation_hours:  6,
  evapotranspiration_mm:3,
  soil_moisture:        0.25,
  elevation_m:          500,
  river_discharge_m3s:  300,
  flood_nearby:         0,
  month:                7,
  year:                 2024,
};

const PARAM_CONFIG = [
  // [key, label, unit, min, max, step, description]
  ['rainfall_mm',           'Daily Rainfall',          'mm',    0,    400,  1,    'Rainfall in the last 24 hours'],
  ['antecedent_7day_mm',    '7-Day Antecedent Rain',   'mm',    0,    600,  1,    'Total rainfall over the past 7 days'],
  ['temp_max_c',            'Max Temperature',         '°C',    -10,  50,   0.5,  'Maximum daily temperature'],
  ['temp_min_c',            'Min Temperature',         '°C',    -20,  40,   0.5,  'Minimum daily temperature'],
  ['humidity_pct',          'Relative Humidity',       '%',     0,    100,  1,    'Maximum relative humidity (%)'],
  ['wind_speed_kmh',        'Wind Speed',              'km/h',  0,    150,  1,    'Maximum wind speed'],
  ['precipitation_hours',   'Precipitation Hours',     'hrs',   0,    24,   0.5,  'Number of hours with precipitation'],
  ['evapotranspiration_mm', 'Evapotranspiration',      'mm',    0,    20,   0.1,  'Daily reference ET (FAO-56)'],
  ['soil_moisture',         'Soil Moisture',           '0-1',   0,    1,    0.01, 'Volumetric soil moisture (0=dry, 1=saturated)'],
  ['elevation_m',           'Elevation',               'm',     0,    6000, 10,   'Terrain elevation above sea level'],
  ['river_discharge_m3s',   'River Discharge',         'm³/s',  0,    10000,10,   'River flow rate (m³/second)'],
  ['month',                 'Month',                   '',      1,    12,   1,    'Month of the year (1=Jan, 12=Dec)'],
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ManualResultBar({ label, mlPct, capPct, finalPct, color, icon }) {
  return (
    <div className="manual-result-block">
      <div className="manual-result-header">
        {icon}
        <span className="manual-result-title">{label}</span>
        <span className="manual-result-final" style={{ color }}>{finalPct}%</span>
      </div>
      <div className="manual-result-bars">
        <div className="manual-bar-row">
          <span className="manual-bar-label">Raw ML</span>
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
          <span className="manual-bar-label">Final</span>
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

function TabManualTest() {
  const [params, setParams]     = useState(DEFAULT_PARAMS);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const handleChange = (key, val) => {
    setParams(prev => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handlePreset = (preset) => {
    if (preset === 'flood') setParams({
      ...DEFAULT_PARAMS,
      rainfall_mm: 120, antecedent_7day_mm: 200, humidity_pct: 92,
      precipitation_hours: 14, soil_moisture: 0.45, elevation_m: 60,
      river_discharge_m3s: 3500, flood_nearby: 1, month: 7,
    });
    if (preset === 'landslide') setParams({
      ...DEFAULT_PARAMS,
      rainfall_mm: 95, antecedent_7day_mm: 180, humidity_pct: 88,
      precipitation_hours: 10, soil_moisture: 0.42, elevation_m: 1800,
      river_discharge_m3s: 50, month: 8,
    });
    if (preset === 'safe') setParams({
      ...DEFAULT_PARAMS,
      rainfall_mm: 0, antecedent_7day_mm: 2, humidity_pct: 35,
      precipitation_hours: 0, soil_moisture: 0.05, elevation_m: 250,
      river_discharge_m3s: 10, month: 1,
    });
    setResult(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/predict-manual`, {
        ...params,
        flood_nearby: params.flood_nearby ? 1 : 0,
        month: parseInt(params.month),
        year:  parseInt(params.year  || 2024),
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
      {/* Left: Parameter Form */}
      <div className="manual-form-panel">
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <div className="manual-form-title">
            <FlaskConical size={20} className="icon-blue" />
            Manual Parameter Test
          </div>
          <p className="search-panel-desc">
            Enter all training-set parameters directly to test the model without GPS or internet.
            Perfect for demonstrating model accuracy to examiners.
          </p>
          {/* Preset Scenarios */}
          <div className="section-label">Quick Presets</div>
          <div className="quick-locs">
            <button className="quick-loc-btn" onClick={() => handlePreset('flood')} style={{ borderColor: '#60a5fa55' }}>🌊 High Flood Scenario</button>
            <button className="quick-loc-btn" onClick={() => handlePreset('landslide')} style={{ borderColor: '#f59e0b55' }}>⛰️ High Landslide Scenario</button>
            <button className="quick-loc-btn" onClick={() => handlePreset('safe')} style={{ borderColor: '#10b98155' }}>✅ Safe / Dry Scenario</button>
          </div>
        </div>

        {/* Parameter Inputs */}
        <div className="glass-card">
          <div className="section-label" style={{ marginBottom: '1rem' }}>📋 Training Parameters</div>
          <div className="manual-params-grid">
            {PARAM_CONFIG.map(([key, label, unit, min, max, step, desc]) => (
              <div key={key} className="manual-param-row">
                <div className="manual-param-header">
                  <span className="manual-param-label">{label}</span>
                  <span className="manual-param-unit">
                    {key === 'month'
                      ? MONTH_NAMES[Math.round(params[key]) - 1]
                      : `${params[key]}${unit}`}
                  </span>
                </div>
                <p className="manual-param-desc">{desc}</p>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={params[key]}
                  onChange={e => handleChange(key, e.target.value)}
                  className="manual-slider"
                />
                <div className="manual-slider-bounds">
                  <span>{min}{unit}</span>
                  <span>{max}{unit}</span>
                </div>
              </div>
            ))}

            {/* Soil moisture number input for precision */}
            <div className="manual-param-row">
              <div className="manual-param-header">
                <span className="manual-param-label">Flood Nearby</span>
                <span className="manual-param-unit">{params.flood_nearby ? 'Yes' : 'No'}</span>
              </div>
              <p className="manual-param-desc">Is there a flood event nearby? (affects flood model)</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  className={`quick-loc-btn ${params.flood_nearby ? 'active' : ''}`}
                  style={{ flex: 1, background: params.flood_nearby ? '#60a5fa22' : 'transparent', borderColor: params.flood_nearby ? '#60a5fa' : undefined }}
                  onClick={() => setParams(p => ({ ...p, flood_nearby: 1 }))}
                >Yes</button>
                <button
                  className={`quick-loc-btn ${!params.flood_nearby ? 'active' : ''}`}
                  style={{ flex: 1, background: !params.flood_nearby ? '#10b98122' : 'transparent', borderColor: !params.flood_nearby ? '#10b981' : undefined }}
                  onClick={() => setParams(p => ({ ...p, flood_nearby: 0 }))}
                >No</button>
              </div>
            </div>
          </div>

          <button
            id="manual-predict-btn"
            className="gps-btn"
            style={{ marginTop: '1.5rem', width: '100%' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <><div className="spinner-sm" /> Running Models...</> : <><FlaskConical size={18} /> Run Prediction</>}
          </button>
        </div>
      </div>

      {/* Right: Results */}
      <div className="manual-result-panel">
        {error && <div className="error-card">{error}</div>}

        {!result && !loading && (
          <div className="empty-card empty-card-lg">
            <SlidersHorizontal size={48} className="empty-icon" />
            <p>Set parameters on the left and click <strong>Run Prediction</strong> to see how the model responds to your exact inputs.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '13px', opacity: 0.6 }}>The result shows: Raw ML output → Physics Cap → Final prediction</p>
          </div>
        )}

        {loading && (
          <div className="loading-card loading-card-lg">
            <div className="spinner" />
            <p className="loading-text">Running flood &amp; landslide models...</p>
            <p className="loading-sub">Applying feature engineering + physics gates</p>
          </div>
        )}

        {result && (
          <>
            {/* Summary pills */}
            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <div className="manual-summary-title">
                <FlaskConical size={16} className="icon-blue" /> Prediction Results
              </div>
              <div className="click-result-pills" style={{ marginTop: '0.75rem' }}>
                <span className="pill" style={{ background: getRiskColor(result.predictions.flood_risk_pct) + '33', color: getRiskColor(result.predictions.flood_risk_pct), borderColor: getRiskColor(result.predictions.flood_risk_pct) + '66', fontSize: '15px', padding: '6px 14px' }}>
                  <Droplets size={14} /> Flood: {result.predictions.flood_risk_pct}%
                </span>
                <span className="pill" style={{ marginLeft: 10, background: getRiskColor(result.predictions.landslide_risk_pct) + '33', color: getRiskColor(result.predictions.landslide_risk_pct), borderColor: getRiskColor(result.predictions.landslide_risk_pct) + '66', fontSize: '15px', padding: '6px 14px' }}>
                  <Mountain size={14} /> Landslide: {result.predictions.landslide_risk_pct}%
                </span>
              </div>
            </div>

            {/* Detailed breakdown */}
            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <ManualResultBar
                label="Flood Risk"
                mlPct={result.raw_ml_probabilities.flood_ml_pct}
                capPct={result.physics_caps.max_flood_pct}
                finalPct={result.predictions.flood_risk_pct}
                color={getRiskColor(result.predictions.flood_risk_pct)}
                icon={<Droplets size={18} className="icon-blue" />}
              />
            </div>

            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <ManualResultBar
                label="Landslide Risk"
                mlPct={result.raw_ml_probabilities.landslide_ml_pct}
                capPct={result.physics_caps.max_landslide_pct}
                finalPct={result.predictions.landslide_risk_pct}
                color={getRiskColor(result.predictions.landslide_risk_pct)}
                icon={<Mountain size={18} className="icon-amber" />}
              />
            </div>

            {/* Explanation card */}
            <div className="glass-card live-factors-card">
              <div className="live-factors-title">How the prediction was made</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7 }}>
                <p>① <span style={{ color: '#60a5fa' }}>Raw ML</span> — XGBoost/RF model output on your feature-engineered inputs</p>
                <p>② <span style={{ color: '#a78bfa' }}>Physics Cap</span> — maximum allowed risk given real-world physics constraints</p>
                <p>③ <span style={{ color: '#e2e8f0' }}>Final</span> = min(ML, Cap) — ensures physically impossible predictions are rejected</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
const TABS = [
  { id: 'map',    label: 'Map Explorer',   Icon: Map },
  { id: 'search', label: 'Search & GPS',   Icon: Crosshair },
  { id: 'dual',   label: 'Dual Risk Maps', Icon: Layers },
  { id: 'manual', label: 'Manual Test',    Icon: FlaskConical },
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
        {activeTab === 'manual' && <TabManualTest />}
      </main>
    </div>
  );
}
