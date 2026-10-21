# API ProxiHogar

**Base URL (producción):** `https://proxihogar-backend-production.up.railway.app`

- Autenticación: Mediante JWT en el header `Authorization: Bearer <token>` para rutas protegidas.
- Rutas públicas por ahora: `/api/technicians/nearby` y `/api/technicians/:id` (se consumen sin token).
- Rate Limit: Endpoints de autenticación (`/register` y `/login`) limitados a 10 peticiones cada 15 minutos por IP.
- CORS abierto y protección de cabeceras con Helmet.
- Todos los errores devuelven `{ "error": "mensaje" }`.

---

## 0. Autenticación (`/api/auth`)

### 0.1 Registro de usuario
```
POST /api/auth/register
```

**Body (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `email` | string | Sí | Correo electrónico válido (se normaliza a minúsculas) |
| `password` | string | Sí | Contraseña con mínimo 8 caracteres |
| `nombre` | string | Sí | Nombre del usuario (no vacío) |
| `telefono` | string | No | Número de teléfono |
| `role` | string | No | `"CLIENT"` o `"WORKER"` (por defecto `"CLIENT"`) |

**Respuesta 201 Created:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "uuid-generado",
    "email": "usuario@test.com",
    "nombre": "Juan Pérez",
    "role": "CLIENT"
  }
}
```

**Errores:**
- **400 Bad Request:** Validaciones fallidas (nombre vacío, email inválido, contraseña menor a 8 caracteres o rol no permitido).
- **409 Conflict:** El correo electrónico ya se encuentra registrado.
- **429 Too Many Requests:** Excedido el límite de 10 intentos por IP en 15 minutos.

---

### 0.2 Inicio de sesión
```
POST /api/auth/login
```

**Body (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `email` | string | Sí | Correo electrónico registrado |
| `password` | string | Sí | Contraseña |

**Respuesta 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "uuid-usuario",
    "email": "usuario@test.com",
    "nombre": "Juan Pérez",
    "role": "CLIENT"
  }
}
```

**Errores:**
- **401 Unauthorized:** `"Credenciales inválidas"` (se retorna el mismo mensaje si el usuario no existe o si la contraseña no coincide).
- **429 Too Many Requests:** Excedido el límite de 10 intentos por IP en 15 minutos.

---

### 0.3 Perfil del usuario autenticado
```
GET /api/auth/me
```

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta 200 OK:**
```json
{
  "id": "uuid-usuario",
  "email": "usuario@test.com",
  "nombre": "Juan Pérez",
  "role": "CLIENT",
  "dniRuc": null,
  "telefono": null,
  "createdAt": "2026-10-19T14:23:48.858Z",
  "updatedAt": "2026-10-19T14:23:48.858Z"
}
```

**Errores:**
- **401 Unauthorized:** Token faltante, inválido o expirado.

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

Los filtros son opcionales y combinables. Los resultados vienen ordenados por distancia ascendente. Solo se retornan técnicos con `disponible: true`.

### Ejemplo

```
/api/technicians/nearby?lat=-12.2745&lng=-76.8711&radius=5&especialidad=Electricista&verificado=true&calificacionMin=4
```

### Respuesta 200

Array de técnicos. Si no hay ninguno devuelve `[]` (no es un error).

Campos de cada técnico:

- `id` (string)
- `nombre` (string)
- `iniciales` (string)
- `colorAvatar` (string)
- `especialidad` (string)
- `especialidades` (`string[]`)
- `descripcion` (string)
- `verificado` (boolean)
- `calificacion` (number)
- `cantidadResenas` (number)
- `cantidadTrabajos` (number)
- `distanceKm` (number): distancia calculada con fórmula de Haversine en km
- `distanciaTexto` (string): texto amigable de distancia (`"2.5 km"` o `"850 m"` si es menor a 1 km)
- `tiempoLlegada` (string): tiempo estimado vehicular (`"15 min"`, `"1 h 15 min"` o `"2 h"`)
- `calculoAproximado` (boolean): `true` (indica que el cálculo es lineal, sin ruta GPS en tiempo real)
- `tarifaBase` (number)
- `ubicacion` (string)
- `experienciaAnios` (number)
- `latitude` (number): latitud del técnico (para ubicar pines en el mapa C28)
- `longitude` (number): longitud del técnico (para ubicar pines en el mapa C28)
- `resenas`: array con `id`, `autor`, `iniciales`, `calificacion`, `comentario`, `fecha`, `tags`

### Errores

- **400**: falta `lat`/`lng`, no son numéricos, están fuera de rango, o `radius`/`calificacionMin`/`tarifaMax` son inválidos.
- **500**: error interno.

---

## 2. Perfil de un técnico

```
GET /api/technicians/:id
```

### Query params (opcionales)

| Parámetro | Tipo   | Requerido | Descripción                                                        |
| --------- | ------ | --------- | ------------------------------------------------------------------ |
| `lat`     | number | No        | Latitud del usuario para calcular distancia y tiempo (-90 a 90)    |
| `lng`     | number | No        | Longitud del usuario para calcular distancia y tiempo (-180 a 180) |

> **Nota:** Si se desea calcular la distancia y tiempo estimado hacia el técnico, `lat` y `lng` deben enviarse **juntos**. El tiempo de llegada es una estimación basada en distancia lineal vehicular.

### Ejemplos

- Sin ubicación:
  ```
  /api/technicians/9837e9b0-0093-4ab1-9851-465a7031a941
  ```
- Con ubicación del usuario:
  ```
  /api/technicians/9837e9b0-0093-4ab1-9851-465a7031a941?lat=-12.2745&lng=-76.8711
  ```

### Respuesta 200

Objeto completo del perfil del técnico con reseñas ordenadas de la más reciente a la más antigua:

- Campos base: `id`, `nombre`, `iniciales`, `colorAvatar`, `especialidad`, `especialidades`, `descripcion`, `verificado`, `calificacion`, `cantidadResenas`, `cantidadTrabajos`, `tarifaBase`, `ubicacion`, `experienciaAnios`, `latitude`, `longitude`, `resenas`.
- Si se enviaron `lat` y `lng` válidos, se agregan:
  - `distanceKm` (number)
  - `distanciaTexto` (string: ej. `"2.5 km"` o `"850 m"`)
  - `tiempoLlegada` (string: ej. `"15 min"`, `"1 h 15 min"`, `"2 h"`)
  - `calculoAproximado` (boolean: `true`)

### Errores

- **400**: si solo se envía uno de `lat`/`lng`, o si no son numéricos o están fuera de rango.
- **404**: `{ "error": "Técnico no encontrado" }` si el id no existe.
- **500**: error interno.

---

## 3. Distritos y coordenadas de referencia (C28 - Mapa)

```
GET /api/districts
```

Endpoint público (sin autenticación). Devuelve la coordenada por defecto de Lima y una lista de distritos predefinidos con sus coordenadas aproximadas (centro del distrito).

> **Aclaración importante:** Las coordenadas de los distritos son **aproximadas** (representan el centro del distrito). Su propósito es centrar el mapa y calcular técnicos cercanos cuando el usuario **no concede el permiso de GPS** (Escenario 2 de la HU C28).

### Respuesta 200 OK
```json
{
  "default": { "nombre": "Lima", "latitude": -12.0464, "longitude": -77.0428 },
  "distritos": [
    { "nombre": "Lurín", "latitude": -12.2745, "longitude": -76.8711 },
    { "nombre": "Villa El Salvador", "latitude": -12.2136, "longitude": -76.9319 },
    { "nombre": "Villa María del Triunfo", "latitude": -12.1606, "longitude": -76.9386 },
    { "nombre": "Pachacámac", "latitude": -12.2297, "longitude": -76.8567 },
    { "nombre": "San Juan de Miraflores", "latitude": -12.1550, "longitude": -76.9700 },
    { "nombre": "Santiago de Surco", "latitude": -12.1453, "longitude": -77.0010 },
    { "nombre": "Miraflores", "latitude": -12.1219, "longitude": -77.0297 }
  ]
}
```

---

## 4. Ejemplo de consumo (TypeScript)

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
  distanciaTexto?: string;
  tiempoLlegada?: string;
  calculoAproximado?: boolean;
  tarifaBase: number;
  ubicacion: string;
  experienciaAnios: number;
  latitude: number;
  longitude: number;
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
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status} al obtener el técnico`);
  }

  return res.json();
}
```

---

## 5. Notas para frontend

- El campo numérico de distancia se llama `distanceKm` y el formateado `distanciaTexto`.
- El campo `calculoAproximado: true` indica que la estimación es lineal (no por ruta vial en tiempo real).
- La API necesita `lat` y `lng` numéricos: si el usuario elige un distrito, el frontend debe traducirlo a coordenadas o usar `expo-location`.
- Datos de prueba: existen **8 técnicos de prueba** en la base de datos distribuidos en Lima (Lurín, Villa El Salvador, Villa María del Triunfo, Pachacámac, San Juan de Miraflores, Santiago de Surco y Miraflores), 7 de ellos disponibles y 1 no disponible.
- La primera petición puede tardar unos segundos si el servidor estuvo inactivo.
