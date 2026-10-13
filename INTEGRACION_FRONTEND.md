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
  distanceKm?: number;      // Solo presente en /api/technicians/nearby
  tiempoLlegada?: string;   // Solo presente en /api/technicians/nearby
  tarifaBase: number;
  ubicacion: string;
  experienciaAnios: number;
  resenas: ResenaApi[];
}
```

> **Nota importante:** `distanceKm` y `tiempoLlegada` solo vienen en las respuestas del endpoint `/nearby`. Si el tipo actual de tu componente usa `distanciaKm` con "a", cámbialo a `distanceKm` o mapea la propiedad al recibir la respuesta.

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

export async function getTecnicoPorId(id: string): Promise<TecnicoApi | null> {
  const res = await fetch(`${API_URL}/api/technicians/${encodeURIComponent(id)}`);

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

### Opción B: Tabla de coordenadas fijas por distrito (Selector manual en `ubicacion.tsx`)

Para el selector de distritos sin GPS activo:

| Distrito | Latitud | Longitud | Observación |
| :--- | :--- | :--- | :--- |
| **Lurín** | `-12.2745` | `-76.8711` | Coordenadas base del técnico de prueba |
| **Villa El Salvador** | `-12.2069` | `-76.9367` | Coordenadas aproximadas |
| **Pachacámac** | `-12.2294` | `-76.8586` | Coordenadas aproximadas |
| **Miraflores** | `-12.1211` | `-77.0298` | Coordenadas aproximadas |
| **Surco** | `-12.1394` | `-76.9922` | Coordenadas aproximadas |

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
   - En la base de datos de prueba actual existe 1 técnico configurado: **Juan Rios** en Lurín (`lat: -12.2745, lng: -76.8711`). Asegúrate de usar un radio suficiente (ej. 10 km o 15 km) desde tus coordenadas.
3. **Error HTTP 400 (Bad Request):**
   - Revisa el mensaje devuelto en `{ "error": "..." }`. Generalmente ocurre si `lat` o `lng` faltan o tienen formatos no numéricos.
4. **Campos `undefined` en pantalla:**
   - Confirma los nombres de las propiedades. En la API se utiliza `distanceKm` (no `distanciaKm`).
