"use client";

import { useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";

import { getBoundingBox } from "@/lib/geometry/polygon";
import { fromMeters } from "@/lib/geometry/units";
import type { Point2D, SnapGuide, Surface, Unit, Vertex } from "@/lib/types/planner";

import { useElementSize } from "./use-element-size";

interface SurfaceStage2DProps {
  surfaces: Surface[];
  selectedSurfaceId: string | null;
  activeSnapGuide: SnapGuide | null;
  onSelectSurface: (surfaceId: string | null) => void;
  onBeginSurfaceMove: (surfaceId: string) => void;
  onPreviewSurfaceMove: (surfaceId: string, nextPosition: Point2D) => void;
  onFinalizeSurfaceMove: (surfaceId: string) => void;
  onBeginVertexMove: (surfaceId: string, vertexId: string) => void;
  onPreviewSurfaceVertex: (
    surfaceId: string,
    vertexId: string,
    nextPoint: Point2D,
  ) => void;
  onFinalizeVertexMove: () => void;
}

interface ViewportState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface HoverOverlayState {
  label: string;
  screenX: number;
  screenY: number;
}

const PIXELS_PER_METER = 96;
const GRID_STEP_METERS = 0.5;
const GRID_EXTENT_METERS = 40;
const CANVAS_BACKGROUND = "#fbf8f1";
const MIN_VIEWPORT_SCALE = 0.35;
const MAX_VIEWPORT_SCALE = 4;
const ZOOM_SENSITIVITY = 0.0015;
const VERTEX_HOVER_THRESHOLD = 16;
const EDGE_HOVER_THRESHOLD = 12;

export function SurfaceStage2D({
  surfaces,
  selectedSurfaceId,
  activeSnapGuide,
  onSelectSurface,
  onBeginSurfaceMove,
  onPreviewSurfaceMove,
  onFinalizeSurfaceMove,
  onBeginVertexMove,
  onPreviewSurfaceVertex,
  onFinalizeVertexMove,
}: SurfaceStage2DProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [viewport, setViewport] = useState<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [hoverOverlay, setHoverOverlay] = useState<HoverOverlayState | null>(null);
  const panStateRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  const viewportOrigin = {
    x: centerX + viewport.offsetX,
    y: centerY + viewport.offsetY,
  };
  const selectedSurface =
    surfaces.find((surface) => surface.id === selectedSurfaceId) ?? null;

  const updateHoverOverlay = (
    pointer: Point2D | null | undefined,
    nextViewport: ViewportState = viewport,
  ) => {
    if (!pointer || isPanning || isDraggingShape) {
      setHoverOverlay(null);
      return;
    }

    const hoveredVertex = selectedSurface
      ? findHoveredVertex(pointer, selectedSurface, nextViewport, centerX, centerY)
      : null;

    if (hoveredVertex) {
      setHoverOverlay(hoveredVertex);
      return;
    }

    setHoverOverlay(findHoveredEdge(pointer, surfaces, nextViewport, centerX, centerY));
  };

  return (
    <div
      ref={ref}
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded-[24px] bg-[var(--canvas-bg)]"
      style={{ cursor: isPanning ? "grabbing" : "default" }}
    >
      {size.width > 0 && size.height > 0 ? (
        <Stage
          width={size.width}
          height={size.height}
          onWheel={(event) => {
            event.evt.preventDefault();

            const stage = event.target.getStage();
            const pointer = stage?.getPointerPosition();

            if (!pointer) {
              return;
            }

            let nextViewportState: ViewportState | null = null;

            setViewport((currentViewport) => {
              const nextScale = clampScale(
                currentViewport.scale * Math.exp(-event.evt.deltaY * ZOOM_SENSITIVITY),
              );

              if (Math.abs(nextScale - currentViewport.scale) < 1e-4) {
                nextViewportState = currentViewport;
                return currentViewport;
              }

              const currentX = centerX + currentViewport.offsetX;
              const currentY = centerY + currentViewport.offsetY;
              const worldX = (pointer.x - currentX) / currentViewport.scale;
              const worldY = (pointer.y - currentY) / currentViewport.scale;

              nextViewportState = {
                scale: nextScale,
                offsetX: pointer.x - worldX * nextScale - centerX,
                offsetY: pointer.y - worldY * nextScale - centerY,
              };

              return nextViewportState;
            });

            updateHoverOverlay(pointer, nextViewportState ?? viewport);
          }}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) {
              const stage = event.target.getStage();
              const pointer = stage?.getPointerPosition();

              if (!pointer) {
                return;
              }

              panStateRef.current = {
                pointerX: pointer.x,
                pointerY: pointer.y,
                offsetX: viewport.offsetX,
                offsetY: viewport.offsetY,
              };
              setIsPanning(true);
              setHoverOverlay(null);
              onSelectSurface(null);
            }
          }}
          onMouseMove={(event) => {
            const stage = event.target.getStage();
            const pointer = stage?.getPointerPosition();
            const panState = panStateRef.current;

            if (!pointer) {
              setHoverOverlay(null);
              return;
            }

            if (panState) {
              const nextViewportState = {
                ...viewport,
                offsetX: panState.offsetX + pointer.x - panState.pointerX,
                offsetY: panState.offsetY + pointer.y - panState.pointerY,
              };

              setViewport(nextViewportState);
              setHoverOverlay(null);
              return;
            }

            updateHoverOverlay(pointer);
          }}
          onMouseUp={() => {
            panStateRef.current = null;
            setIsPanning(false);
          }}
          onMouseLeave={() => {
            panStateRef.current = null;
            setIsPanning(false);
            setHoverOverlay(null);
          }}
        >
          <Layer>
            <Rect
              width={size.width}
              height={size.height}
              fill={CANVAS_BACKGROUND}
              listening={false}
            />

            <Group
              x={viewportOrigin.x}
              y={viewportOrigin.y}
              scaleX={viewport.scale}
              scaleY={viewport.scale}
            >
              {renderGrid()}

              {surfaces.map((surface) => {
                const selected = surface.id === selectedSurfaceId;
                const points = flattenPoints(surface.vertices);
                const bounds = getBoundingBox(surface.vertices);

                return (
                  <Group
                    key={surface.id}
                    x={surface.position.x * PIXELS_PER_METER}
                    y={surface.position.y * PIXELS_PER_METER}
                    draggable
                    onClick={(event) => {
                      event.cancelBubble = true;
                      onSelectSurface(surface.id);
                    }}
                    onTap={() => onSelectSurface(surface.id)}
                    onDragStart={() => {
                      setIsDraggingShape(true);
                      setHoverOverlay(null);
                      onBeginSurfaceMove(surface.id);
                    }}
                    onDragMove={(event) => {
                      const position = event.target.position();
                      onPreviewSurfaceMove(surface.id, {
                        x: position.x / PIXELS_PER_METER,
                        y: position.y / PIXELS_PER_METER,
                      });
                    }}
                    onDragEnd={() => {
                      setIsDraggingShape(false);
                      onFinalizeSurfaceMove(surface.id);
                    }}
                  >
                    <Line
                      points={points}
                      closed
                      fill={withAlpha(surface.color, selected ? 0.24 : 0.14)}
                      stroke={surface.color}
                      strokeWidth={selected ? 3 : 2}
                    />

                    {surface.holes.map((hole) => (
                      <Line
                        key={hole.id}
                        points={flattenPoints(hole.vertices)}
                        closed
                        fill={CANVAS_BACKGROUND}
                        stroke={surface.color}
                        strokeWidth={1.25}
                        dash={[8, 6]}
                      />
                    ))}

                    <Text
                      x={bounds.minX * PIXELS_PER_METER + 10}
                      y={bounds.minY * PIXELS_PER_METER + 10}
                      text={surface.name}
                      fontSize={14}
                      fontStyle="600"
                      fill="#211d1a"
                    />

                    {selected
                      ? surface.vertices.map((vertex) => (
                          <Circle
                            key={vertex.id}
                            x={vertex.x * PIXELS_PER_METER}
                            y={vertex.y * PIXELS_PER_METER}
                            radius={7}
                            fill="#ffffff"
                            stroke={surface.color}
                            strokeWidth={3}
                            draggable
                            onMouseDown={(event) => {
                              event.cancelBubble = true;
                            }}
                            onDragStart={() => {
                              setIsDraggingShape(true);
                              setHoverOverlay(null);
                              onBeginVertexMove(surface.id, vertex.id);
                            }}
                            onDragMove={(event) => {
                              const position = event.target.position();
                              onPreviewSurfaceVertex(surface.id, vertex.id, {
                                x: position.x / PIXELS_PER_METER,
                                y: position.y / PIXELS_PER_METER,
                              });
                            }}
                            onDragEnd={(event) => {
                              const position = event.target.position();
                              setIsDraggingShape(false);
                              onPreviewSurfaceVertex(surface.id, vertex.id, {
                                x: position.x / PIXELS_PER_METER,
                                y: position.y / PIXELS_PER_METER,
                              });
                              onFinalizeVertexMove();
                            }}
                          />
                        ))
                      : null}
                  </Group>
                );
              })}

              {activeSnapGuide ? (
                <Group listening={false}>
                  <Line
                    points={[
                      activeSnapGuide.sourcePoint.x * PIXELS_PER_METER,
                      activeSnapGuide.sourcePoint.y * PIXELS_PER_METER,
                      activeSnapGuide.targetPoint.x * PIXELS_PER_METER,
                      activeSnapGuide.targetPoint.y * PIXELS_PER_METER,
                    ]}
                    stroke="#C75F2F"
                    strokeWidth={2}
                    dash={[10, 6]}
                  />
                  <Circle
                    x={activeSnapGuide.targetPoint.x * PIXELS_PER_METER}
                    y={activeSnapGuide.targetPoint.y * PIXELS_PER_METER}
                    radius={10}
                    stroke="#C75F2F"
                    strokeWidth={2}
                  />
                </Group>
              ) : null}
            </Group>
          </Layer>
        </Stage>
      ) : null}

      {hoverOverlay ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-[rgba(33,29,26,0.12)] bg-white/95 px-2 py-1 text-[11px] font-medium text-ink-900 shadow-[0_6px_18px_rgba(33,29,26,0.08)]"
          style={{
            left: hoverOverlay.screenX + 12,
            top: hoverOverlay.screenY - 28,
            transform: "translate3d(0,0,0)",
          }}
        >
          {hoverOverlay.label}
        </div>
      ) : null}

      {surfaces.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-white/85 px-5 py-4 text-center text-sm leading-6 text-[var(--text-muted)]">
            왼쪽 패널에서 면을 추가하면 여기에서 바로 편집할 수 있어요.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function flattenPoints(points: Point2D[]) {
  return points.flatMap((point) => [
    point.x * PIXELS_PER_METER,
    point.y * PIXELS_PER_METER,
  ]);
}

function findHoveredVertex(
  pointer: Point2D,
  surface: Surface,
  viewport: ViewportState,
  centerX: number,
  centerY: number,
): HoverOverlayState | null {
  const viewportOrigin = {
    x: centerX + viewport.offsetX,
    y: centerY + viewport.offsetY,
  };

  let nearestVertex: HoverOverlayState | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const vertex of surface.vertices) {
    const screenPoint = worldToScreenPoint(
      {
        x: surface.position.x + vertex.x,
        y: surface.position.y + vertex.y,
      },
      viewportOrigin,
      viewport.scale,
    );
    const distance = Math.hypot(pointer.x - screenPoint.x, pointer.y - screenPoint.y);

    if (distance > VERTEX_HOVER_THRESHOLD || distance >= nearestDistance) {
      continue;
    }

    nearestDistance = distance;
    nearestVertex = {
      label: vertex.id,
      screenX: screenPoint.x,
      screenY: screenPoint.y,
    };
  }

  return nearestVertex;
}

function findHoveredEdge(
  pointer: Point2D,
  surfaces: Surface[],
  viewport: ViewportState,
  centerX: number,
  centerY: number,
): HoverOverlayState | null {
  const viewportOrigin = {
    x: centerX + viewport.offsetX,
    y: centerY + viewport.offsetY,
  };

  let nearestEdge: HoverOverlayState | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const surface of surfaces) {
    const loops = [surface.vertices, ...surface.holes.map((hole) => hole.vertices)];

    for (const loop of loops) {
      for (const edge of getLoopEdges(loop)) {
        const startWorld = {
          x: surface.position.x + edge.start.x,
          y: surface.position.y + edge.start.y,
        };
        const endWorld = {
          x: surface.position.x + edge.end.x,
          y: surface.position.y + edge.end.y,
        };
        const startScreen = worldToScreenPoint(startWorld, viewportOrigin, viewport.scale);
        const endScreen = worldToScreenPoint(endWorld, viewportOrigin, viewport.scale);
        const distance = distanceToSegment(pointer, startScreen, endScreen);

        if (distance > EDGE_HOVER_THRESHOLD || distance >= nearestDistance) {
          continue;
        }

        nearestDistance = distance;
        nearestEdge = {
          label: formatEdgeLength(edge.lengthMeters, surface.unit),
          screenX: (startScreen.x + endScreen.x) / 2,
          screenY: (startScreen.y + endScreen.y) / 2,
        };
      }
    }
  }

  return nearestEdge;
}

function getLoopEdges(vertices: Vertex[]) {
  if (vertices.length < 2) {
    return [];
  }

  return vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length];

    return {
      start,
      end,
      lengthMeters: Math.hypot(end.x - start.x, end.y - start.y),
    };
  });
}

function formatEdgeLength(lengthMeters: number, unit: Unit) {
  const convertedLength = fromMeters(lengthMeters, unit);
  const digits = unit === "inch" ? 1 : 2;
  const label = unit === "inch" ? "인치" : "미터";

  return `${convertedLength.toFixed(digits)} ${label}`;
}

function worldToScreenPoint(
  point: Point2D,
  viewportOrigin: Point2D,
  scale: number,
): Point2D {
  return {
    x: viewportOrigin.x + point.x * PIXELS_PER_METER * scale,
    y: viewportOrigin.y + point.y * PIXELS_PER_METER * scale,
  };
}

function distanceToSegment(point: Point2D, start: Point2D, end: Point2D) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 1e-9) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  const projectedPoint = {
    x: start.x + dx * projection,
    y: start.y + dy * projection,
  };

  return Math.hypot(point.x - projectedPoint.x, point.y - projectedPoint.y);
}

function renderGrid() {
  const extent = GRID_EXTENT_METERS * PIXELS_PER_METER;
  const columns = Math.floor(GRID_EXTENT_METERS / GRID_STEP_METERS);
  const lines = [];

  for (let index = -columns; index <= columns; index += 1) {
    const x = index * GRID_STEP_METERS * PIXELS_PER_METER;
    lines.push(
      <Line
        key={`vertical-${index}`}
        points={[x, -extent, x, extent]}
        stroke={index % 2 === 0 ? "rgba(99, 84, 70, 0.12)" : "rgba(99, 84, 70, 0.06)"}
        strokeWidth={index === 0 ? 1.4 : 1}
        listening={false}
      />,
    );
  }

  for (let index = -columns; index <= columns; index += 1) {
    const y = index * GRID_STEP_METERS * PIXELS_PER_METER;
    lines.push(
      <Line
        key={`horizontal-${index}`}
        points={[-extent, y, extent, y]}
        stroke={index % 2 === 0 ? "rgba(99, 84, 70, 0.12)" : "rgba(99, 84, 70, 0.06)"}
        strokeWidth={index === 0 ? 1.4 : 1}
        listening={false}
      />,
    );
  }

  return lines;
}

function clampScale(scale: number) {
  return Math.min(MAX_VIEWPORT_SCALE, Math.max(MIN_VIEWPORT_SCALE, scale));
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
