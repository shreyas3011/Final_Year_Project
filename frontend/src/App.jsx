import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import { Droplets, Mountain, Wind, ThermometerSun, Waves, MapPin } from 'lucide-react';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map clicks
function LocationMarker({ position, setPosition, onLocationSelect }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

function App() {
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  const handleLocationSelect = async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      // Assuming FastAPI runs on 8000
      const response = await axios.post('http://localhost:8000/predict', { lat, lon });
      setPrediction(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch predictions");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (pct) => {
    if (pct < 30) return 'text-green-400';
    if (pct < 70) return 'text-yellow-400';
    return 'text-red-500';
  };

  const getRiskBg = (pct) => {
    if (pct < 30) return 'bg-green-400/20 border-green-400/30';
    if (pct < 70) return 'bg-yellow-400/20 border-yellow-400/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  return (
    <div className="min-h-screen p-6 flex flex-col md:flex-row gap-6">
      
      {/* Left Sidebar - Predictions & Data */}
      <div className="w-full md:w-[400px] flex flex-col gap-6">
        
        {/* Header */}
        <div className="glass p-6 rounded-2xl">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            TerraGuard AI
          </h1>
          <p className="text-slate-400 text-sm mt-2">Real-time Flood & Landslide Prediction System</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <MapPin size={16} className="text-blue-400" />
            {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Click anywhere on the map'}
          </div>
        </div>

        {error && (
          <div className="glass border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Case Studies */}
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Historical Case Studies</h3>
          <div className="flex flex-col gap-2">
            <button onClick={() => { setPosition({lat: 30.74, lng: 79.07}); handleLocationSelect(30.74, 79.07); }} className="p-3 bg-slate-800/50 rounded-xl text-left hover:bg-slate-700/50 transition-colors cursor-pointer border border-transparent hover:border-slate-600">
              <div className="font-semibold text-slate-200">Kedarnath, Himalayas</div>
              <div className="text-xs text-slate-400">Extreme Landslide Risk Zone</div>
            </button>
            <button onClick={() => { setPosition({lat: 9.55, lng: 76.62}); handleLocationSelect(9.55, 76.62); }} className="p-3 bg-slate-800/50 rounded-xl text-left hover:bg-slate-700/50 transition-colors cursor-pointer border border-transparent hover:border-slate-600">
              <div className="font-semibold text-slate-200">Kerala, India</div>
              <div className="text-xs text-slate-400">High Flood & Landslide Zone</div>
            </button>
            <button onClick={() => { setPosition({lat: 25.00, lng: 10.00}); handleLocationSelect(25.00, 10.00); }} className="p-3 bg-slate-800/50 rounded-xl text-left hover:bg-slate-700/50 transition-colors cursor-pointer border border-transparent hover:border-slate-600">
              <div className="font-semibold text-slate-200">Sahara Desert, Africa</div>
              <div className="text-xs text-slate-400">Zero Risk Reference</div>
            </button>
          </div>
        </div>

        {/* Prediction Cards */}
        {loading ? (
          <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center flex-1">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-300 animate-pulse">Analyzing satellite telemetry...</p>
          </div>
        ) : prediction ? (
          <div className="flex flex-col gap-4">
            
            {/* Flood Risk Card */}
            <div className={`glass p-6 rounded-2xl border ${getRiskBg(prediction.predictions.flood_risk_pct)} transition-colors duration-500`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Droplets className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-200">Flood Risk</h2>
                    <p className="text-xs text-slate-400">SVM · Calibrated · AUC 98.2%</p>
                  </div>
                </div>
                <div className={`text-3xl font-bold ${getRiskColor(prediction.predictions.flood_risk_pct)}`}>
                  {prediction.predictions.flood_risk_pct}%
                </div>
              </div>
            </div>

            {/* Landslide Risk Card */}
            <div className={`glass p-6 rounded-2xl border ${getRiskBg(prediction.predictions.landslide_risk_pct)} transition-colors duration-500`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-700/20 rounded-lg">
                    <Mountain className="text-amber-500" size={24} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-200">Landslide Risk</h2>
                    <p className="text-xs text-slate-400">Naive Bayes · Calibrated · AUC 96.5%</p>
                  </div>
                </div>
                <div className={`text-3xl font-bold ${getRiskColor(prediction.predictions.landslide_risk_pct)}`}>
                  {prediction.predictions.landslide_risk_pct}%
                </div>
              </div>
            </div>

            {/* Live Factors Grid */}
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Live Satellite Factors</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Droplets size={14} /> <span className="text-xs">Daily Rain</span>
                  </div>
                  <div className="font-semibold">{prediction.live_factors.rainfall_mm} mm</div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Waves size={14} /> <span className="text-xs">7-Day Rain</span>
                  </div>
                  <div className="font-semibold">{prediction.live_factors.antecedent_7day_mm} mm</div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Mountain size={14} /> <span className="text-xs">Elevation</span>
                  </div>
                  <div className="font-semibold">{prediction.live_factors.elevation_m} m</div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <ThermometerSun size={14} /> <span className="text-xs">Soil Moisture</span>
                  </div>
                  <div className="font-semibold">{(prediction.live_factors.soil_moisture * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center flex-1 text-center border-dashed border-slate-600">
            <MapPin size={48} className="text-slate-600 mb-4" />
            <p className="text-slate-400">Select a location on the map to run the AI prediction models.</p>
          </div>
        )}
      </div>

      {/* Right Content - Map */}
      <div className="flex-1 glass rounded-2xl overflow-hidden relative border-slate-700">
        <MapContainer 
          center={[20.5937, 78.9629]} // Center on India
          zoom={5} 
          style={{ height: '100%', width: '100%', background: '#0f172a' }}
        >
          {/* Dark theme map tiles */}
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

export default App;
