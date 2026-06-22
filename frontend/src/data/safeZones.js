export const SAFE_ZONES = [

  // ── Uttarakhand ──────────────────────────────────────────────────────────────
  { id: 1,  name: 'AIIMS Rishikesh',                        lat: 30.0869, lon: 78.2676, type: 'hospital',    state: 'Uttarakhand' },
  { id: 2,  name: 'Doon Medical College Dehradun',           lat: 30.3243, lon: 78.0322, type: 'hospital',    state: 'Uttarakhand' },
  { id: 3,  name: 'NDRF Base Camp Dehradun',                 lat: 30.3165, lon: 78.0500, type: 'relief_camp', state: 'Uttarakhand' },
  { id: 4,  name: 'Base Hospital Srinagar Garhwal',          lat: 30.2238, lon: 78.7896, type: 'hospital',    state: 'Uttarakhand' },
  { id: 5,  name: 'Relief Camp Haridwar',                    lat: 29.9457, lon: 78.1642, type: 'relief_camp', state: 'Uttarakhand' },
  { id: 6,  name: 'District Hospital Chamoli',               lat: 30.4060, lon: 79.3188, type: 'hospital',    state: 'Uttarakhand' },
  { id: 7,  name: 'Relief Camp Rudraprayag',                 lat: 30.2848, lon: 78.9810, type: 'relief_camp', state: 'Uttarakhand' },
  { id: 8,  name: 'District Hospital Pithoragarh',           lat: 29.5831, lon: 80.2103, type: 'hospital',    state: 'Uttarakhand' },
  { id: 9,  name: 'Govt Hospital Uttarkashi',                lat: 30.7268, lon: 78.4354, type: 'hospital',    state: 'Uttarakhand' },

  // ── Assam ────────────────────────────────────────────────────────────────────
  { id: 10, name: 'Gauhati Medical College Guwahati',        lat: 26.1445, lon: 91.7362, type: 'hospital',    state: 'Assam' },
  { id: 11, name: 'NDRF 9th Battalion Guwahati',             lat: 26.1158, lon: 91.7086, type: 'relief_camp', state: 'Assam' },
  { id: 12, name: 'Silchar Medical College',                 lat: 24.8333, lon: 92.7789, type: 'hospital',    state: 'Assam' },
  { id: 13, name: 'Jorhat Medical College',                  lat: 26.7509, lon: 94.2037, type: 'hospital',    state: 'Assam' },
  { id: 14, name: 'Dibrugarh Medical College',               lat: 27.4728, lon: 94.9120, type: 'hospital',    state: 'Assam' },
  { id: 15, name: 'Relief Camp Dhubri',                      lat: 26.0207, lon: 89.9785, type: 'relief_camp', state: 'Assam' },
  { id: 16, name: 'Relief Camp Barpeta',                     lat: 26.3237, lon: 91.0009, type: 'relief_camp', state: 'Assam' },
  { id: 17, name: 'Dist Hospital Nagaon',                    lat: 26.3483, lon: 92.6836, type: 'hospital',    state: 'Assam' },
  { id: 18, name: 'Relief Camp Morigaon',                    lat: 26.2486, lon: 92.3354, type: 'relief_camp', state: 'Assam' },
  { id: 19, name: 'Dist Hospital Tezpur',                    lat: 26.6328, lon: 92.7926, type: 'hospital',    state: 'Assam' },

  // ── Kerala ───────────────────────────────────────────────────────────────────
  { id: 20, name: 'Govt Medical College Thrissur',           lat: 10.5276, lon: 76.2144, type: 'hospital',    state: 'Kerala' },
  { id: 21, name: 'High Ground Camp Munnar',                 lat: 10.0889, lon: 77.0595, type: 'relief_camp', state: 'Kerala' },
  { id: 22, name: 'DDMA Relief Camp Ernakulam',              lat: 10.0159, lon: 76.3419, type: 'relief_camp', state: 'Kerala' },
  { id: 23, name: 'AIIMS Thiruvananthapuram',                lat: 8.5203,  lon: 76.9663, type: 'hospital',    state: 'Kerala' },
  { id: 24, name: 'Kozhikode Govt Medical College',          lat: 11.2588, lon: 75.7804, type: 'hospital',    state: 'Kerala' },
  { id: 25, name: 'Relief Camp Alappuzha',                   lat: 9.4981,  lon: 76.3388, type: 'relief_camp', state: 'Kerala' },
  { id: 26, name: 'Govt Medical College Kottayam',           lat: 9.5916,  lon: 76.5222, type: 'hospital',    state: 'Kerala' },
  { id: 27, name: 'Relief Camp Idukki',                      lat: 9.9189,  lon: 76.9731, type: 'relief_camp', state: 'Kerala' },
  { id: 28, name: 'Govt Medical College Palakkad',           lat: 10.7867, lon: 76.6548, type: 'hospital',    state: 'Kerala' },
  { id: 29, name: 'Relief Camp Wayanad',                     lat: 11.6060, lon: 76.0820, type: 'relief_camp', state: 'Kerala' },

  // ── Bihar ────────────────────────────────────────────────────────────────────
  { id: 30, name: 'PMCH Patna',                              lat: 25.6093, lon: 85.1376, type: 'hospital',    state: 'Bihar' },
  { id: 31, name: 'Relief Camp Muzaffarpur',                 lat: 26.1197, lon: 85.3910, type: 'relief_camp', state: 'Bihar' },
  { id: 32, name: 'SNMMCH Darbhanga',                        lat: 26.1542, lon: 85.8918, type: 'hospital',    state: 'Bihar' },
  { id: 33, name: 'NMCH Patna',                              lat: 25.5945, lon: 85.0892, type: 'hospital',    state: 'Bihar' },
  { id: 34, name: 'Dist Hospital Supaul',                    lat: 26.1239, lon: 86.6061, type: 'hospital',    state: 'Bihar' },
  { id: 35, name: 'Relief Camp Sitamarhi',                   lat: 26.5939, lon: 85.4905, type: 'relief_camp', state: 'Bihar' },
  { id: 36, name: 'Dist Hospital Saran Chapra',              lat: 25.7742, lon: 84.7437, type: 'hospital',    state: 'Bihar' },
  { id: 37, name: 'Relief Camp Bhagalpur',                   lat: 25.2425, lon: 86.9842, type: 'relief_camp', state: 'Bihar' },
  { id: 38, name: 'Dist Hospital Purnia',                    lat: 25.7771, lon: 87.4753, type: 'hospital',    state: 'Bihar' },
  { id: 39, name: 'Relief Camp West Champaran',              lat: 27.0283, lon: 84.4250, type: 'relief_camp', state: 'Bihar' },

  // ── Odisha ───────────────────────────────────────────────────────────────────
  { id: 40, name: 'SCBMCH Cuttack',                          lat: 20.4625, lon: 85.8830, type: 'hospital',    state: 'Odisha' },
  { id: 41, name: 'Cyclone Shelter Puri',                    lat: 19.8135, lon: 85.8312, type: 'shelter',     state: 'Odisha' },
  { id: 42, name: 'NDRF 2nd Battalion Mundali',              lat: 20.4048, lon: 85.7759, type: 'relief_camp', state: 'Odisha' },
  { id: 43, name: 'AIIMS Bhubaneswar',                       lat: 20.2150, lon: 85.7680, type: 'hospital',    state: 'Odisha' },
  { id: 44, name: 'Relief Camp Balasore',                    lat: 21.4942, lon: 86.9288, type: 'relief_camp', state: 'Odisha' },
  { id: 45, name: 'Cyclone Shelter Kendrapara',              lat: 20.5053, lon: 86.4203, type: 'shelter',     state: 'Odisha' },
  { id: 46, name: 'Dist Hospital Sambalpur',                 lat: 21.4669, lon: 83.9812, type: 'hospital',    state: 'Odisha' },
  { id: 47, name: 'Relief Camp Gajapati',                    lat: 19.3268, lon: 84.1220, type: 'relief_camp', state: 'Odisha' },
  { id: 48, name: 'Dist Hospital Rayagada',                  lat: 19.1721, lon: 83.4116, type: 'hospital',    state: 'Odisha' },
  { id: 49, name: 'Cyclone Shelter Ganjam',                  lat: 19.3869, lon: 84.9896, type: 'shelter',     state: 'Odisha' },

  // ── West Bengal ──────────────────────────────────────────────────────────────
  { id: 50, name: 'NRS Medical College Kolkata',             lat: 22.5726, lon: 88.3639, type: 'hospital',    state: 'West Bengal' },
  { id: 51, name: 'Relief Camp Howrah',                      lat: 22.5958, lon: 88.2636, type: 'relief_camp', state: 'West Bengal' },
  { id: 52, name: 'SSKM Hospital Kolkata',                   lat: 22.5373, lon: 88.3430, type: 'hospital',    state: 'West Bengal' },
  { id: 53, name: 'Relief Camp Malda',                       lat: 25.0109, lon: 88.1418, type: 'relief_camp', state: 'West Bengal' },
  { id: 54, name: 'North Bengal Medical College Siliguri',   lat: 26.7271, lon: 88.3953, type: 'hospital',    state: 'West Bengal' },
  { id: 55, name: 'Cyclone Shelter Midnapore',               lat: 22.4239, lon: 87.3119, type: 'shelter',     state: 'West Bengal' },
  { id: 56, name: 'Relief Camp Murshidabad',                 lat: 24.1835, lon: 88.2680, type: 'relief_camp', state: 'West Bengal' },
  { id: 57, name: 'Dist Hospital Cooch Behar',               lat: 26.3159, lon: 89.4445, type: 'hospital',    state: 'West Bengal' },
  { id: 58, name: 'Cyclone Shelter South 24 Parganas',       lat: 21.9634, lon: 88.2479, type: 'shelter',     state: 'West Bengal' },

  // ── Himachal Pradesh ─────────────────────────────────────────────────────────
  { id: 59, name: 'IGMC Shimla',                             lat: 31.1048, lon: 77.1734, type: 'hospital',    state: 'Himachal Pradesh' },
  { id: 60, name: 'Emergency Camp Manali',                   lat: 32.2432, lon: 77.1892, type: 'relief_camp', state: 'Himachal Pradesh' },
  { id: 61, name: 'DRPGMC Kangra',                           lat: 32.0996, lon: 76.2673, type: 'hospital',    state: 'Himachal Pradesh' },
  { id: 62, name: 'Relief Camp Mandi',                       lat: 31.7085, lon: 76.9318, type: 'relief_camp', state: 'Himachal Pradesh' },
  { id: 63, name: 'Dist Hospital Kullu',                     lat: 31.9579, lon: 77.1091, type: 'hospital',    state: 'Himachal Pradesh' },
  { id: 64, name: 'Relief Camp Chamba',                      lat: 32.5539, lon: 76.1262, type: 'relief_camp', state: 'Himachal Pradesh' },

  // ── Maharashtra ──────────────────────────────────────────────────────────────
  { id: 65, name: 'KEM Hospital Mumbai',                     lat: 19.0034, lon: 72.8412, type: 'hospital',    state: 'Maharashtra' },
  { id: 66, name: 'Relief Camp Nashik',                      lat: 19.9975, lon: 73.7898, type: 'relief_camp', state: 'Maharashtra' },
  { id: 67, name: 'Sassoon General Hospital Pune',           lat: 18.5236, lon: 73.8706, type: 'hospital',    state: 'Maharashtra' },
  { id: 68, name: 'Nair Hospital Mumbai',                    lat: 18.9685, lon: 72.8354, type: 'hospital',    state: 'Maharashtra' },
  { id: 69, name: 'Relief Camp Kolhapur',                    lat: 16.6950, lon: 74.2183, type: 'relief_camp', state: 'Maharashtra' },
  { id: 70, name: 'Govt Medical College Aurangabad',         lat: 19.8762, lon: 75.3433, type: 'hospital',    state: 'Maharashtra' },
  { id: 71, name: 'Relief Camp Ratnagiri',                   lat: 16.9902, lon: 73.3120, type: 'relief_camp', state: 'Maharashtra' },
  { id: 72, name: 'Govt Medical College Nagpur',             lat: 21.1458, lon: 79.0882, type: 'hospital',    state: 'Maharashtra' },
  { id: 73, name: 'Relief Camp Sindhudurg',                  lat: 16.3490, lon: 73.5670, type: 'relief_camp', state: 'Maharashtra' },
  { id: 74, name: 'Dist Hospital Gadchiroli',                lat: 20.1809, lon: 80.0055, type: 'hospital',    state: 'Maharashtra' },

  // ── Tamil Nadu ───────────────────────────────────────────────────────────────
  { id: 75, name: 'Govt Stanley Hospital Chennai',           lat: 13.1125, lon: 80.2869, type: 'hospital',    state: 'Tamil Nadu' },
  { id: 76, name: 'Cyclone Relief Camp Cuddalore',           lat: 11.7447, lon: 79.7697, type: 'shelter',     state: 'Tamil Nadu' },
  { id: 77, name: 'Govt Rajaji Hospital Madurai',            lat: 9.9252,  lon: 78.1198, type: 'hospital',    state: 'Tamil Nadu' },
  { id: 78, name: 'Relief Camp Nagapattinam',                lat: 10.7672, lon: 79.8449, type: 'relief_camp', state: 'Tamil Nadu' },
  { id: 79, name: 'Coimbatore Medical College',              lat: 11.0168, lon: 76.9558, type: 'hospital',    state: 'Tamil Nadu' },
  { id: 80, name: 'Cyclone Shelter Villupuram',              lat: 11.9401, lon: 79.4928, type: 'shelter',     state: 'Tamil Nadu' },
  { id: 81, name: 'Govt Hospital Thanjavur',                 lat: 10.7870, lon: 79.1378, type: 'hospital',    state: 'Tamil Nadu' },
  { id: 82, name: 'Relief Camp Thiruvallur',                 lat: 13.1439, lon: 79.9089, type: 'relief_camp', state: 'Tamil Nadu' },
  { id: 83, name: 'ESIC Hospital Tirunelveli',               lat: 8.7139,  lon: 77.7567, type: 'hospital',    state: 'Tamil Nadu' },
  { id: 84, name: 'Cyclone Shelter Ramanathapuram',          lat: 9.3639,  lon: 78.8395, type: 'shelter',     state: 'Tamil Nadu' },

  // ── Andhra Pradesh ───────────────────────────────────────────────────────────
  { id: 85, name: 'Govt General Hospital Vijayawada',        lat: 16.5030, lon: 80.6480, type: 'hospital',    state: 'Andhra Pradesh' },
  { id: 86, name: 'NDRF Camp Visakhapatnam',                 lat: 17.7230, lon: 83.3313, type: 'relief_camp', state: 'Andhra Pradesh' },
  { id: 87, name: 'Govt General Hospital Guntur',            lat: 16.3008, lon: 80.4428, type: 'hospital',    state: 'Andhra Pradesh' },
  { id: 88, name: 'Cyclone Shelter Srikakulam',              lat: 18.2949, lon: 83.8938, type: 'shelter',     state: 'Andhra Pradesh' },
  { id: 89, name: 'Govt Hospital Nellore',                   lat: 14.4426, lon: 79.9865, type: 'hospital',    state: 'Andhra Pradesh' },
  { id: 90, name: 'Relief Camp East Godavari',               lat: 17.0005, lon: 81.8040, type: 'relief_camp', state: 'Andhra Pradesh' },
  { id: 91, name: 'Govt Hospital Ongole',                    lat: 15.5057, lon: 80.0499, type: 'hospital',    state: 'Andhra Pradesh' },
  { id: 92, name: 'Cyclone Shelter Krishna District',        lat: 16.1832, lon: 81.1433, type: 'shelter',     state: 'Andhra Pradesh' },

  // ── Telangana ────────────────────────────────────────────────────────────────
  { id: 93, name: 'NIMS Hyderabad',                          lat: 17.4239, lon: 78.4738, type: 'hospital',    state: 'Telangana' },
  { id: 94, name: 'Osmania General Hospital Hyderabad',      lat: 17.3840, lon: 78.4740, type: 'hospital',    state: 'Telangana' },
  { id: 95, name: 'Relief Camp Khammam',                     lat: 17.2473, lon: 80.1514, type: 'relief_camp', state: 'Telangana' },
  { id: 96, name: 'Dist Hospital Bhadradri Kothagudem',      lat: 17.5565, lon: 80.6191, type: 'hospital',    state: 'Telangana' },
  { id: 97, name: 'Relief Camp Mahabubabad',                 lat: 17.5984, lon: 80.0027, type: 'relief_camp', state: 'Telangana' },
  { id: 98, name: 'Dist Hospital Warangal',                  lat: 17.9784, lon: 79.5941, type: 'hospital',    state: 'Telangana' },

  // ── Karnataka ────────────────────────────────────────────────────────────────
  { id: 99,  name: 'Victoria Hospital Bengaluru',            lat: 12.9620, lon: 77.5789, type: 'hospital',    state: 'Karnataka' },
  { id: 100, name: 'Dist Hospital Belagavi',                 lat: 15.8497, lon: 74.4977, type: 'hospital',    state: 'Karnataka' },
  { id: 101, name: 'Relief Camp Uttara Kannada',             lat: 14.7941, lon: 74.5580, type: 'relief_camp', state: 'Karnataka' },
  { id: 102, name: 'Govt Hospital Mangaluru',                lat: 12.9141, lon: 74.8560, type: 'hospital',    state: 'Karnataka' },
  { id: 103, name: 'Relief Camp Kodagu',                     lat: 12.3375, lon: 75.7139, type: 'relief_camp', state: 'Karnataka' },
  { id: 104, name: 'Dist Hospital Mysuru',                   lat: 12.2958, lon: 76.6394, type: 'hospital',    state: 'Karnataka' },
  { id: 105, name: 'Relief Camp Dakshina Kannada',           lat: 12.8700, lon: 75.2479, type: 'relief_camp', state: 'Karnataka' },
  { id: 106, name: 'Dist Hospital Gadag',                    lat: 15.4134, lon: 75.6222, type: 'hospital',    state: 'Karnataka' },

  // ── Rajasthan ────────────────────────────────────────────────────────────────
  { id: 107, name: 'SMS Medical College Jaipur',             lat: 26.9124, lon: 75.7873, type: 'hospital',    state: 'Rajasthan' },
  { id: 108, name: 'Relief Camp Barmer',                     lat: 25.7521, lon: 71.3967, type: 'relief_camp', state: 'Rajasthan' },
  { id: 109, name: 'SN Medical College Jodhpur',             lat: 26.3009, lon: 73.0243, type: 'hospital',    state: 'Rajasthan' },
  { id: 110, name: 'Relief Camp Jalore',                     lat: 25.3476, lon: 72.6174, type: 'relief_camp', state: 'Rajasthan' },
  { id: 111, name: 'RNT Medical College Udaipur',            lat: 24.5854, lon: 73.7125, type: 'hospital',    state: 'Rajasthan' },
  { id: 112, name: 'Relief Camp Dungarpur',                  lat: 23.8437, lon: 73.7138, type: 'relief_camp', state: 'Rajasthan' },

  // ── Gujarat ──────────────────────────────────────────────────────────────────
  { id: 113, name: 'Civil Hospital Ahmedabad',               lat: 23.0395, lon: 72.5887, type: 'hospital',    state: 'Gujarat' },
  { id: 114, name: 'Relief Camp Morbi',                      lat: 22.8173, lon: 70.8378, type: 'relief_camp', state: 'Gujarat' },
  { id: 115, name: 'PDU Medical College Rajkot',             lat: 22.2965, lon: 70.7808, type: 'hospital',    state: 'Gujarat' },
  { id: 116, name: 'Cyclone Shelter Bhavnagar',              lat: 21.7645, lon: 72.1519, type: 'shelter',     state: 'Gujarat' },
  { id: 117, name: 'Govt Hospital Surat',                    lat: 21.1959, lon: 72.8302, type: 'hospital',    state: 'Gujarat' },
  { id: 118, name: 'Relief Camp Anand',                      lat: 22.5645, lon: 72.9289, type: 'relief_camp', state: 'Gujarat' },
  { id: 119, name: 'Cyclone Shelter Navsari',                lat: 20.9467, lon: 72.9520, type: 'shelter',     state: 'Gujarat' },
  { id: 120, name: 'Dist Hospital Vadodara',                 lat: 22.3072, lon: 73.1812, type: 'hospital',    state: 'Gujarat' },
  { id: 121, name: 'Relief Camp Jamnagar',                   lat: 22.4707, lon: 70.0577, type: 'relief_camp', state: 'Gujarat' },
  { id: 122, name: 'Cyclone Shelter Porbandar',              lat: 21.6422, lon: 69.6093, type: 'shelter',     state: 'Gujarat' },

  // ── Madhya Pradesh ───────────────────────────────────────────────────────────
  { id: 123, name: 'GMCH Bhopal',                            lat: 23.2599, lon: 77.4126, type: 'hospital',    state: 'Madhya Pradesh' },
  { id: 124, name: 'Relief Camp Gwalior',                    lat: 26.2183, lon: 78.1828, type: 'relief_camp', state: 'Madhya Pradesh' },
  { id: 125, name: 'MY Hospital Indore',                     lat: 22.7164, lon: 75.8577, type: 'hospital',    state: 'Madhya Pradesh' },
  { id: 126, name: 'Relief Camp Jabalpur',                   lat: 23.1815, lon: 79.9864, type: 'relief_camp', state: 'Madhya Pradesh' },
  { id: 127, name: 'Dist Hospital Harda',                    lat: 22.3382, lon: 77.0930, type: 'hospital',    state: 'Madhya Pradesh' },
  { id: 128, name: 'Relief Camp Barwani',                    lat: 22.0357, lon: 74.9018, type: 'relief_camp', state: 'Madhya Pradesh' },

  // ── Uttar Pradesh ────────────────────────────────────────────────────────────
  { id: 129, name: 'KGMC Lucknow',                           lat: 26.8631, lon: 80.9462, type: 'hospital',    state: 'Uttar Pradesh' },
  { id: 130, name: 'SRN Hospital Allahabad',                 lat: 25.4358, lon: 81.8463, type: 'hospital',    state: 'Uttar Pradesh' },
  { id: 131, name: 'Relief Camp Varanasi',                   lat: 25.3176, lon: 82.9739, type: 'relief_camp', state: 'Uttar Pradesh' },
  { id: 132, name: 'Dist Hospital Gorakhpur',                lat: 26.7606, lon: 83.3732, type: 'hospital',    state: 'Uttar Pradesh' },
  { id: 133, name: 'Relief Camp Ballia',                     lat: 25.7569, lon: 84.1456, type: 'relief_camp', state: 'Uttar Pradesh' },
  { id: 134, name: 'Dist Hospital Bahraich',                 lat: 27.5745, lon: 81.5951, type: 'hospital',    state: 'Uttar Pradesh' },
  { id: 135, name: 'Relief Camp Lakhimpur Kheri',            lat: 27.9489, lon: 80.7748, type: 'relief_camp', state: 'Uttar Pradesh' },
  { id: 136, name: 'Dist Hospital Azamgarh',                 lat: 26.0737, lon: 83.1862, type: 'hospital',    state: 'Uttar Pradesh' },
  { id: 137, name: 'Relief Camp Gonda',                      lat: 27.1340, lon: 81.9607, type: 'relief_camp', state: 'Uttar Pradesh' },
  { id: 138, name: 'Dist Hospital Agra',                     lat: 27.1767, lon: 78.0081, type: 'hospital',    state: 'Uttar Pradesh' },

  // ── Jharkhand ────────────────────────────────────────────────────────────────
  { id: 139, name: 'Rajendra Institute Ranchi',              lat: 23.3441, lon: 85.3096, type: 'hospital',    state: 'Jharkhand' },
  { id: 140, name: 'Relief Camp Dhanbad',                    lat: 23.7957, lon: 86.4304, type: 'relief_camp', state: 'Jharkhand' },
  { id: 141, name: 'Dist Hospital Dumka',                    lat: 24.2696, lon: 87.2478, type: 'hospital',    state: 'Jharkhand' },
  { id: 142, name: 'Relief Camp Sahebganj',                  lat: 25.2490, lon: 87.6755, type: 'relief_camp', state: 'Jharkhand' },
  { id: 143, name: 'Dist Hospital Giridih',                  lat: 24.1935, lon: 86.2997, type: 'hospital',    state: 'Jharkhand' },

  // ── Chhattisgarh ─────────────────────────────────────────────────────────────
  { id: 144, name: 'AIIMS Raipur',                           lat: 21.2514, lon: 81.6296, type: 'hospital',    state: 'Chhattisgarh' },
  { id: 145, name: 'Relief Camp Bilaspur',                   lat: 22.0796, lon: 82.1391, type: 'relief_camp', state: 'Chhattisgarh' },
  { id: 146, name: 'Dist Hospital Korba',                    lat: 22.3595, lon: 82.6501, type: 'hospital',    state: 'Chhattisgarh' },
  { id: 147, name: 'Relief Camp Bastar',                     lat: 19.1292, lon: 81.9530, type: 'relief_camp', state: 'Chhattisgarh' },

  // ── Goa ──────────────────────────────────────────────────────────────────────
  { id: 148, name: 'Goa Medical College Panaji',             lat: 15.4909, lon: 73.8278, type: 'hospital',    state: 'Goa' },
  { id: 149, name: 'Relief Camp South Goa',                  lat: 15.2993, lon: 74.1240, type: 'relief_camp', state: 'Goa' },

  // ── Punjab ───────────────────────────────────────────────────────────────────
  { id: 150, name: 'GMCH Chandigarh',                        lat: 30.7333, lon: 76.7794, type: 'hospital',    state: 'Punjab' },
  { id: 151, name: 'Govt Hospital Amritsar',                 lat: 31.6340, lon: 74.8723, type: 'hospital',    state: 'Punjab' },
  { id: 152, name: 'Relief Camp Firozpur',                   lat: 30.9254, lon: 74.6130, type: 'relief_camp', state: 'Punjab' },
  { id: 153, name: 'Dist Hospital Gurdaspur',                lat: 32.0426, lon: 75.4080, type: 'hospital',    state: 'Punjab' },
  { id: 154, name: 'Relief Camp Ludhiana',                   lat: 30.9010, lon: 75.8573, type: 'relief_camp', state: 'Punjab' },

  // ── Haryana ──────────────────────────────────────────────────────────────────
  { id: 155, name: 'PGIMS Rohtak',                           lat: 28.9084, lon: 76.5631, type: 'hospital',    state: 'Haryana' },
  { id: 156, name: 'Relief Camp Ambala',                     lat: 30.3782, lon: 76.7767, type: 'relief_camp', state: 'Haryana' },
  { id: 157, name: 'Dist Hospital Hisar',                    lat: 29.1492, lon: 75.7217, type: 'hospital',    state: 'Haryana' },
  { id: 158, name: 'Relief Camp Karnal',                     lat: 29.6857, lon: 76.9905, type: 'relief_camp', state: 'Haryana' },

  // ── Jammu & Kashmir ──────────────────────────────────────────────────────────
  { id: 159, name: 'SKIMS Srinagar',                         lat: 34.1526, lon: 74.8320, type: 'hospital',    state: 'J&K' },
  { id: 160, name: 'GMC Jammu',                              lat: 32.7266, lon: 74.8570, type: 'hospital',    state: 'J&K' },
  { id: 161, name: 'Relief Camp Kupwara',                    lat: 34.5225, lon: 74.2595, type: 'relief_camp', state: 'J&K' },
  { id: 162, name: 'Relief Camp Rajouri',                    lat: 33.3761, lon: 74.3142, type: 'relief_camp', state: 'J&K' },
  { id: 163, name: 'Dist Hospital Anantnag',                 lat: 33.7315, lon: 75.1507, type: 'hospital',    state: 'J&K' },

  // ── Manipur ──────────────────────────────────────────────────────────────────
  { id: 164, name: 'JNIMS Imphal',                           lat: 24.8170, lon: 93.9368, type: 'hospital',    state: 'Manipur' },
  { id: 165, name: 'Relief Camp Imphal West',                lat: 24.8197, lon: 93.8712, type: 'relief_camp', state: 'Manipur' },
  { id: 166, name: 'Dist Hospital Churachandpur',            lat: 24.3329, lon: 93.6793, type: 'hospital',    state: 'Manipur' },

  // ── Nagaland ─────────────────────────────────────────────────────────────────
  { id: 167, name: 'NHAK Kohima',                            lat: 25.6586, lon: 94.1175, type: 'hospital',    state: 'Nagaland' },
  { id: 168, name: 'Relief Camp Dimapur',                    lat: 25.9044, lon: 93.7272, type: 'relief_camp', state: 'Nagaland' },

  // ── Mizoram ──────────────────────────────────────────────────────────────────
  { id: 169, name: 'Zoram Medical College Aizawl',           lat: 23.7307, lon: 92.7173, type: 'hospital',    state: 'Mizoram' },
  { id: 170, name: 'Relief Camp Lunglei',                    lat: 22.8864, lon: 92.7327, type: 'relief_camp', state: 'Mizoram' },

  // ── Meghalaya ────────────────────────────────────────────────────────────────
  { id: 171, name: 'NEIGRIHMS Shillong',                     lat: 25.5617, lon: 91.8833, type: 'hospital',    state: 'Meghalaya' },
  { id: 172, name: 'Relief Camp East Khasi Hills',           lat: 25.5788, lon: 91.8933, type: 'relief_camp', state: 'Meghalaya' },
  { id: 173, name: 'Dist Hospital Tura',                     lat: 25.5140, lon: 90.2165, type: 'hospital',    state: 'Meghalaya' },

  // ── Tripura ──────────────────────────────────────────────────────────────────
  { id: 174, name: 'GBP Hospital Agartala',                  lat: 23.8315, lon: 91.2868, type: 'hospital',    state: 'Tripura' },
  { id: 175, name: 'Relief Camp West Tripura',               lat: 23.7401, lon: 91.3200, type: 'relief_camp', state: 'Tripura' },

  // ── Arunachal Pradesh ────────────────────────────────────────────────────────
  { id: 176, name: 'RK Mission Hospital Itanagar',           lat: 27.0844, lon: 93.6053, type: 'hospital',    state: 'Arunachal Pradesh' },
  { id: 177, name: 'Relief Camp East Siang',                 lat: 28.1731, lon: 95.1345, type: 'relief_camp', state: 'Arunachal Pradesh' },

  // ── Sikkim ───────────────────────────────────────────────────────────────────
  { id: 178, name: 'STNM Hospital Gangtok',                  lat: 27.3314, lon: 88.6138, type: 'hospital',    state: 'Sikkim' },
  { id: 179, name: 'Relief Camp South Sikkim',               lat: 27.1501, lon: 88.5231, type: 'relief_camp', state: 'Sikkim' },

  // ── Puducherry ───────────────────────────────────────────────────────────────
  { id: 180, name: 'JIPMER Puducherry',                      lat: 11.9416, lon: 79.8083, type: 'hospital',    state: 'Puducherry' },
  { id: 181, name: 'Cyclone Shelter Karaikal',               lat: 10.9254, lon: 79.8380, type: 'shelter',     state: 'Puducherry' },

  // ── Delhi / NCR ──────────────────────────────────────────────────────────────
  { id: 182, name: 'AIIMS New Delhi',                        lat: 28.5672, lon: 77.2100, type: 'hospital',    state: 'Delhi' },
  { id: 183, name: 'Safdarjung Hospital Delhi',              lat: 28.5689, lon: 77.2058, type: 'hospital',    state: 'Delhi' },
  { id: 184, name: 'GTB Hospital Delhi',                     lat: 28.6741, lon: 77.3085, type: 'hospital',    state: 'Delhi' },
  { id: 185, name: 'NDRF Flood Relief Camp Delhi',           lat: 28.6139, lon: 77.2090, type: 'relief_camp', state: 'Delhi' },

  // ── Andaman & Nicobar ────────────────────────────────────────────────────────
  { id: 186, name: 'GB Pant Hospital Port Blair',            lat: 11.6234, lon: 92.7265, type: 'hospital',    state: 'Andaman & Nicobar' },
  { id: 187, name: 'Cyclone Shelter Campbell Bay',           lat: 7.0191,  lon: 93.9196, type: 'shelter',     state: 'Andaman & Nicobar' },

  // ── Lakshadweep ──────────────────────────────────────────────────────────────
  { id: 188, name: 'RNT Hospital Kavaratti',                 lat: 10.5669, lon: 72.6420, type: 'hospital',    state: 'Lakshadweep' },

  // ── Dadra & Nagar Haveli / Daman ─────────────────────────────────────────────
  { id: 189, name: 'Dist Hospital Silvassa',                 lat: 20.2688, lon: 73.0158, type: 'hospital',    state: 'Dadra & NH' },
  { id: 190, name: 'Dist Hospital Daman',                    lat: 20.4137, lon: 72.8322, type: 'hospital',    state: 'Daman & Diu' },
];

// Colours for map pin icons per type
export const ZONE_COLORS = {
  hospital:    '#1D9E75',
  relief_camp: '#378ADD',
  shelter:     '#EF9F27',
};
