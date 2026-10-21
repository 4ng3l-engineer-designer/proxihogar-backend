// src/data/districts.ts

export interface DistrictItem {
  nombre: string;
  latitude: number;
  longitude: number;
}

export interface DistrictsResponse {
  default: DistrictItem;
  distritos: DistrictItem[];
}

export const DISTRICTS_DATA: DistrictsResponse = {
  default: { nombre: "Lima", latitude: -12.0464, longitude: -77.0428 },
  distritos: [
    { nombre: "Lurín", latitude: -12.2745, longitude: -76.8711 },
    { nombre: "Villa El Salvador", latitude: -12.2136, longitude: -76.9319 },
    { nombre: "Villa María del Triunfo", latitude: -12.1606, longitude: -76.9386 },
    { nombre: "Pachacámac", latitude: -12.2297, longitude: -76.8567 },
    { nombre: "San Juan de Miraflores", latitude: -12.1550, longitude: -76.9700 },
    { nombre: "Santiago de Surco", latitude: -12.1453, longitude: -77.0010 },
    { nombre: "Miraflores", latitude: -12.1219, longitude: -77.0297 },
  ],
};
