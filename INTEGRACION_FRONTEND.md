# Guía de integración: consumir la API desde la app

**Base URL:** `https://proxihogar-backend-production.up.railway.app`  
**Referencia de endpoints:** Ver [API.md](./API.md)

---

## Cómo funciona

Flujo de datos de la arquitectura:

```text
┌───────────────────────┐         Petición HTTP         ┌────────────────────────┐         SQL / Prisma         ┌──────────────────────┐
│  App Móvil (Expo RN)  │ ────────────────────────────> │   Railway (Backend)    │ ───────────────────────────> │  Supabase (Postgres) │
│                       │ <──────────────────────────── │                        │ <─────────────────────────── │                      │
└───────────────────────┘          JSON Response        └────────────────────────┘          Query Data          └──────────────────────┘
```

Actualmente, la app lee datos estáticos directamente desde `src/data/tecnicos.ts` y `src/data/categorias.ts`. Integrar la API consiste en reemplazar la lectura de esos archivos mock por peticiones HTTP asíncronas a los endpoints correspondientes de Railway.

---

## Paso 1: Crear la URL base en una variable

Crea el archivo `src/constants/api.ts` en el proyecto del frontend:

```typescript
// src/constants/api.ts
export const API_URL = "https://proxihogar-backend-production.up.railway.app";
```

---

## Paso 2: Ajustar el tipo Tecnico

Adapta o crea las interfaces de datos para que coincidan con la respuesta del backend:

```typescript
// src/types/api.ts

export interface ResenaApi {
  id: string;
  autor: string;
  iniciales: string;
  calificacion: number;
  comentario: string;
  fecha: string;
  tags: string[];
}

export interface TecnicoApi {
  id: string;
  nombre: string;
  iniciales: string;
  colorAvatar: string;
  especialidad: string;
  especialidades: string[];
  descripcion: string;
  verificado: boolean;
  calificacion: number;
  cantidadResenas: number;
  cantidadTrabajos: number;
  distanceKm?: number;      // Presente en /nearby o en /:id si se envían lat/lng
  distanciaTexto?: string;  // Presente en /nearby o en /:id si se envían lat/lng (ej: "2.5 km" o "850 m")
  tiempoLlegada?: string;   // Presente en /nearby o en /:id si se envían lat/lng (ej: "15 min", "1 h 15 min")
  calculoAproximado?: boolean; // true cuando se calcula la distancia y tiempo
  tarifaBase: number | null; // null si es a convenir
  moneda: string;           // "PEN"
  tarifaTexto: string;      // ej: "S/ 30.00" o "Tarifa a convenir"
  ubicacion: string;
  experienciaAnios: number;
  latitude: number;         // Latitud para ubicar el pin en el mapa (C28)
  longitude: number;        // Longitud para ubicar el pin en el mapa (C28)
  resenas: ResenaApi[];
}
```

> **Nota importante sobre tarifas (C24):** Mostrar siempre `tarifaTexto` en la tarjeta del técnico y en la vista de perfil. **No armar el precio a mano** (no concatenes `"S/"` ni agregues decimales manualmente en los componentes del frontend). Si el técnico no tiene tarifa establecida (`tarifaBase: null`), `tarifaTexto` ya contiene automáticamente `"Tarifa a convenir"`. Además, al filtrar por `tarifaMax`, la API excluye automáticamente a los técnicos con tarifa a convenir.

> **Nota sobre distancias:** `distanceKm` y `tiempoLlegada` vienen calculados en el endpoint `/nearby`. Si el tipo actual de tu componente usa `distanciaKm` con "a", cámbialo a `distanceKm` o mapea la propiedad al recibir la respuesta.

---

## Paso 3: Crear src/services/api.ts

Crea el archivo `src/services/api.ts` con las funciones de llamada a la API:

```typescript
// src/services/api.ts
import { API_URL } from "../constants/api";
import { TecnicoApi } from "../types/api";

export interface GetTecnicosCercanosParams {
  lat: number;
  lng: number;
  radius?: number;
  especialidad?: string;
  verificado?: boolean;
  calificacionMin?: number;
  tarifaMax?: number;
}

export async function getTecnicosCercanos(
  params: GetTecnicosCercanosParams
): Promise<TecnicoApi[]> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });

  const res = await fetch(`${API_URL}/api/technicians/nearby?${query.toString()}`);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.error || `Error ${res.status}: no se pudieron cargar los técnicos cercanos`
    );
  }

  return res.json();
}

export async function getTecnicoPorId(
  id: string,
  userLocation?: { lat: number; lng: number }
): Promise<TecnicoApi | null> {
  let url = `${API_URL}/api/technicians/${encodeURIComponent(id)}`;
  if (userLocation) {
    const query = new URLSearchParams({
      lat: String(userLocation.lat),
      lng: String(userLocation.lng),
    });
    url += `?${query.toString()}`;
  }

  const res = await fetch(url);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.error || `Error ${res.status}: no se pudo cargar el perfil del técnico`
    );
  }

  return res.json();
}

export interface DistritosResponse {
  default: { nombre: string; latitude: number; longitude: number };
  distritos: Array<{ nombre: string; latitude: number; longitude: number }>;
}

export async function getDistritos(): Promise<DistritosResponse> {
  const res = await fetch(`${API_URL}/api/districts`);
  if (!res.ok) {
    throw new Error(`Error ${res.status} al obtener distritos`);
  }
  return res.json();
}
```

---

## Paso 3.1: Autenticación con JWT y almacenamiento seguro (`expo-secure-store`)

El backend implementa autenticación basada en JWT (`/api/auth`). Para guardar el token de sesión de forma segura y encriptada en el dispositivo móvil (Keychain en iOS y Keystore en Android), se recomienda utilizar `expo-secure-store`.

### 1. Instalar `expo-secure-store` en la app de Expo

Ejecuta en la terminal de la app de frontend:

```bash
npx expo install expo-secure-store
```

### 2. Crear el helper de almacenamiento seguro (`src/services/authStorage.ts`)

```typescript
// src/services/authStorage.ts
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "proxihogar_auth_token";

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
```

### 3. Crear los servicios de autenticación (`src/services/auth.ts`)

```typescript
// src/services/auth.ts
import { API_URL } from "../constants/api";
import { saveAuthToken, getAuthToken, removeAuthToken } from "./authStorage";

export interface UserResponse {
  id: string;
  email: string;
  nombre: string;
  role: "CLIENT" | "WORKER";
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

export interface UserProfile extends UserResponse {
  dniRuc?: string | null;
  telefono?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Registro
export async function registerUser(data: {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  role?: "CLIENT" | "WORKER";
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "Error al registrar usuario");
  }

  // Guardar token en SecureStore
  await saveAuthToken(body.token);
  return body;
}

// Login
export async function loginUser(credentials: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "Credenciales inválidas");
  }

  // Guardar token en SecureStore
  await saveAuthToken(body.token);
  return body;
}

// Obtener perfil actual (GET /api/auth/me) con Bearer token
export async function getMyProfile(): Promise<UserProfile> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("No hay sesión activa.");
  }

  const res = await fetch(`${API_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401) {
    await removeAuthToken(); // Token expirado o inválido
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "Error al obtener perfil");
  }

  return body;
}

// Cerrar sesión
export async function logoutUser(): Promise<void> {
  await removeAuthToken();
}
```

### 4. Cómo enviar el token en peticiones protegidas

Para enviar el token a cualquier endpoint protegido que agregues en el futuro:

```typescript
const token = await getAuthToken();

const res = await fetch(`${API_URL}/api/ruta-protegida`, {
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});
```

---

## Paso 4: Conectar el Home (src/app/(solicitante)/home.tsx)

Sustituye la importación de `tecnicos` de mock data por una llamada al servicio con manejo de estados:

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { getTecnicosCercanos } from "@/services/api";
import { TecnicoApi } from "@/types/api";
import { TarjetaTecnico } from "@/components/tecnicos/TarjetaTecnico";

export default function HomeScreen() {
  const [tecnicos, setTecnicos] = useState<TecnicoApi[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarTecnicos = async () => {
    try {
      setCargando(true);
      setError(null);
      // Coordenadas base (Lurín, Lima)
      const data = await getTecnicosCercanos({
        lat: -12.2745,
        lng: -76.8711,
        radius: 10,
      });
      setTecnicos(data);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTecnicos();
  }, []);

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Sección Técnicos Destacados */}
      <View className="mt-7 px-5">
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A", marginBottom: 12 }}>
          Técnicos destacados cerca de ti
        </Text>

        {cargando && (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-2 text-slate-500">Buscando profesionales cercanos...</Text>
          </View>
        )}

        {error && (
          <View className="py-6 px-4 bg-red-50 rounded-2xl items-center">
            <Text className="text-red-600 text-center mb-3">{error}</Text>
            <TouchableOpacity
              onPress={cargarTecnicos}
              className="bg-blue-600 px-4 py-2 rounded-xl"
            >
              <Text className="text-white font-bold">Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!cargando && !error && tecnicos.length === 0 && (
          <View className="py-6 items-center">
            <Text className="text-slate-500">No hay técnicos disponibles en tu radio actual.</Text>
          </View>
        )}

        {!cargando && !error && tecnicos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tecnicos.map((tecnico) => (
              <TarjetaTecnico key={tecnico.id} tecnico={tecnico} variant="compact" />
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}
```

---

## Paso 5: Conectar el perfil (src/app/(solicitante)/tecnicos/[id].tsx)

Obtén el `id` dinámico desde la ruta con `useLocalSearchParams` y solicita el perfil completo a la API:

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getTecnicoPorId } from "@/services/api";
import { TecnicoApi } from "@/types/api";

export default function PerfilTecnicoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tecnico, setTecnico] = useState<TecnicoApi | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    setCargando(true);
    setError(null);

    getTecnicoPorId(id)
      .then((data) => {
        if (isMounted) setTecnico(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Error al cargar técnico");
      })
      .finally(() => {
        if (isMounted) setCargando(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (cargando) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-slate-500">Cargando perfil...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-red-500 text-center mb-4">{error}</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-slate-200 px-4 py-2 rounded-xl">
          <Text className="text-slate-700 font-bold">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!tecnico) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-slate-700 font-bold text-lg mb-2">Técnico no encontrado</Text>
        <Text className="text-slate-500 text-center mb-4">
          El profesional solicitado no existe o fue dado de baja.
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-blue-600 px-4 py-2 rounded-xl">
          <Text className="text-white font-bold">Regresar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Renderizar información completa del técnico */}
      <View className="p-5">
        <Text className="text-2xl font-extrabold text-slate-900">{tecnico.nombre}</Text>
        <Text className="text-slate-600">{tecnico.especialidad}</Text>
        {/* Reseñas, experiencia, tarifaBase, etc. */}
      </View>
    </ScrollView>
  );
}
```

---

## Paso 6: Conectar filtros y radio

El backend resuelve el filtrado y el ordenamiento por distancia de forma nativa. La app no debe filtrar manualmente con `.filter()` sobre arreglos estáticos:

1. **Dependencias del efecto:** Agrega las variables de estado de los filtros en las dependencias de `useEffect`.
2. **Re-petición automática:** Al cambiar el radio (ej. de 5 a 10 km) o seleccionar una especialidad, la app invoca nuevamente `getTecnicosCercanos`:
   ```typescript
   useEffect(() => {
     cargarTecnicosConFiltros({
       lat: ubicacion.lat,
       lng: ubicacion.lng,
       radius,
       especialidad,
       verificado: soloVerificados ? true : undefined,
       calificacionMin,
       tarifaMax,
     });
   }, [radius, especialidad, soloVerificados, calificacionMin, tarifaMax, ubicacion]);
   ```
3. **Limpiar filtros:** Restablece los filtros a `undefined` o sus valores iniciales para recuperar la lista completa.

---

## Paso 7: Ubicación del usuario

### Opción A: GPS en tiempo real con `expo-location`

Instalación:
```bash
npx expo install expo-location
```

Implementación:
```typescript
import * as Location from "expo-location";

async function obtenerCoordenadasActuales() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permiso de ubicación denegado");
  }

  const location = await Location.getCurrentPositionAsync({});
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
  };
}
```

### Opción B: Obtener distritos de la API (`/api/districts`)

Si no se dispone de GPS, la app puede consultar los distritos predefinidos:

```typescript
const distritosData = await getDistritos();
// distritosData.default -> { nombre: "Lima", latitude: -12.0464, longitude: -77.0428 }
// distritosData.distritos -> lista de distritos para selector manual
```

---

## Mapa (C28)

En la pantalla de mapa (`src/app/(solicitante)/mapa.tsx` o similar), se integran la geolocalización, los distritos y los técnicos cercanos:

### 1. Dibujar los pines de los técnicos
Los pines se dibujan directamente con los campos `latitude` y `longitude` presentes en cada elemento del arreglo devuelto por `GET /api/technicians/nearby`:

```tsx
import MapView, { Marker } from "react-native-maps";

<MapView
  style={{ flex: 1 }}
  region={{
    latitude: centroMapa.latitude,
    longitude: centroMapa.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  }}
>
  {/* Pin de ubicación del usuario o distrito seleccionado */}
  <Marker
    coordinate={{ latitude: centroMapa.latitude, longitude: centroMapa.longitude }}
    title="Ubicación de búsqueda"
    pinColor="#2563EB"
  />

  {/* Pines de los técnicos en el radio */}
  {tecnicos.map((tecnico) => (
    <Marker
      key={tecnico.id}
      coordinate={{
        latitude: tecnico.latitude,
        longitude: tecnico.longitude,
      }}
      title={tecnico.nombre}
      description={`${tecnico.especialidad} • ${tecnico.distanciaTexto || ""}`}
      onPress={() => abrirDetalleTecnico(tecnico.id)}
    />
  ))}
</MapView>
```

### 2. Centrado del mapa y gestión de permisos GPS (Escenarios C28)

- **Escenario 1 (Permiso de GPS concedido):**
  1. La app solicita permiso de geolocalización al arrancar con `expo-location`.
  2. Al ser concedido, se obtiene la posición exacta (`coords.latitude`, `coords.longitude`).
  3. El mapa se centra automáticamente en esas coordenadas.
  4. Se consulta `GET /api/technicians/nearby?lat=${lat}&lng=${lng}&radius=10` para pintar los técnicos cercanos.

- **Escenario 2 (Permiso de GPS denegado o no disponible):**
  1. Si el usuario rechaza el acceso al GPS, la app consulta `GET /api/districts`.
  2. El mapa se centra inicialmente en las coordenadas `default` (Lima: `-12.0464`, `-77.0428`).
  3. Se muestra un banner o selector con la lista de `distritos` devuelta por la API para que el usuario elija su distrito manualmente.
  4. Al seleccionar un distrito (ej. "Lurín" o "Miraflores"), el mapa se traslada al centro de dicho distrito y se consulta `/nearby` con las coordenadas aproximadas del distrito elegido.

---

## Seguimiento (C33)

La pantalla de seguimiento del servicio (ej. `src/app/(solicitante)/seguimiento/[id].tsx`) permite al cliente visualizar el estado de su solicitud y la información en tiempo real del técnico asignado.

### 1. Obtener los datos de la solicitud y del técnico asignado

Para consultar la solicitud, se invoca `GET /api/requests/:id` enviando el token de autenticación en el header `Authorization`:

```typescript
import { API_URL } from "../constants/api";
import { getAuthToken } from "./authStorage";

export interface TecnicoAsignado {
  id: string;
  nombre: string;
  iniciales: string;
  colorAvatar: string;
  especialidad: string;
  verificado: boolean;
  calificacion: number;
  cantidadResenas: number;
  experienciaAnios: number;
  telefono: string | null;
  tarifaBase: number | null;
  moneda: string;
  tarifaTexto: string;
  distanceKm?: number;
  distanciaTexto?: string;
  tiempoLlegada?: string;
  calculoAproximado?: boolean;
}

export interface SolicitudDetalle {
  id: string;
  status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  direccion: string;
  tipoProblema: string;
  descripcion: string;
  radio: string;
  createdAt: string;
  updatedAt: string;
  tecnico: TecnicoAsignado;
}

export async function getSolicitudPorId(id: string): Promise<SolicitudDetalle> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("No hay sesión activa");
  }

  const res = await fetch(`${API_URL}/api/requests/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error ${res.status} al cargar seguimiento`);
  }

  return res.json();
}
```

### 2. Renderizar la información del técnico en la pantalla de seguimiento

La respuesta de `GET /api/requests/:id` contiene el objeto `tecnico` con todos los datos necesarios para pintar la tarjeta del profesional asignado:

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getSolicitudPorId, SolicitudDetalle } from "@/services/api";

export default function SeguimientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [solicitud, setSolicitud] = useState<SolicitudDetalle | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (id) {
      getSolicitudPorId(id)
        .then(setSolicitud)
        .catch(console.error)
        .finally(() => setCargando(false));
    }
  }, [id]);

  if (cargando) return <ActivityIndicator size="large" color="#2563EB" />;
  if (!solicitud) return <Text>Solicitud no encontrada</Text>;

  const { tecnico } = solicitud;

  return (
    <View className="p-4 bg-white rounded-2xl shadow-sm">
      {/* Datos del Técnico Asignado */}
      <View className="flex-row items-center mb-3">
        <View style={{ backgroundColor: tecnico.colorAvatar }} className="w-12 h-12 rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">{tecnico.iniciales}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-slate-800">{tecnico.nombre}</Text>
          <Text className="text-sm text-slate-500">{tecnico.especialidad} • ⭐ {tecnico.calificacion}</Text>
        </View>
      </View>

      {/* Estimación de Llegada y Distancia */}
      {tecnico.tiempoLlegada && (
        <View className="bg-blue-50 p-3 rounded-xl mb-3">
          <Text className="text-blue-800 font-semibold">
            Tiempo estimado de llegada: {tecnico.tiempoLlegada} ({tecnico.distanciaTexto})
          </Text>
        </View>
      )}

      {/* Tarifa base */}
      <Text className="text-slate-600 mb-2">Tarifa base: <Text className="font-bold">{tecnico.tarifaTexto}</Text></Text>

      {/* Botón de Llamada directa si tiene teléfono registrado */}
      {tecnico.telefono && (
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${tecnico.telefono}`)}
          className="bg-green-600 py-3 rounded-xl items-center mt-2"
        >
          <Text className="text-white font-bold">Llamar al técnico ({tecnico.telefono})</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

---

## Paso 8: Estados de la pantalla

Maneja siempre los 4 estados principales de visualización:

| Estado | Condición | Componente / UI esperada |
| :--- | :--- | :--- |
| **Cargando** | `cargando === true` | `ActivityIndicator` (spinner) con texto descriptivo |
| **Lista vacía** | `!cargando && data.length === 0` | Mensaje informativo: *"No se encontraron técnicos en esta zona o con estos filtros"* |
| **Error** | `error !== null` | Mensaje de error legible con botón *"Reintentar"* |
| **No encontrado (404)** | `data === null` (en perfil) | Mensaje *"Técnico no encontrado"* con botón *"Volver"* |

---

## Paso 9: Probar desde el celular o emulador

- **Acceso público:** La URL de Railway (`https://proxihogar-backend-production.up.railway.app`) es pública en Internet. No necesitas configurar `localhost` ni la IP de tu red local en Expo Go.
- **Verificación rápida:** Abre el endpoint en el navegador antes de probar en el móvil:
  ```text
  https://proxihogar-backend-production.up.railway.app/api/technicians/nearby?lat=-12.2745&lng=-76.8711&radius=15
  ```
- **Cold start:** La primera petición puede demorar entre 3 y 8 segundos si la instancia estuvo inactiva.
- **Error 500:** Si el backend responde 500 de forma persistente, consulta con el equipo de backend (puede que Supabase haya pausado el proyecto por inactividad gratuita).

---

## Paso 10: Checklist de verificación

Marca cada punto al completar la integración:

- [ ] La lista de técnicos cercanos se descarga desde la API de Railway en vez del mock local.
- [ ] La distancia (`distanceKm`) y el badge de verificado se muestran correctamente en las tarjetas.
- [ ] Al presionar un técnico, se abre su pantalla de perfil con el `id` real.
- [ ] La pantalla de perfil carga la información y reseñas desde `/api/technicians/:id`.
- [ ] Modificar el radio de búsqueda (ej. 2 km, 5 km, 10 km) actualiza los resultados en tiempo real.
- [ ] Los filtros de especialidad, verificación y calificación se aplican combinados.
- [ ] El botón de limpiar filtros restaura la lista original.
- [ ] Si no hay técnicos en el radio, se muestra el estado de lista vacía.
- [ ] Si falla la conexión a internet, se muestra el mensaje de error con opción a reintentar.

---

## Problemas comunes

1. **`Network request failed`:**
   - Verifica la conexión a Internet del emulador o dispositivo móvil.
   - Confirma que `API_URL` apunte a `https://proxihogar-backend-production.up.railway.app` y use `https://`.
2. **Lista siempre vacía (`[]`):**
   - Comprueba que `lat` y `lng` sean números flotantes válidos dentro de Lima.
   - En la base de datos de prueba actual existen **8 técnicos configurados** en Lima (Lurín, Villa El Salvador, Villa María del Triunfo, Pachacámac, San Juan de Miraflores, Santiago de Surco y Miraflores), 7 disponibles y 1 no disponible. Asegúrate de usar un radio suficiente (ej. 10 km o 15 km) desde tus coordenadas si estás alejado.
3. **Error HTTP 400 (Bad Request):**
   - Revisa el mensaje devuelto en `{ "error": "..." }`. Generalmente ocurre si `lat` o `lng` faltan o tienen formatos no numéricos.
4. **Campos `undefined` en pantalla:**
   - Confirma los nombres de las propiedades. En la API se utiliza `distanceKm` (no `distanciaKm`).
