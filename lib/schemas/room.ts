import { z } from "zod";

import { surfaceSchema } from "@/lib/schemas/planner";
import {
  FURNITURE_PLACEMENT_MODES,
  ROOM_CONNECTION_KINDS,
  ROOM_EDIT_MODES,
  ROOM_SIDEBAR_TABS,
} from "@/lib/types/room";

const point3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const size3DSchema = z.object({
  x: z.number().positive(),
  y: z.number().positive(),
  z: z.number().positive(),
});

export const roomSurfaceAssetSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: surfaceSchema.shape.type,
  source: z.enum(["saved", "scene", "default"]),
  surface: surfaceSchema,
});

export const roomSurfacePlacementSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  label: z.string(),
  type: surfaceSchema.shape.type,
  surface: surfaceSchema,
  position: point3DSchema,
  rotationY: z.number(),
  scale: size3DSchema,
  attachedToSurfaceId: z.string().nullable(),
  attachedEdgeIndex: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const roomFurnitureAssetSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  size: size3DSchema,
  placementMode: z.enum(FURNITURE_PLACEMENT_MODES),
});

export const roomFurniturePlacementSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  label: z.string(),
  color: z.string(),
  size: size3DSchema,
  placementMode: z.enum(FURNITURE_PLACEMENT_MODES),
  position: point3DSchema,
  rotationY: z.number(),
  attachedSurfaceId: z.string().nullable(),
  attachedVertexId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const roomLightPlacementSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  intensity: z.number().positive(),
  position: point3DSchema,
  surfaceId: z.string(),
  vertexId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const roomCharacterStateSchema = z.object({
  height: z.number().positive(),
  width: z.number().positive(),
  position: point3DSchema,
  rotationY: z.number(),
});

export const roomConnectionSchema = z.object({
  id: z.string(),
  kind: z.enum(ROOM_CONNECTION_KINDS),
  sourceId: z.string(),
  targetId: z.string(),
  edgeIndex: z.number().int().nullable(),
  sourceVertexId: z.string().nullable(),
  targetVertexId: z.string().nullable(),
});

export const roomSelectionSchema = z.object({
  kind: z.enum(["surface", "furniture", "light", "character"]).nullable(),
  id: z.string().nullable(),
});

export const roomPlacementIntentSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("surface"),
      assetId: z.string(),
      surfaceType: surfaceSchema.shape.type,
    }),
    z.object({
      kind: z.literal("furniture"),
      assetId: z.string(),
    }),
    z.object({
      kind: z.literal("light"),
    }),
    z.object({
      kind: z.literal("character"),
    }),
  ])
  .nullable();

export const roomSnapPreviewSchema = z.object({
  kind: z.enum(["grid", "surface-vertex", "edge-anchor", "ceiling-vertex"]),
  position: point3DSchema,
  surfaceId: z.string().nullable(),
  vertexId: z.string().nullable(),
  edgeIndex: z.number().int().nullable(),
  label: z.string(),
});

export const roomSnapshotSchema = z.object({
  placedSurfaces: z.array(roomSurfacePlacementSchema),
  furniture: z.array(roomFurniturePlacementSchema),
  lights: z.array(roomLightPlacementSchema),
  connections: z.array(roomConnectionSchema),
  selected: roomSelectionSchema,
  activeSidebarTab: z.enum(ROOM_SIDEBAR_TABS),
  activePlacementIntent: roomPlacementIntentSchema,
  snapEnabled: z.boolean(),
  editMode: z.enum(ROOM_EDIT_MODES),
  wall2DTargetId: z.string().nullable(),
  activeFloorEdgeIndex: z.number().int().nullable(),
  character: roomCharacterStateSchema,
  lastSavedAt: z.string().nullable(),
});
