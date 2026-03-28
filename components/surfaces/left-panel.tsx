import {
  getBasePointLabel,
  getSurfaceTypeLabel,
  getUnitLabel,
} from "@/lib/ui/planner-labels";
import {
  BASE_POINTS,
  SURFACE_TYPES,
  UNITS,
  type BasePoint,
  type DraftSurfaceState,
  type Surface,
  type SurfaceLibraryItem,
} from "@/lib/types/planner";

interface LeftPanelProps {
  draft: DraftSurfaceState;
  onDraftSurfaceTypeChange: (value: DraftSurfaceState["surfaceType"]) => void;
  onDraftUnitChange: (value: DraftSurfaceState["unit"]) => void;
  onDraftDimensionChange: (
    field: keyof DraftSurfaceState["dimensions"],
    value: number,
  ) => void;
  onCreateSurface: () => void;
  selectedSurface: Surface | null;
  vertexBasePoint: BasePoint;
  vertexDistance: number;
  onVertexBasePointChange: (value: BasePoint) => void;
  onVertexDistanceChange: (value: number) => void;
  onInsertVertex: () => void;
  library: SurfaceLibraryItem[];
  libraryLabel: string;
  onLibraryLabelChange: (value: string) => void;
  onSaveToLibrary: () => void;
  onLoadFromLibrary: (itemId: string) => void;
  surfaces: Surface[];
  cutTargetId: string;
  cutCutterId: string;
  onCutTargetChange: (value: string) => void;
  onCutCutterChange: (value: string) => void;
  onCutSurface: () => void;
  cutFeedback: string | null;
}

export function LeftPanel({
  draft,
  onDraftSurfaceTypeChange,
  onDraftUnitChange,
  onDraftDimensionChange,
  onCreateSurface,
  selectedSurface,
  vertexBasePoint,
  vertexDistance,
  onVertexBasePointChange,
  onVertexDistanceChange,
  onInsertVertex,
  library,
  libraryLabel,
  onLibraryLabelChange,
  onSaveToLibrary,
  onLoadFromLibrary,
  surfaces,
  cutTargetId,
  cutCutterId,
  onCutTargetChange,
  onCutCutterChange,
  onCutSurface,
  cutFeedback,
}: LeftPanelProps) {
  return (
    <aside className="min-h-[360px] overflow-y-auto border border-[var(--panel-border)] bg-white/75 p-4 xl:h-full">
      <div className="space-y-5">
        <PanelSection
          title="면 만들기"
          description="간단한 기본 설정으로 새 면을 바로 추가할 수 있어요."
        >
          <Field label="유형">
            <select
              value={draft.surfaceType}
              onChange={(event) =>
                onDraftSurfaceTypeChange(event.target.value as DraftSurfaceState["surfaceType"])
              }
              className={fieldClassName}
            >
              {SURFACE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {getSurfaceTypeLabel(type)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="단위">
            <select
              value={draft.unit}
              onChange={(event) =>
                onDraftUnitChange(event.target.value as DraftSurfaceState["unit"])
              }
              className={fieldClassName}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {getUnitLabel(unit)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="길이"
              value={draft.dimensions.length}
              onChange={(value) => onDraftDimensionChange("length", value)}
            />
            <NumberField
              label="높이"
              value={draft.dimensions.height}
              onChange={(value) => onDraftDimensionChange("height", value)}
            />
            <NumberField
              label="두께"
              value={draft.dimensions.thickness}
              onChange={(value) => onDraftDimensionChange("thickness", value)}
            />
          </div>

          <button
            type="button"
            onClick={onCreateSurface}
            className="w-full rounded-2xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            면 추가
          </button>
        </PanelSection>

        <PanelSection
          title="꼭짓점 추가"
          description="왼쪽, 오른쪽, 가운데 기준으로 꼭짓점을 간단하게 넣을 수 있어요."
        >
          <Field label="기준점">
            <select
              value={vertexBasePoint}
              onChange={(event) =>
                onVertexBasePointChange(event.target.value as BasePoint)
              }
              className={fieldClassName}
              disabled={!selectedSurface}
            >
              {BASE_POINTS.map((point) => (
                <option key={point} value={point}>
                  {getBasePointLabel(point)}
                </option>
              ))}
            </select>
          </Field>

          <NumberField
            label={`거리${selectedSurface ? ` (${getUnitLabel(selectedSurface.unit)})` : ""}`}
            value={vertexDistance}
            onChange={onVertexDistanceChange}
            disabled={!selectedSurface}
          />

          <button
            type="button"
            onClick={onInsertVertex}
            disabled={!selectedSurface}
            className="w-full rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 text-sm font-semibold text-ink-800 transition hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            선택한 면에 꼭짓점 추가
          </button>
        </PanelSection>

        <PanelSection
          title="면 라이브러리"
          description="선택한 면을 로컬에 저장하고 나중에 다시 불러올 수 있어요."
        >
          <Field label="저장 이름">
            <input
              value={libraryLabel}
              onChange={(event) => onLibraryLabelChange(event.target.value)}
              placeholder={selectedSurface?.name ?? "먼저 면을 선택하세요"}
              className={fieldClassName}
            />
          </Field>

          <button
            type="button"
            onClick={onSaveToLibrary}
            disabled={!selectedSurface}
            className="w-full rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 text-sm font-semibold text-ink-800 transition hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            선택한 면 저장
          </button>

          <div className="space-y-2">
            {library.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--panel-border)] px-4 py-3 text-sm text-[var(--text-muted)]">
                저장된 면이 아직 없어요.
              </p>
            ) : (
              library.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onLoadFromLibrary(item.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 text-left transition hover:border-ink-300"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">
                      {item.label}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {getSurfaceTypeLabel(item.surface.type)} · {getUnitLabel(item.surface.unit)}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-clay-700">불러오기</span>
                </button>
              ))
            )}
          </div>
        </PanelSection>

        <PanelSection
          title="개구부 만들기"
          description="두 면이 겹친 부분을 빼서 문이나 창문 같은 구멍을 만들 수 있어요."
        >
          <Field label="기준 면">
            <select
              value={cutTargetId}
              onChange={(event) => onCutTargetChange(event.target.value)}
              className={fieldClassName}
              disabled={surfaces.length < 2}
            >
              <option value="">기준 면 선택</option>
              {surfaces.map((surface) => (
                <option key={surface.id} value={surface.id}>
                  {surface.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="잘라낼 면">
            <select
              value={cutCutterId}
              onChange={(event) => onCutCutterChange(event.target.value)}
              className={fieldClassName}
              disabled={surfaces.length < 2}
            >
              <option value="">잘라낼 면 선택</option>
              {surfaces.map((surface) => (
                <option key={surface.id} value={surface.id}>
                  {surface.name}
                </option>
              ))}
            </select>
          </Field>

          <button
            type="button"
            onClick={onCutSurface}
            disabled={surfaces.length < 2 || !cutTargetId || !cutCutterId}
            className="w-full rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 text-sm font-semibold text-ink-800 transition hover:border-ink-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            겹친 부분 빼기
          </button>

          {cutFeedback ? (
            <p className="rounded-2xl bg-sand-50 px-4 py-3 text-sm text-ink-700">
              {cutFeedback}
            </p>
          ) : null}
        </PanelSection>
      </div>
    </aside>
  );
}

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-[22px] border border-[var(--panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,244,236,0.8))] p-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-ink-800">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        step="0.1"
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className={fieldClassName}
      />
    </Field>
  );
}

const fieldClassName =
  "w-full rounded-2xl border border-[var(--panel-border)] bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50";
