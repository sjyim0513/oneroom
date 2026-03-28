import {
  getAbsoluteVertices,
  normalizeLoop,
  pointInPolygon,
} from "@/lib/geometry/polygon";
import type { Point2D, Surface } from "@/lib/types/planner";

const EPSILON = 1e-6;

interface RectangleCell {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface DirectedEdge {
  start: Point2D;
  end: Point2D;
}

export function subtractPolygonToOuterBoundary(
  target: Surface,
  cutter: Surface,
): Point2D[] | null {
  if (target.holes.length > 0 || cutter.holes.length > 0) {
    return null;
  }

  const targetPolygon = getAbsoluteVertices(target).map(toPoint);
  const cutterPolygon = getAbsoluteVertices(cutter).map(toPoint);

  if (targetPolygon.length < 3 || cutterPolygon.length < 3) {
    return null;
  }

  if (!isOrthogonalLoop(targetPolygon) || !isOrthogonalLoop(cutterPolygon)) {
    return null;
  }

  const xCoordinates = getSortedCoordinates([
    ...targetPolygon.map((point) => point.x),
    ...cutterPolygon.map((point) => point.x),
  ]);
  const yCoordinates = getSortedCoordinates([
    ...targetPolygon.map((point) => point.y),
    ...cutterPolygon.map((point) => point.y),
  ]);

  if (xCoordinates.length < 2 || yCoordinates.length < 2) {
    return null;
  }

  const keptCells: RectangleCell[] = [];
  let removedCellCount = 0;

  for (let xIndex = 0; xIndex < xCoordinates.length - 1; xIndex += 1) {
    const minX = xCoordinates[xIndex];
    const maxX = xCoordinates[xIndex + 1];

    if (maxX - minX <= EPSILON) {
      continue;
    }

    for (let yIndex = 0; yIndex < yCoordinates.length - 1; yIndex += 1) {
      const minY = yCoordinates[yIndex];
      const maxY = yCoordinates[yIndex + 1];

      if (maxY - minY <= EPSILON) {
        continue;
      }

      const midpoint = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
      };
      const insideTarget = pointInPolygon(midpoint, targetPolygon);
      const insideCutter = pointInPolygon(midpoint, cutterPolygon);

      if (!insideTarget) {
        continue;
      }

      if (insideCutter) {
        removedCellCount += 1;
        continue;
      }

      keptCells.push({
        minX,
        minY,
        maxX,
        maxY,
      });
    }
  }

  if (removedCellCount === 0 || keptCells.length === 0) {
    return null;
  }

  const loops = traceBoundaryLoops(keptCells);

  if (loops.length !== 1) {
    return null;
  }

  const simplified = rotateLoopToAnchor(simplifyLoop(loops[0]));

  if (simplified.length < 3) {
    return null;
  }

  return simplified;
}

function toPoint(point: Point2D): Point2D {
  return {
    x: point.x,
    y: point.y,
  };
}

function isOrthogonalLoop(points: Point2D[]) {
  return points.every((point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    const deltaX = Math.abs(nextPoint.x - point.x);
    const deltaY = Math.abs(nextPoint.y - point.y);
    return deltaX <= EPSILON || deltaY <= EPSILON;
  });
}

function getSortedCoordinates(values: number[]) {
  return [...values]
    .sort((left, right) => left - right)
    .filter(
      (value, index, array) =>
        index === 0 || Math.abs(value - array[index - 1]) > EPSILON,
    );
}

function traceBoundaryLoops(cells: RectangleCell[]) {
  const edgeMap = new Map<string, DirectedEdge>();

  for (const cell of cells) {
    const corners = [
      { x: cell.minX, y: cell.minY },
      { x: cell.maxX, y: cell.minY },
      { x: cell.maxX, y: cell.maxY },
      { x: cell.minX, y: cell.maxY },
    ];

    for (let index = 0; index < corners.length; index += 1) {
      const start = corners[index];
      const end = corners[(index + 1) % corners.length];
      toggleDirectedEdge(edgeMap, start, end);
    }
  }

  const outgoingEdges = new Map<string, DirectedEdge[]>();

  for (const edge of edgeMap.values()) {
    const startKey = pointKey(edge.start);
    const currentEdges = outgoingEdges.get(startKey) ?? [];
    currentEdges.push(edge);
    outgoingEdges.set(startKey, currentEdges);
  }

  const remainingEdgeKeys = new Set(edgeMap.keys());
  const loops: Point2D[][] = [];

  while (remainingEdgeKeys.size > 0) {
    const firstEdgeKey = remainingEdgeKeys.values().next().value as string | undefined;

    if (!firstEdgeKey) {
      break;
    }

    const firstEdge = edgeMap.get(firstEdgeKey);

    if (!firstEdge) {
      remainingEdgeKeys.delete(firstEdgeKey);
      continue;
    }

    const loop: Point2D[] = [];
    let currentEdge = firstEdge;
    let guard = 0;

    while (guard < edgeMap.size + 4) {
      guard += 1;
      const currentKey = edgeKey(currentEdge.start, currentEdge.end);

      if (!remainingEdgeKeys.has(currentKey)) {
        return [];
      }

      remainingEdgeKeys.delete(currentKey);
      loop.push(currentEdge.start);

      const nextStartKey = pointKey(currentEdge.end);

      if (pointsEqual(currentEdge.end, firstEdge.start)) {
        break;
      }

      const nextEdge = (outgoingEdges.get(nextStartKey) ?? []).find((edge) =>
        remainingEdgeKeys.has(edgeKey(edge.start, edge.end)),
      );

      if (!nextEdge) {
        return [];
      }

      currentEdge = nextEdge;
    }

    if (loop.length < 3 || guard >= edgeMap.size + 4) {
      return [];
    }

    loops.push(normalizeLoop(loop, false));
  }

  return loops;
}

function toggleDirectedEdge(
  edgeMap: Map<string, DirectedEdge>,
  start: Point2D,
  end: Point2D,
) {
  const reverseKey = edgeKey(end, start);

  if (edgeMap.has(reverseKey)) {
    edgeMap.delete(reverseKey);
    return;
  }

  edgeMap.set(edgeKey(start, end), {
    start,
    end,
  });
}

function simplifyLoop(points: Point2D[]) {
  const nextPoints = dedupeConsecutivePoints(points);

  if (nextPoints.length < 3) {
    return nextPoints;
  }

  let changed = true;

  while (changed && nextPoints.length >= 3) {
    changed = false;

    for (let index = 0; index < nextPoints.length; index += 1) {
      const previous = nextPoints[(index - 1 + nextPoints.length) % nextPoints.length];
      const current = nextPoints[index];
      const next = nextPoints[(index + 1) % nextPoints.length];

      if (isCollinear(previous, current, next)) {
        nextPoints.splice(index, 1);
        changed = true;
        break;
      }
    }
  }

  return nextPoints;
}

function rotateLoopToAnchor(points: Point2D[]) {
  if (points.length === 0) {
    return points;
  }

  let anchorIndex = 0;

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const anchor = points[anchorIndex];

    if (
      current.y < anchor.y - EPSILON ||
      (Math.abs(current.y - anchor.y) <= EPSILON && current.x < anchor.x - EPSILON)
    ) {
      anchorIndex = index;
    }
  }

  return [...points.slice(anchorIndex), ...points.slice(0, anchorIndex)];
}

function dedupeConsecutivePoints(points: Point2D[]) {
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    return !pointsEqual(point, previous);
  });
}

function isCollinear(previous: Point2D, current: Point2D, next: Point2D) {
  const cross =
    (current.x - previous.x) * (next.y - current.y) -
    (current.y - previous.y) * (next.x - current.x);

  if (Math.abs(cross) > EPSILON) {
    return false;
  }

  const sameVertical =
    Math.abs(previous.x - current.x) <= EPSILON && Math.abs(current.x - next.x) <= EPSILON;
  const sameHorizontal =
    Math.abs(previous.y - current.y) <= EPSILON && Math.abs(current.y - next.y) <= EPSILON;

  return sameVertical || sameHorizontal;
}

function pointKey(point: Point2D) {
  return `${roundKey(point.x)}:${roundKey(point.y)}`;
}

function edgeKey(start: Point2D, end: Point2D) {
  return `${pointKey(start)}->${pointKey(end)}`;
}

function roundKey(value: number) {
  return Math.round(value * 1_000_000);
}

function pointsEqual(left: Point2D, right: Point2D) {
  return Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;
}
