/** Geographic and area bounds accepted by every real-terrain loader. */
export const realTerrainBounds = {
  minimumLatitude: -85,
  maximumLatitude: 85,
  minimumLongitude: -180,
  maximumLongitude: 180,
  minimumSpanKm: 2,
  maximumSpanKm: 200,
  defaultSpanKm: 25,
} as const;

/** Centers for the real-terrain location selector, in decimal degrees. */
export const realTerrainPresets = [
  { name: 'Wicklow Mountains', latitude: 53.01, longitude: -6.33 },
  { name: 'Dublin', latitude: 53.3498, longitude: -6.2603 },
  { name: 'Cork', latitude: 51.8985, longitude: -8.4756 },
  { name: 'Galway', latitude: 53.2707, longitude: -9.0568 },
  { name: 'Kilkee', latitude: 52.6795, longitude: -9.647 },
  { name: 'Mont Blanc', latitude: 45.83, longitude: 6.86 },
  { name: 'Everest', latitude: 27.99, longitude: 86.93 },
  { name: 'Mount Fuji', latitude: 35.3606, longitude: 138.7274 },
  { name: 'Mount Aso', latitude: 32.8842, longitude: 131.104 },
  { name: 'Japanese Alps — Kamikōchi', latitude: 36.2492, longitude: 137.6377 },
  { name: 'Aoraki / Mount Cook', latitude: -43.595, longitude: 170.1418 },
  { name: 'Milford Sound', latitude: -44.6414, longitude: 167.8975 },
  { name: 'Machu Picchu', latitude: -13.1631, longitude: -72.545 },
  { name: 'Cordillera Blanca — Huascarán', latitude: -9.1214, longitude: -77.6044 },
  { name: 'Serra dos Órgãos', latitude: -22.4575, longitude: -43.0306 },
  { name: 'Rio de Janeiro — Tijuca', latitude: -22.9628, longitude: -43.2792 },
  { name: 'Dolomites — Tre Cime', latitude: 46.6186, longitude: 12.3026 },
  { name: 'Matterhorn', latitude: 45.9763, longitude: 7.6586 },
  { name: 'Torres del Paine', latitude: -50.9423, longitude: -73.4068 },
  { name: 'Mount Kilimanjaro', latitude: -3.0674, longitude: 37.3556 },
] as const;
