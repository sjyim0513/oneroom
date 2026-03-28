import { roomSnapshotSchema } from "@/lib/schemas/room";

export type RoomSnapshot = ReturnType<typeof roomSnapshotSchema.parse>;

const STORAGE_KEY = "oneroom:room:v1";

export function saveRoomSnapshot(snapshot: RoomSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadRoomSnapshot(): RoomSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return roomSnapshotSchema.parse(JSON.parse(rawValue));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
