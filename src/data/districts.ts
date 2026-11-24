// src/data/districts.ts

export interface DistrictZone {
  id: string;
  nombre: string;
  latitude: number;
  longitude: number;
}

export interface DistrictItem {
  id: string;
  nombre: string;
  descripcion: string;
  latitude: number;
  longitude: number;
  zonas: DistrictZone[];
}

export type DistrictsResponse = DistrictItem[];

export const DISTRICTS_DATA: DistrictsResponse = [
  {
    id: "chorrillos",
    nombre: "Chorrillos",
    descripcion: "Lima, Perú",
    latitude: -12.1711,
    longitude: -77.0147,
    zonas: [
      { id: "villa-militar", nombre: "Villa Militar", latitude: -12.1645, longitude: -77.0125 },
      { id: "huertos-de-villa", nombre: "Huertos de Villa", latitude: -12.1780, longitude: -77.0180 },
      { id: "los-cedros", nombre: "Los Cedros", latitude: -12.1710, longitude: -77.0210 },
      { id: "santa-teresa", nombre: "Santa Teresa", latitude: -12.1690, longitude: -77.0050 },
      { id: "buenos-aires", nombre: "Buenos Aires", latitude: -12.1735, longitude: -77.0095 },
      { id: "matellini", nombre: "Matellini", latitude: -12.1820, longitude: -77.0150 },
      { id: "san-genaro", nombre: "San Genaro", latitude: -12.1760, longitude: -77.0060 },
      { id: "delicias-de-villa", nombre: "Delicias de Villa", latitude: -12.1850, longitude: -77.0200 },
      { id: "guardia-civil", nombre: "Guardia Civil", latitude: -12.1670, longitude: -77.0170 },
      { id: "santa-leonor", nombre: "Santa Leonor", latitude: -12.1800, longitude: -77.0100 },
      { id: "paseo-de-la-republica", nombre: "Paseo de la República", latitude: -12.1660, longitude: -77.0230 },
      { id: "san-juan-bautista", nombre: "San Juan Bautista", latitude: -12.1770, longitude: -77.0140 },
      { id: "marcavilca", nombre: "Marcavilca", latitude: -12.1720, longitude: -77.0040 },
      { id: "la-campina", nombre: "La Campiña", latitude: -12.1840, longitude: -77.0170 },
      { id: "plaza-mayor", nombre: "Plaza Mayor de Chorrillos", latitude: -12.1700, longitude: -77.0190 },
    ],
  },
];
