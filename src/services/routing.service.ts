// src/services/routing.service.ts
import { calculateHaversineDistanceMeters } from "../utils/haversine";

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 4000;
const CACHE_MAX_AGE_MS = 15 * 1000; // 15 segundos
const CACHE_MAX_DISTANCE_METERS = 50; // 50 metros

export interface RouteCalculationResult {
  ruta: Array<[number, number]>; // [lat, lng]
  distanciaMetros: number;
  duracionSegundos: number;
  calculadoEn: Date;
}

interface CachedRouteEntry {
  techLat: number;
  techLng: number;
  destLat: number;
  destLng: number;
  result: RouteCalculationResult;
  cachedAtMs: number;
}

// Caché en memoria por solicitud (requestId -> última ruta calculada)
const routeCache = new Map<string, CachedRouteEntry>();

export class RoutingService {
  /**
   * Obtiene la ruta desde la posición del técnico hasta el domicilio usando caché en memoria
   * y OSRM público. Devuelve null si OSRM falla o excede el timeout (nunca lanza 500).
   */
  async getRouteForRequest(
    requestId: string,
    techLat: number,
    techLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteCalculationResult | null> {
    const nowMs = Date.now();
    const cached = routeCache.get(requestId);

    if (cached) {
      const elapsedMs = nowMs - cached.cachedAtMs;
      const movedMeters = calculateHaversineDistanceMeters(
        cached.techLat,
        cached.techLng,
        techLat,
        techLng
      );
      const sameDest = cached.destLat === destLat && cached.destLng === destLng;

      // Reutilizar caché si no pasó más de 15s y el técnico no se movió más de 50m
      if (sameDest && elapsedMs <= CACHE_MAX_AGE_MS && movedMeters <= CACHE_MAX_DISTANCE_METERS) {
        return cached.result;
      }
    }

    const calculated = await this.fetchOsrmRoute(techLat, techLng, destLat, destLng);
    if (!calculated) {
      return null;
    }

    routeCache.set(requestId, {
      techLat,
      techLng,
      destLat,
      destLng,
      result: calculated,
      cachedAtMs: nowMs,
    });

    return calculated;
  }

  /**
   * Limpia la caché de ruta para una solicitud (al salir de ON_THE_WAY).
   */
  clearRouteCache(requestId: string): void {
    routeCache.delete(requestId);
  }

  private async fetchOsrmRoute(
    techLat: number,
    techLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteCalculationResult | null> {
    const baseUrl = (process.env.OSRM_BASE_URL || DEFAULT_OSRM_BASE_URL).replace(/\/+$/, "");
    const url = `${baseUrl}/route/v1/driving/${techLng},${techLat};${destLng},${destLat}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "ProxiHogar-Backend/1.0",
        },
        signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{
          geometry?: {
            coordinates?: Array<[number, number]>;
          };
          distance?: number;
          duration?: number;
        }>;
      };

      const firstRoute = data?.routes?.[0];
      const rawCoords = firstRoute?.geometry?.coordinates;

      if (
        !firstRoute ||
        !Array.isArray(rawCoords) ||
        rawCoords.length === 0 ||
        typeof firstRoute.distance !== "number" ||
        typeof firstRoute.duration !== "number"
      ) {
        return null;
      }

      // OSRM devuelve [lng, lat]; convertir a [lat, lng]
      const ruta: Array<[number, number]> = rawCoords.map(([lng, lat]) => [lat, lng]);

      return {
        ruta,
        distanciaMetros: firstRoute.distance,
        duracionSegundos: firstRoute.duration,
        calculadoEn: new Date(),
      };
    } catch {
      // Fallo de red, timeout o respuesta inválida: devolver resultado controlado sin exponer detalles
      return null;
    }
  }
}

export const routingService = new RoutingService();

