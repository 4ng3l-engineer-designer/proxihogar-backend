# API ProxiHogar

**Base URL (producción):** `https://proxihogar-backend.onrender.com`

- Autenticación: Mediante JWT en el header `Authorization: Bearer <token>` para rutas protegidas.
- Rutas públicas: `/api/technicians/nearby`, `/api/technicians/:id`, `/api/districts`, `/api/request-statuses`, `/api/auth/register` y `/api/auth/login` (se consumen sin token).
- Rate Limit: Endpoints de autenticación (`/register` y `/login`) limitados a **20 intentos fallidos** cada 15 minutos por IP (`skipSuccessfulRequests: true`). Las peticiones exitosas no descuentan intentos.
- Expiración automática: Las solicitudes en estado `PENDING` expiran automáticamente tras `REQUEST_EXPIRY_HOURS` horas (por defecto `24`).
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
| `role` | string | No | `"CLIENT"` o `"WORKER"` (por defecto `"CLIENT"`). Si es `"WORKER"`, crea automáticamente el perfil `Technician` en la misma transacción con `disponible: false` y `especialidad: "Sin especificar"`. |

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
- **429 Too Many Requests:** `{ "error": "Demasiados intentos fallidos. Intenta de nuevo en unos minutos." }` (excedido el límite de 20 intentos fallidos por IP en 15 minutos).

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
- **429 Too Many Requests:** `{ "error": "Demasiados intentos fallidos. Intenta de nuevo en unos minutos." }` (excedido el límite de 20 intentos fallidos por IP en 15 minutos).

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

> **Regla de filtrado doble (cobertura):** Un técnico aparece en `/nearby` únicamente si cumple **ambas** condiciones:
> 1. `distanceKm <= radius` (radio solicitado por el cliente).
> 2. Si el técnico tiene `radioCobertura` definido (no `null`), `distanceKm <= radioCobertura` (radio máximo de cobertura del técnico en km). Si `radioCobertura` es `null`, no se aplica límite propio del técnico.

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
- `radioCobertura` (number | null): radio máximo de cobertura en km definido por el técnico, o `null` si no tiene límite
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

- Campos base: `id`, `nombre`, `iniciales`, `fotoUrl` (string | null), `colorAvatar`, `especialidad`, `especialidades`, `descripcion`, `verificado`, `calificacion`, `cantidadResenas`, `cantidadTrabajos`, `tarifaBase` (number | null), `moneda` (string), `tarifaTexto` (string), `radioCobertura` (number | null), `ubicacion`, `experienciaAnios`, `latitude`, `longitude`, `resenas`.
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

### 2.3.1 Detalle de una solicitud asignada al técnico autenticado
```
GET /api/technicians/me/requests/:id
```

Protegido con `authenticate` y `requireRole("WORKER")`. Devuelve el detalle de una solicitud específica asignada al técnico autenticado (buscado por el `userId` del token), incluyendo los datos básicos del cliente (`nombre`, `telefono` — sin `email` ni `password`), `estado` completo con `historial` y `chat`. No incluye datos del perfil del técnico ni de otros técnicos.

**Headers:**
```
Authorization: Bearer <token_worker>
```

**Respuesta 200 OK:**
```json
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
```

**Errores:**
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** El usuario no posee el rol `WORKER`.
- **404 Not Found:** `{ "error": "Solicitud no encontrada." }` (si la solicitud no existe o pertenece a otro técnico).

---

### 2.4 Perfil propio del técnico autenticado
```
GET /api/technicians/me
```

Protegido con `authenticate` y `requireRole("WORKER")`. Devuelve todos los campos del perfil del técnico autenticado, incluido `disponible`.

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta 200 OK:**
Devuelve el objeto de perfil completo del técnico (igual que `GET /api/technicians/:id`) añadiendo el campo booleano `disponible`.

**Errores:**
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** El usuario no posee el rol `WORKER`.
- **404 Not Found:** Perfil de técnico no encontrado.

---

### 2.5 Actualizar perfil propio del técnico
```
PATCH /api/technicians/me
```

Protegido con `authenticate` y `requireRole("WORKER")`. Permite al técnico completar o actualizar su perfil profesional.

**Body (JSON — todos los campos son opcionales):**
| Campo | Tipo | Validación |
| :--- | :--- | :--- |
| `especialidad` | string | Texto no vacío |
| `descripcion` | string | Texto |
| `tarifaBase` | number \| null | Número `>= 0` o `null` |
| `radioCobertura` | number \| null | Número positivo `> 0` (en km) o `null` ("sin límite definido") |
| `ubicacion` | string | Texto no vacío |
| `experienciaAnios` | number | Entero `>= 0` |
| `latitude` | number | `-90` a `90` (debe enviarse junto con `longitude`) |
| `longitude` | number | `-180` a `180` (debe enviarse junto con `latitude`) |
| `fotoUrl` | null | Por ahora solo se acepta `null` |

> **Campos protegidos:** No permite modificar `verificado`, `calificacion` ni `cantidadResenas`.

**Respuesta 200 OK:** Perfil actualizado del técnico (incluyendo `disponible`).

**Errores:**
- **400 Bad Request:** Algún campo incumple las validaciones o `latitude`/`longitude` no vienen juntos.
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** El usuario no posee el rol `WORKER`.
- **404 Not Found:** Perfil de técnico no encontrado.
- **409 Conflict:** Intenta dejar `especialidad` en `"Sin especificar"` o `descripcion` vacía mientras el técnico tiene `disponible: true`.

---

### 2.6 Cambiar disponibilidad del técnico
```
PATCH /api/technicians/me/disponibilidad
```

Protegido con `authenticate` y `requireRole("WORKER")`.

**Body (JSON):**
```json
{ "disponible": true }
```

**Regla de negocio:** `disponible` solo puede pasar a `true` si `especialidad` no es `"Sin especificar"` y `descripcion` no está vacía.

**Respuesta 200 OK:** Perfil actualizado del técnico con el nuevo valor de `disponible`.

**Errores:**
- **400 Bad Request:** `disponible` no es booleano.
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** El usuario no posee el rol `WORKER`.
- **404 Not Found:** Perfil de técnico no encontrado.
- **409 Conflict:** `"Debes completar tu especialidad y descripción antes de activarte como disponible."`

---

### 2.7 Enviar ubicación en tiempo real del técnico (C30)
```
POST /api/technicians/me/location
```

Protegido con `authenticate` y `requireRole("WORKER")`. Guarda la posición actual del técnico mientras tiene una solicitud activa en estado `ON_THE_WAY` y emite el evento `technician:location` por Socket.io a la sala `request:<requestId>`.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `latitude` | number | Sí | Latitud válida (`-90` a `90`) |
| `longitude` | number | Sí | Longitud válida (`-180` a `180`) |

**Respuesta 200 OK:**
```json
{
  "latitude": -12.2745,
  "longitude": -76.8711,
  "updatedAt": "2026-11-20T05:25:00.000Z"
}
```

**Errores:**
- **400 Bad Request:** `latitude` o `longitude` faltantes, no numéricos o fuera de rango.
- **401 Unauthorized:** Token no proporcionado o inválido.
- **403 Forbidden:** El usuario no posee el rol `WORKER`.
- **409 Conflict:** `"Solo puedes enviar tu ubicación mientras vas en camino a un servicio."` (cuando el técnico no tiene ninguna solicitud en `ON_THE_WAY`).
- **429 Too Many Requests:** `"Espera unos segundos antes de enviar otra ubicación."` (límite de 1 envío cada 5 segundos por técnico; no se guarda ni se emite por socket).

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

Todas las rutas bajo `/api/requests` requieren autenticación con token Bearer (`authenticate`).
- Creación, listado, detalle y ruta (`POST /api/requests`, `GET /api/requests`, `GET /api/requests/:id`, `GET /api/requests/:id/route`, `POST /api/requests/:id/work-order/pay`): exclusivos del cliente dueño (`CLIENT`).
- Órdenes de trabajo del técnico (`POST /api/requests/:id/work-order`, `PATCH /api/requests/:id/work-order/send`): exclusivos del técnico asignado (`WORKER`).
- Cambio de estado, acceso al chat, mensajes y consulta de orden (`PATCH /api/requests/:id/status`, `GET /api/requests/:id/chat`, `GET/POST /api/requests/:id/messages`, `POST /api/requests/:id/messages/image`, `GET /api/requests/:id/work-order`): disponibles tanto para el cliente dueño (`CLIENT`) como para el técnico asignado (`WORKER`).
- El `clientId` o `userId` se toma siempre del token JWT del usuario autenticado.

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
| `motivo` | string | No | Motivo opcional de cancelación (máximo 200 caracteres). Solo se guarda cuando `status` es `CANCELLED`; en otros estados se ignora. Si viene vacío, se guarda `null`. |

**Matriz de transiciones permitidas:**
- **WORKER asignado:**
  - `PENDING` → `ACCEPTED` o `CANCELLED`
  - `ACCEPTED` → `ON_THE_WAY`
  - `ON_THE_WAY` → `IN_PROGRESS`
  - `IN_PROGRESS` → `COMPLETED`
- **CLIENT dueño:**
  - `PENDING` → `CANCELLED`
  - `ACCEPTED` → `CANCELLED`
- **Sistema (automático):**
  - `PENDING` → `EXPIRED` (registrado con `changedBy: "system"` cuando la solicitud supera `REQUEST_EXPIRY_HOURS` horas sin ser aceptada; default `24` horas).

**Regla de técnico ocupado (al aceptar):**
Cuando la transición es a `ACCEPTED`, el servidor verifica dentro de una transacción (bloqueando la fila del técnico) que no tenga otra solicitud en estado `ACCEPTED`, `ON_THE_WAY` o `IN_PROGRESS`. Si ya tiene una, responde `409 Conflict` con `"Ya tienes un servicio en curso. Finalízalo antes de aceptar otro."`. Esta restricción aplica únicamente al aceptar, no al crear solicitudes.

**Respuesta 200 OK:**
Objeto de la solicitud con el nuevo `status`, el objeto `estado` actualizado, `chat`, `tecnico` y `cliente` (`{ nombre, telefono }`). Todo el cambio se ejecuta atómicamente en una transacción con bloqueo de fila (`FOR UPDATE`).

- Dentro de `estado`:
  - `cancelacion`: `null` cuando el estado no es `CANCELLED` ni `EXPIRED`. Cuando el estado actual es `CANCELLED` o `EXPIRED`, contiene:
    ```json
    {
      "por": "CLIENT" | "WORKER" | "SYSTEM",
      "motivo": "string | null",
      "fecha": "2026-11-20T06:50:00.000Z"
    }
    ```
  - Cada elemento de `estado.historial` incluye `codigo`, `texto`, `fecha`, `por` (`"CLIENT"`, `"WORKER"` o `"SYSTEM"`) y `motivo` (solo si existe). El motivo es visible únicamente para los participantes de la solicitud (cliente dueño y técnico asignado).

**Errores:**
- **400 Bad Request:** Estado no enviado/no reconocido en `RequestStatus`, o `motivo` no es texto / supera los 200 caracteres.
- **401 Unauthorized:** Token no proporcionado o inválido.
- **404 Not Found:** Solicitud no encontrada o no pertenece al usuario autenticado (si es cliente, no es el dueño; si es técnico, no es el técnico asignado).
- **409 Conflict:** Transición no permitida (ej. `"No se puede pasar de PENDING a COMPLETED."`) o técnico ocupado (`"Ya tienes un servicio en curso. Finalízalo antes de aceptar otro."`).

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
  { "codigo": "CANCELLED", "texto": "Cancelado", "paso": null, "color": "#EF4444" },
  { "codigo": "EXPIRED", "texto": "Expirado", "paso": null, "color": "#6B7280" }
]
```

> **Expiración automática (`REQUEST_EXPIRY_HOURS`):** Un job interno (`src/jobs/expireRequests.ts`) se ejecuta al arrancar el servidor y cada 10 minutos para expirar solicitudes `PENDING` más antiguas que `REQUEST_EXPIRY_HOURS` horas (default `24`), registrando un log con `changedBy: "system"` y emitiendo `request:status` por Socket.io. Si la variable `REQUEST_EXPIRY_HOURS` no es un número positivo, el servidor falla al arrancar con un mensaje claro.

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
- Si el chat **no está disponible** (`PENDING`, `CANCELLED` o `EXPIRED`), responde `403 Forbidden` con el motivo.
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

### 4.7 Obtener historial de mensajes del chat
```
GET /api/requests/:id/messages
```

Disponible para el **cliente dueño** o el **técnico asignado**. Permite consultar el historial de mensajes (texto e imágenes) con paginación cursor-based hacia atrás (`before`).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Params (opcionales):**
| Parámetro | Tipo | Default | Descripción |
| :--- | :--- | :--- | :--- |
| `limit` | number | 30 | Cantidad máxima de mensajes a devolver (mínimo 1, máximo 100). |
| `before` | string | - | ID de un mensaje. Retorna los mensajes anteriores (más antiguos) a ese mensaje. |

**Reglas de acceso:**
- **404 Not Found:** La solicitud no existe o el usuario no es participante.
- **403 Forbidden:** El chat no está disponible en el estado actual (`PENDING`, `CANCELLED` o `EXPIRED`).
- En estado `COMPLETED` el chat es de solo lectura, por lo que **sí permite leer los mensajes** (200 OK).
- Los mensajes se devuelven ordenados **cronológicamente del más antiguo al más reciente**.

**Respuesta 200 OK:**
```json
{
  "mensajes": [
    {
      "id": "c1f72a4d-82d2-4318-8f83-e0709f635671",
      "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
      "tipo": "TEXT",
      "contenido": "Hola, estoy llegando en 10 minutos.",
      "createdAt": "2026-10-22T20:15:30.000Z",
      "senderId": "9837e9b0-0093-4ab1-9851-465a7031a941",
      "senderRole": "WORKER",
      "esMio": false
    },
    {
      "id": "b3e921d0-11fa-4091-bb29-e58f00128e45",
      "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
      "tipo": "TEXT",
      "contenido": "Perfecto Juan, te espero en la puerta.",
      "archivo": null,
      "createdAt": "2026-10-22T20:16:10.000Z",
      "senderId": "3339f0ad-83a2-4f82-becb-82225d6a7489",
      "senderRole": "CLIENT",
      "esMio": true
    },
    {
      "id": "a4d912f1-55ca-41a2-9c31-91f2014ab211",
      "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
      "tipo": "IMAGE",
      "contenido": "Así está el tablero eléctrico",
      "archivo": {
        "url": "https://<proyecto>.supabase.co/storage/v1/object/sign/...",
        "mime": "image/jpeg",
        "size": 148290,
        "expiraEn": "2026-10-22T21:16:30.000Z"
      },
      "createdAt": "2026-10-22T20:16:30.000Z",
      "senderId": "3339f0ad-83a2-4f82-becb-82225d6a7489",
      "senderRole": "CLIENT",
      "esMio": true
    }
  ],
  "hayMas": false
}
```

> **Objeto `archivo` (C41):** Cuando `tipo` es `"TEXT"`, `archivo` es `null`. Cuando `tipo` es `"IMAGE"`, `archivo` contiene `{ url, mime, size, expiraEn }`, donde `url` es un enlace firmado de Supabase Storage válido por **1 hora** y `expiraEn` es la fecha ISO de expiración.

**Errores:**
- **401 Unauthorized:** Token no proporcionado o expirado.
- **403 Forbidden:** Chat no disponible (`PENDING` o `CANCELLED`).
- **404 Not Found:** Solicitud no encontrada, usuario no participante o mensaje de referencia (`before`) no existe.

---

### 4.8 Enviar mensaje de chat
```
POST /api/requests/:id/messages
```

Disponible para el cliente dueño o el técnico asignado. Guarda un nuevo mensaje de texto en la conversación y lo emite en tiempo real vía Socket.io a la sala `request:<requestId>`.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `contenido` | string | Sí | Texto del mensaje (se recortan espacios; longitud 1 a 1000 caracteres). |

**Reglas de negocio:**
- Si `contenido` no se envía, no es texto, está vacío o supera los 1000 caracteres: **400 Bad Request**.
- Si el usuario no es participante o la solicitud no existe: **404 Not Found**.
- Si el chat no está disponible (`PENDING`, `CANCELLED` o `EXPIRED`): **403 Forbidden** con el motivo.
- Si el servicio finalizó (`COMPLETED` / `chat.soloLectura === true`): **409 Conflict** con `"El servicio finalizó; el chat es solo de lectura"`.

**Respuesta 201 Created:**
```json
{
  "id": "8c59f201-9031-41ae-ba5a-19e0cf558fa3",
  "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
  "tipo": "TEXT",
  "contenido": "Ya estoy afuera del domicilio.",
  "archivo": null,
  "createdAt": "2026-10-22T20:18:00.000Z",
  "senderId": "9837e9b0-0093-4ab1-9851-465a7031a941",
  "senderRole": "WORKER",
  "esMio": true
}
```

---

### 4.9 Enviar imagen en el chat (C41)
```
POST /api/requests/:id/messages/image
```

Disponible para el cliente dueño o el técnico asignado. Recibe `multipart/form-data`, valida los *magic bytes* del archivo en memoria (sin guardar en disco), sube la imagen a Supabase Storage en `requests/<requestId>/<uuid>.<ext>`, guarda el mensaje (`tipo: "IMAGE"`) y lo emite por Socket.io (`chat:message`) con su objeto `archivo`.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Campos (`FormData`):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `imagen` | File | Sí | Imagen JPEG (`FF D8 FF`), PNG (`89 50 4E 47`) o WebP (`RIFF....WEBP`). Máximo **5 MB**. |
| `contenido` | string | No | Pie de foto opcional (se recortan espacios; máximo 1000 caracteres). |

**Respuesta 201 Created:**
```json
{
  "id": "a4d912f1-55ca-41a2-9c31-91f2014ab211",
  "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
  "tipo": "IMAGE",
  "contenido": "Así está el tomacorriente",
  "archivo": {
    "url": "https://<proyecto>.supabase.co/storage/v1/object/sign/...",
    "mime": "image/jpeg",
    "size": 148290,
    "expiraEn": "2026-11-20T06:45:00.000Z"
  },
  "createdAt": "2026-11-20T05:45:00.000Z",
  "senderId": "3339f0ad-83a2-4f82-becb-82225d6a7489",
  "senderRole": "CLIENT",
  "esMio": true
}
```

**Errores:**
- **400 Bad Request:** Falta el archivo en el campo `imagen` o `contenido` supera los 1000 caracteres.
- **401 Unauthorized:** Token no proporcionado o expirado.
- **403 Forbidden:** El chat no está disponible (`PENDING`, `CANCELLED` o `EXPIRED`).
- **404 Not Found:** Solicitud no encontrada o el usuario no es participante.
- **409 Conflict:** `"El servicio finalizó; el chat es solo de lectura"` (en estado `COMPLETED`).
- **413 Payload Too Large:** La imagen supera el límite máximo de 5 MB.
- **415 Unsupported Media Type:** El contenido real del archivo (magic bytes) no corresponde a JPEG, PNG o WebP.
- **502 Bad Gateway:** Fallo al subir la imagen a Supabase Storage (no se crea el mensaje).

---

### 4.10 Tiempo Real con Socket.io (C37)

El servidor cuenta con Socket.io montado sobre el mismo puerto HTTP con soporte CORS habilitado. El envío de mensajes se realiza siempre por REST (`POST /api/requests/:id/messages` o `POST /api/requests/:id/messages/image`); el socket se utiliza exclusivamente para recibir eventos en tiempo real.

#### Conexión y autenticación
El cliente debe enviar el token JWT en el objeto `auth` del handshake:
```javascript
import { io } from "socket.io-client";

const socket = io("https://proxihogar-backend.onrender.com", {
  auth: {
    token: "<JWT_DEL_USUARIO>",
  },
});
```
- Si el token no se envía o es inválido/expirado, la conexión es **rechazada** por el servidor disparando el evento `connect_error` en el cliente.

#### Eventos del cliente hacia el servidor

1. **`chat:join`** (Unirse a la sala de la solicitud):
   - Envía: `{ requestId: "string" }`
   - Callback: `(response: { ok: boolean, error?: string }) => void`
   - Valida que el usuario sea participante y que el chat esté disponible (`ACCEPTED`, `ON_THE_WAY`, `IN_PROGRESS` o `COMPLETED`).
   - Si es válido, une el socket a la sala `request:<requestId>` y responde `{ ok: true }`.
   - Si no, responde `{ ok: false, error: "mensaje de motivo" }`.

2. **`chat:leave`** (Salir de la sala):
   - Envía: `{ requestId: "string" }`
   - Saca al socket de la sala `request:<requestId>`.

#### Eventos emitidos por el servidor hacia la sala `request:<requestId>`

1. **`chat:message`** (Nuevo mensaje enviado):
   Se emite automáticamente tras guardar un mensaje exitosamente vía `POST /api/requests/:id/messages` (con `archivo: null`) o `POST /api/requests/:id/messages/image` (con `archivo: { url, mime, size, expiraEn }`).
   ```json
   {
     "id": "8c59f201-9031-41ae-ba5a-19e0cf558fa3",
     "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
     "tipo": "TEXT",
     "contenido": "Ya estoy afuera del domicilio.",
     "archivo": null,
     "createdAt": "2026-10-22T20:18:00.000Z",
     "senderId": "9837e9b0-0093-4ab1-9851-465a7031a941",
     "senderRole": "WORKER"
   }
   ```
   > **Cálculo de `esMio`:** Como el evento se transmite a toda la sala, cada cliente calcula localmente si el mensaje es suyo comparando: `esMio = msg.senderId === usuarioActual.id`.

2. **`request:status`** (Cambio de estado del servicio):
   Se emite automáticamente cuando se actualiza el estado de la solicitud vía `PATCH /api/requests/:id/status`.
   ```json
   {
     "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
     "status": "COMPLETED",
     "estado": {
       "codigo": "COMPLETED",
       "texto": "Finalizado",
       "paso": 5,
       "totalPasos": 5,
       "color": "#10B981",
       "historial": [ ... ]
     },
     "chat": {
       "disponible": true,
       "soloLectura": true,
       "motivo": "El servicio finalizó; el chat es solo de lectura"
     }
   }
   ```

3. **`technician:location`** (Ubicación en tiempo real del técnico — C30):
   Se emite automáticamente a la sala `request:<requestId>` cuando el técnico actualiza su posición vía `POST /api/technicians/me/location` mientras está en `ON_THE_WAY`. Solo transporta la posición (no incluye la polilínea de la ruta).
   ```json
   {
     "requestId": "6724b0e8-07cb-4fc0-a034-77a8a97e412e",
     "latitude": -12.2745,
     "longitude": -76.8711,
     "updatedAt": "2026-11-20T05:25:00.000Z"
   }
   ```

---

### 4.11 Ruta hacia el domicilio en tiempo real (C30)
```
GET /api/requests/:id/route
```

Protegido con `authenticate`. Accesible **únicamente para el cliente dueño** de la solicitud (cualquier otro usuario, incluyendo técnicos, recibe `404 Not Found`).

Calcula la ruta vehicular desde la última posición registrada del técnico hasta el domicilio de la solicitud usando el servidor **OSRM público** (`router.project-osrm.org`), con caché en memoria por solicitud (se recalcula únicamente si el técnico se movió más de 50 metros o pasaron más de 15 segundos; la caché se limpia al salir de `ON_THE_WAY`).

> **Nota de disponibilidad:** El cálculo de ruta utiliza la instancia pública de OSRM sin garantía de disponibilidad ni SLA. Ante timeouts (> 4 s) o fallos del servicio externo, el endpoint nunca devuelve error `500`: responde `200 OK` con `estado: "RUTA_NO_DISPONIBLE"` y las coordenadas de ambos marcadores para que la app pueda seguir mostrándolos en el mapa.

**Respuestas `200 OK` según el estado:**

1. **`NO_EN_CAMINO`** (la solicitud no está en `ON_THE_WAY`):
   ```json
   {
     "estado": "NO_EN_CAMINO",
     "mensaje": "El técnico no está en camino."
   }
   ```
2. **`SIN_UBICACION`** (la solicitud está en `ON_THE_WAY`, pero el técnico aún no ha enviado su posición):
   ```json
   {
     "estado": "SIN_UBICACION",
     "mensaje": "El técnico aún no comparte su ubicación."
   }
   ```
3. **`RUTA_NO_DISPONIBLE`** (existe posición, pero OSRM falló o demoró más de 4 s):
   ```json
   {
     "estado": "RUTA_NO_DISPONIBLE",
     "mensaje": "No pudimos calcular la ruta en este momento.",
     "tecnico": { "latitude": -12.2745, "longitude": -76.8711, "updatedAt": "2026-11-20T05:25:00.000Z" },
     "domicilio": { "latitude": -12.1219, "longitude": -77.0297 }
   }
   ```
4. **`OK`** (ruta calculada o servida desde caché):
   ```json
   {
     "estado": "OK",
     "tecnico": { "latitude": -12.2745, "longitude": -76.8711, "updatedAt": "2026-11-20T05:25:00.000Z" },
     "domicilio": { "latitude": -12.1219, "longitude": -77.0297 },
     "ruta": [
       [-12.2745, -76.8711],
       [-12.2701, -76.8754]
     ],
     "distanciaMetros": 25400.5,
     "duracionSegundos": 1980.2,
     "calculadoEn": "2026-11-20T05:25:05.000Z"
   }
   ```

**Errores:**
- **401 Unauthorized:** Token no proporcionado o inválido.
- **404 Not Found:** La solicitud no existe o el usuario autenticado no es el cliente dueño.

---

### 4.12 Orden de trabajo y pago (C56)

Todas las respuestas de solicitudes (`GET /api/requests/:id`, `GET /api/technicians/me/requests/:id`, etc.) incluyen el campo `ordenTrabajo` (`null` si aún no se creó, o `{ id, manoDeObra, items, total, totalTexto, moneda, status, paymentMethod, paymentReference, paidAt }`).

**Regla de completado:** Si la solicitud tiene una orden de trabajo en estado `SENT` (pendiente de pago), el técnico **no** puede pasar manualmente de `IN_PROGRESS` a `COMPLETED` (`409`: `"El servicio tiene una orden de trabajo pendiente de pago. El cliente debe registrar el pago primero."`). El servicio pasa a `COMPLETED` automáticamente cuando el cliente registra el pago. Si la solicitud no tiene orden de trabajo, el técnico puede completarla manualmente como antes.

#### 4.12.1 Crear orden de trabajo (borrador)
```
POST /api/requests/:id/work-order
```
Protegido con `authenticate` y `requireRole("WORKER")` (técnico asignado). Solo permitido cuando la solicitud está en `IN_PROGRESS` y aún no tiene orden.

**Body (JSON):**
```json
{
  "manoDeObra": 50,
  "items": [
    { "descripcion": "Cambio de llave", "cantidad": 1, "precioUnitario": 25 },
    { "descripcion": "Cinta aislante", "cantidad": 2, "precioUnitario": 5 }
  ]
}
```
- `manoDeObra >= 0`; `items` no vacío (`descripcion` no vacía, `cantidad > 0`, `precioUnitario >= 0`).
- `total` se calcula en el servidor (`manoDeObra + suma(cantidad * precioUnitario)`). Se crea en estado `DRAFT`.

**Respuesta 201 Created:** Orden completa (`id`, `requestId`, `manoDeObra`, `items`, `total`, `totalTexto`, `tarifaTexto`, `moneda: "PEN"`, `status: "DRAFT"`, `paymentMethod: null`, `paymentReference: null`, `paidAt: null`, `createdAt`, `updatedAt`).

**Errores:** `400` (validación), `401`, `403`, `404`, `409` (no está en `IN_PROGRESS` o ya existe orden).

#### 4.12.2 Enviar orden al cliente
```
PATCH /api/requests/:id/work-order/send
```
Protegido con `authenticate` y `requireRole("WORKER")` (técnico asignado). Pasa la orden de `DRAFT` a `SENT` y emite `workorder:sent` por Socket.io a `request:<id>`.

**Respuesta 200 OK:** Orden actualizada con `status: "SENT"`.  
**Errores:** `401`, `403`, `404`, `409` (si la orden no está en `DRAFT`).

#### 4.12.3 Consultar orden de trabajo
```
GET /api/requests/:id/work-order
```
Protegido con `authenticate` (cliente dueño o técnico asignado).

**Respuesta 200 OK:** Orden completa incluyendo `tarifaTexto` (`formatTarifa(total)`) y `moneda: "PEN"`.  
**Errores:** `401`, `404` (si no existe la solicitud, no es participante o no existe orden).

#### 4.12.4 Registrar pago y finalizar servicio
```
POST /api/requests/:id/work-order/pay
```
Protegido con `authenticate` y `requireRole("CLIENT")` (cliente dueño). Solo permitido si la orden está en `SENT`.

**Body (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `paymentMethod` | string | Sí | `"EFECTIVO"`, `"YAPE"`, `"PLIN"` o `"TRANSFERENCIA"` |
| `paymentReference` | string | No | Número de operación (máx. 50 caracteres) |

**Efecto transaccional:** Actualiza la orden a `PAID` (`paymentMethod`, `paymentReference`, `paidAt = now()`) y cambia la solicitud de `IN_PROGRESS` a `COMPLETED` registrando `RequestStatusLog`. Emite `workorder:paid` y `request:status` por Socket.io.

**Respuesta 200 OK:** `{ "orden": { ... }, "solicitud": { ... } }`.  
**Errores:** `400` (`paymentMethod` inválido o `paymentReference > 50`), `401`, `403`, `404`, `409` (orden no está en `SENT`).

---

## 5. Ejemplo de consumo (TypeScript)

```typescript
const API_URL = "https://proxihogar-backend.onrender.com";

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
