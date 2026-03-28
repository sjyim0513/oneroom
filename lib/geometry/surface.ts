import { v4 as uuid } from "uuid";

import { getBoundingBox } from "@/lib/geometry/polygon";
import { clampPositive, convertDimensionsToMeters } from "@/lib/geometry/units";
import type {
  BasePoint,
  Connection,
  DraftSurfaceState,
  Point2D,
  Surface,
  SurfaceDimensions,
  SurfaceLibraryItem,
  SurfaceType,
  Vertex,
} from "@/lib/types/planner";
import { getSurfaceTypeLabel } from "@/lib/ui/planner-labels";

export const DEFAULT_DRAFT_DIMENSIONS: SurfaceDimensions = {
  length: 4,
  height: 2.4,
  thickness: 0.12,
};

export const SURFACE_COLORS: Record<SurfaceType, string> = {
  wall: "#C75F2F",
  floor: "#68824D",
  ceiling: "#7E6D57",
};

function getOrderedVertexId(index: number) {
  return `v${index + 1}`;
}

function getNextVertexId(vertices: Vertex[]) {
  const maxIndex = vertices.reduce((largest, vertex) => {
    const match = /^v(\d+)$/i.exec(vertex.id);
    const value = match ? Number(match[1]) : 0;
    return Math.max(largest, value);
  }, 0);

  return `v${maxIndex + 1}`;
}

export function createRectangleVertices(length: number, height: number): Vertex[] {
  return [
    { id: getOrderedVertexId(0), x: 0, y: 0 },
    { id: getOrderedVertexId(1), x: length, y: 0 },
    { id: getOrderedVertexId(2), x: length, y: height },
    { id: getOrderedVertexId(3), x: 0, y: height },
  ];
}

export function createSurfaceFromDraft(
  draft: DraftSurfaceState,
  index: number,
): Surface {
  const dimensions = convertDimensionsToMeters(draft.dimensions, draft.unit);
  const createdAt = new Date().toISOString();
  const horizontalOffset = (index % 3) * 0.65;
  const verticalOffset = Math.floor(index / 3) * 0.55;

  return {
    id: uuid(),
    name: `${getSurfaceTypeLabel(draft.surfaceType)} ${index + 1}`,
    type: draft.surfaceType,
    unit: draft.unit,
    position: {
      x: -1.3 + horizontalOffset,
      y: -0.8 + verticalOffset,
    },
    dimensions,
    vertices: createRectangleVertices(dimensions.length, dimensions.height),
    holes: [],
    color: SURFACE_COLORS[draft.surfaceType],
    createdAt,
    updatedAt: createdAt,
  };
}

export function cloneSurfaceWithNewIds(
  surface: Surface,
  offset: Point2D,
  index = 0,
): Surface {
  const now = new Date().toISOString();

  return normalizeSurfaceVertexIds({
    ...surface,
    id: uuid(),
    name: `${surface.name} 복사본 ${index + 1}`,
    position: {
      x: surface.position.x + offset.x,
      y: surface.position.y + offset.y,
    },
    vertices: surface.vertices.map((vertex) => ({ ...vertex })),
    holes: surface.holes.map((hole) => ({
      ...hole,
      id: uuid(),
      vertices: hole.vertices.map((vertex) => ({
        ...vertex,
        id: uuid(),
      })),
    })),
    createdAt: now,
    updatedAt: now,
  }).surface;
}

export function dimensionsFromVertices(
  vertices: Vertex[],
  thickness: number,
): SurfaceDimensions {
  const bounds = getBoundingBox(vertices);

  return {
    length: clampPositive(bounds.width, 0.1),
    height: clampPositive(bounds.height, 0.1),
    thickness: clampPositive(thickness, 0.01),
  };
}

export function insertVertexAtDistance(
  vertices: Vertex[],
  basePoint: BasePoint,
  distance: number,
): Vertex[] {
  if (vertices.length < 3) {
    return vertices;
  }

  const bounds = getBoundingBox(vertices);
  const rawTargetX =
    basePoint === "left"
      ? bounds.minX + distance
      : basePoint === "right"
        ? bounds.maxX - distance
        : bounds.minX + bounds.width / 2 + distance;
  const targetX = Math.min(bounds.maxX, Math.max(bounds.minX, rawTargetX));

  let insertAfterIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let interpolatedY = bounds.minY;

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const minX = Math.min(current.x, next.x);
    const maxX = Math.max(current.x, next.x);
    const spansTarget = targetX >= minX && targetX <= maxX;
    const spanDistance = spansTarget
      ? 0
      : Math.min(Math.abs(targetX - minX), Math.abs(targetX - maxX));
    const edgeTop = Math.min(current.y, next.y);
    const edgeLengthX = next.x - current.x;
    const ratio =
      Math.abs(edgeLengthX) < 1e-6 ? 0 : (targetX - current.x) / edgeLengthX;
    const y =
      Math.abs(edgeLengthX) < 1e-6
        ? Math.min(current.y, next.y)
        : current.y + (next.y - current.y) * ratio;
    const score = spanDistance * 100 + edgeTop;

    if (score < bestScore) {
      bestScore = score;
      insertAfterIndex = index;
      interpolatedY = y;
    }
  }

  const nextVertices = [...vertices];
  nextVertices.splice(insertAfterIndex + 1, 0, {
    id: getNextVertexId(vertices),
    x: targetX,
    y: interpolatedY,
  });

  return nextVertices;
}

export function normalizeSurfaceVertexIds(surface: Surface) {
  const vertexIdMap: Record<string, string> = {};
  const nextVertices = surface.vertices.map((vertex, index) => {
    const nextId = getOrderedVertexId(index);
    vertexIdMap[vertex.id] = nextId;

    return vertex.id === nextId
      ? vertex
      : {
          ...vertex,
          id: nextId,
        };
  });

  return {
    surface:
      nextVertices.every((vertex, index) => vertex === surface.vertices[index])
        ? surface
        : {
            ...surface,
            vertices: nextVertices,
          },
    vertexIdMap,
  };
}

export function normalizePlannerEntities(
  surfaces: Surface[],
  connections: Connection[],
) {
  const vertexIdMaps = new Map<string, Record<string, string>>();
  const normalizedSurfaces = surfaces.map((surface) => {
    const normalized = normalizeSurfaceVertexIds(surface);
    vertexIdMaps.set(surface.id, normalized.vertexIdMap);
    return normalized.surface;
  });

  const normalizedConnections = connections.map((connection) => ({
    ...connection,
    vertexAId:
      vertexIdMaps.get(connection.surfaceAId)?.[connection.vertexAId] ??
      connection.vertexAId,
    vertexBId:
      vertexIdMaps.get(connection.surfaceBId)?.[connection.vertexBId] ??
      connection.vertexBId,
  }));

  return {
    surfaces: normalizedSurfaces,
    connections: normalizedConnections,
  };
}

export function normalizeSurfaceLibraryItems(library: SurfaceLibraryItem[]) {
  return library.map((item) => ({
    ...item,
    surface: normalizeSurfaceVertexIds(item.surface).surface,
  }));
}
