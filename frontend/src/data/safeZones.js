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

  // Maharashtra
  { id: 20, name: 'KEM Hospital Mumbai',                  lat: 19.0034, lon: 72.8412, type: 'hospital',    state: 'Maharashtra' },
  { id: 21, name: 'Relief Camp Nashik',                   lat: 19.9975, lon: 73.7898, type: 'relief_camp', state: 'Maharashtra' },
  { id: 22, name: 'Sassoon General Hospital Pune',        lat: 18.5236, lon: 73.8706, type: 'hospital',    state: 'Maharashtra' },

  // Tamil Nadu
  { id: 23, name: 'Govt Stanley Hospital Chennai',        lat: 13.1125, lon: 80.2869, type: 'hospital',    state: 'Tamil Nadu' },
  { id: 24, name: 'Cyclone Relief Camp Cuddalore',        lat: 11.7447, lon: 79.7697, type: 'shelter',     state: 'Tamil Nadu' },

  // Andhra Pradesh
  { id: 25, name: 'Govt General Hospital Vijayawada',     lat: 16.5030, lon: 80.6480, type: 'hospital',    state: 'Andhra Pradesh' },
  { id: 26, name: 'NDRF Camp Visakhapatnam',              lat: 17.7230, lon: 83.3313, type: 'relief_camp', state: 'Andhra Pradesh' },
];

// Colours for map pin icons per type
export const ZONE_COLORS = {
  hospital:    '#1D9E75',
  relief_camp: '#378ADD',
  shelter:     '#EF9F27',
};
