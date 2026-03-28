import { getSurfaceTypeLabel, getUnitLabel } from "@/lib/ui/planner-labels";
import { SURFACE_TYPES, UNITS, type Point2D, type Surface } from "@/lib/types/planner";

interface VertexRow {
  id: string;
  x: number;
  y: number;
}

interface ConnectionRow {
  connectionId: string;
  otherSurfaceName: string;
  localVertexId: string;
  otherVertexId: string;
}

interface RightPanelProps {
  selectedSurface: Surface | null;
  dimensionValues: {
    length: number;
    height: number;
    thickness: number;
  } | null;
  vertices: VertexRow[];
  connections: ConnectionRow[];
  onNameChange: (value: string) => void;
  onTypeChange: (value: Surface["type"]) => void;
  onUnitChange: (value: Surface["unit"]) => void;
  onDimensionChange: (
    field: "length" | "height" | "thickness",
    value: number,
  ) => void;
  onVertexChange: (vertexId: string, nextPoint: Point2D) => void;
  onDeleteSurface: () => void;
  onDeleteConnectedGroup: () => void;
  onDisconnectConnection: (connectionId: string) => void;
}

export function RightPanel({
  selectedSurface,
  dimensionValues,
  vertices,
  connections,
  onNameChange,
  onTypeChange,
  onUnitChange,
  onDimensionChange,
  onVertexChange,
  onDeleteSurface,
  onDeleteConnectedGroup,
  onDisconnectConnection,
}: RightPanelProps) {
  if (!selectedSurface || !dimensionValues) {
    return (
      <aside className="min-h-[320px] border border-[var(--panel-border)] bg-white/75 p-4 xl:h-full">
        <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-[var(--panel-border)] bg-white/80 p-6 text-center text-sm leading-6 text-[var(--text-muted)]">
          면을 선택하면 이름, 크기, 정점 좌표를 여기에서 바로 수정할 수 있어요.
        </div>
      </aside>
    );
  }

  return (
    <aside className="min-h-[360px] overflow-y-auto border border-[var(--panel-border)] bg-white/75 p-4 xl:h-full">
      <div className="space-y-5">
        <section className="space-y-3 rounded-[22px] border border-[var(--panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,244,236,0.8))] p-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900">
              선택한 면
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              현재 선택한 면의 기본 정보와 크기를 바로 바꿀 수 있어요.
            </p>
          </div>

          <Field label="이름">
            <input
              value={selectedSurface.name}
              onChange={(event) => onNameChange(event.target.value)}
              className={fieldClassName}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="종류">
              <select
                value={selectedSurface.type}
                onChange={(event) => onTypeChange(event.target.value as Surface["type"])}
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
                value={selectedSurface.unit}
                onChange={(event) => onUnitChange(event.target.value as Surface["unit"])}
                className={fieldClassName}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {getUnitLabel(unit)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="길이"
              value={dimensionValues.length}
              onChange={(value) => onDimensionChange("length", value)}
            />
            <NumberField
              label="높이"
              value={dimensionValues.height}
              onChange={(value) => onDimensionChange("height", value)}
            />
            <NumberField
              label="두께"
              value={dimensionValues.thickness}
              onChange={(value) => onDimensionChange("thickness", value)}
            />
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={onDeleteSurface}
              className="w-full rounded-2xl border border-[#d9b6ad] bg-[#fff4f0] px-4 py-3 text-sm font-semibold text-[#94422c] transition hover:bg-[#fee7e0]"
            >
              선택한 면 삭제
            </button>
            <button
              type="button"
              onClick={onDeleteConnectedGroup}
              className="w-full rounded-2xl border border-[#d5b4a2] bg-[#fdf1e8] px-4 py-3 text-sm font-semibold text-[#8a4a2f] transition hover:bg-[#f9e6da]"
            >
              연결된 오브젝트 전체 삭제
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-[22px] border border-[var(--panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,244,236,0.8))] p-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900">
              정점 목록
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              각 정점의 x, y 좌표를 직접 수정할 수 있어요.
            </p>
          </div>

          <div className="space-y-2">
            {vertices.map((vertex) => (
              <div
                key={vertex.id}
                className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-white p-3"
              >
                <span className="text-xs font-semibold tracking-[0.2em] text-[var(--text-muted)]">
                  {vertex.id}
                </span>
                <input
                  type="number"
                  value={Number.isFinite(vertex.x) ? vertex.x : ""}
                  step="0.1"
                  onChange={(event) =>
                    onVertexChange(vertex.id, {
                      x: Number(event.target.value),
                      y: vertex.y,
                    })
                  }
                  className={fieldClassName}
                />
                <input
                  type="number"
                  value={Number.isFinite(vertex.y) ? vertex.y : ""}
                  step="0.1"
                  onChange={(event) =>
                    onVertexChange(vertex.id, {
                      x: vertex.x,
                      y: Number(event.target.value),
                    })
                  }
                  className={fieldClassName}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-[22px] border border-[var(--panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,244,236,0.8))] p-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900">
              연결 정보
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              정점끼리 연결된 면 정보예요. 필요한 연결만 골라서 해제할 수 있어요.
            </p>
          </div>

          {connections.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--panel-border)] px-4 py-3 text-sm text-[var(--text-muted)]">
              이 면에는 아직 연결된 다른 면이 없어요.
            </p>
          ) : (
            <div className="space-y-2">
              {connections.map((connection) => (
                <div
                  key={connection.connectionId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-ink-800">
                      {connection.otherSurfaceName}와 연결됨
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {connection.localVertexId} ↔ {connection.otherVertexId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDisconnectConnection(connection.connectionId)}
                    className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs font-semibold text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
                  >
                    연결 해제
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        step="0.1"
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className={fieldClassName}
      />
    </Field>
  );
}

const fieldClassName =
  "w-full rounded-2xl border border-[var(--panel-border)] bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-ink-400";
