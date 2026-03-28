"use client";

import { getFloorEdgeAnchors, getSurfaceSizeDisplay } from "@/lib/geometry/room";
import { useRoomStore } from "@/store/room-store";

export function RoomPropertiesPanel() {
  const {
    placedSurfaces,
    furniture,
    lights,
    character,
    selected,
    activePlacementIntent,
    activeFloorEdgeIndex,
    snapEnabled,
    snapPreview,
    selectSurface,
    setActiveFloorEdgeIndex,
    placeWallAsset,
    placeLightOnVertex,
    openWall2D,
    updateFurniturePosition,
    updateFurnitureSize,
    updateCharacterConfig,
    deleteSelected,
  } = useRoomStore();

  const selectedSurface =
    selected.kind === "surface"
      ? placedSurfaces.find((item) => item.id === selected.id) ?? null
      : null;
  const selectedFurniture =
    selected.kind === "furniture"
      ? furniture.find((item) => item.id === selected.id) ?? null
      : null;
  const selectedLight =
    selected.kind === "light"
      ? lights.find((item) => item.id === selected.id) ?? null
      : null;
  const floorEdges =
    selectedSurface?.type === "floor" ? getFloorEdgeAnchors(selectedSurface) : [];
  const activeWallAssetId =
    activePlacementIntent?.kind === "surface" && activePlacementIntent.surfaceType === "wall"
      ? activePlacementIntent.assetId
      : null;
  const ceilingReady =
    activePlacementIntent?.kind === "light" && selectedSurface?.type === "ceiling";

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[24px] border border-[var(--panel-border)] bg-white/75 shadow-panel">
      <div className="border-b border-[var(--panel-border)] px-4 py-4">
        <p className="text-sm font-semibold text-ink-900">선택 정보</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          위치, 크기, 스냅 상태를 확인하고 필요한 액션을 바로 실행할 수 있어요.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {selectedSurface ? (
          <>
            <InfoCard title={selectedSurface.label} subtitle={getSurfaceSubtitle(selectedSurface.type)}>
              <InfoRow label="위치" value={formatPoint3D(selectedSurface.position)} />
              <InfoRow
                label="크기"
                value={formatSize3D(getSurfaceSizeDisplay(selectedSurface))}
              />
            </InfoCard>

            {selectedSurface.type === "wall" ? (
              <button
                type="button"
                onClick={() => openWall2D(selectedSurface.id)}
                className="w-full rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 text-sm font-medium text-ink-900 transition hover:border-ink-300"
              >
                벽 2D 보기 열기
              </button>
            ) : null}

            {selectedSurface.type === "floor" ? (
              <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--canvas-bg)] p-4">
                <p className="text-sm font-semibold text-ink-900">바닥 모서리</p>
                <div className="mt-3 space-y-2">
                  {floorEdges.map((edge) => (
                    <div
                      key={edge.index}
                      className={`rounded-2xl border px-3 py-3 ${
                        activeFloorEdgeIndex === edge.index
                          ? "border-ink-900 bg-white"
                          : "border-[var(--panel-border)] bg-white/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-ink-900">모서리 {edge.index + 1}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            길이 {edge.length.toFixed(2)}m
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            selectSurface(selectedSurface.id);
                            setActiveFloorEdgeIndex(edge.index);
                          }}
                          className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-ink-800"
                        >
                          기준으로 선택
                        </button>
                      </div>

                      {activeWallAssetId ? (
                        <button
                          type="button"
                          onClick={() => placeWallAsset(activeWallAssetId, selectedSurface.id, edge.index)}
                          className="mt-3 w-full rounded-xl bg-ink-900 px-3 py-2 text-sm font-medium text-white"
                        >
                          이 모서리에 벽 붙이기
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {ceilingReady ? (
              <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--canvas-bg)] p-4">
                <p className="text-sm font-semibold text-ink-900">천장 정점 조명</p>
                <div className="mt-3 space-y-2">
                  {selectedSurface.surface.vertices.map((vertex) => (
                    <button
                      key={vertex.id}
                      type="button"
                      onClick={() => placeLightOnVertex(selectedSurface.id, vertex.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-sm text-ink-800"
                    >
                      <span>{vertex.id}</span>
                      <span>여기에 조명 놓기</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {selectedFurniture ? (
          <InfoCard title={selectedFurniture.label} subtitle="가구">
            <EditableNumber
              label="위치 X"
              value={selectedFurniture.position.x}
              onChange={(value) => updateFurniturePosition("x", value)}
            />
            <EditableNumber
              label="위치 Y"
              value={selectedFurniture.position.y}
              onChange={(value) => updateFurniturePosition("y", value)}
            />
            <EditableNumber
              label="위치 Z"
              value={selectedFurniture.position.z}
              onChange={(value) => updateFurniturePosition("z", value)}
            />
            <EditableNumber
              label="가로"
              value={selectedFurniture.size.x}
              onChange={(value) => updateFurnitureSize("x", value)}
            />
            <EditableNumber
              label="높이"
              value={selectedFurniture.size.y}
              onChange={(value) => updateFurnitureSize("y", value)}
            />
            <EditableNumber
              label="깊이"
              value={selectedFurniture.size.z}
              onChange={(value) => updateFurnitureSize("z", value)}
            />
          </InfoCard>
        ) : null}

        {selectedLight ? (
          <InfoCard title={selectedLight.label} subtitle="조명">
            <EditableNumber
              label="위치 X"
              value={selectedLight.position.x}
              onChange={(value) => updateFurniturePosition("x", value)}
            />
            <EditableNumber
              label="위치 Y"
              value={selectedLight.position.y}
              onChange={(value) => updateFurniturePosition("y", value)}
            />
            <EditableNumber
              label="위치 Z"
              value={selectedLight.position.z}
              onChange={(value) => updateFurniturePosition("z", value)}
            />
          </InfoCard>
        ) : null}

        {selected.kind === "character" ? (
          <InfoCard title="캐릭터" subtitle="플레이 기준점">
            <InfoRow label="위치" value={formatPoint3D(character.position)} />
            <EditableNumber
              label="키"
              value={character.height}
              onChange={(value) => updateCharacterConfig({ height: value })}
            />
            <EditableNumber
              label="너비"
              value={character.width}
              onChange={(value) => updateCharacterConfig({ width: value })}
            />
          </InfoCard>
        ) : null}

        {!selected.kind ? (
          <div className="rounded-[20px] border border-dashed border-[var(--panel-border)] bg-[var(--canvas-bg)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
            장면에서 바닥, 벽, 가구, 조명, 캐릭터를 선택하면 여기에서 자세한 정보를 볼 수 있어요.
          </div>
        ) : null}

        <div className="rounded-[20px] border border-[var(--panel-border)] bg-white/85 p-4">
          <p className="text-sm font-semibold text-ink-900">스냅 상태</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {snapEnabled ? "스냅 켜짐" : "스냅 꺼짐"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {snapPreview
              ? `${snapPreview.label} 위치를 미리 보고 있어요.`
              : "현재 표시 중인 스냅 미리보기가 없어요."}
          </p>
        </div>

        {selected.kind ? (
          <button
            type="button"
            onClick={deleteSelected}
            className="w-full rounded-2xl border border-[#d9bfb8] bg-[#fff4f1] px-4 py-3 text-sm font-medium text-[#8f4b3d]"
          >
            선택 항목 삭제
          </button>
        ) : null}
      </div>
    </section>
  );
}

function InfoCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--panel-border)] bg-white/85 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}

function EditableNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <input
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-ink-900 outline-none transition focus:border-ink-400"
      />
    </label>
  );
}

function getSurfaceSubtitle(type: "floor" | "wall" | "ceiling") {
  if (type === "floor") {
    return "바닥 면";
  }

  if (type === "wall") {
    return "벽 면";
  }

  return "천장 면";
}

function formatPoint3D(point: { x: number; y: number; z: number }) {
  return `${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}`;
}

function formatSize3D(size: { x: number; y: number; z: number }) {
  return `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}m`;
}
