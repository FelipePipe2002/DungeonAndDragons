import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { LandmarkEvent } from "@/lib/types";
import { fetchJsonAsset } from "@/lib/services/asset-api.service";

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];
type LineString = Point[];
type MultiPoint = Point[];
type RiverLine = { line: LineString; width: number };
type WallSegment = {
  id: string;
  key: string;
  line: LineString;
  ringIndex: number;
  index: number;
};
type WallCorner = { id: string; point: Point; segmentIds: Set<string> };
type Segment = { a: Point; b: Point };
type StoredState = {
  hiddenWalls?: string[];
  gateCorners?: string[];
  hiddenBuildings?: number[];
  buildingOverrides?: Record<string, string>;
  selection?: { a: Point; b: Point };
  viewCenter?: Point;
  zoomScale?: number;
};
type RiverSegment = { a: Point; b: Point; width: number };

type BuildingsMapProps = {
  dataUrl?: string;
  events?: LandmarkEvent[];
  isPlacementActive?: boolean;
  onPlaceEvent?: (position: { x: number; y: number }) => void;
  onLoadError?: (message: string | null) => void;
  onLoadComplete?: () => void;
  buildingLinks?: Record<number, number>;
  buildingNames?: Record<number, string>;
  activeLinkBuildingId?: number | null;
  activeLinkOrganizationId?: number | null;
  onAssignBuildingLink?: (mapBuildingIndex: number) => void;
  onAssignOrganizationLink?: (mapBuildingIndex: number) => void;
  onOpenBuilding?: (buildingId: number) => void;
  focusPosition?: { x: number; y: number } | null;
  focusScale?: number | null;
  focusBuildingIndex?: number | null;
  focusBuildingIndices?: number[] | null;
  highlightBuildingIndices?: number[] | null;
  hiddenBuildingIndices?: number[] | null;
  onHiddenBuildingsChange?: (hiddenBuildingIndices: number[]) => void;
  focusRequestId?: number;
  showGrid?: boolean;
};
type WallSegmentsBuild = {
  segments: WallSegment[];
  keyMap: Map<string, string>;
};
type BuildingCategory = {
  id: string;
  label: string;
  color: string;
  weightInside: number;
  weightOutside: number;
};

type BuildingsFeature = {
  type: "MultiPolygon";
  id: string;
  coordinates: MultiPolygon;
};

type WaterFeature = BuildingsFeature;

type PolygonFeature = {
  type: "Polygon";
  id: string;
  coordinates: Polygon;
};

type MultiPointFeature = {
  type: "MultiPoint";
  id: string;
  coordinates: MultiPoint;
};

type GeometryCollection = {
  type: "GeometryCollection";
  id: string;
  geometries: Array<
    | { type: "LineString"; coordinates: LineString; width?: number }
    | { type: "Polygon"; coordinates: Polygon; width?: number }
  >;
};

type MapBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type WallRing = {
  ring: Ring;
  width: number;
};


const VIEW_SIZE = 1200;
const PADDING = 24;
const STORAGE_KEY_PREFIX = "dnd-building-map-state:";
const MAX_ZOOM = 12;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const DRAG_THRESHOLD_PX = 2;

// Centralized tuning values so map visuals can be adjusted quickly.
const VISUAL_CONFIG = {
  sourceDefaults: {
    wallWidth: 2.5,
    riverWidth: 3,
  },
  trees: {
    color: "#667755",
    radiusMin: 2.5,
    radiusScale: 7.5,
    filterBlur: 2.4,
    filterAlphaMultiplier: 24,
    filterAlphaOffset: -10,
    noiseBaseFrequency: 0.045,
    noiseOctaves: 2,
    noiseDisplacement: 12,
    noiseSeed: 15,
  },
  buildings: {
    // Multipliers applied to base color for subtle per-building variation.
    shadeSteps: [0.86, 0.92, 1, 1.1, 1.12],
    dimColor: "#b7b0a0",
    dimOpacity: 0.28,
  },
  walls: {
    strokeMin: 1.2,
    riverStrokeMin: 1.5,
    towerRadiusMin: 4,
    towerRadiusScale: 7,
  },
  gates: {
    smallMin: 6,
    largeMin: 12,
    largeWidthMultiplier: 2,
  },
} as const;

const NORMAL_BUILDING_COLOR = "#D6A36E";
const SPECIAL_BUILDING_CATEGORIES: BuildingCategory[] = [
  {
    id: "tavern",
    label: "Taberna",
    color: "#B46A3C",
    weightInside: 0.03,
    weightOutside: 0.018,
  },
  {
    id: "blacksmith",
    label: "Armaduria",
    color: "#3D3D3D",
    weightInside: 0.025,
    weightOutside: 0.02,
  },
  {
    id: "temple",
    label: "Templo",
    color: "#C6B06B",
    weightInside: 0.015,
    weightOutside: 0,
  },
  {
    id: "library",
    label: "Librería",
    color: "#4E6B8A",
    weightInside: 0.01,
    weightOutside: 0,
  },
  {
    id: "general",
    label: "Tienda general",
    color: "#D1A44B",
    weightInside: 0.02,
    weightOutside: 0.012,
  },
  {
    id: "transport",
    label: "Transporte",
    color: "#7F6A55",
    weightInside: 0.01,
    weightOutside: 0.01,
  },
  {
    id: "potions",
    label: "Pociones",
    color: "#6A8F7B",
    weightInside: 0.01,
    weightOutside: 0,
  },
  {
    id: "restaurant",
    label: "Restaurante",
    color: "#A5564C",
    weightInside: 0.015,
    weightOutside: 0,
  },
  {
    id: "hotel",
    label: "Hotel",
    color: "#8C7A6A",
    weightInside: 0.015,
    weightOutside: 0,
  },
];
const CATEGORY_BY_ID = new Map(
  SPECIAL_BUILDING_CATEGORIES.map((category) => [category.id, category])
);
const CATEGORY_ORDER = ["normal", ...SPECIAL_BUILDING_CATEGORIES.map((c) => c.id)];

function computeBounds(rings: Ring[], lines: LineString[], points: Point[]): MapBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  for (const line of lines) {
    for (const [x, y] of line) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

type MapView = {
  center: Point;
  scale: number;
};

function toSvgCoord(point: Point, view: MapView) {
  return {
    x: (point[0] - view.center[0]) * view.scale + VIEW_SIZE / 2,
    y: (view.center[1] - point[1]) * view.scale + VIEW_SIZE / 2,
  };
}

function toSvgPoints(ring: Ring, view: MapView): string {
  return ring
    .map((point) => {
      const { x, y } = toSvgCoord(point, view);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function toSvgLine(line: LineString, view: MapView): string {
  return line
    .map((point) => {
      const { x, y } = toSvgCoord(point, view);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function toSvgPath(lines: LineString[], view: MapView): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    const start = toSvgCoord(line[0], view);
    parts.push(`M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`);
    for (let i = 1; i < line.length; i += 1) {
      const { x, y } = toSvgCoord(line[i], view);
      parts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  return parts.join(" ");
}

function pointKey(point: Point): string {
  return `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
}

function segmentKey(a: Point, b: Point): string {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const wx = point[0] - a[0];
  const wy = point[1] - a[1];
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(wx, wy);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(point[0] - b[0], point[1] - b[1]);
  const t = c1 / c2;
  const projX = a[0] + t * vx;
  const projY = a[1] + t * vy;
  return Math.hypot(point[0] - projX, point[1] - projY);
}

function isPointInWater(point: Point, rings: Ring[]) {
  return rings.some((ring) => pointInPolygon(point, ring));
}

function distanceToRivers(point: Point, rivers: RiverSegment[]) {
  let minDistance = Infinity;
  let width = 0;
  for (const river of rivers) {
    const distance = pointToSegmentDistance(point, river.a, river.b);
    if (distance < minDistance) {
      minDistance = distance;
      width = river.width;
    }
  }
  return { minDistance, width };
}

function findShoreT(a: Point, b: Point, rivers: RiverSegment[]) {
  if (rivers.length === 0) return null;
  const start = distanceToRivers(a, rivers);
  const end = distanceToRivers(b, rivers);
  const f0 = start.minDistance - start.width / 2;
  const f1 = end.minDistance - end.width / 2;
  if (f0 >= 0 || f1 <= 0) {
    return null;
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    const midPoint: Point = [
      a[0] + (b[0] - a[0]) * mid,
      a[1] + (b[1] - a[1]) * mid,
    ];
    const midDist = distanceToRivers(midPoint, rivers);
    const fmid = midDist.minDistance - midDist.width / 2;
    if (fmid <= 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return hi;
}

function findRiverBoundaryT(
  a: Point,
  b: Point,
  river: RiverSegment
): number | null {
  const radius = river.width / 2;
  const d0 = pointToSegmentDistance(a, river.a, river.b) - radius;
  const d1 = pointToSegmentDistance(b, river.a, river.b) - radius;
  if (d0 === 0) return 0;
  if (d1 === 0) return 1;
  if (d0 * d1 > 0) return null;
  let lo = 0;
  let hi = 1;
  let fLo = d0;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    const midPoint: Point = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid];
    const fMid = pointToSegmentDistance(midPoint, river.a, river.b) - radius;
    if (fLo * fMid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

function clipSegmentToRivers(
  segment: Segment,
  riverSegments: RiverSegment[]
): Segment | null {
  const a = segment.a;
  const b = segment.b;
  const tValues = new Set<number>();
  tValues.add(0);
  tValues.add(1);

  for (const river of riverSegments) {
    const t = findRiverBoundaryT(a, b, river);
    if (t !== null) {
      tValues.add(t);
    }
  }

  const sorted = Array.from(tValues)
    .filter((value) => value >= 0 && value <= 1)
    .sort((x, y) => x - y);
  const toPoint = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  let best: { start: number; end: number; length: number } | null = null;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end - start < 1e-4) continue;
    const mid = (start + end) / 2;
    const midPoint = toPoint(mid);
    if (riverSegments.length > 0) {
      const { minDistance, width } = distanceToRivers(midPoint, riverSegments);
      if (minDistance <= width / 2) continue;
    }
    const length = end - start;
    if (!best || length > best.length) {
      best = { start, end, length };
    }
  }

  if (!best) {
    return null;
  }

  return { a: toPoint(best.start), b: toPoint(best.end) };
}

function buildWallSegmentsWithMap(rings: Ring[]): WallSegmentsBuild {
  const segments: WallSegment[] = [];
  const keyMap = new Map<string, string>();
  rings.forEach((ring, ringIndex) => {
    const count = ring.length;
    if (count < 2) return;
    for (let i = 0; i < count; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % count];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const key = segmentKey(a, b);
      if (keyMap.has(key)) continue;
      const id = `${ringIndex}-${i}`;
      keyMap.set(key, id);
      segments.push({
        id,
        key,
        line: [a, b],
        ringIndex,
        index: i,
      });
    }
  });
  return { segments, keyMap };
}

function pointInPolygon(point: Point, ring: Ring): boolean {
  if (ring.length < 3) return false;
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ringCentroid(ring: Ring): Point {
  let x = 0;
  let y = 0;
  for (const point of ring) {
    x += point[0];
    y += point[1];
  }
  const count = ring.length || 1;
  return [x / count, y / count];
}


function seededRandom(seed: number): number {
  const modulus = 233280;
  const value = (seed * 9301 + 49297) % modulus;
  return value / modulus;
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyShade(hex: string, multiplier: number) {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const nextR = clampByte(r * multiplier);
  const nextG = clampByte(g * multiplier);
  const nextB = clampByte(b * multiplier);
  return `#${nextR.toString(16).padStart(2, "0")}${nextG
    .toString(16)
    .padStart(2, "0")}${nextB.toString(16).padStart(2, "0")}`;
}

function getShadedBuildingColor(baseColor: string, seed: number) {
  const steps = VISUAL_CONFIG.buildings.shadeSteps;
  const roll = seededRandom(seed);
  const index = Math.min(steps.length - 1, Math.floor(roll * steps.length));
  return applyShade(baseColor, steps[index]);
}

function pickBuildingCategory(
  seed: number,
  insideWalls: boolean
): BuildingCategory | null {
  const roll = seededRandom(seed);
  let acc = 0;
  for (const category of SPECIAL_BUILDING_CATEGORIES) {
    acc += insideWalls ? category.weightInside : category.weightOutside;
    if (roll < acc) return category;
  }
  return null;
}

const hashKey = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getStorageKey = (dataUrl?: string) =>
  dataUrl ? `${STORAGE_KEY_PREFIX}${hashKey(dataUrl)}` : `${STORAGE_KEY_PREFIX}default`;

function readStoredState(storageKey: string): StoredState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredState(storageKey: string, state: StoredState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function writeStoredStatePartial(storageKey: string, partial: Partial<StoredState>) {
  const current = readStoredState(storageKey) ?? {};
  writeStoredState(storageKey, { ...current, ...partial });
}

function toStoredPoint(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTreeRadius(viewScale: number) {
  return Math.max(
    VISUAL_CONFIG.trees.radiusMin,
    VISUAL_CONFIG.trees.radiusScale * viewScale
  );
}

function getWallStrokeWidth(baseWallWidth: number, viewScale: number) {
  return Math.max(VISUAL_CONFIG.walls.strokeMin, baseWallWidth * viewScale);
}

function getTowerRadius(viewScale: number) {
  return Math.max(
    VISUAL_CONFIG.walls.towerRadiusMin,
    VISUAL_CONFIG.walls.towerRadiusScale * viewScale
  );
}

function clampCenter(center: Point, bounds: MapBounds, viewScale: number): Point {
  const halfWidth = VIEW_SIZE / (2 * viewScale);
  const halfHeight = VIEW_SIZE / (2 * viewScale);
  let minX = bounds.minX + halfWidth;
  let maxX = bounds.maxX - halfWidth;
  let minY = bounds.minY + halfHeight;
  let maxY = bounds.maxY - halfHeight;
  if (minX > maxX) {
    minX = bounds.maxX - halfWidth;
    maxX = bounds.minX + halfWidth;
  }
  if (minY > maxY) {
    minY = bounds.maxY - halfHeight;
    maxY = bounds.minY + halfHeight;
  }
  return [clamp(center[0], minX, maxX), clamp(center[1], minY, maxY)];
}

export default function BuildingsMap({
  dataUrl,
  events = [],
  isPlacementActive = false,
  onPlaceEvent,
  onLoadError,
  onLoadComplete,
  buildingLinks,
  buildingNames,
  activeLinkBuildingId = null,
  activeLinkOrganizationId = null,
  onAssignBuildingLink,
  onAssignOrganizationLink,
  onOpenBuilding,
  focusPosition,
  focusScale,
  focusBuildingIndex,
  focusBuildingIndices,
  highlightBuildingIndices,
  hiddenBuildingIndices,
  onHiddenBuildingsChange,
  focusRequestId = 0,
  showGrid = true,
}: BuildingsMapProps): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rings, setRings] = useState<Ring[]>([]);
  const [roads, setRoads] = useState<LineString[]>([]);
  const [walls, setWalls] = useState<WallRing[]>([]);
  const [waters, setWaters] = useState<Ring[]>([]);
  const [rivers, setRivers] = useState<RiverLine[]>([]);
  const [earth, setEarth] = useState<Ring | null>(null);
  const [trees, setTrees] = useState<Point[]>([]);
  const [hiddenBuildings, setHiddenBuildings] = useState<Set<number>>(
    () => new Set()
  );
  const [hiddenWalls, setHiddenWalls] = useState<Set<string>>(
    () => new Set()
  );
  const [gateCorners, setGateCorners] = useState<Set<string>>(
    () => new Set()
  );
  const [buildingOverrides, setBuildingOverrides] = useState<Map<number, string>>(
    () => new Map()
  );
  const [selectionPoints, setSelectionPoints] = useState<Point[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hoveredBuilding, setHoveredBuilding] = useState<number | null>(null);
  const [highlightCategoryId, setHighlightCategoryId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [viewCenter, setViewCenter] = useState<Point>([0, 0]);
  const [isPanning, setIsPanning] = useState(false);
  const storageKey = useMemo(() => getStorageKey(dataUrl), [dataUrl]);
  const treeFilterSuffix = useMemo(
    () => storageKey.replace(/[^a-zA-Z0-9_-]/g, "_"),
    [storageKey]
  );
  const selectionDragRef = useRef<{
    start: Point;
    origin: [Point, Point];
    didDrag: boolean;
    pointerId: number;
  } | null>(null);
  const mapDragRef = useRef<{
    startSvg: Point;
    startCenter: Point;
    didDrag: boolean;
    pointerId: number;
  } | null>(null);
  const suppressSelectionClickRef = useRef(false);
  const suppressPanClickRef = useRef(false);
  const suppressHiddenClickRef = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const pendingPanCenterRef = useRef<Point | null>(null);
  const viewPersistTimeoutRef = useRef<number | null>(null);
  const resetDefaultsRef = useRef<{
    hiddenWalls: Set<string>;
    gateCorners: Set<string>;
    hiddenBuildings: Set<number>;
    buildingOverrides: Map<number, string>;
    selectionPoints: Point[];
  } | null>(null);

  const toSvgPoint = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const svgPoint = point.matrixTransform(ctm.inverse());
    return [svgPoint.x, svgPoint.y];
  };

  const toMapPoint = (clientX: number, clientY: number, view: MapView): Point | null => {
    const mappedSvg = toSvgPoint(clientX, clientY);
    if (!mappedSvg) return null;
    const [svgX, svgY] = mappedSvg;
    const mapX = (svgX - VIEW_SIZE / 2) / view.scale + view.center[0];
    const mapY = view.center[1] - (svgY - VIEW_SIZE / 2) / view.scale;
    return [mapX, mapY];
  };

  const toMapPosition = (
    clientX: number,
    clientY: number,
    view: MapView
  ): { x: number; y: number } | null => {
    const mapped = toMapPoint(clientX, clientY, view);
    if (!mapped) return null;
    return { x: mapped[0], y: mapped[1] };
  };

  const flushPendingPanUpdate = () => {
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }
    if (pendingPanCenterRef.current) {
      const nextCenter = pendingPanCenterRef.current;
      pendingPanCenterRef.current = null;
      setViewCenter(nextCenter);
    }
  };

  useEffect(() => {
    let alive = true;
    setHasLoaded(false);

    async function loadBuildings() {
      if (!dataUrl) {
        throw new Error("No se definio el JSON del mapa.");
      }
      const data = await fetchJsonAsset<{
        features: Array<
          | BuildingsFeature
          | GeometryCollection
          | WaterFeature
          | PolygonFeature
          | MultiPointFeature
        >;
      }>(dataUrl);

      const earthLayer = data.features[1] as PolygonFeature;
      if (!earthLayer || earthLayer.type !== "Polygon") {
        throw new Error("features[1] is not a Polygon earth layer");
      }
      const extractedEarth = earthLayer.coordinates[0];

      const buildings = data.features[6] as BuildingsFeature;
      if (!buildings || buildings.type !== "MultiPolygon") {
        throw new Error("features[6] is not a MultiPolygon buildings layer");
      }

      const extractedBuildings = buildings.coordinates
        .map((polygon) => polygon[0])
        .filter(Boolean);

      const roadsLayer = data.features[2] as GeometryCollection;
      const extractedRoads = roadsLayer?.geometries
        ?.filter((geom) => geom.type === "LineString")
        .map((geom) => geom.coordinates) ?? [];

      const wallsLayer = data.features[3] as GeometryCollection;
      const extractedWalls = wallsLayer?.geometries
        ?.filter((geom) => geom.type === "Polygon")
        .map((geom) => ({
          ring: geom.coordinates[0],
          width:
            typeof geom.width === "number"
              ? geom.width
              : VISUAL_CONFIG.sourceDefaults.wallWidth,
        }))
        .filter((entry) => entry.ring) ?? [];

      const riversLayer = data.features[4] as GeometryCollection;
      const extractedRivers = riversLayer?.geometries
        ?.filter((geom) => geom.type === "LineString")
        .map((geom) => ({
          line: geom.coordinates,
          width:
            typeof geom.width === "number"
              ? geom.width
              : VISUAL_CONFIG.sourceDefaults.riverWidth,
        })) ?? [];

      const waterLayer = data.features[13] as WaterFeature;
      if (!waterLayer || waterLayer.type !== "MultiPolygon") {
        throw new Error("features[13] is not a MultiPolygon water layer");
      }
      const extractedWater = waterLayer.coordinates
        .map((polygon) => polygon[0])
        .filter(Boolean);

      const treesLayer = data.features.find(
        (feature): feature is MultiPointFeature =>
          feature.type === "MultiPoint" && feature.id === "trees"
      );
      const extractedTrees = treesLayer?.coordinates ?? [];
      const extractedWallRings = extractedWalls.map((wall) => wall.ring);
      const loadedBounds = computeBounds(
        [
          ...(extractedEarth ? [extractedEarth] : []),
          ...extractedBuildings,
          ...extractedWallRings,
          ...extractedWater,
        ],
        [...extractedRoads, ...extractedRivers.map((river) => river.line)],
        extractedTrees
      );
      const loadedWidth = Math.max(loadedBounds.maxX - loadedBounds.minX, 1);
      const loadedHeight = Math.max(loadedBounds.maxY - loadedBounds.minY, 1);
      const usable = VIEW_SIZE - PADDING * 2;
      const rawLoadedScale = Math.min(usable / loadedWidth, usable / loadedHeight);
      const loadedScale = Number.isFinite(rawLoadedScale) && rawLoadedScale > 0
        ? rawLoadedScale
        : 1;

      const wallBuild = buildWallSegmentsWithMap(extractedWallRings);
      const wallSegments = wallBuild.segments;
      const wallKeyMap = wallBuild.keyMap;
      const hiddenByWater = new Set<string>();
      const waterTouching = new Map<string, boolean>();
      for (const segment of wallSegments) {
        const [a, b] = segment.line;
        const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const inMid = isPointInWater(mid, extractedWater);
        const inA = isPointInWater(a, extractedWater);
        const inB = isPointInWater(b, extractedWater);
        const touching = inMid || (inA && inB);
        waterTouching.set(segment.id, touching);
      }

      for (const segment of wallSegments) {
        if (waterTouching.get(segment.id)) {
          hiddenByWater.add(segment.id);
        }
      }

      if (alive) {
        const stored = readStoredState(storageKey);
        const baseDefaults = {
          hiddenWalls: hiddenByWater,
          gateCorners: new Set<string>(),
          hiddenBuildings: new Set<number>(),
          buildingOverrides: new Map<number, string>(),
          selectionPoints: [] as Point[],
        };
        const initialHiddenWalls = stored?.hiddenWalls
          ? new Set<string>(stored.hiddenWalls)
          : hiddenByWater;
        const initialGateCorners = stored?.gateCorners
          ? new Set<string>(stored.gateCorners)
          : new Set<string>();
        const initialHiddenBuildings = hiddenBuildingIndices
          ? new Set<number>(hiddenBuildingIndices)
          : stored?.hiddenBuildings
            ? new Set<number>(stored.hiddenBuildings)
            : new Set<number>();
        const initialBuildingOverrides = new Map<number, string>();
        if (stored?.buildingOverrides) {
          Object.entries(stored.buildingOverrides).forEach(([key, value]) => {
            const index = Number(key);
            if (!Number.isNaN(index) && typeof value === "string") {
              initialBuildingOverrides.set(index, value);
            }
          });
        }
        const initialSelection =
          stored?.selection?.a && stored?.selection?.b
            ? [stored.selection.a, stored.selection.b]
            : [];
        const storedCenter = toStoredPoint(stored?.viewCenter);
        const storedZoom =
          typeof stored?.zoomScale === "number" && Number.isFinite(stored.zoomScale)
            ? clamp(stored.zoomScale, 1, MAX_ZOOM)
            : null;
        const requestedZoom =
          typeof focusScale === "number" && Number.isFinite(focusScale)
            ? clamp(focusScale, 1, MAX_ZOOM)
            : null;
        let initialCenter: Point = storedCenter ?? [
          (loadedBounds.minX + loadedBounds.maxX) / 2,
          (loadedBounds.minY + loadedBounds.maxY) / 2,
        ];
        if (typeof focusBuildingIndex === "number" && Number.isFinite(focusBuildingIndex)) {
          const focusedRing = extractedBuildings[focusBuildingIndex];
          if (focusedRing && focusedRing.length > 0) {
            initialCenter = ringCentroid(focusedRing);
          }
        } else if (
          focusPosition &&
          Number.isFinite(focusPosition.x) &&
          Number.isFinite(focusPosition.y)
        ) {
          initialCenter = [focusPosition.x, focusPosition.y];
        }
        const initialZoom = requestedZoom ?? storedZoom ?? 1;
        const initialViewScale = loadedScale * initialZoom;
        const clampedInitialCenter = clampCenter(initialCenter, loadedBounds, initialViewScale);
        resetDefaultsRef.current = baseDefaults;
        setEarth(extractedEarth);
        setRings(extractedBuildings);
        setRoads(extractedRoads);
        setWalls(extractedWalls);
        setRivers(extractedRivers);
        setWaters(extractedWater);
        setTrees(extractedTrees);
        setGateCorners(initialGateCorners);
        setHiddenWalls(initialHiddenWalls);
        setHiddenBuildings(initialHiddenBuildings);
        setBuildingOverrides(initialBuildingOverrides);
        setSelectionPoints(initialSelection);
        setViewCenter(clampedInitialCenter);
        setZoomScale(initialZoom);
        setHasLoaded(true);
        setLoadError(null);
        onLoadError?.(null);
        onLoadComplete?.();
      }
    }

    loadBuildings().catch((err) => {
      console.error(err);
      if (alive) {
        setEarth(null);
        setRings([]);
        setRoads([]);
        setWalls([]);
        setRivers([]);
        setWaters([]);
        setTrees([]);
        setHiddenWalls(new Set());
        setHiddenBuildings(new Set());
        setGateCorners(new Set());
        setBuildingOverrides(new Map());
        setSelectionPoints([]);
        setHasLoaded(false);
        const message = err instanceof Error ? err.message : "No se pudo cargar el JSON.";
        setLoadError(message);
        onLoadError?.(message);
      }
    });

    return () => {
      alive = false;
    };
  }, [dataUrl, onLoadComplete, onLoadError, storageKey]);

  const selectionBounds = useMemo<MapBounds | null>(() => {
    if (selectionPoints.length !== 2) return null;
    const [a, b] = selectionPoints;
    let minX = Math.min(a[0], b[0]);
    let maxX = Math.max(a[0], b[0]);
    let minY = Math.min(a[1], b[1]);
    let maxY = Math.max(a[1], b[1]);
    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    return { minX, maxX, minY, maxY };
  }, [selectionPoints]);

  const wallRings = useMemo(() => walls.map((wall) => wall.ring), [walls]);
  const wallWidths = useMemo(() => walls.map((wall) => wall.width), [walls]);
  const riverSegments = useMemo<RiverSegment[]>(() => {
    const segments: RiverSegment[] = [];
    for (const river of rivers) {
      for (let i = 1; i < river.line.length; i += 1) {
        segments.push({
          a: river.line[i - 1],
          b: river.line[i],
          width: river.width,
        });
      }
    }
    return segments;
  }, [rivers]);

  const { bounds, scale } = useMemo(() => {
    if (
      !earth &&
      rings.length === 0 &&
      roads.length === 0 &&
      wallRings.length === 0 &&
      rivers.length === 0 &&
      waters.length === 0
    ) {
      return {
        bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
        scale: 1,
      };
    }

    const mapBounds =
      selectionBounds ??
      computeBounds(
        [
          ...(earth ? [earth] : []),
          ...rings,
          ...wallRings,
          ...waters,
        ],
        [...roads, ...rivers.map((river) => river.line)],
        trees
      );
    const width = mapBounds.maxX - mapBounds.minX;
    const height = mapBounds.maxY - mapBounds.minY;
    const usable = VIEW_SIZE - PADDING * 2;
    const computedScale = Math.min(usable / width, usable / height);

    return { bounds: mapBounds, scale: computedScale };
  }, [earth, rings, roads, wallRings, rivers, waters, selectionBounds, trees]);

  useEffect(() => {
    const viewScale = scale * zoomScale;
    setViewCenter((current) => clampCenter(current, bounds, viewScale));
  }, [bounds, scale, zoomScale]);

  useEffect(() => {
    if (normalizedFocusBuildingIndices.length > 0) {
      const ring = rings[normalizedFocusBuildingIndices[0]];
      if (ring && ring.length > 0) {
        setViewCenter(ringCentroid(ring));
      }
      return;
    }
    if (typeof focusBuildingIndex === "number" && Number.isFinite(focusBuildingIndex)) {
      const ring = rings[focusBuildingIndex];
      if (ring && ring.length > 0) {
        setViewCenter(ringCentroid(ring));
      }
      return;
    }
    if (!focusPosition) {
      return;
    }
    setViewCenter([focusPosition.x, focusPosition.y]);
  }, [focusBuildingIndex, focusPosition, rings, focusRequestId]);

  useEffect(() => {
    if (typeof focusScale !== "number" || !Number.isFinite(focusScale)) {
      return;
    }
    setZoomScale(clamp(focusScale, 1, MAX_ZOOM));
  }, [focusScale]);

  const view = useMemo<MapView>(() => {
    const viewScale = scale * zoomScale;
    return {
      center: clampCenter(viewCenter, bounds, viewScale),
      scale: viewScale,
    };
  }, [bounds, scale, viewCenter, zoomScale]);
  const normalizedFocusBuildingIndices = useMemo(() => {
    if (!focusBuildingIndices || focusBuildingIndices.length === 0) return [];
    return focusBuildingIndices.filter(
      (index) =>
        typeof index === "number" &&
        Number.isFinite(index) &&
        index >= 0 &&
        index < rings.length
    );
  }, [focusBuildingIndices, rings.length]);
  const normalizedHighlightBuildingIndices = useMemo(() => {
    if (!highlightBuildingIndices || highlightBuildingIndices.length === 0) return [];
    return highlightBuildingIndices.filter(
      (index) =>
        typeof index === "number" &&
        Number.isFinite(index) &&
        index >= 0 &&
        index < rings.length
    );
  }, [highlightBuildingIndices, rings.length]);
  const focusedBuildingSet = useMemo(
    () => new Set(normalizedFocusBuildingIndices),
    [normalizedFocusBuildingIndices]
  );
  const highlightBuildingSet = useMemo(
    () => new Set(normalizedHighlightBuildingIndices),
    [normalizedHighlightBuildingIndices]
  );
  const hasFocusedBuildingGroup = normalizedFocusBuildingIndices.length > 0;
  const hasFocusedBuilding =
    typeof focusBuildingIndex === "number" &&
    Number.isFinite(focusBuildingIndex) &&
    focusBuildingIndex >= 0 &&
    focusBuildingIndex < rings.length;
  const hasActiveCategoryHighlight = highlightCategoryId !== null;
  const shouldDimForFocus = activeLinkOrganizationId === null && activeLinkBuildingId === null;
  const hasEffectiveFocusedBuilding =
    shouldDimForFocus && (hasFocusedBuilding || hasFocusedBuildingGroup) && !hasActiveCategoryHighlight;
  const focusViewportToRings = (targetRings: Ring[]) => {
    if (targetRings.length === 0) return;

    const targetBounds = computeBounds(targetRings, [], []);
    const width = Math.max(targetBounds.maxX - targetBounds.minX, 1);
    const height = Math.max(targetBounds.maxY - targetBounds.minY, 1);
    const usable = VIEW_SIZE - PADDING * 2;
    const targetScale = Math.min(usable / width, usable / height);

    setViewCenter([
      (targetBounds.minX + targetBounds.maxX) / 2,
      (targetBounds.minY + targetBounds.maxY) / 2,
    ]);
    setZoomScale(clamp(targetScale / scale, 1, MAX_ZOOM));
  };
  const isBuildingVisible = (buildingIndex: number, categoryId: string) => {
    const matchesCategory =
      highlightCategoryId === null || highlightCategoryId === categoryId;
    const matchesFocus =
      !hasEffectiveFocusedBuilding ||
      focusBuildingIndex === buildingIndex ||
      focusedBuildingSet.has(buildingIndex);
    return matchesCategory && matchesFocus;
  };
  const handleToggleCategoryHighlight = (categoryId: string) => {
    if (highlightCategoryId === categoryId) {
      setHighlightCategoryId(null);
      return;
    }

    setHighlightCategoryId(categoryId);
    focusViewportToRings(
      rings.filter((ring, index) => {
        const derived = buildingCategories[index]?.id ?? "normal";
        const override = buildingOverrides.get(index);
        return (override ?? derived) === categoryId;
      })
    );
  };
  const treeMapRadius = getTreeRadius(view.scale) / view.scale;
  const treesTransform = `translate(${VIEW_SIZE / 2} ${VIEW_SIZE / 2}) scale(${view.scale} ${-view.scale}) translate(${-view.center[0]} ${-view.center[1]})`;
  const dimStyle =
    hasActiveCategoryHighlight || hasEffectiveFocusedBuilding
      ? { filter: "grayscale(1)", opacity: VISUAL_CONFIG.buildings.dimOpacity }
      : undefined;

  const buildingCategories = useMemo(
    () =>
      rings.map((ring, index) => {
        const centroid = ringCentroid(ring);
        const insideWalls = wallRings.some((wall) => pointInPolygon(centroid, wall));
        return pickBuildingCategory(index, insideWalls);
      }),
    [rings, wallRings]
  );

  const hoveredInfo = useMemo(() => {
    if (hoveredBuilding === null) return null;
    const ring = rings[hoveredBuilding];
    if (!ring) return null;
    if (hiddenBuildings.has(hoveredBuilding)) return null;
    const derived = buildingCategories[hoveredBuilding]?.id ?? "normal";
    const override = buildingOverrides.get(hoveredBuilding);
    const categoryId = override ?? derived;
    if (!isBuildingVisible(hoveredBuilding, categoryId)) return null;
    const linkedBuildingId = buildingLinks?.[hoveredBuilding];
    if (linkedBuildingId !== undefined) {
      const label =
        (buildingNames && buildingNames[linkedBuildingId]) ||
        `Edificio ${linkedBuildingId}`;
      const centroid = ringCentroid(ring);
      const { x, y } = toSvgCoord(centroid, view);
      return { x, y, label };
    }
    if (categoryId === "normal") return null;
    const category = CATEGORY_BY_ID.get(categoryId);
    if (!category) return null;
    const centroid = ringCentroid(ring);
    const { x, y } = toSvgCoord(centroid, view);
    return { x, y, label: category.label };
  }, [
    hoveredBuilding,
    rings,
    hiddenBuildings,
    buildingCategories,
    buildingOverrides,
    buildingLinks,
    buildingNames,
    focusBuildingIndex,
    hasEffectiveFocusedBuilding,
    highlightCategoryId,
    view,
  ]);

  useEffect(() => {
    if (!hasLoaded) return;
    const payload: StoredState = {
      hiddenWalls: Array.from(hiddenWalls),
      gateCorners: Array.from(gateCorners),
      buildingOverrides: Object.fromEntries(
        Array.from(buildingOverrides.entries()).map(([key, value]) => [
          String(key),
          value,
        ])
      ),
      selection:
        selectionPoints.length === 2
          ? { a: selectionPoints[0], b: selectionPoints[1] }
          : undefined,
    };
    if (!hiddenBuildingIndices) {
      payload.hiddenBuildings = Array.from(hiddenBuildings);
    }
    writeStoredStatePartial(storageKey, payload);
  }, [
    hasLoaded,
    hiddenWalls,
    gateCorners,
    hiddenBuildings,
    buildingOverrides,
    selectionPoints,
    storageKey,
    hiddenBuildingIndices,
  ]);

  useEffect(() => {
    if (!hasLoaded) return;
    if (viewPersistTimeoutRef.current !== null) {
      window.clearTimeout(viewPersistTimeoutRef.current);
    }
    viewPersistTimeoutRef.current = window.setTimeout(() => {
      writeStoredStatePartial(storageKey, {
        viewCenter,
        zoomScale,
      });
      viewPersistTimeoutRef.current = null;
    }, 180);

    return () => {
      if (viewPersistTimeoutRef.current !== null) {
        window.clearTimeout(viewPersistTimeoutRef.current);
      }
    };
  }, [hasLoaded, storageKey, viewCenter, zoomScale]);

  useEffect(() => {
    if (!hiddenBuildingIndices) return;
    setHiddenBuildings(new Set(hiddenBuildingIndices));
  }, [hiddenBuildingIndices]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.shiftKey && key === "r") {
        event.preventDefault();
        const defaults = resetDefaultsRef.current;
        if (!defaults) return;
        setHiddenWalls(new Set(defaults.hiddenWalls));
        setGateCorners(new Set(defaults.gateCorners));
        setHiddenBuildings(new Set(defaults.hiddenBuildings));
        setBuildingOverrides(new Map(defaults.buildingOverrides));
        setSelectionPoints([...defaults.selectionPoints]);
        if (onHiddenBuildingsChange) {
          onHiddenBuildingsChange(Array.from(defaults.hiddenBuildings));
        }
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // ignore storage errors
        }
        return;
      }

      if (event.ctrlKey && key === "r") {
        event.preventDefault();
        setSelectionPoints([]);
        return;
      }

      if (key === "escape") {
        setHighlightCategoryId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [storageKey]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const zoomFactor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);

      setZoomScale((currentZoom) => {
        const nextZoom = clamp(currentZoom * zoomFactor, 1, MAX_ZOOM);
        if (nextZoom === currentZoom) {
          return currentZoom;
        }

        const currentViewScale = scale * currentZoom;
        const nextViewScale = scale * nextZoom;
        setViewCenter((currentCenter) => {
          const mapX = (pointerX - VIEW_SIZE / 2) / currentViewScale + currentCenter[0];
          const mapY = currentCenter[1] - (pointerY - VIEW_SIZE / 2) / currentViewScale;
          const nextCenterX = mapX - (pointerX - VIEW_SIZE / 2) / nextViewScale;
          const nextCenterY = mapY + (pointerY - VIEW_SIZE / 2) / nextViewScale;
          return clampCenter([nextCenterX, nextCenterY], bounds, nextViewScale);
        });

        return nextZoom;
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", onWheel);
    };
  }, [bounds, scale]);

  useEffect(() => {
    const stopPointerDrag = () => {
      selectionDragRef.current = null;
      if (!mapDragRef.current) return;
      flushPendingPanUpdate();
      mapDragRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("pointerup", stopPointerDrag);
    window.addEventListener("pointercancel", stopPointerDrag);
    window.addEventListener("blur", stopPointerDrag);
    return () => {
      window.removeEventListener("pointerup", stopPointerDrag);
      window.removeEventListener("pointercancel", stopPointerDrag);
      window.removeEventListener("blur", stopPointerDrag);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current);
        panFrameRef.current = null;
      }
      pendingPanCenterRef.current = null;
      if (viewPersistTimeoutRef.current !== null) {
        window.clearTimeout(viewPersistTimeoutRef.current);
        viewPersistTimeoutRef.current = null;
      }
    };
  }, []);

  const { wallSegments, wallSegmentKeyMap } = useMemo(() => {
    const build = buildWallSegmentsWithMap(wallRings);
    return { wallSegments: build.segments, wallSegmentKeyMap: build.keyMap };
  }, [wallRings]);

  const clippedWallSegments = useMemo(() => {
    return wallSegments
      .map((segment) => {
        const clipped = clipSegmentToRivers(
          { a: segment.line[0], b: segment.line[1] },
          riverSegments
        );
        if (!clipped) {
          return segment;
        }
        return {
          ...segment,
          line: [clipped.a, clipped.b] as LineString,
        };
      })
  }, [wallSegments, riverSegments]);

  const wallSegmentMap = useMemo(() => {
    const map = new Map<string, WallSegment>();
    wallSegments.forEach((segment) => map.set(segment.id, segment));
    return map;
  }, [wallSegments]);

  const wallCorners = useMemo<WallCorner[]>(() => {
    const corners = new Map<string, WallCorner>();
    wallRings.forEach((ring, ringIndex) => {
      const count = ring.length;
      if (count < 2) return;
      for (let i = 0; i < count; i += 1) {
        const point = ring[i];
        const key = pointKey(point);
        const prevKey = segmentKey(
          ring[(i - 1 + count) % count],
          ring[i]
        );
        const nextKey = segmentKey(
          ring[i],
          ring[(i + 1) % count]
        );
        const prevId = wallSegmentKeyMap.get(prevKey);
        const nextId = wallSegmentKeyMap.get(nextKey);
        const existing = corners.get(key);
        if (existing) {
          if (prevId) existing.segmentIds.add(prevId);
          if (nextId) existing.segmentIds.add(nextId);
        } else {
          const segmentIds = new Set<string>();
          if (prevId) segmentIds.add(prevId);
          if (nextId) segmentIds.add(nextId);
          if (segmentIds.size === 0) continue;
          corners.set(key, {
            id: key,
            point,
            segmentIds,
          });
        }
      }
    });
    return Array.from(corners.values());
  }, [wallRings, wallSegmentKeyMap]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "radial-gradient(circle at top, #f5f1e8 0%, #e4dac7 60%, #d2c2a5 100%)",
        color: "#2a2218",
        fontFamily: "'IBM Plex Serif', 'Georgia', serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.65), rgba(255,255,255,0.3))",
            boxShadow: "0 18px 45px rgba(42, 34, 24, 0.22)",
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            position: "relative",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              maxWidth: "min(260px, calc(100% - 48px))",
              maxHeight: "calc(100% - 48px)",
              overflowY: "auto",
              background: "rgba(255, 255, 255, 0.9)",
              border: "1px solid rgba(42, 34, 24, 0.2)",
              borderRadius: "12px",
              padding: "12px 14px",
              boxShadow: "0 10px 25px rgba(42, 34, 24, 0.15)",
              fontSize: "14px",
              lineHeight: 1.3,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "8px" }}>
              Construcciones
            </div>
            <button
              type="button"
              onClick={() => handleToggleCategoryHighlight("normal")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                font: "inherit",
                color: highlightCategoryId && highlightCategoryId !== "normal" ? "#6d5b3f" : "inherit",
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: NORMAL_BUILDING_COLOR,
                  border: "1px solid rgba(42, 34, 24, 0.35)",
                  display: "inline-block",
                }}
              />
              <span>Normal</span>
            </button>
            {SPECIAL_BUILDING_CATEGORIES.map((category) => (
              <button
                type="button"
                key={`legend-${category.id}`}
                onClick={() => handleToggleCategoryHighlight(category.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  font: "inherit",
                  color:
                    highlightCategoryId &&
                    highlightCategoryId !== category.id
                      ? "#6d5b3f"
                      : "inherit",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    background: category.color,
                    border: "1px solid rgba(42, 34, 24, 0.35)",
                    display: "inline-block",
                  }}
                />
                <span>{category.label}</span>
              </button>
            ))}
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{
              display: "block",
              borderRadius: "12px",
              background: "#f7f3eb",
              cursor:
                activeLinkBuildingId !== null
                  ? "crosshair"
                  : isPanning
                  ? "grabbing"
                  : "grab",
              userSelect: "none",
            }}
            onPointerDown={(event) => {
              if (event.ctrlKey) {
                if (selectionPoints.length !== 2) return;
                event.preventDefault();
                const start = toMapPoint(event.clientX, event.clientY, view);
                if (!start) return;
                selectionDragRef.current = {
                  start,
                  origin: [selectionPoints[0], selectionPoints[1]],
                  didDrag: false,
                  pointerId: event.pointerId,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
                return;
              }
              if (event.button !== 0) return;
              if (activeLinkBuildingId !== null) return;
              event.preventDefault();
              const startSvg = toSvgPoint(event.clientX, event.clientY);
              if (!startSvg) return;
              mapDragRef.current = {
                startSvg,
                startCenter: view.center,
                didDrag: false,
                pointerId: event.pointerId,
              };
              setIsPanning(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = selectionDragRef.current;
              if (drag && drag.pointerId === event.pointerId) {
                const current = toMapPoint(event.clientX, event.clientY, view);
                if (!current) return;
                const dx = current[0] - drag.start[0];
                const dy = current[1] - drag.start[1];
                if (Math.abs(dx) + Math.abs(dy) > 0.001) {
                  drag.didDrag = true;
                }
                setSelectionPoints([
                  [drag.origin[0][0] + dx, drag.origin[0][1] + dy],
                  [drag.origin[1][0] + dx, drag.origin[1][1] + dy],
                ]);
                return;
              }
              const mapDrag = mapDragRef.current;
              if (!mapDrag || mapDrag.pointerId !== event.pointerId) return;
              const currentSvg = toSvgPoint(event.clientX, event.clientY);
              if (!currentSvg) return;
              const dx = currentSvg[0] - mapDrag.startSvg[0];
              const dy = currentSvg[1] - mapDrag.startSvg[1];
              if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) {
                mapDrag.didDrag = true;
              }
              pendingPanCenterRef.current = clampCenter(
                [
                  mapDrag.startCenter[0] - dx / view.scale,
                  mapDrag.startCenter[1] + dy / view.scale,
                ],
                bounds,
                view.scale
              );
              if (panFrameRef.current === null) {
                panFrameRef.current = window.requestAnimationFrame(() => {
                  panFrameRef.current = null;
                  if (!pendingPanCenterRef.current) return;
                  const nextCenter = pendingPanCenterRef.current;
                  pendingPanCenterRef.current = null;
                  setViewCenter(nextCenter);
                });
              }
            }}
            onPointerUp={(event) => {
              const drag = selectionDragRef.current;
              if (drag && drag.pointerId === event.pointerId) {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                if (drag.didDrag) {
                  suppressSelectionClickRef.current = true;
                }
                selectionDragRef.current = null;
                return;
              }
              const mapDrag = mapDragRef.current;
              if (!mapDrag || mapDrag.pointerId !== event.pointerId) return;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              if (mapDrag.didDrag) {
                suppressPanClickRef.current = true;
              }
              flushPendingPanUpdate();
              mapDragRef.current = null;
              setIsPanning(false);
            }}
            onPointerCancel={(event) => {
              const drag = selectionDragRef.current;
              if (drag && drag.pointerId === event.pointerId) {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                selectionDragRef.current = null;
              }
              const mapDrag = mapDragRef.current;
              if (mapDrag && mapDrag.pointerId === event.pointerId) {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                flushPendingPanUpdate();
                mapDragRef.current = null;
                setIsPanning(false);
              }
            }}
            onDragStart={(event) => event.preventDefault()}
            onContextMenu={(event) => {
              if (!isPlacementActive || !onPlaceEvent) return;
              event.preventDefault();
              const position = toMapPosition(event.clientX, event.clientY, view);
              if (!position) return;
              onPlaceEvent(position);
            }}
            onClick={(event) => {
              if (!event.ctrlKey) return;
              if (suppressSelectionClickRef.current) {
                suppressSelectionClickRef.current = false;
                return;
              }
              const mapped = toMapPoint(event.clientX, event.clientY, view);
              if (!mapped) return;
              const [mapX, mapY] = mapped;
              setSelectionPoints((prev) => {
                if (prev.length !== 1) {
                  return [[mapX, mapY]];
                }
                const next = [prev[0], [mapX, mapY]] as Point[];
                return next;
              });
            }}
            onClickCapture={(event) => {
              if (!suppressPanClickRef.current) return;
              suppressPanClickRef.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {loadError && (
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                fill="#6a5334"
                fontSize="16"
              >
                {loadError}
              </text>
            )}
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(42, 34, 24, 0.08)"
                  strokeWidth="1"
                />
              </pattern>
              <filter
                id={`trees-fill-${treeFilterSuffix}`}
                filterUnits="objectBoundingBox"
                x="-25%"
                y="-25%"
                width="150%"
                height="150%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur
                  in="SourceAlpha"
                  stdDeviation={VISUAL_CONFIG.trees.filterBlur}
                  result="tree-blur"
                />
                <feColorMatrix
                  in="tree-blur"
                  type="matrix"
                  values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${VISUAL_CONFIG.trees.filterAlphaMultiplier} ${VISUAL_CONFIG.trees.filterAlphaOffset}`}
                  result="tree-solid"
                />
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency={VISUAL_CONFIG.trees.noiseBaseFrequency}
                  numOctaves={VISUAL_CONFIG.trees.noiseOctaves}
                  seed={VISUAL_CONFIG.trees.noiseSeed}
                  result="tree-noise"
                />
                <feDisplacementMap
                  in="tree-solid"
                  in2="tree-noise"
                  scale={VISUAL_CONFIG.trees.noiseDisplacement}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="tree-distorted"
                />
                <feFlood floodColor={VISUAL_CONFIG.trees.color} result="tree-fill-color" />
                <feComposite in="tree-fill-color" in2="tree-distorted" operator="in" />
              </filter>
            </defs>
            {showGrid ? <rect width="100%" height="100%" fill="url(#grid)" /> : null}

            <g style={dimStyle}>
              {earth && (
                <polygon
                  points={toSvgPoints(earth, view)}
                  fill="#FFF2C8"
                  stroke="#FFF2C8"
                  strokeWidth="1"
                />
              )}
            </g>

            <g style={dimStyle}>
              {waters.map((ring, index) => (
                <polygon
                  key={`water-${index}`}
                  points={toSvgPoints(ring, view)}
                  fill="#779988"
                  stroke="#779988"
                  strokeWidth="1.5"
                />
              ))}
            </g>

            <g style={dimStyle}>
              {rivers.map((river, index) => (
                <polyline
                  key={`river-${index}`}
                  points={toSvgLine(river.line, view)}
                  fill="none"
                  stroke="#779988"
                  strokeWidth={Math.max(
                    VISUAL_CONFIG.walls.riverStrokeMin,
                    river.width * view.scale
                  )}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </g>

            <g style={dimStyle}>
              <path
                d={toSvgPath(roads, view)}
                fill="none"
                stroke="#8A8F8B"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={toSvgPath(roads, view)}
                fill="none"
                stroke="#FFF2C8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            <g style={dimStyle}>
              {clippedWallSegments.map((segment) => (
                <polyline
                  key={`wall-${segment.id}`}
                  points={toSvgLine(segment.line, view)}
                  fill="none"
                  stroke={hiddenWalls.has(segment.id) ? "transparent" : "#606661"}
                  strokeWidth={getWallStrokeWidth(
                    wallWidths[segment.ringIndex] ?? VISUAL_CONFIG.sourceDefaults.wallWidth,
                    view.scale
                  )}
                  pointerEvents="all"
                  style={{ cursor: "pointer" }}
                  onClick={(event) => {
                    if (event.ctrlKey) return;
                    setHiddenWalls((prev) => {
                      const next = new Set(prev);
                      if (next.has(segment.id)) {
                        next.delete(segment.id);
                      } else {
                        next.add(segment.id);
                      }
                      return next;
                    });
                  }}
                  onContextMenu={(event) => {
                    if (isPlacementActive) return;
                    event.preventDefault();
                    setHiddenWalls((prev) => {
                      const next = new Set(prev);
                      if (next.has(segment.id)) {
                        next.delete(segment.id);
                      } else {
                        next.add(segment.id);
                      }
                      return next;
                    });
                  }}
                />
              ))}
            </g>

            <g style={dimStyle}>
              {wallCorners.map((corner, index) => {
                const { x, y } = toSvgCoord(corner.point, view);
                const allHidden = Array.from(corner.segmentIds).every((id) =>
                  hiddenWalls.has(id)
                );
                if (allHidden) return null;
                let isRiverGate = false;
                if (riverSegments.length > 0) {
                  const { minDistance, width } = distanceToRivers(corner.point, riverSegments);
                  isRiverGate = minDistance <= width / 2;
                }

                const isGate = gateCorners.has(corner.id) || isRiverGate;
                const firstSegmentId = corner.segmentIds.values().next().value as
                  | string
                  | undefined;
                const segmentForWidth = firstSegmentId
                  ? wallSegmentMap.get(firstSegmentId)
                  : undefined;
                const baseWallWidth =
                  segmentForWidth && wallWidths[segmentForWidth.ringIndex] !== undefined
                    ? wallWidths[segmentForWidth.ringIndex]
                    : VISUAL_CONFIG.sourceDefaults.wallWidth;
                const wallWidth = getWallStrokeWidth(baseWallWidth, view.scale);
                const small = Math.max(VISUAL_CONFIG.gates.smallMin, wallWidth);
                const large = Math.max(
                  VISUAL_CONFIG.gates.largeMin,
                  wallWidth * VISUAL_CONFIG.gates.largeWidthMultiplier
                );
                const offset = (small + large) / 2;
                const gateSides: Array<{ angle: number; x: number; y: number }> = [];
                if (isGate) {
                  corner.segmentIds.forEach((id) => {
                    if (hiddenWalls.has(id)) return;
                    const segment = wallSegmentMap.get(id);
                    if (!segment) return;
                    const [a, b] = segment.line;
                    const isA =
                      a[0] === corner.point[0] && a[1] === corner.point[1];
                    const other = isA ? b : a;
                    const vx = other[0] - corner.point[0];
                    const vy = other[1] - corner.point[1];
                    const len = Math.hypot(vx, vy);
                    if (len === 0) return;
                    const angle =
                      (Math.atan2(-vy, vx) * 180) / Math.PI;
                    const shoreT = isRiverGate ? findShoreT(corner.point, other, riverSegments) : null;
                    const offsetMap = offset / view.scale;
                    const distanceMap =
                      shoreT !== null ? shoreT * len : offsetMap;
                    const dirX = vx / len;
                    const dirY = vy / len;
                    const sidePoint: Point = [
                      corner.point[0] + dirX * distanceMap,
                      corner.point[1] + dirY * distanceMap,
                    ];
                    const sideSvg = toSvgCoord(sidePoint, view);
                    gateSides.push({ angle, x: sideSvg.x - x, y: sideSvg.y - y });
                  });
                }
                return (
                  <g
                    key={`wall-corner-${index}`}
                    onClick={(event) => {
                      if (event.ctrlKey) return;
                      setGateCorners((prev) => {
                        const next = new Set(prev);
                        if (next.has(corner.id)) {
                          next.delete(corner.id);
                        } else {
                          next.add(corner.id);
                        }
                        return next;
                      });
                    }}
                    onContextMenu={(event) => {
                      if (isPlacementActive) return;
                      event.preventDefault();
                      setGateCorners((prev) => {
                        const next = new Set(prev);
                        if (next.has(corner.id)) {
                          next.delete(corner.id);
                        } else {
                          next.add(corner.id);
                        }
                        return next;
                      });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {isGate ? (
                      <g transform={`translate(${x} ${y})`}>
                        {!isRiverGate && (
                          <rect
                            x={-small / 2}
                            y={-small / 2}
                            width={small}
                            height={small}
                            fill="#FFF2C8"
                          />
                        )}
                        {gateSides.map((side, sideIndex) => (
                          <g
                            key={`gate-side-${index}-${sideIndex}`}
                            transform={`translate(${side.x} ${side.y}) rotate(${side.angle})`}
                          >
                            <rect
                              x={-large / 2}
                              y={-large / 2}
                              width={large}
                              height={large}
                              fill="#606661"
                            />
                          </g>
                        ))}
                      </g>
                    ) : (
                      <circle cx={x} cy={y} r={getTowerRadius(view.scale)} fill="#606661" />
                    )}
                  </g>
                );
              })}
            </g>

            <g>
              {rings.map((ring, index) => {
                const isHidden = hiddenBuildings.has(index);
                const override = buildingOverrides.get(index);
                const derived = buildingCategories[index]?.id ?? "normal";
                const categoryId = override ?? derived;
                const isFocusedBuilding =
                  hasEffectiveFocusedBuilding &&
                  (focusBuildingIndex === index || focusedBuildingSet.has(index));
                const isHighlightedBuilding = highlightBuildingSet.has(index);
                const isVisible = !isHidden && isBuildingVisible(index, categoryId);
                const baseColor =
                  categoryId === "normal"
                    ? NORMAL_BUILDING_COLOR
                    : CATEGORY_BY_ID.get(categoryId)?.color ??
                      NORMAL_BUILDING_COLOR;
                const fillColor = isVisible
                  ? getShadedBuildingColor(baseColor, index + 1)
                  : "transparent";
                const isSpecial = categoryId !== "normal";
                const linkedBuildingId = buildingLinks?.[index];
                return (
                  <polygon
                    key={`building-${index}`}
                    points={toSvgPoints(ring, view)}
                    fill={fillColor}
                    opacity={isVisible ? 1 : isHidden ? 0.15 : 0}
                    stroke={
                      isVisible
                        ? isFocusedBuilding
                          ? "#2f2517"
                          : isHighlightedBuilding
                            ? "#3f2a18"
                            : "#606661"
                        : isHidden
                          ? "#9c8b77"
                          : "transparent"
                    }
                    strokeWidth={
                      isFocusedBuilding
                        ? "1.8"
                        : isHighlightedBuilding
                          ? "1.5"
                          : "0.75"
                    }
                    style={{ cursor: "pointer" }}
                    pointerEvents={isHidden || isVisible ? "all" : "none"}
                    onPointerDown={(event) => {
                      if (event.altKey || event.shiftKey) {
                        event.preventDefault();
                        event.stopPropagation();
                        suppressHiddenClickRef.current = true;
                        setHiddenBuildings((prev) => {
                          const next = new Set(prev);
                          if (next.has(index)) {
                            next.delete(index);
                          } else {
                            next.add(index);
                          }
                          if (onHiddenBuildingsChange) {
                            onHiddenBuildingsChange(Array.from(next));
                          }
                          return next;
                        });
                        return;
                      }
                      if (activeLinkBuildingId !== null || activeLinkOrganizationId !== null) {
                        event.stopPropagation();
                      }
                    }}
                    onClick={(event) => {
                      if (suppressHiddenClickRef.current) {
                        suppressHiddenClickRef.current = false;
                        return;
                      }
                      if (event.ctrlKey) return;
                      if (event.altKey || event.shiftKey) return;

                      if (activeLinkBuildingId !== null && onAssignBuildingLink) {
                        onAssignBuildingLink(index);
                        return;
                      }
                      if (activeLinkOrganizationId !== null && onAssignOrganizationLink) {
                        onAssignOrganizationLink(index);
                        return;
                      }
                      if (linkedBuildingId !== undefined && onOpenBuilding) {
                        onOpenBuilding(linkedBuildingId);
                        return;
                      }
                      setHiddenBuildings((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) {
                          next.delete(index);
                        } else {
                          next.add(index);
                        }
                        return next;
                      });
                    }}
                    onMouseEnter={() => {
                      if (isHidden) return;
                      if (!isSpecial && linkedBuildingId === undefined) return;
                      if (hoverTimeoutRef.current !== null) {
                        window.clearTimeout(hoverTimeoutRef.current);
                      }
                      hoverTimeoutRef.current = window.setTimeout(() => {
                        setHoveredBuilding(index);
                      }, 350);
                    }}
                    onMouseLeave={() => {
                      if (hoverTimeoutRef.current !== null) {
                        window.clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      setHoveredBuilding((current) =>
                        current === index ? null : current
                      );
                    }}
                    onContextMenu={(event) => {
                      if (isPlacementActive) return;
                      event.preventDefault();
                      setBuildingOverrides((prev) => {
                        const next = new Map(prev);
                        const current = next.get(index) ?? derived;
                        const currentIndex = CATEGORY_ORDER.indexOf(current);
                        const nextIndex =
                          currentIndex === -1
                            ? 0
                            : (currentIndex + 1) % CATEGORY_ORDER.length;
                        const nextId = CATEGORY_ORDER[nextIndex];
                        if (nextId === derived) {
                          next.delete(index);
                        } else {
                          next.set(index, nextId);
                        }
                        return next;
                      });
                    }}
                  />
                );
              })}
            </g>

            <g pointerEvents="none" style={dimStyle}>
              <g filter={`url(#trees-fill-${treeFilterSuffix})`} transform={treesTransform}>
                {trees.map((tree, index) => {
                  return (
                    <circle
                      key={`tree-fill-source-${index}`}
                      cx={tree[0]}
                      cy={tree[1]}
                      r={treeMapRadius}
                      fill="#000"
                    />
                  );
                })}
              </g>
            </g>

            {events
              .filter((evento) => evento.posicion)
              .map((evento, index) => {
                const position = evento.posicion!;
                const { x, y } = toSvgCoord([position[0], position[1]], view);
                return (
                  <g key={`event-${index}`} pointerEvents="none">
                    <circle cx={x} cy={y} r="5" fill="#b22c22" stroke="#fff4de" strokeWidth="2" />
                    <text
                      x={x}
                      y={y + 16}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#2b200f"
                      style={{
                        paintOrder: "stroke",
                        stroke: "#fff4de",
                        strokeWidth: 3,
                      }}
                    >
                      {evento.nombre}
                    </text>
                  </g>
                );
              })}

            {hoveredInfo && (() => {
              const padding = 6;
              const charWidth = 6;
              const height = 20;
              const width = hoveredInfo.label.length * charWidth + padding * 2;
              const offsetX = 10;
              const offsetY = 12;
              const baseX = hoveredInfo.x + offsetX;
              const baseY = hoveredInfo.y + offsetY;
              const clampedX = Math.min(
                Math.max(8, baseX),
                VIEW_SIZE - width - 8
              );
              const clampedY = Math.min(
                Math.max(8, baseY),
                VIEW_SIZE - height - 8
              );
              return (
                <g pointerEvents="none">
                  <rect
                    x={clampedX}
                    y={clampedY}
                    width={width}
                    height={height}
                    rx="6"
                    ry="6"
                    fill="rgba(255, 255, 255, 0.92)"
                    stroke="rgba(42, 34, 24, 0.4)"
                    strokeWidth="1"
                  />
                  <text
                    x={clampedX + padding}
                    y={clampedY + height / 2 + 4}
                    fill="#2a2218"
                    fontSize="13"
                    fontFamily="'IBM Plex Serif', 'Georgia', serif"
                  >
                    {hoveredInfo.label}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
}
