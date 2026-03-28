import type { SurfaceDimensions, Unit } from "@/lib/types/planner";

const INCH_TO_METER = 0.0254;

export function toMeters(value: number, unit: Unit) {
  return unit === "inch" ? value * INCH_TO_METER : value;
}

export function fromMeters(value: number, unit: Unit) {
  return unit === "inch" ? value / INCH_TO_METER : value;
}

export function convertDimensionsToMeters(
  dimensions: SurfaceDimensions,
  unit: Unit,
): SurfaceDimensions {
  return {
    length: toMeters(dimensions.length, unit),
    height: toMeters(dimensions.height, unit),
    thickness: toMeters(dimensions.thickness, unit),
  };
}

export function convertDimensionsFromMeters(
  dimensions: SurfaceDimensions,
  unit: Unit,
): SurfaceDimensions {
  return {
    length: fromMeters(dimensions.length, unit),
    height: fromMeters(dimensions.height, unit),
    thickness: fromMeters(dimensions.thickness, unit),
  };
}

export function formatMeters(value: number, unit: Unit) {
  const converted = fromMeters(value, unit);
  const digits = unit === "inch" ? 1 : 2;
  return `${converted.toFixed(digits)} ${unit === "inch" ? "in" : "m"}`;
}

export function clampPositive(value: number, fallback = 0.01) {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}
