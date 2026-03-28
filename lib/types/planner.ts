export const SURFACE_TYPES = ["wall", "floor", "ceiling"] as const;
export const UNITS = ["meter", "inch"] as const;
export const VIEW_MODES = ["2d", "3d"] as const;
export const BASE_POINTS = ["left", "right", "center"] as const;

export type SurfaceType = (typeof SURFACE_TYPES)[number];
export type Unit = (typeof UNITS)[number];
export type ViewMode = (typeof VIEW_MODES)[number];
export type BasePoint = (typeof BASE_POINTS)[number];

export interface Point2D {
  x: number;
  y: number;
}

export interface Vertex extends Point2D {
  id: string;
}

export interface SurfaceHole {
  id: string;
  vertices: Vertex[];
}

export interface SurfaceDimensions {
  length: number;
  height: number;
  thickness: number;
}

export interface Surface {
  id: string;
  name: string;
  type: SurfaceType;
  unit: Unit;
  position: Point2D;
  dimensions: SurfaceDimensions;
  vertices: Vertex[];
  holes: SurfaceHole[];
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  id: string;
  surfaceAId: string;
  vertexAId: string;
  surfaceBId: string;
  vertexBId: string;
  createdAt: string;
}

export interface SnapGuide {
  sourceSurfaceId: string;
  sourceVertexId: string;
  sourcePoint: Point2D;
  targetSurfaceId: string;
  targetVertexId: string;
  targetPoint: Point2D;
  distance: number;
}

export interface SurfaceLibraryItem {
  id: string;
  label: string;
  surface: Surface;
  savedAt: string;
}

export interface DraftSurfaceState {
  surfaceType: SurfaceType;
  unit: Unit;
  dimensions: SurfaceDimensions;
}
