// src/utils/haversine.ts

/**
 * Calcula la distancia en kilómetros entre dos puntos de coordenadas usando la fórmula de Haversine.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_KM = 6371;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_KM * c;
  return Number(distance.toFixed(1));
}

/**
 * Estima el tiempo de llegada vehicular basado en la distancia en km.
 */
export function estimateArrivalTime(distanceKm: number): string {
  const estimatedMinutes = Math.max(5, Math.round(distanceKm * 6 + 2));
  return `${estimatedMinutes} min`;
}
