# API ProxiHogar

**Base URL (producción):** `https://proxihogar-backend-production.up.railway.app`

- Sin autenticación por ahora.
- CORS abierto.
- Todos los errores devuelven `{ "error": "mensaje" }`.

---

## 1. Técnicos cercanos (con filtros y radio)

```
GET /api/technicians/nearby
```

### Query params

| Parámetro         | Tipo                  | Requerido | Descripción                                              |
| ----------------- | --------------------- | --------- | -------------------------------------------------------- |
| `lat`             | number                | Sí        | Latitud del usuario, entre -90 y 90                      |
| `lng`             | number                | Sí        | Longitud del usuario, entre -180 y 180                   |
| `radius`          | number                | No        | Radio de búsqueda en km (default `10`)                   |
| `especialidad`    | string                | No        | Ej. `Electricista`, sin distinguir mayúsculas            |
| `verificado`      | `"true"` / `"false"`  | No        | `"true"` devuelve solo técnicos verificados              |
| `calificacionMin` | number (0 a 5)        | No        | Calificación mínima                                      |
| `tarifaMax`       | number positivo       | No        | Tarifa base máxima                                       |

Los filtros son opcionales y combinables. Los resultados vienen ordenados por distancia ascendente.

### Ejemplo

```
/api/technicians/nearby?lat=-12.2745&lng=-76.8711&radius=5&especialidad=Electricista&verificado=true&calificacionMin=4
```

### Respuesta 200

Array de técnicos. Si no hay ninguno devuelve `[]` (no es un error).

Campos de cada técnico:

- `id`
- `nombre`
- `iniciales`
- `colorAvatar`
- `especialidad`
- `especialidades` (`string[]`)
- `descripcion`
- `verificado`
- `calificacion`
- `cantidadResenas`
- `cantidadTrabajos`
- `distanceKm`
- `tiempoLlegada`
- `tarifaBase`
- `ubicacion`
- `experienciaAnios`
- `resenas`: array con `id`, `autor`, `iniciales`, `calificacion`, `comentario`, `fecha`, `tags`

### Errores

- **400**: falta `lat`/`lng`, no son numéricos, están fuera de rango, o `radius`/`calificacionMin`/`tarifaMax` son inválidos.
- **500**: error interno.

---

## 2. Perfil de un técnico

```
GET /api/technicians/:id
```

### Ejemplo

```
/api/technicians/9837e9b0-0093-4ab1-9851-465a7031a941
```

### Respuesta 200

Mismo objeto del técnico, **sin** `distanceKm` ni `tiempoLlegada`, con reseñas ordenadas de la más reciente a la más antigua.

### Errores

- **404**: `{ "error": "Técnico no encontrado" }` si el id no existe.
- **500**: error interno.

---

## 3. Ejemplo de consumo (TypeScript)

```typescript
const API_URL = "https://proxihogar-backend-production.up.railway.app";

export interface Resena {
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
  distanceKm?: number;
  tiempoLlegada?: string;
  tarifaBase: number;
  ubicacion: string;
  experienciaAnios: number;
  resenas: Resena[];
}

export interface NearbyParams {
  lat: number;
  lng: number;
  radius?: number;
  especialidad?: string;
  verificado?: boolean;
  calificacionMin?: number;
  tarifaMax?: number;
}

export async function getTecnicosCercanos(params: NearbyParams): Promise<TecnicoApi[]> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });

  const res = await fetch(`${API_URL}/api/technicians/nearby?${query.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status} al obtener técnicos cercanos`);
  }

  return res.json();
}

export async function getTecnicoPorId(id: string): Promise<TecnicoApi | null> {
  const res = await fetch(`${API_URL}/api/technicians/${encodeURIComponent(id)}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status} al obtener el técnico`);
  }

  return res.json();
}
```

---

## 4. Notas para frontend

- El campo de distancia se llama `distanceKm`. Si el tipo del frontend usa otro nombre (por ejemplo `distanciaKm`), hay que mapearlo.
- La API necesita `lat` y `lng` numéricos: si el usuario elige un distrito, el frontend debe traducirlo a coordenadas o usar `expo-location`.
- Datos de prueba: solo existe 1 técnico (**Juan Rios**, Lurín, lat `-12.2745`, lng `-76.8711`).
- La primera petición puede tardar unos segundos si el servidor estuvo inactivo.
