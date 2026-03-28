import { plannerSnapshotSchema } from "@/lib/schemas/planner";

export type PlannerSnapshot = ReturnType<typeof plannerSnapshotSchema.parse>;

const STORAGE_KEY = "oneroom:planner:v1";

export function savePlannerSnapshot(snapshot: PlannerSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadPlannerSnapshot(): PlannerSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return plannerSnapshotSchema.parse(parsed);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
