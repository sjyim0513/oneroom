"use client";

import { getPlacementModeLabel, getSurfaceTypeLabelForRoom } from "@/lib/geometry/room";
import type { RoomSidebarTab } from "@/lib/types/room";
import { useRoomStore } from "@/store/room-store";

const tabs: Array<{ id: RoomSidebarTab; label: string }> = [
  { id: "floor", label: "바닥" },
  { id: "wall", label: "벽" },
  { id: "ceiling", label: "천장" },
  { id: "furniture", label: "가구" },
  { id: "light", label: "조명" },
  { id: "character", label: "캐릭터" },
];

export function RoomAssetsPanel() {
  const {
    availableSurfaceAssets,
    furnitureCatalog,
    activeSidebarTab,
    activePlacementIntent,
    placedSurfaces,
    selected,
    setSidebarTab,
    setPlacementIntent,
    placeCeilingAsset,
    setStatusMessage,
  } = useRoomStore();

  const selectedFloor =
    selected.kind === "surface"
      ? placedSurfaces.find((surface) => surface.id === selected.id && surface.type === "floor") ??
        null
      : null;

  const surfaceAssets = availableSurfaceAssets.filter((asset) => asset.type === activeSidebarTab);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[24px] border border-[var(--panel-border)] bg-white/75 shadow-panel">
      <div className="border-b border-[var(--panel-border)] px-4 py-4">
        <p className="text-sm font-semibold text-ink-900">자산 패널</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          바닥부터 배치하고, 벽은 선택한 바닥의 모서리에 붙여 주세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--panel-border)] px-4 py-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSidebarTab(tab.id)}
            className={`rounded-full px-3 py-2 text-sm font-medium transition ${
              activeSidebarTab === tab.id
                ? "bg-ink-900 text-white"
                : "border border-[var(--panel-border)] bg-white text-ink-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {activeSidebarTab === "furniture" ? (
          furnitureCatalog.map((asset) => {
            const active =
              activePlacementIntent?.kind === "furniture" &&
              activePlacementIntent.assetId === asset.id;

            return (
              <AssetCard
                key={asset.id}
                title={asset.label}
                meta={`${getPlacementModeLabel(asset.placementMode)} · ${asset.size.x.toFixed(2)}m`}
                active={active}
                actionLabel="배치 준비"
                onAction={() =>
                  setPlacementIntent({
                    kind: "furniture",
                    assetId: asset.id,
                  })
                }
              />
            );
          })
        ) : activeSidebarTab === "light" ? (
          <AssetCard
            title="천장 조명"
            meta="선택한 천장의 정점에 배치"
            active={activePlacementIntent?.kind === "light"}
            actionLabel="배치 준비"
            onAction={() => setPlacementIntent({ kind: "light" })}
          />
        ) : activeSidebarTab === "character" ? (
          <AssetCard
            title="캐릭터"
            meta="플레이 시점 기준"
            active={activePlacementIntent?.kind === "character"}
            actionLabel="배치 준비"
            onAction={() => setPlacementIntent({ kind: "character" })}
          />
        ) : (
          surfaceAssets.map((asset) => {
            const active =
              activePlacementIntent?.kind === "surface" &&
              activePlacementIntent.assetId === asset.id;

            return (
              <AssetCard
                key={asset.id}
                title={asset.label}
                meta={`${getSurfaceTypeLabelForRoom(asset.type)} · ${asset.surface.dimensions.length.toFixed(2)}m`}
                active={active}
                actionLabel={
                  activeSidebarTab === "ceiling" && selectedFloor ? "선택 바닥에 바로 올리기" : "배치 준비"
                }
                onAction={() => {
                  if (asset.type === "ceiling" && selectedFloor) {
                    placeCeilingAsset(asset.id, selectedFloor.id);
                    return;
                  }

                  setPlacementIntent({
                    kind: "surface",
                    assetId: asset.id,
                    surfaceType: asset.type,
                  });
                }}
              />
            );
          })
        )}

        {activeSidebarTab === "wall" && !selectedFloor ? (
          <HintBox>
            벽은 바닥을 먼저 선택한 뒤 오른쪽 패널에서 모서리를 골라 붙일 수 있어요.
          </HintBox>
        ) : null}

        {activeSidebarTab === "ceiling" && !selectedFloor ? (
          <HintBox>
            천장은 바닥을 선택한 상태에서 올리는 흐름이 가장 편해요.
          </HintBox>
        ) : null}

        {activeSidebarTab === "light" ? (
          <HintBox>
            천장을 선택하고, 보이는 정점 마커를 클릭하면 조명이 놓여요.
          </HintBox>
        ) : null}

        {activeSidebarTab === "character" ? (
          <HintBox>
            바닥 위를 클릭해 캐릭터를 놓은 뒤 플레이 버튼으로 직접 이동해 보세요.
          </HintBox>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setPlacementIntent(null);
            setStatusMessage("배치 준비를 해제했어요.");
          }}
          className="w-full rounded-2xl border border-dashed border-[var(--panel-border)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition hover:border-ink-300 hover:bg-white"
        >
          배치 준비 해제
        </button>
      </div>
    </section>
  );
}

function AssetCard({
  title,
  meta,
  actionLabel,
  active,
  onAction,
}: {
  title: string;
  meta: string;
  actionLabel: string;
  active: boolean;
  onAction: () => void;
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-4 transition ${
        active
          ? "border-ink-900 bg-ink-900/5"
          : "border-[var(--panel-border)] bg-white/85"
      }`}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-[var(--text-muted)]">{meta}</p>
      </div>

      <button
        type="button"
        onClick={onAction}
        className={`mt-4 w-full rounded-xl px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-ink-900 text-white"
            : "border border-[var(--panel-border)] bg-white text-ink-800 hover:border-ink-300"
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[var(--panel-border)] bg-[var(--canvas-bg)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
      {children}
    </div>
  );
}
