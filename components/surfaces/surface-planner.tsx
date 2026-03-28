"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { LeftPanel } from "@/components/surfaces/left-panel";
import { RightPanel } from "@/components/surfaces/right-panel";
import { TopToolbar } from "@/components/surfaces/top-toolbar";
import type { BasePoint } from "@/lib/types/planner";
import {
  getConnectionSummary,
  getSurfaceDisplayDimensions,
  getSurfaceVertexDisplayPoint,
  toSurfaceLocalPoint,
  usePlannerStore,
} from "@/store/planner-store";

const SurfaceStage2D = dynamic(
  () =>
    import("@/components/surfaces/surface-stage-2d").then(
      (module) => module.SurfaceStage2D,
    ),
  {
    ssr: false,
    loading: () => <ViewportFallback label="2D 편집기를 불러오는 중..." />,
  },
);

const SurfaceScene3D = dynamic(
  () =>
    import("@/components/surfaces/surface-scene-3d").then(
      (module) => module.SurfaceScene3D,
    ),
  {
    ssr: false,
    loading: () => <ViewportFallback label="3D 화면을 불러오는 중..." />,
  },
);

export function SurfacePlanner() {
  const {
    surfaces,
    connections,
    selectedSurfaceId,
    currentViewMode,
    snapEnabled,
    scaleLinkedEnabled,
    activeSnapGuide,
    draft,
    library,
    lastSavedAt,
    initialized,
    canUndo,
    canRedo,
    initialize,
    setViewMode,
    toggleSnap,
    toggleScaleLinked,
    selectSurface,
    setDraftSurfaceType,
    setDraftUnit,
    setDraftDimensions,
    createSurface,
    beginSurfaceMove,
    previewSurfaceMove,
    finalizeSurfaceMove,
    updateSurfaceMeta,
    resizeSurface,
    beginVertexMove,
    previewSurfaceVertex,
    finalizeVertexMove,
    updateSurfaceVertex,
    insertVertex,
    saveSelectedSurfaceToLibrary,
    loadSurfaceFromLibrary,
    deleteSurface,
    deleteConnectedGroup,
    removeConnection,
    cutSurface,
    undo,
    redo,
    saveScene,
    loadScene,
  } = usePlannerStore();

  const [vertexBasePoint, setVertexBasePoint] = useState<BasePoint>("left");
  const [vertexDistance, setVertexDistance] = useState(0.5);
  const [libraryLabel, setLibraryLabel] = useState("");
  const [cutTargetId, setCutTargetId] = useState("");
  const [cutCutterId, setCutCutterId] = useState("");
  const [cutFeedback, setCutFeedback] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;

      if (!hasModifier) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();

        if (canUndo) {
          undo();
        }

        return;
      }

      if ((key === "y" && !event.shiftKey) || (key === "z" && event.shiftKey)) {
        event.preventDefault();

        if (canRedo) {
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canRedo, canUndo, redo, undo]);

  const selectedSurface = useMemo(
    () => surfaces.find((surface) => surface.id === selectedSurfaceId) ?? null,
    [selectedSurfaceId, surfaces],
  );
  const dimensionValues = selectedSurface
    ? getSurfaceDisplayDimensions(selectedSurface)
    : null;
  const vertexRows = selectedSurface
    ? selectedSurface.vertices.map((vertex) => ({
        id: vertex.id,
        ...getSurfaceVertexDisplayPoint(selectedSurface, vertex),
      }))
    : [];
  const connectionRows = selectedSurface
    ? getConnectionSummary(selectedSurface.id, surfaces, connections)
    : [];

  useEffect(() => {
    const currentTargetExists = surfaces.some((surface) => surface.id === cutTargetId);
    const currentCutterExists = surfaces.some((surface) => surface.id === cutCutterId);
    const fallbackTarget = selectedSurface?.id ?? surfaces[0]?.id ?? "";
    const fallbackCutter =
      surfaces.find((surface) => surface.id !== fallbackTarget)?.id ?? "";

    if (!currentTargetExists && fallbackTarget) {
      setCutTargetId(fallbackTarget);
    }

    if ((!currentCutterExists || cutCutterId === cutTargetId) && fallbackCutter) {
      setCutCutterId(fallbackCutter);
    }

    if (surfaces.length < 2) {
      setCutFeedback(null);
    }
  }, [cutCutterId, cutTargetId, selectedSurface, surfaces]);

  if (!initialized) {
    return <ViewportFallback label="편집기를 준비하는 중..." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopToolbar
        currentViewMode={currentViewMode}
        onViewModeChange={setViewMode}
        snapEnabled={snapEnabled}
        scaleLinkedEnabled={scaleLinkedEnabled}
        onToggleSnap={toggleSnap}
        onToggleScaleLinked={toggleScaleLinked}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSaveScene={saveScene}
        onLoadScene={loadScene}
        lastSavedAt={lastSavedAt}
        surfacesCount={surfaces.length}
      />

      <div className="grid flex-1 min-h-0 gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <section className="order-2 xl:order-1">
          <LeftPanel
            draft={draft}
            onDraftSurfaceTypeChange={setDraftSurfaceType}
            onDraftUnitChange={setDraftUnit}
            onDraftDimensionChange={(field, value) =>
              setDraftDimensions({
                [field]: value,
              })
            }
            onCreateSurface={createSurface}
            selectedSurface={selectedSurface}
            vertexBasePoint={vertexBasePoint}
            vertexDistance={vertexDistance}
            onVertexBasePointChange={setVertexBasePoint}
            onVertexDistanceChange={setVertexDistance}
            onInsertVertex={() => {
              if (!selectedSurface) {
                return;
              }

              insertVertex(selectedSurface.id, vertexBasePoint, vertexDistance);
            }}
            library={library}
            libraryLabel={libraryLabel}
            onLibraryLabelChange={setLibraryLabel}
            onSaveToLibrary={() => {
              saveSelectedSurfaceToLibrary(libraryLabel);
              setLibraryLabel("");
            }}
            onLoadFromLibrary={loadSurfaceFromLibrary}
            surfaces={surfaces}
            cutTargetId={cutTargetId}
            cutCutterId={cutCutterId}
            onCutTargetChange={setCutTargetId}
            onCutCutterChange={setCutCutterId}
            onCutSurface={() => {
              if (!cutTargetId || !cutCutterId) {
                setCutFeedback("기준 면과 잘라낼 면을 먼저 선택해 주세요.");
                return;
              }

              const success = cutSurface(cutTargetId, cutCutterId);
              setCutFeedback(
                success
                  ? "기준 면 외곽선을 잘라낸 모양으로 업데이트했어요."
                  : "지금은 겹친 결과가 하나의 바깥 윤곽으로 남는 직교 면만 잘라낼 수 있어요.",
              );
            }}
            cutFeedback={cutFeedback}
          />
        </section>

        <section className="order-1 min-h-[420px] overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-white/70 xl:order-2 xl:min-h-0">
          <div className="flex h-full min-h-[420px] flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {currentViewMode === "2d" ? "2D 면 편집" : "3D 면 미리보기"}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {currentViewMode === "2d"
                    ? "면을 드래그하고 정점을 움직여 서로 연결하고, 길이와 겹침 정보도 바로 확인해 보세요."
                    : "같은 면 데이터를 두께까지 포함한 3D로 확인할 수 있어요."}
                </p>
              </div>

              <div className="text-sm text-[var(--text-muted)]">
                {selectedSurface
                  ? `선택한 면: ${selectedSurface.name}`
                  : "편집할 면을 선택해 주세요."}
              </div>
            </div>

            <div className="flex-1 p-4">
              {currentViewMode === "2d" ? (
                <SurfaceStage2D
                  surfaces={surfaces}
                  selectedSurfaceId={selectedSurfaceId}
                  activeSnapGuide={activeSnapGuide}
                  onSelectSurface={selectSurface}
                  onBeginSurfaceMove={beginSurfaceMove}
                  onPreviewSurfaceMove={previewSurfaceMove}
                  onFinalizeSurfaceMove={finalizeSurfaceMove}
                  onBeginVertexMove={beginVertexMove}
                  onPreviewSurfaceVertex={previewSurfaceVertex}
                  onFinalizeVertexMove={finalizeVertexMove}
                />
              ) : (
                <SurfaceScene3D
                  surfaces={surfaces}
                  selectedSurfaceId={selectedSurfaceId}
                  onSelectSurface={selectSurface}
                />
              )}
            </div>
          </div>
        </section>

        <section className="order-3">
          <RightPanel
            selectedSurface={selectedSurface}
            dimensionValues={dimensionValues}
            vertices={vertexRows}
            connections={connectionRows}
            onNameChange={(value) => {
              if (selectedSurface) {
                updateSurfaceMeta(selectedSurface.id, { name: value });
              }
            }}
            onTypeChange={(value) => {
              if (selectedSurface) {
                updateSurfaceMeta(selectedSurface.id, { type: value });
              }
            }}
            onUnitChange={(value) => {
              if (selectedSurface) {
                updateSurfaceMeta(selectedSurface.id, { unit: value });
              }
            }}
            onDimensionChange={(field, value) => {
              if (!selectedSurface || !dimensionValues) {
                return;
              }

              resizeSurface(
                selectedSurface.id,
                {
                  ...dimensionValues,
                  [field]: value,
                },
                selectedSurface.unit,
              );
            }}
            onVertexChange={(vertexId, nextPoint) => {
              if (!selectedSurface) {
                return;
              }

              updateSurfaceVertex(
                selectedSurface.id,
                vertexId,
                toSurfaceLocalPoint(selectedSurface, nextPoint),
              );
            }}
            onDeleteSurface={() => {
              if (!selectedSurface) {
                return;
              }

              const shouldDelete = window.confirm(
                `"${selectedSurface.name}" 면을 삭제할까요?`,
              );

              if (!shouldDelete) {
                return;
              }

              deleteSurface(selectedSurface.id);
            }}
            onDeleteConnectedGroup={() => {
              if (!selectedSurface) {
                return;
              }

              const shouldDelete = window.confirm(
                `"${selectedSurface.name}"이 포함된 연결 오브젝트 전체를 삭제할까요?`,
              );

              if (!shouldDelete) {
                return;
              }

              deleteConnectedGroup(selectedSurface.id);
            }}
            onDisconnectConnection={(connectionId) => {
              removeConnection(connectionId);
            }}
          />
        </section>
      </div>
    </div>
  );
}

function ViewportFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-6">
      <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-white/80 px-5 py-4 text-sm text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}
