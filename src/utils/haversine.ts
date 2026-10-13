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
 * Formatea la distancia en kilómetros a texto amigable.
 * Si es menor a 1 km, devuelve en metros redondeados a decena (ej: "850 m").
 * Si es 1 km o más, devuelve con un decimal (ej: "2.5 km").
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round((km * 1000) / 10) * 10;
    if (meters >= 1000) {
      return "1.0 km";
    }
    return `${meters} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Formatea los minutos estimados a texto legible.
 * Menor a 60 min: "15 min"
 * 60 min o más: "1 h 15 min", o "2 h" cuando los minutos restantes son 0.
 */
export function formatArrivalTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${remainingMinutes} min`;
}

/**
 * Estima el tiempo de llegada vehicular basado en la distancia en km.
 */
export function estimateArrivalTime(distanceKm: number): string {
  const estimatedMinutes = Math.max(5, Math.round(distanceKm * 6 + 2));
  return formatArrivalTime(estimatedMinutes);
}
