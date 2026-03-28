import { v4 as uuid } from "uuid";

import {
  getAbsoluteVertices,
  isConvexPolygon,
  isPolygonInsidePolygon,
  normalizeLoop,
} from "@/lib/geometry/polygon";
import type { Point2D, Surface, Vertex } from "@/lib/types/planner";

export function buildBooleanCutHole(target: Surface, cutter: Surface): Vertex[] | null {
  const targetVertices = getAbsoluteVertices(target);
  const cutterVertices = getAbsoluteVertices(cutter);

  if (isPolygonInsidePolygon(cutterVertices, targetVertices)) {
    return cutterVertices.map((vertex) => ({
      id: uuid(),
      x: vertex.x - target.position.x,
      y: vertex.y - target.position.y,
    }));
  }

  if (!isConvexPolygon(targetVertices) || !isConvexPolygon(cutterVertices)) {
    return null;
  }

  const clipped = clipConvexPolygon(cutterVertices, targetVertices);

  if (clipped.length < 3) {
    return null;
  }

  return normalizeLoop(clipped, true).map((point) => ({
    id: uuid(),
    x: point.x - target.position.x,
    y: point.y - target.position.y,
  }));
}

function clipConvexPolygon(subject: Point2D[], clip: Point2D[]) {
  let output = [...subject];
  const clipPoints = normalizeLoop(clip, true);

  for (let index = 0; index < clipPoints.length; index += 1) {
    const a = clipPoints[index];
    const b = clipPoints[(index + 1) % clipPoints.length];
    const input = [...output];
    output = [];

    if (input.length === 0) {
      break;
    }

    let previousPoint = input[input.length - 1];

    for (const currentPoint of input) {
      const currentInside = isInside(currentPoint, a, b);
      const previousInside = isInside(previousPoint, a, b);

      if (currentInside) {
        if (!previousInside) {
          output.push(getIntersection(previousPoint, currentPoint, a, b));
        }

        output.push(currentPoint);
      } else if (previousInside) {
        output.push(getIntersection(previousPoint, currentPoint, a, b));
      }

      previousPoint = currentPoint;
    }
  }

  return output;
}

function isInside(point: Point2D, edgeStart: Point2D, edgeEnd: Point2D) {
  const cross =
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
    (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x);

  return cross <= 1e-6;
}

function getIntersection(
  segmentStart: Point2D,
  segmentEnd: Point2D,
  edgeStart: Point2D,
  edgeEnd: Point2D,
): Point2D {
  const denominator =
    (segmentStart.x - segmentEnd.x) * (edgeStart.y - edgeEnd.y) -
    (segmentStart.y - segmentEnd.y) * (edgeStart.x - edgeEnd.x);

  if (Math.abs(denominator) < 1e-9) {
    return segmentEnd;
  }

  const determinantA = segmentStart.x * segmentEnd.y - segmentStart.y * segmentEnd.x;
  const determinantB = edgeStart.x * edgeEnd.y - edgeStart.y * edgeEnd.x;

  return {
    x:
      (determinantA * (edgeStart.x - edgeEnd.x) -
        (segmentStart.x - segmentEnd.x) * determinantB) /
      denominator,
    y:
      (determinantA * (edgeStart.y - edgeEnd.y) -
        (segmentStart.y - segmentEnd.y) * determinantB) /
      denominator,
  };
}
