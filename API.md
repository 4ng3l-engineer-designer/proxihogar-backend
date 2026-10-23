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
| `tarifaMax`       | number positivo       | No        | Tarifa base máxima (excluye a técnicos con `tarifaBase: null`) |

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
- `fotoUrl` (string | null): URL de la fotografía del técnico o `null` si no tiene foto cargada
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
- `tarifaBase` (number | null): monto base o `null` si no tiene tarifa fija
- `moneda` (string): código de moneda (`"PEN"`)
- `tarifaTexto` (string): tarifa formateada lista para mostrar en la interfaz (ej. `"S/ 30.00"` o `"Tarifa a convenir"` si es `null`)
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

- Campos base: `id`, `nombre`, `iniciales`, `fotoUrl` (string | null), `colorAvatar`, `especialidad`, `especialidades`, `descripcion`, `verificado`, `calificacion`, `cantidadResenas`, `cantidadTrabajos`, `tarifaBase` (number | null), `moneda` (string), `tarifaTexto` (string), `ubicacion`, `experienciaAnios`, `latitude`, `longitude`, `resenas`.
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

### 2.3 Solicitudes asignadas al técnico autenticado
```
GET /api/technicians/me/requests
```

Permite al técnico autenticado (rol `WORKER`) consultar todas las solicitudes que tiene asignadas, ordenadas de la más reciente a la más antigua.

**Headers:**
```
Authorization: Bearer <token_worker>
```

**Respuesta 200 OK:**
```json
[
  {
    "id": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
    "status": "PENDING",
    "direccion": "Av. Larco 123, Miraflores",
    "tipoProblema": "Cortocircuito en sala",
    "descripcion": "Saltan los plomos continuamente.",
    "radio": "5km",
    "latitude": -12.1219,
    "longitude": -77.0297,
    "createdAt": "2026-10-22T16:30:00.000Z",
    "updatedAt": "2026-10-22T16:30:00.000Z",
    "cliente": {
      "nombre": "Cliente Ejemplo",
      "telefono": "987111222"
    },
    "estado": {
      "codigo": "PENDING",
      "texto": "Pendiente de aceptación",
      "paso": 1,
      "totalPasos": 5,
      "color": "#EAB308",
      "historial": [
        {
          "codigo": "PENDING",
          "texto": "Pendiente de aceptación",
          "fecha": "2026-10-22T16:30:00.000Z"
        }
      ]
    },
    "chat": {
      "disponible": false,
      "soloLectura": false,
      "motivo": "Esperando que el técnico acepte el servicio"
    }
  }
]
```

**Errores:**
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** El usuario no posee el rol `WORKER`.
- **404 Not Found:** El usuario autenticado no tiene un perfil de técnico asociado.

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

## 4. Solicitudes de servicio (C33 - Seguimiento)

Todas las rutas bajo `/api/requests` están protegidas y requieren autenticación con token Bearer y rol `CLIENT`. El `clientId` se toma automáticamente del token JWT del usuario autenticado.

Header requerido:
```
Authorization: Bearer <token>
```

### 4.1 Crear solicitud de servicio
```
POST /api/requests
```

**Body (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `technicianId` | string | Sí | ID del técnico a contratar |
| `direccion` | string | Sí | Dirección de atención |
| `tipoProblema` | string | Sí | Categoría o tipo del problema |
| `descripcion` | string | Sí | Detalle del problema |
| `radio` | string | No | Radio de búsqueda / atención (default: `"5km"`) |
| `latitude` | number | No | Latitud de la solicitud (-90 a 90). Obligatorio si se envía `longitude`. |
| `longitude` | number | No | Longitud de la solicitud (-180 a 180). Obligatorio si se envía `latitude`. |

**Respuesta 201 Created:**
```json
{
  "id": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
  "status": "PENDING",
  "direccion": "Av. Larco 123, Miraflores",
  "tipoProblema": "Fuga de agua",
  "descripcion": "El caño de la cocina gotea continuamente",
  "radio": "5km",
  "createdAt": "2026-10-21T05:30:00.000Z",
  "updatedAt": "2026-10-21T05:30:00.000Z",
  "tecnico": {
    "id": "9837e9b0-0093-4ab1-9851-465a7031a941",
    "nombre": "Juan Rios",
    "iniciales": "JR",
    "fotoUrl": null,
    "colorAvatar": "#0B192C",
    "especialidad": "Electricista",
    "verificado": true,
    "calificacion": 4.9,
    "cantidadResenas": 142,
    "experienciaAnios": 8,
    "telefono": "987654321",
    "disponible": true,
    "tarifaBase": 30,
    "moneda": "PEN",
    "tarifaTexto": "S/ 30.00",
    "distanceKm": 18.2,
    "distanciaTexto": "18.2 km",
    "tiempoLlegada": "1 h 52 min",
    "calculoAproximado": true
  },
  "estado": {
    "codigo": "PENDING",
    "texto": "Pendiente de aceptación",
    "paso": 1,
    "totalPasos": 5,
    "color": "#EAB308",
    "historial": [
      {
        "codigo": "PENDING",
        "texto": "Pendiente de aceptación",
        "fecha": "2026-10-21T05:30:00.000Z"
      }
    ]
  },
  "chat": {
    "disponible": false,
    "soloLectura": false,
    "motivo": "Esperando que el técnico acepte el servicio"
  }
}
```

**Errores:**
- **400 Bad Request:** Campos requeridos faltantes (`direccion`, `tipoProblema`, `descripcion`, `technicianId`) o coordenadas fuera de rango / incompletas.
- **401 Unauthorized:** Token no proporcionado o expirado.
- **403 Forbidden:** El usuario autenticado no tiene rol `CLIENT`.
- **404 Not Found:** El técnico especificado no existe.
- **409 Conflict:** `"El técnico no está disponible"` (cuando el técnico tiene `disponible: false`).

---

### 4.2 Listar solicitudes del cliente
```
GET /api/requests
```

Devuelve las solicitudes creadas por el cliente autenticado, ordenadas de la más reciente a la más antigua.

**Respuesta 200 OK:**
Array de solicitudes con la estructura descrita en el punto 4.1 (incluyendo `tecnico` y `estado`).

**Errores:**
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** Usuario con rol no autorizado (requiere `CLIENT`).

---

### 4.3 Detalle de una solicitud (Pantalla de seguimiento C33 / C38)
```
GET /api/requests/:id
```

Obtiene los datos de la solicitud, el objeto `tecnico` y el objeto `estado` completo para la pantalla de seguimiento y la cabecera del chat.

**Respuesta 200 OK:**
Objeto de la solicitud con `tecnico` y `estado`.

**Errores:**
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** Usuario con rol no autorizado (requiere `CLIENT`).
- **404 Not Found:** La solicitud no existe o pertenece a otro usuario (no revela su existencia).

---

### 4.4 Actualizar estado de una solicitud (C31 - Indicador de estado)
```
PATCH /api/requests/:id/status
```

Permite avanzar o cancelar el estado de una solicitud según las transiciones permitidas por el rol del usuario autenticado (`CLIENT` o `WORKER`).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `status` | string | Sí | Nuevo estado (`PENDING`, `ACCEPTED`, `ON_THE_WAY`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) |

**Matriz de transiciones permitidas:**
- **WORKER asignado:**
  - `PENDING` → `ACCEPTED` o `CANCELLED`
  - `ACCEPTED` → `ON_THE_WAY`
  - `ON_THE_WAY` → `IN_PROGRESS`
  - `IN_PROGRESS` → `COMPLETED`
- **CLIENT dueño:**
  - `PENDING` → `CANCELLED`
  - `ACCEPTED` → `CANCELLED`

**Respuesta 200 OK:**
Objeto de la solicitud con el nuevo `status` y el objeto `estado` actualizado (incorporando el nuevo log en `historial`).

**Errores:**
- **400 Bad Request:** Estado no enviado o valor no reconocido en `RequestStatus`.
- **401 Unauthorized:** Token no proporcionado o inválido.
- **404 Not Found:** Solicitud no encontrada o no pertenece al usuario autenticado (si es cliente, no es el dueño; si es técnico, no es el técnico asignado).
- **409 Conflict:** Transición no permitida (ej. `"No se puede pasar de PENDING a COMPLETED."`).

---

### 4.5 Catálogo de estados del servicio (C31)
```
GET /api/request-statuses
```

Endpoint público para consultar la lista de estados configurados en el sistema, permitiendo al frontend construir dinámicamente indicadores de progreso y listas de estados.

**Respuesta 200 OK:**
```json
[
  { "codigo": "PENDING", "texto": "Pendiente de aceptación", "paso": 1, "color": "#EAB308" },
  { "codigo": "ACCEPTED", "texto": "Aceptado", "paso": 2, "color": "#3B82F6" },
  { "codigo": "ON_THE_WAY", "texto": "Técnico en camino", "paso": 3, "color": "#8B5CF6" },
  { "codigo": "IN_PROGRESS", "texto": "Servicio en progreso", "paso": 4, "color": "#0EA5E9" },
  { "codigo": "COMPLETED", "texto": "Finalizado", "paso": 5, "color": "#10B981" },
  { "codigo": "CANCELLED", "texto": "Cancelado", "paso": null, "color": "#EF4444" }
]
```

---

### 4.6 Acceso al chat del servicio (C36)
```
GET /api/requests/:id/chat
```

Valida si el chat está habilitado para la solicitud y entrega los datos de la contraparte para pintar la cabecera e inicializar la conversación.

**Headers:**
```
Authorization: Bearer <token>
```

**Reglas de acceso:**
- Solo pueden acceder el **cliente dueño** de la solicitud o el **técnico asignado** (vinculado al `userId` del token). Cualquier otro usuario recibe `404`.
- Si el chat **no está disponible** (`PENDING` o `CANCELLED`), responde `403 Forbidden` con el motivo.
- Si el servicio está `COMPLETED`, el chat está disponible pero en modo `soloLectura: true`.

**Respuesta 200 OK (ejemplo cliente consultando):**
```json
{
  "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
  "status": "ACCEPTED",
  "chat": {
    "disponible": true,
    "soloLectura": false,
    "motivo": null
  },
  "miRol": "CLIENT",
  "contraparte": {
    "id": "9837e9b0-0093-4ab1-9851-465a7031a941",
    "nombre": "Juan Rios",
    "iniciales": "JR",
    "colorAvatar": "#0B192C",
    "fotoUrl": null,
    "especialidad": "Electricista",
    "disponible": true
  }
}
```

**Respuesta 200 OK (ejemplo técnico consultando):**
```json
{
  "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
  "status": "ACCEPTED",
  "chat": {
    "disponible": true,
    "soloLectura": false,
    "motivo": null
  },
  "miRol": "WORKER",
  "contraparte": {
    "id": "3339f0ad-83a2-4f82-becb-82225d6a7489",
    "nombre": "Cliente Ejemplo",
    "iniciales": "CE",
    "colorAvatar": null,
    "fotoUrl": null,
    "especialidad": null,
    "disponible": null
  }
}
```

**Errores:**
- **401 Unauthorized:** Token no proporcionado o expirado.
- **403 Forbidden:** El chat no está disponible para el estado actual de la solicitud (ej. `{ "error": "Esperando que el técnico acepte el servicio" }` o `{ "error": "El servicio fue cancelado" }`).
- **404 Not Found:** La solicitud no existe o el usuario autenticado no participa en ella.

---

## 5. Ejemplo de consumo (TypeScript)

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
  fotoUrl: string | null;
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
  tarifaBase: number | null;
  moneda: string;
  tarifaTexto: string;
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

## 6. Notas para frontend

- El campo `fotoUrl` puede ser una URL `string` o `null`. Si es `null`, el frontend debe renderizar las iniciales del técnico sobre un círculo con el color especificado en `colorAvatar`.
- El objeto `tecnico` en las respuestas de solicitudes (`/api/requests`) incluye `disponible: boolean` para mostrar si el profesional se encuentra en línea / disponible (útil en cabeceras de chat y pantallas de seguimiento).
- El campo numérico de distancia se llama `distanceKm` y el formateado `distanciaTexto`.
- El campo `calculoAproximado: true` indica que la estimación es lineal (no por ruta vial en tiempo real).
- El campo `tarifaTexto` ya viene formateado con el símbolo de moneda (`"S/ 30.00"`) o `"Tarifa a convenir"` si `tarifaBase` es `null`. Se recomienda mostrar directamente `tarifaTexto` en las tarjetas sin concatenar la moneda manualmente.
- Los filtros por `tarifaMax` excluyen automáticamente a los técnicos que tienen `tarifaBase: null`.
- La API necesita `lat` y `lng` numéricos: si el usuario elige un distrito, el frontend debe traducirlo a coordenadas o usar `expo-location`.
- Datos de prueba: existen **8 técnicos de prueba** en la base de datos distribuidos en Lima (Lurín, Villa El Salvador, Villa María del Triunfo, Pachacámac, San Juan de Miraflores, Santiago de Surco y Miraflores), 7 de ellos disponibles y 1 no disponible.
- La primera petición puede tardar unos segundos si el servidor estuvo inactivo.
