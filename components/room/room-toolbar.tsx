"use client";

interface RoomToolbarProps {
  snapEnabled: boolean;
  editMode: "editor" | "play";
  wall2DTargetId: string | null;
  lastSavedAt: string | null;
  onSave: () => void;
  onLoad: () => void;
  onDownload: () => void;
  onPlay: () => void;
  onEditMode: () => void;
  onToggleSnap: () => void;
  onCloseWall2D: () => void;
}

export function RoomToolbar({
  snapEnabled,
  editMode,
  wall2DTargetId,
  lastSavedAt,
  onSave,
  onLoad,
  onDownload,
  onPlay,
  onEditMode,
  onToggleSnap,
  onCloseWall2D,
}: RoomToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--panel-border)] bg-white/75 px-4 py-3 shadow-panel">
      <div>
        <p className="text-sm font-semibold text-ink-900">방 구성 편집기</p>
        <p className="text-xs text-[var(--text-muted)]">
          바닥을 놓고, 벽을 붙이고, 가구와 조명을 정점에 맞춰 배치해 보세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton onClick={onSave}>저장</ToolbarButton>
        <ToolbarButton onClick={onLoad}>불러오기</ToolbarButton>
        <ToolbarButton onClick={onDownload}>다운로드</ToolbarButton>
        <ToolbarButton
          active={editMode === "play"}
          onClick={onPlay}
        >
          플레이
        </ToolbarButton>
        <ToolbarButton
          active={snapEnabled}
          onClick={onToggleSnap}
        >
          스냅 {snapEnabled ? "켜짐" : "꺼짐"}
        </ToolbarButton>
        <ToolbarButton
          active={editMode === "editor"}
          onClick={onEditMode}
        >
          편집 모드
        </ToolbarButton>
        <ToolbarButton
          disabled={!wall2DTargetId}
          onClick={onCloseWall2D}
        >
          2D 벽 보기 종료
        </ToolbarButton>
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        {lastSavedAt
          ? `마지막 저장 ${new Date(lastSavedAt).toLocaleString("ko-KR")}`
          : "아직 저장하지 않았어요."}
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
        disabled
          ? "cursor-not-allowed border-[var(--panel-border)] bg-white/50 text-[var(--text-muted)]"
          : active
            ? "border-ink-900 bg-ink-900 text-white shadow-lg shadow-ink-900/10"
            : "border-[var(--panel-border)] bg-white/85 text-ink-800 hover:border-ink-300 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}
