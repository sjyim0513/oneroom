import { dimensionsFromVertices } from "@/lib/geometry/surface";
import {
  getAbsoluteSurfaceVertex,
  getBoundingBox,
  scaleVerticesFromBounds,
} from "@/lib/geometry/polygon";
import type { Connection, Point2D, Surface } from "@/lib/types/planner";

export function getConnectedSurfaceGroup(
  surfaceId: string,
  connections: Connection[],
): string[] {
  const visited = new Set<string>();
  const queue = [surfaceId];

  while (queue.length > 0) {
    const currentSurfaceId = queue.shift();

    if (!currentSurfaceId || visited.has(currentSurfaceId)) {
      continue;
    }

    visited.add(currentSurfaceId);

    for (const connection of connections) {
      if (connection.surfaceAId === currentSurfaceId && !visited.has(connection.surfaceBId)) {
        queue.push(connection.surfaceBId);
      }

      if (connection.surfaceBId === currentSurfaceId && !visited.has(connection.surfaceAId)) {
        queue.push(connection.surfaceAId);
      }
    }
  }

  return [...visited];
}

export function moveSurfaceGroup(
  surfaces: Surface[],
  groupIds: string[],
  delta: Point2D,
): Surface[] {
  const groupIdSet = new Set(groupIds);

  return surfaces.map((surface) =>
    groupIdSet.has(surface.id)
      ? {
          ...surface,
          position: {
            x: surface.position.x + delta.x,
            y: surface.position.y + delta.y,
          },
          updatedAt: new Date().toISOString(),
        }
      : surface,
  );
}

export function moveSurfaceGroupFromStartPositions(
  surfaces: Surface[],
  groupIds: string[],
  startPositions: Record<string, Point2D>,
  delta: Point2D,
): Surface[] {
  const groupIdSet = new Set(groupIds);

  return surfaces.map((surface) => {
    if (!groupIdSet.has(surface.id)) {
      return surface;
    }

    const startPosition = startPositions[surface.id] ?? surface.position;

    return {
      ...surface,
      position: {
        x: startPosition.x + delta.x,
        y: startPosition.y + delta.y,
      },
      updatedAt: new Date().toISOString(),
    };
  });
}

export function alignSurfaceVertexToPoint(
  surface: Surface,
  vertexId: string,
  targetPoint: Point2D,
): Surface {
  const absoluteVertex = getAbsoluteSurfaceVertex(surface, vertexId);

  if (!absoluteVertex) {
    return surface;
  }

  const delta = {
    x: targetPoint.x - absoluteVertex.x,
    y: targetPoint.y - absoluteVertex.y,
  };

  return {
    ...surface,
    position: {
      x: surface.position.x + delta.x,
      y: surface.position.y + delta.y,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function scaleSurfaceGeometry(
  surface: Surface,
  scaleX: number,
  scaleY: number,
  thickness = surface.dimensions.thickness,
): Surface {
  const bounds = getBoundingBox(surface.vertices);
  const vertices = scaleVerticesFromBounds(surface.vertices, scaleX, scaleY, bounds);
  const holes = surface.holes.map((hole) => ({
    ...hole,
    vertices: scaleVerticesFromBounds(hole.vertices, scaleX, scaleY, bounds),
  }));

  return {
    ...surface,
    vertices,
    holes,
    dimensions: dimensionsFromVertices(vertices, thickness),
    updatedAt: new Date().toISOString(),
  };
}

export function propagateLinkedScaling(
  surfaces: Surface[],
  connections: Connection[],
  resizedSurfaceId: string,
  scaleX: number,
  scaleY: number,
): Surface[] {
  const surfaceMap = new Map(surfaces.map((surface) => [surface.id, surface]));
  const queue = [resizedSurfaceId];
  const visited = new Set<string>([resizedSurfaceId]);

  while (queue.length > 0) {
    const currentSurfaceId = queue.shift();

    if (!currentSurfaceId) {
      continue;
    }

    const currentSurface = surfaceMap.get(currentSurfaceId);

    if (!currentSurface) {
      continue;
    }

    for (const connection of connections) {
      const touchesCurrent =
        connection.surfaceAId === currentSurfaceId ||
        connection.surfaceBId === currentSurfaceId;

      if (!touchesCurrent) {
        continue;
      }

      const neighborSurfaceId =
        connection.surfaceAId === currentSurfaceId
          ? connection.surfaceBId
          : connection.surfaceAId;

      if (visited.has(neighborSurfaceId)) {
        continue;
      }

      const neighborSurface = surfaceMap.get(neighborSurfaceId);

      if (!neighborSurface) {
        continue;
      }

      const anchorOnCurrent =
        connection.surfaceAId === currentSurfaceId
          ? connection.vertexAId
          : connection.vertexBId;
      const anchorOnNeighbor =
        connection.surfaceAId === currentSurfaceId
          ? connection.vertexBId
          : connection.vertexAId;
      const anchorPoint = getAbsoluteSurfaceVertex(currentSurface, anchorOnCurrent);

      if (!anchorPoint) {
        continue;
      }

      const scaledNeighbor = scaleSurfaceGeometry(neighborSurface, scaleX, scaleY);
      const alignedNeighbor = alignSurfaceVertexToPoint(
        scaledNeighbor,
        anchorOnNeighbor,
        anchorPoint,
      );

      surfaceMap.set(neighborSurfaceId, alignedNeighbor);
      queue.push(neighborSurfaceId);
      visited.add(neighborSurfaceId);
    }
  }

  return surfaces.map((surface) => surfaceMap.get(surface.id) ?? surface);
}
