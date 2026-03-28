import { v4 as uuid } from "uuid";

import { getAbsoluteHoleVertices, getAbsoluteVertices, getBoundingBox } from "@/lib/geometry/polygon";
import { SURFACE_COLORS, createRectangleVertices, dimensionsFromVertices } from "@/lib/geometry/surface";
import type { PlannerSnapshot } from "@/lib/storage/planner-storage";
import type { Point2D, Surface, SurfaceType, Vertex } from "@/lib/types/planner";
import type {
  FurniturePlacementMode,
  Point3D,
  RoomFurnitureAsset,
  RoomFurniturePlacement,
  RoomSnapPreview,
  RoomSurfaceAsset,
  RoomSurfacePlacement,
  Size3D,
} from "@/lib/types/room";

const DEFAULT_ROOM_HEIGHT = 2.4;
const SNAP_DISTANCE = 0.45;

export interface RoomEdgeAnchor {
  index: number;
  start: Point3D;
  end: Point3D;
  midpoint: Point3D;
  length: number;
  rotationY: number;
}

export interface RoomVertexCandidate {
  surfaceId: string;
  vertexId: string;
  position: Point3D;
  label: string;
}

const surfaceTypeLabels: Record<SurfaceType, string> = {
  floor: "바닥",
  wall: "벽",
  ceiling: "천장",
};

export const DEFAULT_FURNITURE_ASSETS: RoomFurnitureAsset[] = [
  {
    id: "furniture-sofa",
    label: "소파",
    color: "#9A6D4F",
    size: { x: 1.9, y: 0.82, z: 0.9 },
    placementMode: "floor",
  },
  {
    id: "furniture-table",
    label: "테이블",
    color: "#A98960",
    size: { x: 1.2, y: 0.74, z: 0.8 },
    placementMode: "floor",
  },
  {
    id: "furniture-chair",
    label: "의자",
    color: "#7A8D76",
    size: { x: 0.48, y: 0.9, z: 0.48 },
    placementMode: "floor",
  },
  {
    id: "furniture-shelf",
    label: "선반",
    color: "#7B6D5C",
    size: { x: 0.9, y: 0.32, z: 0.24 },
    placementMode: "wall",
  },
  {
    id: "furniture-frame",
    label: "액자",
    color: "#B9966E",
    size: { x: 0.72, y: 0.52, z: 0.06 },
    placementMode: "wall",
  },
];

export function collectRoomSurfaceAssets(snapshot: PlannerSnapshot | null): RoomSurfaceAsset[] {
  const assets: RoomSurfaceAsset[] = [];
  const seen = new Set<string>();

  for (const item of snapshot?.library ?? []) {
    const key = `saved:${item.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    assets.push({
      id: key,
      label: item.label,
      type: item.surface.type,
      source: "saved",
      surface: normalizeSurfaceForRoom(item.surface),
    });
  }

  for (const surface of snapshot?.surfaces ?? []) {
    const key = `scene:${surface.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    assets.push({
      id: key,
      label: `${surface.name} 불러오기`,
      type: surface.type,
      source: "scene",
      surface: normalizeSurfaceForRoom(surface),
    });
  }

  return [...assets, ...createFallbackAssets(assets)];
}

export function normalizeSurfaceForRoom(surface: Surface): Surface {
  const absoluteVertices = getAbsoluteVertices(surface);
  const absoluteHoles = surface.holes.map((hole) => ({
    ...hole,
    vertices: getAbsoluteHoleVertices(surface, hole),
  }));
  const bounds = getBoundingBox(absoluteVertices);
  const vertices = absoluteVertices.map((vertex, index) => ({
    id: `v${index + 1}`,
    x: vertex.x - bounds.minX,
    y: vertex.y - bounds.minY,
  }));

  return {
    ...surface,
    position: { x: 0, y: 0 },
    vertices,
    holes: absoluteHoles.map((hole) => ({
      ...hole,
      vertices: hole.vertices.map((vertex) => ({
        ...vertex,
        x: vertex.x - bounds.minX,
        y: vertex.y - bounds.minY,
      })),
    })),
    dimensions: dimensionsFromVertices(vertices, surface.dimensions.thickness),
  };
}

export function createSurfacePlacementFromAsset(
  asset: RoomSurfaceAsset,
  patch: Partial<RoomSurfacePlacement> = {},
): RoomSurfacePlacement {
  const now = new Date().toISOString();

  return {
    id: uuid(),
    assetId: asset.id,
    label: asset.label,
    type: asset.type,
    surface: cloneSurface(asset.surface),
    position: { x: 0, y: 0, z: 0 },
    rotationY: 0,
    scale: { x: 1, y: 1, z: 1 },
    attachedToSurfaceId: null,
    attachedEdgeIndex: null,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export function createFurniturePlacement(
  asset: RoomFurnitureAsset,
  patch: Partial<RoomFurniturePlacement> = {},
): RoomFurniturePlacement {
  const now = new Date().toISOString();

  return {
    id: uuid(),
    assetId: asset.id,
    label: asset.label,
    color: asset.color,
    size: { ...asset.size },
    placementMode: asset.placementMode,
    position: { x: 0, y: asset.size.y / 2, z: 0 },
    rotationY: 0,
    attachedSurfaceId: null,
    attachedVertexId: null,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export function getSurfaceWorldVertices(placement: RoomSurfacePlacement) {
  return placement.surface.vertices.map((vertex) => ({
    id: vertex.id,
    position: getSurfaceVertexWorldPoint(placement, vertex),
  }));
}

export function getSurfaceVertexWorldPoint(
  placement: RoomSurfacePlacement,
  vertex: Point2D,
): Point3D {
  if (placement.type === "wall") {
    return transformWallPoint(placement, {
      x: vertex.x * placement.scale.x,
      y: vertex.y * placement.scale.y,
      z: 0,
    });
  }

  return transformPlanPoint(placement, {
    x: vertex.x * placement.scale.x,
    y: placement.type === "ceiling" ? 0 : 0,
    z: vertex.y * placement.scale.z,
  });
}

export function getFloorEdgeAnchors(placement: RoomSurfacePlacement): RoomEdgeAnchor[] {
  if (placement.type !== "floor") {
    return [];
  }

  const vertices = getSurfaceWorldVertices(placement);

  return vertices.map((entry, index) => {
    const nextEntry = vertices[(index + 1) % vertices.length];
    const midpoint = {
      x: (entry.position.x + nextEntry.position.x) / 2,
      y: placement.position.y + placement.surface.dimensions.thickness * placement.scale.y,
      z: (entry.position.z + nextEntry.position.z) / 2,
    };
    const deltaX = nextEntry.position.x - entry.position.x;
    const deltaZ = nextEntry.position.z - entry.position.z;

    return {
      index,
      start: {
        x: entry.position.x,
        y: placement.position.y + placement.surface.dimensions.thickness * placement.scale.y,
        z: entry.position.z,
      },
      end: {
        x: nextEntry.position.x,
        y: placement.position.y + placement.surface.dimensions.thickness * placement.scale.y,
        z: nextEntry.position.z,
      },
      midpoint,
      length: Math.hypot(deltaX, deltaZ),
      rotationY: Math.atan2(deltaZ, deltaX),
    };
  });
}

export function getWallPlacementFromEdge(
  asset: RoomSurfaceAsset,
  floorPlacement: RoomSurfacePlacement,
  edge: RoomEdgeAnchor,
): RoomSurfacePlacement {
  const baseLength = Math.max(asset.surface.dimensions.length, 0.01);
  const wallPlacement = createSurfacePlacementFromAsset(asset, {
    position: {
      x: edge.start.x,
      y: edge.start.y,
      z: edge.start.z,
    },
    rotationY: edge.rotationY,
    scale: {
      x: edge.length / baseLength,
      y: 1,
      z: 1,
    },
    attachedToSurfaceId: floorPlacement.id,
    attachedEdgeIndex: edge.index,
  });

  return wallPlacement;
}

export function getCeilingPlacementFromFloor(
  asset: RoomSurfaceAsset,
  floorPlacement: RoomSurfacePlacement,
  ceilingHeight: number,
): RoomSurfacePlacement {
  const floorBounds = getBoundingBox(floorPlacement.surface.vertices);
  const ceilingBounds = getBoundingBox(asset.surface.vertices);

  return createSurfacePlacementFromAsset(asset, {
    position: {
      x: floorPlacement.position.x,
      y: ceilingHeight,
      z: floorPlacement.position.z,
    },
    rotationY: floorPlacement.rotationY,
    scale: {
      x: floorBounds.width / Math.max(ceilingBounds.width, 0.01),
      y: 1,
      z: floorBounds.height / Math.max(ceilingBounds.height, 0.01),
    },
    attachedToSurfaceId: floorPlacement.id,
    attachedEdgeIndex: null,
  });
}

export function getSuggestedCeilingHeight(
  floorId: string,
  placedSurfaces: RoomSurfacePlacement[],
) {
  const attachedWalls = placedSurfaces.filter(
    (surface) => surface.type === "wall" && surface.attachedToSurfaceId === floorId,
  );

  if (attachedWalls.length === 0) {
    return DEFAULT_ROOM_HEIGHT;
  }

  return attachedWalls.reduce((highest, wall) => {
    const wallHeight = wall.surface.dimensions.height * wall.scale.y;
    return Math.max(highest, wall.position.y + wallHeight);
  }, DEFAULT_ROOM_HEIGHT);
}

export function getVertexSnapCandidates(
  placedSurfaces: RoomSurfacePlacement[],
  filter?: (surface: RoomSurfacePlacement) => boolean,
) {
  return placedSurfaces
    .filter((surface) => (filter ? filter(surface) : true))
    .flatMap((surface) =>
      getSurfaceWorldVertices(surface).map((entry) => ({
        surfaceId: surface.id,
        vertexId: entry.id,
        position: entry.position,
        label: `${surface.label} · ${entry.id}`,
      })),
    );
}

export function getNearestSnapPreview(
  point: Point3D,
  candidates: RoomVertexCandidate[],
  maxDistance = SNAP_DISTANCE,
): RoomSnapPreview | null {
  let nearest: RoomVertexCandidate | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = distance3D(point, candidate.position);

    if (distance > maxDistance || distance >= nearestDistance) {
      continue;
    }

    nearestDistance = distance;
    nearest = candidate;
  }

  if (!nearest) {
    return null;
  }

  return {
    kind: "surface-vertex",
    position: nearest.position,
    surfaceId: nearest.surfaceId,
    vertexId: nearest.vertexId,
    edgeIndex: null,
    label: nearest.label,
  };
}

export function snapPointToGrid(point: Point3D, step = 0.5): Point3D {
  return {
    x: Math.round(point.x / step) * step,
    y: point.y,
    z: Math.round(point.z / step) * step,
  };
}

export function getSurfaceWorldBounds(placement: RoomSurfacePlacement) {
  const vertices = getSurfaceWorldVertices(placement);
  const points: Point3D[] = [...vertices.map((entry) => entry.position)];

  if (placement.type === "wall") {
    const depthVector = rotateXZ(
      { x: 0, z: placement.surface.dimensions.thickness * placement.scale.z },
      placement.rotationY,
    );

    for (const entry of vertices) {
      points.push({
        x: entry.position.x + depthVector.x,
        y: entry.position.y,
        z: entry.position.z + depthVector.z,
      });
    }
  } else {
    const topY = placement.position.y + placement.surface.dimensions.thickness * placement.scale.y;

    for (const entry of vertices) {
      points.push({
        x: entry.position.x,
        y: topY,
        z: entry.position.z,
      });
    }
  }

  return buildBounds3D(points);
}

export function getFurnitureWorldBounds(item: RoomFurniturePlacement) {
  const half = {
    x: item.size.x / 2,
    y: item.size.y / 2,
    z: item.size.z / 2,
  };

  return {
    minX: item.position.x - half.x,
    maxX: item.position.x + half.x,
    minY: item.position.y - half.y,
    maxY: item.position.y + half.y,
    minZ: item.position.z - half.z,
    maxZ: item.position.z + half.z,
  };
}

export function getCharacterCollision(nextPosition: Point3D, width: number) {
  const half = width / 2;

  return {
    minX: nextPosition.x - half,
    maxX: nextPosition.x + half,
    minY: nextPosition.y,
    maxY: nextPosition.y + 0.1,
    minZ: nextPosition.z - half,
    maxZ: nextPosition.z + half,
  };
}

export function boundsIntersect(
  left: ReturnType<typeof buildBounds3D>,
  right: ReturnType<typeof buildBounds3D>,
) {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY ||
    left.maxZ < right.minZ ||
    left.minZ > right.maxZ
  );
}

export function getSurfaceSizeDisplay(placement: RoomSurfacePlacement): Size3D {
  if (placement.type === "wall") {
    return {
      x: placement.surface.dimensions.length * placement.scale.x,
      y: placement.surface.dimensions.height * placement.scale.y,
      z: placement.surface.dimensions.thickness * placement.scale.z,
    };
  }

  return {
    x: placement.surface.dimensions.length * placement.scale.x,
    y: placement.surface.dimensions.thickness * placement.scale.y,
    z: placement.surface.dimensions.height * placement.scale.z,
  };
}

export function getPlacementModeLabel(mode: FurniturePlacementMode) {
  if (mode === "wall") {
    return "벽 부착";
  }

  if (mode === "both") {
    return "바닥/벽";
  }

  return "바닥";
}

export function getSurfaceTypeLabelForRoom(type: SurfaceType) {
  return surfaceTypeLabels[type];
}

function createFallbackAssets(existing: RoomSurfaceAsset[]) {
  const missingTypes = (["floor", "wall", "ceiling"] as SurfaceType[]).filter(
    (type) => !existing.some((asset) => asset.type === type),
  );

  return missingTypes.map((type) => {
    const surface =
      type === "wall"
        ? createFallbackSurface(type, 4, 2.4, 0.12)
        : createFallbackSurface(type, 4, 4, 0.12);

    return {
      id: `default:${type}`,
      label: `기본 ${surfaceTypeLabels[type]}`,
      type,
      source: "default" as const,
      surface,
    };
  });
}

function createFallbackSurface(
  type: SurfaceType,
  length: number,
  height: number,
  thickness: number,
): Surface {
  const now = new Date().toISOString();
  const vertices = createRectangleVertices(length, height);

  return {
    id: uuid(),
    name: `기본 ${surfaceTypeLabels[type]}`,
    type,
    unit: "meter",
    position: { x: 0, y: 0 },
    dimensions: {
      length,
      height,
      thickness,
    },
    vertices,
    holes: [],
    color: SURFACE_COLORS[type],
    createdAt: now,
    updatedAt: now,
  };
}

function cloneSurface(surface: Surface) {
  return JSON.parse(JSON.stringify(surface)) as Surface;
}

function transformPlanPoint(
  placement: RoomSurfacePlacement,
  point: Point3D,
): Point3D {
  const rotated = rotateXZ({ x: point.x, z: point.z }, placement.rotationY);

  return {
    x: placement.position.x + rotated.x,
    y: placement.position.y + point.y,
    z: placement.position.z + rotated.z,
  };
}

function transformWallPoint(
  placement: RoomSurfacePlacement,
  point: Point3D,
): Point3D {
  const rotated = rotateXZ({ x: point.x, z: point.z }, placement.rotationY);

  return {
    x: placement.position.x + rotated.x,
    y: placement.position.y + point.y,
    z: placement.position.z + rotated.z,
  };
}

function rotateXZ(point: { x: number; z: number }, rotationY: number) {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);

  return {
    x: point.x * cosine - point.z * sine,
    z: point.x * sine + point.z * cosine,
  };
}

function distance3D(left: Point3D, right: Point3D) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function buildBounds3D(points: Point3D[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxZ: Math.max(...points.map((point) => point.z)),
  };
}
