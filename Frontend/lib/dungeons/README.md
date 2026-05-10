# Dungeon JSON Contract

Contrato base versionado para mapas de mazmorra.

## Obligatorio
- `type: "mazmorra"`
- `version: 1`
- `layout`
- `layout.width` numero finito mayor a `0`
- `layout.height` numero finito mayor a `0`
- `layout.rooms` arreglo

## Opcional
- `metadata`
- `layout.units`
- `layout.origin`
- `layout.corridors`
- `layout.doors`
- `layout.markers`
- `layout.lights`
- `layout.props`
- campos opcionales de room, corridor, door y marker definidos en `types.ts`

## Defaults reservados para normalizacion futura
- `layout.units = "tile"`
- `layout.origin = { x: 0, y: 0 }`
- `layout.corridors = []`
- `layout.doors = []`
- `layout.markers = []`
- `layout.lights = []`
- `layout.props = []`
- `room.kind = "room"`
- `door.kind = "door"`

## Props decorativos
- `layout.props` guarda objetos decorativos persistentes de la dungeon.
- Cada prop usa coordenadas porcentuales `x`/`y` sobre el mapa (`0..100`) para compartir el mismo overlay que batalla.
- Shape soportado: `"rectangle" | "circle"`.
- Campos base: `id`, `shape`, `x`, `y`, `width`, `height`, `color`.
- Campos opcionales: `rotation`, `name`, `image`, `imageAssetId`, `hidden`.
- Batalla puede editar estos props cuando muestra una dungeon JSON; el cambio se re-suben al asset JSON del landmark.

## Rechazado por contrato minimo
- `type` faltante o distinto de `"mazmorra"`
- `version` faltante o distinta de `1`
- `layout` faltante
- `layout.width` invalido
- `layout.height` invalido
- `layout.rooms` no es arreglo

## Documento minimo valido
```json
{
  "type": "mazmorra",
  "version": 1,
  "layout": {
    "width": 100,
    "height": 100,
    "rooms": []
  }
}
```

Este contrato es el piso estable para el adaptador y el generador futuros. No define todavia semantica completa de render.

## Dungeon Generator API

`generateDungeonMapDocument(options)` acepta una configuracion agrupada y mantiene compatibilidad con opciones legacy planas.

### Opciones agrupadas
- `preset`: `"minimal" | "simple" | "rooms-corridors"`
- `roomOptions`
  - `count`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `padding`
- `corridorOptions`
  - `enabled`, `width`, `maxSteps`, `allowIntersections`
- `topologyOptions`
  - `extraConnections`
- `debugOptions`
  - `name`, `seed`

### Presets (composicion)
- `minimal`: mapa base sin salas/corredores generados
- `simple`: salas rectangulares sin corredores por defecto
- `rooms-corridors`: salas rectangulares + corredores y conexiones extra controladas

### Invariantes publicas (garantizadas)
- El documento generado siempre valida contra el adaptador (`readDungeonMapDocument`).
- Las salas generadas son rectangulares (en esta etapa de simplificacion).
- Si hay corredores:
  - usan segmentos ortogonales,
  - respetan `maxSteps`,
  - no crean pares directos duplicados entre la misma pareja de salas,
  - mantienen consistencia de puertas para endpoints validos.

### Intersecciones de corredores
- `corridorOptions.allowIntersections` controla si los corredores pueden reutilizar tramos ya existentes y formar intersecciones.
- Default: `true`.
- Legacy flat alias: `allowCorridorIntersections`.

### Variabilidad por seed
- Con el mismo `seed` y misma configuracion, el layout es determinista.
- Con seeds distintos, puede variar:
  - posicion y tamano de salas,
  - topologia de conexiones,
  - trazado final de corredores dentro de las restricciones.
