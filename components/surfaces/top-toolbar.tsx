import type { ViewMode } from "@/lib/types/planner";

interface TopToolbarProps {
  currentViewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  snapEnabled: boolean;
  scaleLinkedEnabled: boolean;
  onToggleSnap: () => void;
  onToggleScaleLinked: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSaveScene: () => void;
  onLoadScene: () => void;
  lastSavedAt: string | null;
  surfacesCount: number;
}

export function TopToolbar({
  currentViewMode,
  onViewModeChange,
  snapEnabled,
  scaleLinkedEnabled,
  onToggleSnap,
  onToggleScaleLinked,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSaveScene,
  onLoadScene,
  lastSavedAt,
  surfacesCount,
}: TopToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] bg-white/70 px-4 py-4 md:px-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="font-display text-2xl font-semibold tracking-tight text-ink-900">
            면 만들기
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            하나의 데이터로 2D 편집, 3D 확인, 스냅 연결, 연결 해제까지 한 번에 진행할 수 있어요.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ToggleButton
            active={currentViewMode === "2d"}
            onClick={() => onViewModeChange("2d")}
          >
            2D 보기
          </ToggleButton>
          <ToggleButton
            active={currentViewMode === "3d"}
            onClick={() => onViewModeChange("3d")}
          >
            3D 보기
          </ToggleButton>
          <ToggleButton active={snapEnabled} onClick={onToggleSnap}>
            스냅 기능 {snapEnabled ? "켜짐" : "꺼짐"}
          </ToggleButton>
          <ToggleButton active={scaleLinkedEnabled} onClick={onToggleScaleLinked}>
            크기 연동 {scaleLinkedEnabled ? "켜짐" : "꺼짐"}
          </ToggleButton>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onUndo} disabled={!canUndo}>
            되돌리기
          </ActionButton>
          <ActionButton onClick={onRedo} disabled={!canRedo}>
            다시 실행
          </ActionButton>
          <ActionButton onClick={onSaveScene}>현재 장면 저장</ActionButton>
          <ActionButton onClick={onLoadScene}>저장한 장면 불러오기</ActionButton>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
          <span>면 {surfacesCount}개</span>
          <span>
            {lastSavedAt ? `저장됨 ${formatSavedAt(lastSavedAt)}` : "로컬 저장 준비 완료"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-ink-900 text-white shadow-lg shadow-ink-900/15"
          : "border border-[var(--panel-border)] bg-white text-ink-700 hover:border-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-[var(--panel-border)] bg-white px-4 py-2 text-sm font-medium text-ink-800 transition hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function formatSavedAt(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}
