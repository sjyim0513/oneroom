"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { RoomAssetsPanel } from "@/components/room/room-assets-panel";
import { RoomPropertiesPanel } from "@/components/room/room-properties-panel";
import { RoomToolbar } from "@/components/room/room-toolbar";
import { RoomWall2D } from "@/components/room/room-wall-2d";
import { useRoomStore } from "@/store/room-store";

const RoomScene = dynamic(
  () => import("@/components/room/room-scene").then((module) => module.RoomScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[480px] items-center justify-center rounded-[24px] border border-dashed border-[var(--panel-border)] bg-white/70 px-6 py-5 text-sm text-[var(--text-muted)]">
        3D 방 편집기를 불러오는 중이에요.
      </div>
    ),
  },
);

export function RoomEditor() {
  const {
    initialized,
    editMode,
    snapEnabled,
    wall2DTargetId,
    lastSavedAt,
    statusMessage,
    initialize,
    toggleSnap,
    setEditMode,
    closeWall2D,
    saveRoom,
    loadRoom,
    downloadRoom,
  } = useRoomStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && wall2DTargetId) {
        closeWall2D();
      }

      if (event.key === "Escape" && editMode === "play") {
        setEditMode("editor");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeWall2D, editMode, setEditMode, wall2DTargetId]);

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-[24px] border border-dashed border-[var(--panel-border)] bg-white/75 px-6 py-5 text-sm text-[var(--text-muted)]">
          방 편집기를 준비하고 있어요.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <RoomToolbar
        snapEnabled={snapEnabled}
        editMode={editMode}
        wall2DTargetId={wall2DTargetId}
        lastSavedAt={lastSavedAt}
        onSave={saveRoom}
        onLoad={loadRoom}
        onDownload={downloadRoom}
        onPlay={() => setEditMode("play")}
        onEditMode={() => setEditMode("editor")}
        onToggleSnap={toggleSnap}
        onCloseWall2D={closeWall2D}
      />

      <div className="grid flex-1 min-h-0 gap-4 pt-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="order-2 min-h-0 xl:order-1">
          <RoomAssetsPanel />
        </div>

        <div className="order-1 min-h-0 xl:order-2">
          <div className="relative h-full min-h-[540px] rounded-[24px] border border-[var(--panel-border)] bg-white/70 p-4 shadow-panel">
            <RoomScene />
            {wall2DTargetId ? <RoomWall2D /> : null}
          </div>
        </div>

        <div className="order-3 min-h-0">
          <RoomPropertiesPanel />
        </div>
      </div>

      {statusMessage ? (
        <div className="mt-4 rounded-[20px] border border-[var(--panel-border)] bg-white/85 px-4 py-3 text-sm text-[var(--text-muted)]">
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
