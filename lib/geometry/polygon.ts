import type { Point2D, Surface, SurfaceHole, Vertex } from "@/lib/types/planner";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function getBoundingBox(points: Point2D[]): BoundingBox {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function scaleVerticesFromBounds(
  vertices: Vertex[],
  scaleX: number,
  scaleY: number,
  bounds: BoundingBox = getBoundingBox(vertices),
): Vertex[] {
  return vertices.map((vertex) => ({
    ...vertex,
    x: bounds.minX + (vertex.x - bounds.minX) * scaleX,
    y: bounds.minY + (vertex.y - bounds.minY) * scaleY,
  }));
}

export function getAbsoluteVertices(surface: Surface): Vertex[] {
  return surface.vertices.map((vertex) => ({
    ...vertex,
    x: vertex.x + surface.position.x,
    y: vertex.y + surface.position.y,
  }));
}

export function getAbsoluteHoleVertices(surface: Surface, hole: SurfaceHole): Vertex[] {
  return hole.vertices.map((vertex) => ({
    ...vertex,
    x: vertex.x + surface.position.x,
    y: vertex.y + surface.position.y,
  }));
}

export function getPolygonArea(points: Point2D[]) {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

export function isClockwise(points: Point2D[]) {
  return getPolygonArea(points) > 0;
}

export function normalizeLoop(points: Point2D[], clockwise: boolean) {
  const normalized = [...points];
  const shouldReverse = isClockwise(normalized) !== clockwise;
  return shouldReverse ? normalized.reverse() : normalized;
}

export function pointInPolygon(point: Point2D, polygon: Point2D[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function isPolygonInsidePolygon(inner: Point2D[], outer: Point2D[]) {
  return inner.every((point) => pointInPolygon(point, outer));
}

export function isConvexPolygon(points: Point2D[]) {
  if (points.length < 4) {
    return true;
  }

  let sign = 0;

  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    const cross =
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

    if (Math.abs(cross) < 1e-9) {
      continue;
    }

    if (sign === 0) {
      sign = Math.sign(cross);
      continue;
    }

    if (Math.sign(cross) !== sign) {
      return false;
    }
  }

  return true;
}

export function getAbsoluteSurfaceVertex(surface: Surface, vertexId: string) {
  const vertex = surface.vertices.find((item) => item.id === vertexId);

  if (!vertex) {
    return null;
  }

  return {
    ...vertex,
    x: vertex.x + surface.position.x,
    y: vertex.y + surface.position.y,
  };
}
