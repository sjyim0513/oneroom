import { getAbsoluteVertices } from "@/lib/geometry/polygon";
import type { Point2D, SnapGuide, Surface } from "@/lib/types/planner";

export const SNAP_THRESHOLD_METERS = 0.18;

export function findSnapGuide(
  movingSurfaceId: string,
  nextPosition: Point2D,
  surfaces: Surface[],
  thresholdMeters = SNAP_THRESHOLD_METERS,
  excludedSurfaceIds: string[] = [movingSurfaceId],
): SnapGuide | null {
  const movingSurface = surfaces.find((surface) => surface.id === movingSurfaceId);

  if (!movingSurface) {
    return null;
  }

  const translatedSurfaces = surfaces.map((surface) =>
    surface.id === movingSurfaceId
      ? {
          ...surface,
          position: nextPosition,
        }
      : surface,
  );

  return findSnapGuideForSurfaceGroup(
    [movingSurfaceId],
    translatedSurfaces,
    thresholdMeters,
    excludedSurfaceIds,
  );
}

export function findSnapGuideForSurfaceGroup(
  movingSurfaceIds: string[],
  surfaces: Surface[],
  thresholdMeters = SNAP_THRESHOLD_METERS,
  excludedSurfaceIds: string[] = movingSurfaceIds,
): SnapGuide | null {
  const movingSurfaceIdSet = new Set(movingSurfaceIds);
  const excludedSurfaceIdSet = new Set(excludedSurfaceIds);
  const movingSurfaces = surfaces.filter((surface) => movingSurfaceIdSet.has(surface.id));

  let nearestGuide: SnapGuide | null = null;

  for (const movingSurface of movingSurfaces) {
    for (const sourceVertex of getAbsoluteVertices(movingSurface)) {
      for (const targetSurface of surfaces) {
        if (excludedSurfaceIdSet.has(targetSurface.id)) {
          continue;
        }

        for (const targetVertex of getAbsoluteVertices(targetSurface)) {
          const distance = Math.hypot(
            targetVertex.x - sourceVertex.x,
            targetVertex.y - sourceVertex.y,
          );

          if (distance > thresholdMeters) {
            continue;
          }

          if (!nearestGuide || distance < nearestGuide.distance) {
            nearestGuide = {
              sourceSurfaceId: movingSurface.id,
              sourceVertexId: sourceVertex.id,
              sourcePoint: { x: sourceVertex.x, y: sourceVertex.y },
              targetSurfaceId: targetSurface.id,
              targetVertexId: targetVertex.id,
              targetPoint: { x: targetVertex.x, y: targetVertex.y },
              distance,
            };
          }
        }
      }
    }
  }

  return nearestGuide;
}
