import type { Surface, SurfaceType } from "@/lib/types/planner";

export const ROOM_SIDEBAR_TABS = [
  "floor",
  "wall",
  "ceiling",
  "furniture",
  "light",
  "character",
] as const;

export const ROOM_EDIT_MODES = ["editor", "play"] as const;
export const FURNITURE_PLACEMENT_MODES = ["floor", "wall", "both"] as const;
export const ROOM_CONNECTION_KINDS = [
  "wall-floor-edge",
  "ceiling-floor",
  "furniture-vertex",
  "light-vertex",
] as const;

export type RoomSidebarTab = (typeof ROOM_SIDEBAR_TABS)[number];
export type RoomEditMode = (typeof ROOM_EDIT_MODES)[number];
export type FurniturePlacementMode = (typeof FURNITURE_PLACEMENT_MODES)[number];
export type RoomConnectionKind = (typeof ROOM_CONNECTION_KINDS)[number];
export type RoomSelectionKind = "surface" | "furniture" | "light" | "character";
export type RoomSurfaceAssetSource = "saved" | "scene" | "default";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Size3D {
  x: number;
  y: number;
  z: number;
}

export interface RoomSurfaceAsset {
  id: string;
  label: string;
  type: SurfaceType;
  source: RoomSurfaceAssetSource;
  surface: Surface;
}

export interface RoomSurfacePlacement {
  id: string;
  assetId: string;
  label: string;
  type: SurfaceType;
  surface: Surface;
  position: Point3D;
  rotationY: number;
  scale: Size3D;
  attachedToSurfaceId: string | null;
  attachedEdgeIndex: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomFurnitureAsset {
  id: string;
  label: string;
  color: string;
  size: Size3D;
  placementMode: FurniturePlacementMode;
}

export interface RoomFurniturePlacement {
  id: string;
  assetId: string;
  label: string;
  color: string;
  size: Size3D;
  placementMode: FurniturePlacementMode;
  position: Point3D;
  rotationY: number;
  attachedSurfaceId: string | null;
  attachedVertexId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomLightPlacement {
  id: string;
  label: string;
  color: string;
  intensity: number;
  position: Point3D;
  surfaceId: string;
  vertexId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomCharacterState {
  height: number;
  width: number;
  position: Point3D;
  rotationY: number;
}

export interface RoomConnection {
  id: string;
  kind: RoomConnectionKind;
  sourceId: string;
  targetId: string;
  edgeIndex: number | null;
  sourceVertexId: string | null;
  targetVertexId: string | null;
}

export interface RoomSelection {
  kind: RoomSelectionKind | null;
  id: string | null;
}

export type RoomPlacementIntent =
  | { kind: "surface"; assetId: string; surfaceType: SurfaceType }
  | { kind: "furniture"; assetId: string }
  | { kind: "light" }
  | { kind: "character" };

export interface RoomSnapPreview {
  kind: "grid" | "surface-vertex" | "edge-anchor" | "ceiling-vertex";
  position: Point3D;
  surfaceId: string | null;
  vertexId: string | null;
  edgeIndex: number | null;
  label: string;
}
