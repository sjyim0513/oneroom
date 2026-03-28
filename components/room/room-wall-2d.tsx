"use client";

import { useMemo } from "react";

import { getBoundingBox } from "@/lib/geometry/polygon";
import { useRoomStore } from "@/store/room-store";

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 240;
const PADDING = 28;

export function RoomWall2D() {
  const {
    placedSurfaces,
    furniture,
    furnitureCatalog,
    wall2DTargetId,
    activePlacementIntent,
    placeWallFurnitureAsset,
    closeWall2D,
  } = useRoomStore();

  const wall = placedSurfaces.find((surface) => surface.id === wall2DTargetId) ?? null;
  const activeFurniture =
    activePlacementIntent?.kind === "furniture"
      ? furnitureCatalog.find((asset) => asset.id === activePlacementIntent.assetId) ?? null
      : null;
  const attachedFurniture = furniture.filter((item) => item.attachedSurfaceId === wall2DTargetId);

  const layout = useMemo(() => {
    if (!wall) {
      return null;
    }

    const bounds = getBoundingBox(wall.surface.vertices);
    const scale = Math.min(
      (PANEL_WIDTH - PADDING * 2) / Math.max(bounds.width, 0.01),
      (PANEL_HEIGHT - PADDING * 2) / Math.max(bounds.height, 0.01),
    );

    return {
      bounds,
      scale,
      toScreen(point: { x: number; y: number }) {
        return {
          x: PADDING + (point.x - bounds.minX) * scale,
          y: PADDING + (point.y - bounds.minY) * scale,
        };
      },
    };
  }, [wall]);

  if (!wall || !layout) {
    return null;
  }

  const polygonPoints = wall.surface.vertices
    .map((vertex) => {
      const screen = layout.toScreen(vertex);
      return `${screen.x},${screen.y}`;
    })
    .join(" ");

  return (
    <div className="absolute bottom-4 right-4 z-20 w-[340px] rounded-[24px] border border-[var(--panel-border)] bg-white/95 p-4 shadow-[0_18px_40px_rgba(33,29,26,0.12)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">벽 2D 보기</p>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            {activeFurniture
              ? `${activeFurniture.label}을(를) 놓을 정점을 눌러 주세요.`
              : "벽 정점 이름과 배치된 벽 가구 위치를 확인할 수 있어요."}
          </p>
        </div>

        <button
          type="button"
          onClick={closeWall2D}
          className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-ink-800"
        >
          닫기
        </button>
      </div>

      <div className="mt-4 rounded-[20px] border border-[var(--panel-border)] bg-[var(--canvas-bg)] p-3">
        <svg
          viewBox={`0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}`}
          className="h-[240px] w-full"
          role="img"
          aria-label="벽 2D 보기"
        >
          <polygon
            points={polygonPoints}
            fill="rgba(104,130,77,0.15)"
            stroke="#68824D"
            strokeWidth={2}
          />

          {wall.surface.vertices.map((vertex) => {
            const screen = layout.toScreen(vertex);

            return (
              <g key={vertex.id}>
                <circle
                  cx={screen.x}
                  cy={screen.y}
                  r={7}
                  fill="#ffffff"
                  stroke="#68824D"
                  strokeWidth={2}
                  style={{ cursor: activeFurniture ? "pointer" : "default" }}
                  onClick={() => {
                    if (!activeFurniture) {
                      return;
                    }

                    if (activeFurniture.placementMode === "floor") {
                      return;
                    }

                    placeWallFurnitureAsset(activeFurniture.id, wall.id, vertex.id);
                  }}
                />
                <text
                  x={screen.x + 10}
                  y={screen.y - 8}
                  fontSize="11"
                  fill="#211d1a"
                >
                  {vertex.id}
                </text>
              </g>
            );
          })}

          {attachedFurniture.map((item) => {
            const vertex = wall.surface.vertices.find((entry) => entry.id === item.attachedVertexId);

            if (!vertex) {
              return null;
            }

            const screen = layout.toScreen(vertex);

            return (
              <g key={item.id}>
                <rect
                  x={screen.x - 10}
                  y={screen.y + 10}
                  width={20}
                  height={12}
                  rx={6}
                  fill={item.color}
                  opacity={0.85}
                />
                <text
                  x={screen.x + 14}
                  y={screen.y + 21}
                  fontSize="10"
                  fill="#211d1a"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
