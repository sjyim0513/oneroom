import type { BasePoint, SurfaceType, Unit } from "@/lib/types/planner";

const surfaceTypeLabels: Record<SurfaceType, string> = {
  wall: "벽",
  floor: "바닥",
  ceiling: "천장",
};

const unitLabels: Record<Unit, string> = {
  meter: "미터",
  inch: "인치",
};

const basePointLabels: Record<BasePoint, string> = {
  left: "왼쪽",
  right: "오른쪽",
  center: "가운데",
};

export function getSurfaceTypeLabel(value: SurfaceType) {
  return surfaceTypeLabels[value];
}

export function getUnitLabel(value: Unit) {
  return unitLabels[value];
}

export function getBasePointLabel(value: BasePoint) {
  return basePointLabels[value];
}
