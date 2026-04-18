# dnd Backend

Backend Spring Boot para D&D con autenticacion JWT por cookie y dominio principal en PostgreSQL: `landmarks`, `buildings`, `characters`, `organizations`.

## Requisitos
- Java `21`
- PostgreSQL `15+`
- Maven (o `mvnw`)

## Variables de entorno
Crear `.env` en la raiz de `Backend`:

```env
JWT_SECRET_KEY=tu_clave_jwt_larga
DB_NAME=nombre_db
DB_USERNAME=usuario_postgres
DB_PASSWORD=password_postgres
```

## Levantar
```bash
./mvnw spring-boot:run
```

Base URL:
- `http://localhost:8086/api`

## Seguridad
- Publico: `POST /api/auth/register`
- Autenticado: `GET /api/auth/login`, `POST /api/auth/logout`, `/api/v1/**`
- Registro single-user: solo se permite crear el primer usuario; luego devuelve `409`.

## Migraciones y esquema
- Flyway habilitado (`db/migration/V1__init_domain_schema.sql`)
- Hibernate en `validate`
- Esquema normalizado con tablas puente/tags/eventos y FKs con limpieza referencial por cascada.

## Endpoints de dominio
Todos autenticados bajo `/api/v1`:
- `GET/POST/PUT/DELETE /landmarks`
- `GET/POST/PUT/DELETE /buildings`
- `GET/POST/PUT/DELETE /characters`
- `GET/POST/PUT/DELETE /organizations`

### Include en landmarks
`GET /api/v1/landmarks?include=edificios,personajes,organizaciones`

Acepta alias ingles:
- `buildings`
- `characters`
- `organizations`

## Payloads (compatibles con frontend)

### Landmark
`POST /api/v1/landmarks`

```json
{
  "icono": "city",
  "nombre": "Puerto Dorado",
  "tipo": "ciudad",
  "escalaIcono": 1.1,
  "escalaTexto": 1.0,
  "mostrarLeyenda": true,
  "posicion": [0.45, 0.55],
  "tags": ["capital", "puerto"],
  "poblacion": 12000,
  "descripcionCorta": "Centro comercial",
  "historia": "Fundada por marinos.",
  "eventos": [
    {
      "nombre": "Fundacion",
      "descripcion": "Nacimiento de la ciudad",
      "fecha": "1200 DR",
      "posicion": [0.4, 0.6]
    }
  ],
  "mapa": {
    "kind": "embedded",
    "dataUrl": "data:image/png;base64,AAAA"
  }
}
```

`mapa` soporta union:
- `{ "kind": "asset", "filename": "..." }`
- `{ "kind": "embedded", "dataUrl": "..." }`
- `{ "kind": "external", "url": "..." }`
- `{ "kind": "stored", "key": "..." }`
- `{ "kind": "buildings", "source": "asset", "filename": "..." }`
- `{ "kind": "buildings", "source": "external", "url": "..." }`

### Building
`POST /api/v1/buildings`

```json
{
  "landmarkId": 1,
  "nombre": "Forja Central",
  "posicion": [0.25, 0.7],
  "descripcion": "Forja principal",
  "tags": ["metal", "herreria"],
  "duenoId": null,
  "duenoNombre": "Maestro Ferron",
  "mapBuildingIndex": 4,
  "organizationId": 1
}
```

### Character
`POST /api/v1/characters`

```json
{
  "nombre": "Aldric",
  "clase": "Paladin",
  "raza": "Humano",
  "descripcion": "Capitan de la orden",
  "tags": ["lider", "tanque"],
  "imagen": "https://img.example/aldric.png",
  "landmarkId": 1,
  "buildingIds": [1],
  "organizationIds": [1],
  "eventos": [
    {
      "sesion": "Sesion 1",
      "descripcion": "Ingreso a la orden",
      "fecha": "2026-02-01"
    }
  ]
}
```

### Organization
`POST /api/v1/organizations`

```json
{
  "nombre": "Orden del Alba",
  "descripcion": "Guardianes de la ciudad",
  "tags": ["guardia"],
  "imagen": null,
  "categorias": ["militar"],
  "edificios": [1],
  "miembros": [
    { "personajeId": 1, "categoria": "Lider" }
  ],
  "landmarks": [1]
}
```

Notas de derivacion:
- `organization.edificios` se deriva desde `buildings.organization_id`.
- `character.organizationIds` se deriva desde `organization_memberships`.
- `organization.miembros` devuelve datos derivados de `character` + `categoria` editable.

## Validaciones principales
- `nombre` obligatorio en landmark/building/character/organization
- `tipo` dentro del enum
- `escalaIcono` y `escalaTexto` en `0.6..2.4`
- `landmark.posicion` en `0..1`
- deduplicacion de `tags`, ids de relaciones y categorias
- validacion estricta del objeto `mapa` por combinacion `kind/source`

## Contrato de mazmorras
- La regla aplica solo cuando `landmark.tipo === "mazmorra"`.
- Una mazmorra solo acepta mapa por `mapAssetId`.
- Para `mapAssetId`, se acepta:
- asset de tipo `image`
- asset de tipo `json` cuyo root tenga `type: "mazmorra"`
- Una mazmorra no acepta referencias `mapa.kind` (`asset`, `external`, `stored`, `embedded` ni `buildings`).
- Si el JSON no tiene `type` o `type !== "mazmorra"`, la request se rechaza.
- Contrato minimo del JSON de mazmorra:

```json
{
  "type": "mazmorra",
  "version": 1
}
```

`version: 1` queda recomendado para el contrato inicial, pero no es obligatorio todavia.

Mensaje de error estandar:

```text
Las mazmorras solo permiten imagenes o JSON con type="mazmorra".
```

## Errores
Contrato uniforme desde `GlobalExceptionHandler`:

```json
{
  "timestamp": "...",
  "status": 400,
  "error": "Bad Request",
  "message": "Error de validación",
  "path": "/api/v1/landmarks",
  "errors": [
    { "field": "escalaIcono", "message": "escalaIcono debe ser >= 0.6" }
  ]
}
```

## Tests
- Seguridad de endpoints `/api/v1/**`
- CRUD de landmarks con `mapa.kind=embedded`
- Relaciones derivadas organization/building/character
- Limpieza de referencias al borrar `character` y `landmark`
- Validaciones 400 (campo y mapa invalido)

Ejecutar:
```bash
./mvnw test
```
