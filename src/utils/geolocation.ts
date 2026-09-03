// Geolocation and Speed Helper Utilities

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export function formatCoordinates(
  lat: number | null,
  lon: number | null,
  fallbackText: string = 'Unavailable'
): string {
  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    return fallbackText;
  }
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

export function calculateSpeedFromDisplacement(
  prevLat: number,
  prevLon: number,
  prevTimestamp: number,
  currLat: number,
  currLon: number,
  currTimestamp: number,
  accuracyMeters: number = 15
): number {
  const timeDeltaHours = (currTimestamp - prevTimestamp) / 3600000;
  // If time delta is unreasonable (less than 300ms or greater than 2 minutes), ignore
  if (timeDeltaHours < 0.0001 || timeDeltaHours > 0.033) {
    return 0;
  }

  const distKm = calculateDistanceKm(prevLat, prevLon, currLat, currLon);
  const distMeters = distKm * 1000;

  // Filter out GPS noise / drift when stationary
  const jitterThreshold = Math.max(8, accuracyMeters * 0.8);
  if (distMeters < jitterThreshold) {
    return 0;
  }

  const rawSpeedKmh = Math.round(distKm / timeDeltaHours);
  // Cap at realistic vehicle speeds (e.g. 200 km/h) to reject satellite teleport spikes
  if (rawSpeedKmh > 200) {
    return 0;
  }

  // Snap very small speeds to 0
  return rawSpeedKmh < 3 ? 0 : rawSpeedKmh;
}

// Generate realistic street names for simulated driving
const DEMO_STREETS = [
  "Highway 101, Express Corridor",
  "Grand Interstate Avenue, Zone 4",
  "Metro Expressway, Outer Ring Road",
  "Ocean Boulevard, Coastal Route",
  "Skyline Boulevard, North Pass"
];

export function getRandomDemoLocation(): string {
  return DEMO_STREETS[Math.floor(Math.random() * DEMO_STREETS.length)];
}
