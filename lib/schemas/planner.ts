import { z } from "zod";

import { BASE_POINTS, SURFACE_TYPES, UNITS, VIEW_MODES } from "@/lib/types/planner";

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const vertexSchema = pointSchema.extend({
  id: z.string(),
});

const surfaceHoleSchema = z.object({
  id: z.string(),
  vertices: z.array(vertexSchema),
});

const surfaceDimensionsSchema = z.object({
  length: z.number().positive(),
  height: z.number().positive(),
  thickness: z.number().positive(),
});

export const surfaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(SURFACE_TYPES),
  unit: z.enum(UNITS),
  position: pointSchema,
  dimensions: surfaceDimensionsSchema,
  vertices: z.array(vertexSchema).min(3),
  holes: z.array(surfaceHoleSchema),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const connectionSchema = z.object({
  id: z.string(),
  surfaceAId: z.string(),
  vertexAId: z.string(),
  surfaceBId: z.string(),
  vertexBId: z.string(),
  createdAt: z.string(),
});

export const snapGuideSchema = z.object({
  sourceSurfaceId: z.string(),
  sourceVertexId: z.string(),
  sourcePoint: pointSchema,
  targetSurfaceId: z.string(),
  targetVertexId: z.string(),
  targetPoint: pointSchema,
  distance: z.number(),
});

export const surfaceLibraryItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  surface: surfaceSchema,
  savedAt: z.string(),
});

export const draftSurfaceStateSchema = z.object({
  surfaceType: z.enum(SURFACE_TYPES),
  unit: z.enum(UNITS),
  dimensions: surfaceDimensionsSchema,
});

export const plannerSnapshotSchema = z.object({
  surfaces: z.array(surfaceSchema),
  connections: z.array(connectionSchema),
  selectedSurfaceId: z.string().nullable(),
  currentViewMode: z.enum(VIEW_MODES),
  snapEnabled: z.boolean(),
  scaleLinkedEnabled: z.boolean(),
  draft: draftSurfaceStateSchema,
  library: z.array(surfaceLibraryItemSchema),
  lastSavedAt: z.string().nullable(),
});

export const basePointSchema = z.enum(BASE_POINTS);
