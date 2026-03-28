"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";

import { buildBooleanCutHole } from "@/lib/geometry/boolean-cut";
import {
  getConnectedSurfaceGroup,
  moveSurfaceGroup,
  moveSurfaceGroupFromStartPositions,
  propagateLinkedScaling,
  scaleSurfaceGeometry,
} from "@/lib/geometry/connections";
import { getAbsoluteSurfaceVertex, getBoundingBox } from "@/lib/geometry/polygon";
import {
  DEFAULT_DRAFT_DIMENSIONS,
  cloneSurfaceWithNewIds,
  createSurfaceFromDraft,
  dimensionsFromVertices,
  insertVertexAtDistance,
  normalizePlannerEntities,
  normalizeSurfaceLibraryItems,
} from "@/lib/geometry/surface";
import { findSnapGuideForSurfaceGroup } from "@/lib/geometry/snap";
import type { PlannerSnapshot } from "@/lib/storage/planner-storage";
import {
  loadPlannerSnapshot,
  savePlannerSnapshot,
} from "@/lib/storage/planner-storage";
import {
  convertDimensionsFromMeters,
  convertDimensionsToMeters,
  fromMeters,
  toMeters,
} from "@/lib/geometry/units";
import type {
  BasePoint,
  Connection,
  DraftSurfaceState,
  Point2D,
  SnapGuide,
  Surface,
  SurfaceDimensions,
  SurfaceLibraryItem,
  SurfaceType,
  Unit,
  ViewMode,
} from "@/lib/types/planner";

const MAX_HISTORY_ENTRIES = 80;

interface SceneHistorySnapshot {
  surfaces: Surface[];
  connections: Connection[];
  selectedSurfaceId: string | null;
}

interface MoveSession {
  surfaceId: string;
  groupIds: string[];
  startPositions: Record<string, Point2D>;
  beforeSnapshot: SceneHistorySnapshot;
}

interface VertexMoveSession {
  surfaceId: string;
  vertexId: string;
  beforeSnapshot: SceneHistorySnapshot;
}

interface PlannerState {
  surfaces: Surface[];
  connections: Connection[];
  selectedSurfaceId: string | null;
  currentViewMode: ViewMode;
  snapEnabled: boolean;
  scaleLinkedEnabled: boolean;
  activeSnapGuide: SnapGuide | null;
  draft: DraftSurfaceState;
  library: SurfaceLibraryItem[];
  lastSavedAt: string | null;
  initialized: boolean;
  moveSession: MoveSession | null;
  vertexMoveSession: VertexMoveSession | null;
  historyPast: SceneHistorySnapshot[];
  historyFuture: SceneHistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  initialize: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSnap: () => void;
  toggleScaleLinked: () => void;
  selectSurface: (surfaceId: string | null) => void;
  setDraftSurfaceType: (surfaceType: SurfaceType) => void;
  setDraftUnit: (unit: Unit) => void;
  setDraftDimensions: (dimensions: Partial<SurfaceDimensions>) => void;
  createSurface: () => void;
  beginSurfaceMove: (surfaceId: string) => void;
  previewSurfaceMove: (surfaceId: string, nextPosition: Point2D) => void;
  finalizeSurfaceMove: (surfaceId: string) => void;
  updateSurfaceMeta: (
    surfaceId: string,
    patch: Partial<Pick<Surface, "name" | "type" | "unit">>,
  ) => void;
  resizeSurface: (
    surfaceId: string,
    dimensions: SurfaceDimensions,
    unit?: Unit,
  ) => void;
  beginVertexMove: (surfaceId: string, vertexId: string) => void;
  previewSurfaceVertex: (
    surfaceId: string,
    vertexId: string,
    nextPoint: Point2D,
  ) => void;
  finalizeVertexMove: () => void;
  updateSurfaceVertex: (
    surfaceId: string,
    vertexId: string,
    nextPoint: Point2D,
  ) => void;
  insertVertex: (surfaceId: string, basePoint: BasePoint, distance: number) => void;
  saveSelectedSurfaceToLibrary: (label?: string) => void;
  loadSurfaceFromLibrary: (libraryItemId: string) => void;
  deleteSurface: (surfaceId: string) => void;
  removeConnection: (connectionId: string) => void;
  cutSurface: (targetSurfaceId: string, cutterSurfaceId: string) => boolean;
  undo: () => void;
  redo: () => void;
  saveScene: () => void;
  loadScene: () => void;
}

const initialDraft: DraftSurfaceState = {
  surfaceType: "wall",
  unit: "meter",
  dimensions: DEFAULT_DRAFT_DIMENSIONS,
};

export const usePlannerStore = create<PlannerState>((set, get) => ({
  surfaces: [],
  connections: [],
  selectedSurfaceId: null,
  currentViewMode: "2d",
  snapEnabled: true,
  scaleLinkedEnabled: true,
  activeSnapGuide: null,
  draft: initialDraft,
  library: [],
  lastSavedAt: null,
  initialized: false,
  moveSession: null,
  vertexMoveSession: null,
  historyPast: [],
  historyFuture: [],
  canUndo: false,
  canRedo: false,

  initialize: () => {
    if (get().initialized) {
      return;
    }

    const snapshot = loadPlannerSnapshot();

    if (!snapshot) {
      set({ initialized: true });
      return;
    }

    set({
      ...hydrateSnapshot(snapshot),
      initialized: true,
      activeSnapGuide: null,
      moveSession: null,
      vertexMoveSession: null,
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
    });
  },

  setViewMode: (mode) => {
    set({ currentViewMode: mode });
    persistCurrentScene(get());
  },

  toggleSnap: () => {
    set((state) => ({
      snapEnabled: !state.snapEnabled,
      activeSnapGuide: state.snapEnabled ? null : state.activeSnapGuide,
    }));
    persistCurrentScene(get());
  },

  toggleScaleLinked: () => {
    set((state) => ({ scaleLinkedEnabled: !state.scaleLinkedEnabled }));
    persistCurrentScene(get());
  },

  selectSurface: (surfaceId) => {
    set({ selectedSurfaceId: surfaceId });
    persistCurrentScene(get());
  },

  setDraftSurfaceType: (surfaceType) => {
    set((state) => ({
      draft: {
        ...state.draft,
        surfaceType,
      },
    }));
    persistCurrentScene(get());
  },

  setDraftUnit: (unit) => {
    set((state) => ({
      draft: {
        ...state.draft,
        unit,
        dimensions: convertDimensionsFromMeters(
          convertDimensionsToMeters(state.draft.dimensions, state.draft.unit),
          unit,
        ),
      },
    }));
    persistCurrentScene(get());
  },

  setDraftDimensions: (dimensions) => {
    set((state) => ({
      draft: {
        ...state.draft,
        dimensions: {
          ...state.draft.dimensions,
          ...dimensions,
        },
      },
    }));
    persistCurrentScene(get());
  },

  createSurface: () => {
    const state = get();
    const previousSnapshot = createSceneHistorySnapshot(state);
    const nextSurface = createSurfaceFromDraft(state.draft, state.surfaces.length);
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: [...state.surfaces, nextSurface],
      connections: state.connections,
      selectedSurfaceId: nextSurface.id,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  beginSurfaceMove: (surfaceId) => {
    set((state) => ({
      moveSession: createMoveSession(surfaceId, state),
      selectedSurfaceId: surfaceId,
      activeSnapGuide: null,
    }));
  },

  previewSurfaceMove: (surfaceId, nextPosition) => {
    set((state) => {
      const moveSession =
        state.moveSession?.surfaceId === surfaceId
          ? state.moveSession
          : createMoveSession(surfaceId, state);

      if (!moveSession) {
        return {
          selectedSurfaceId: surfaceId,
          activeSnapGuide: null,
          moveSession: null,
        };
      }

      const startPosition = moveSession.startPositions[surfaceId];

      if (!startPosition) {
        return {
          selectedSurfaceId: surfaceId,
          activeSnapGuide: null,
          moveSession,
        };
      }

      const delta = {
        x: nextPosition.x - startPosition.x,
        y: nextPosition.y - startPosition.y,
      };

      const nextSurfaces = moveSurfaceGroupFromStartPositions(
        state.surfaces,
        moveSession.groupIds,
        moveSession.startPositions,
        delta,
      );

      return {
        surfaces: nextSurfaces,
        activeSnapGuide: state.snapEnabled
          ? findSnapGuideForSurfaceGroup(
              moveSession.groupIds,
              nextSurfaces,
              undefined,
              moveSession.groupIds,
            )
          : null,
        selectedSurfaceId: surfaceId,
        moveSession,
      };
    });
  },

  finalizeSurfaceMove: (surfaceId) => {
    const state = get();
    const moveSession =
      state.moveSession?.surfaceId === surfaceId
        ? state.moveSession
        : createMoveSession(surfaceId, state);

    if (!moveSession) {
      set({ activeSnapGuide: null, moveSession: null });
      persistCurrentScene(get());
      return;
    }

    const guide =
      state.activeSnapGuide &&
      moveSession.groupIds.includes(state.activeSnapGuide.sourceSurfaceId)
        ? state.activeSnapGuide
        : null;

    const nextSurfaces = guide
      ? moveSurfaceGroup(state.surfaces, moveSession.groupIds, {
          x: guide.targetPoint.x - guide.sourcePoint.x,
          y: guide.targetPoint.y - guide.sourcePoint.y,
        })
      : state.surfaces;

    const hasConnection = guide
      ? state.connections.some(
          (connection) =>
            (connection.surfaceAId === guide.sourceSurfaceId &&
              connection.vertexAId === guide.sourceVertexId &&
              connection.surfaceBId === guide.targetSurfaceId &&
              connection.vertexBId === guide.targetVertexId) ||
            (connection.surfaceAId === guide.targetSurfaceId &&
              connection.vertexAId === guide.targetVertexId &&
              connection.surfaceBId === guide.sourceSurfaceId &&
              connection.vertexBId === guide.sourceVertexId),
        )
      : true;

    const nextConnections =
      guide && !hasConnection
        ? [
            ...state.connections,
            {
              id: uuid(),
              surfaceAId: guide.sourceSurfaceId,
              vertexAId: guide.sourceVertexId,
              surfaceBId: guide.targetSurfaceId,
              vertexBId: guide.targetVertexId,
              createdAt: new Date().toISOString(),
            },
          ]
        : state.connections;

    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: nextSurfaces,
      connections: nextConnections,
      selectedSurfaceId: surfaceId,
    });

    set((currentState) =>
      commitSceneSnapshot(currentState, moveSession.beforeSnapshot, nextSnapshot),
    );
    persistCurrentScene(get());
  },

  updateSurfaceMeta: (surfaceId, patch) => {
    const state = get();
    const previousSnapshot = createSceneHistorySnapshot(state);
    const nextSurfaces = state.surfaces.map((surface) =>
      surface.id === surfaceId
        ? {
            ...surface,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : surface,
    );
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: nextSurfaces,
      connections: state.connections,
      selectedSurfaceId: state.selectedSurfaceId,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  resizeSurface: (surfaceId, dimensions, unit) => {
    const state = get();
    const target = state.surfaces.find((surface) => surface.id === surfaceId);

    if (!target) {
      return;
    }

    const previousSnapshot = createSceneHistorySnapshot(state);
    const resolvedUnit = unit ?? target.unit;
    const nextDimensionsMeters = convertDimensionsToMeters(dimensions, resolvedUnit);
    const scaleX =
      nextDimensionsMeters.length / Math.max(target.dimensions.length, 0.001);
    const scaleY =
      nextDimensionsMeters.height / Math.max(target.dimensions.height, 0.001);
    const resizedTarget = {
      ...scaleSurfaceGeometry(
        {
          ...target,
          unit: resolvedUnit,
        },
        scaleX,
        scaleY,
        nextDimensionsMeters.thickness,
      ),
      unit: resolvedUnit,
      dimensions: nextDimensionsMeters,
      updatedAt: new Date().toISOString(),
    };

    let nextSurfaces = state.surfaces.map((surface) =>
      surface.id === surfaceId ? resizedTarget : surface,
    );

    if (state.scaleLinkedEnabled) {
      nextSurfaces = propagateLinkedScaling(
        nextSurfaces,
        state.connections,
        surfaceId,
        scaleX,
        scaleY,
      );
    }

    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: nextSurfaces,
      connections: state.connections,
      selectedSurfaceId: state.selectedSurfaceId,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  beginVertexMove: (surfaceId, vertexId) => {
    set((state) => ({
      vertexMoveSession: {
        surfaceId,
        vertexId,
        beforeSnapshot: createSceneHistorySnapshot(state),
      },
      selectedSurfaceId: surfaceId,
    }));
  },

  previewSurfaceVertex: (surfaceId, vertexId, nextPoint) => {
    set((state) => ({
      surfaces: updateVertexInSurfaces(state.surfaces, surfaceId, vertexId, nextPoint),
      selectedSurfaceId: surfaceId,
    }));
  },

  finalizeVertexMove: () => {
    const state = get();

    if (!state.vertexMoveSession) {
      return;
    }

    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: state.surfaces,
      connections: state.connections,
      selectedSurfaceId: state.selectedSurfaceId,
    });

    set((currentState) =>
      commitSceneSnapshot(
        currentState,
        state.vertexMoveSession!.beforeSnapshot,
        nextSnapshot,
      ),
    );
    persistCurrentScene(get());
  },

  updateSurfaceVertex: (surfaceId, vertexId, nextPoint) => {
    const state = get();
    const previousSnapshot = createSceneHistorySnapshot(state);
    const nextSurfaces = updateVertexInSurfaces(
      state.surfaces,
      surfaceId,
      vertexId,
      nextPoint,
    );
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: nextSurfaces,
      connections: state.connections,
      selectedSurfaceId: surfaceId,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  insertVertex: (surfaceId, basePoint, distance) => {
    const state = get();
    const surface = state.surfaces.find((item) => item.id === surfaceId);

    if (!surface) {
      return;
    }

    const previousSnapshot = createSceneHistorySnapshot(state);
    const distanceInMeters = toMeters(distance, surface.unit);
    const nextSurfaces = state.surfaces.map((item) => {
      if (item.id !== surfaceId) {
        return item;
      }

      const nextVertices = insertVertexAtDistance(
        item.vertices,
        basePoint,
        distanceInMeters,
      );

      return {
        ...item,
        vertices: nextVertices,
        dimensions: dimensionsFromVertices(nextVertices, item.dimensions.thickness),
        updatedAt: new Date().toISOString(),
      };
    });
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: nextSurfaces,
      connections: state.connections,
      selectedSurfaceId: surfaceId,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  saveSelectedSurfaceToLibrary: (label) => {
    const state = get();
    const surface = state.surfaces.find(
      (item) => item.id === state.selectedSurfaceId,
    );

    if (!surface) {
      return;
    }

    const nextItem: SurfaceLibraryItem = {
      id: uuid(),
      label: label?.trim() || surface.name,
      surface: JSON.parse(JSON.stringify(surface)) as Surface,
      savedAt: new Date().toISOString(),
    };

    set({
      library: [nextItem, ...state.library],
      lastSavedAt: new Date().toISOString(),
    });
    persistCurrentScene(get());
  },

  loadSurfaceFromLibrary: (libraryItemId) => {
    const state = get();
    const item = state.library.find((entry) => entry.id === libraryItemId);

    if (!item) {
      return;
    }

    const previousSnapshot = createSceneHistorySnapshot(state);
    const nextSurface = cloneSurfaceWithNewIds(
      item.surface,
      { x: 0.45, y: 0.45 },
      state.surfaces.length,
    );
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: [...state.surfaces, nextSurface],
      connections: state.connections,
      selectedSurfaceId: nextSurface.id,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  deleteSurface: (surfaceId) => {
    const state = get();
    const previousSnapshot = createSceneHistorySnapshot(state);
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: state.surfaces.filter((surface) => surface.id !== surfaceId),
      connections: state.connections.filter(
        (connection) =>
          connection.surfaceAId !== surfaceId && connection.surfaceBId !== surfaceId,
      ),
      selectedSurfaceId:
        state.selectedSurfaceId === surfaceId ? null : state.selectedSurfaceId,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  removeConnection: (connectionId) => {
    const state = get();
    const previousSnapshot = createSceneHistorySnapshot(state);
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: state.surfaces,
      connections: state.connections.filter(
        (connection) => connection.id !== connectionId,
      ),
      selectedSurfaceId: state.selectedSurfaceId,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
  },

  cutSurface: (targetSurfaceId, cutterSurfaceId) => {
    const state = get();
    const target = state.surfaces.find((surface) => surface.id === targetSurfaceId);
    const cutter = state.surfaces.find((surface) => surface.id === cutterSurfaceId);

    if (!target || !cutter || targetSurfaceId === cutterSurfaceId) {
      return false;
    }

    const holeVertices = buildBooleanCutHole(target, cutter);

    if (!holeVertices) {
      return false;
    }

    const previousSnapshot = createSceneHistorySnapshot(state);
    const nextSnapshot = createSceneHistorySnapshot({
      surfaces: state.surfaces.map((surface) =>
        surface.id === targetSurfaceId
          ? {
              ...surface,
              holes: [
                ...surface.holes,
                {
                  id: uuid(),
                  vertices: holeVertices,
                },
              ],
              updatedAt: new Date().toISOString(),
            }
          : surface,
      ),
      connections: state.connections,
      selectedSurfaceId: targetSurfaceId,
    });

    set((currentState) => commitSceneSnapshot(currentState, previousSnapshot, nextSnapshot));
    persistCurrentScene(get());
    return true;
  },

  undo: () => {
    set((state) => {
      if (state.historyPast.length === 0) {
        return state;
      }

      const previousSnapshot = state.historyPast[state.historyPast.length - 1];
      const currentSnapshot = createSceneHistorySnapshot(state);
      const historyPast = state.historyPast.slice(0, -1);
      const historyFuture = [currentSnapshot, ...state.historyFuture];

      return {
        ...restoreSceneSnapshot(previousSnapshot),
        ...getHistoryState(historyPast, historyFuture),
        activeSnapGuide: null,
        moveSession: null,
        vertexMoveSession: null,
      };
    });
    persistCurrentScene(get());
  },

  redo: () => {
    set((state) => {
      if (state.historyFuture.length === 0) {
        return state;
      }

      const nextSnapshot = state.historyFuture[0];
      const currentSnapshot = createSceneHistorySnapshot(state);
      const historyPast = trimHistory([...state.historyPast, currentSnapshot]);
      const historyFuture = state.historyFuture.slice(1);

      return {
        ...restoreSceneSnapshot(nextSnapshot),
        ...getHistoryState(historyPast, historyFuture),
        activeSnapGuide: null,
        moveSession: null,
        vertexMoveSession: null,
      };
    });
    persistCurrentScene(get());
  },

  saveScene: () => {
    const now = new Date().toISOString();
    set({ lastSavedAt: now });
    persistCurrentScene({
      ...get(),
      lastSavedAt: now,
    });
  },

  loadScene: () => {
    const snapshot = loadPlannerSnapshot();

    if (!snapshot) {
      return;
    }

    set({
      ...hydrateSnapshot(snapshot),
      activeSnapGuide: null,
      moveSession: null,
      vertexMoveSession: null,
      initialized: true,
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
    });
  },
}));

function createMoveSession(surfaceId: string, state: PlannerState): MoveSession | null {
  const sourceSurface = state.surfaces.find((surface) => surface.id === surfaceId);

  if (!sourceSurface) {
    return null;
  }

  const groupIds = getConnectedSurfaceGroup(surfaceId, state.connections);
  const startPositions = Object.fromEntries(
    state.surfaces
      .filter((surface) => groupIds.includes(surface.id))
      .map((surface) => [
        surface.id,
        {
          x: surface.position.x,
          y: surface.position.y,
        },
      ]),
  );

  return {
    surfaceId,
    groupIds,
    startPositions,
    beforeSnapshot: createSceneHistorySnapshot(state),
  };
}

function updateVertexInSurfaces(
  surfaces: Surface[],
  surfaceId: string,
  vertexId: string,
  nextPoint: Point2D,
) {
  return surfaces.map((surface) => {
    if (surface.id !== surfaceId) {
      return surface;
    }

    const nextVertices = surface.vertices.map((vertex) =>
      vertex.id === vertexId
        ? {
            ...vertex,
            x: nextPoint.x,
            y: nextPoint.y,
          }
        : vertex,
    );

    return {
      ...surface,
      vertices: nextVertices,
      dimensions: dimensionsFromVertices(nextVertices, surface.dimensions.thickness),
      updatedAt: new Date().toISOString(),
    };
  });
}

function hydrateSnapshot(snapshot: PlannerSnapshot) {
  const normalizedScene = normalizePlannerEntities(
    snapshot.surfaces,
    snapshot.connections,
  );

  return {
    surfaces: normalizedScene.surfaces,
    connections: normalizedScene.connections,
    selectedSurfaceId: snapshot.selectedSurfaceId,
    currentViewMode: snapshot.currentViewMode,
    snapEnabled: snapshot.snapEnabled,
    scaleLinkedEnabled: snapshot.scaleLinkedEnabled,
    draft: snapshot.draft,
    library: normalizeSurfaceLibraryItems(snapshot.library),
    lastSavedAt: snapshot.lastSavedAt,
  };
}

function createSceneHistorySnapshot(source: {
  surfaces: Surface[];
  connections: Connection[];
  selectedSurfaceId: string | null;
}): SceneHistorySnapshot {
  return JSON.parse(
    JSON.stringify({
      surfaces: source.surfaces,
      connections: source.connections,
      selectedSurfaceId: source.selectedSurfaceId,
    }),
  ) as SceneHistorySnapshot;
}

function restoreSceneSnapshot(snapshot: SceneHistorySnapshot) {
  return {
    surfaces: snapshot.surfaces,
    connections: snapshot.connections,
    selectedSurfaceId: snapshot.selectedSurfaceId,
  };
}

function areSceneSnapshotsEqual(
  previousSnapshot: SceneHistorySnapshot,
  nextSnapshot: SceneHistorySnapshot,
) {
  return JSON.stringify(previousSnapshot) === JSON.stringify(nextSnapshot);
}

function trimHistory(history: SceneHistorySnapshot[]) {
  return history.slice(-MAX_HISTORY_ENTRIES);
}

function getHistoryState(
  historyPast: SceneHistorySnapshot[],
  historyFuture: SceneHistorySnapshot[],
) {
  return {
    historyPast,
    historyFuture,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
  };
}

function commitSceneSnapshot(
  state: PlannerState,
  previousSnapshot: SceneHistorySnapshot,
  nextSnapshot: SceneHistorySnapshot,
) {
  if (areSceneSnapshotsEqual(previousSnapshot, nextSnapshot)) {
    return {
      ...restoreSceneSnapshot(nextSnapshot),
      activeSnapGuide: null,
      moveSession: null,
      vertexMoveSession: null,
    };
  }

  const historyPast = trimHistory([...state.historyPast, previousSnapshot]);
  const historyFuture: SceneHistorySnapshot[] = [];

  return {
    ...restoreSceneSnapshot(nextSnapshot),
    ...getHistoryState(historyPast, historyFuture),
    activeSnapGuide: null,
    moveSession: null,
    vertexMoveSession: null,
  };
}

function persistCurrentScene(state: PlannerState) {
  savePlannerSnapshot({
    surfaces: state.surfaces,
    connections: state.connections,
    selectedSurfaceId: state.selectedSurfaceId,
    currentViewMode: state.currentViewMode,
    snapEnabled: state.snapEnabled,
    scaleLinkedEnabled: state.scaleLinkedEnabled,
    draft: state.draft,
    library: state.library,
    lastSavedAt: state.lastSavedAt,
  });
}

export function getSurfaceDisplayDimensions(surface: Surface) {
  return convertDimensionsFromMeters(surface.dimensions, surface.unit);
}

export function getSurfaceVertexDisplayPoint(
  surface: Surface,
  point: Point2D,
): Point2D {
  return {
    x: fromMeters(point.x, surface.unit),
    y: fromMeters(point.y, surface.unit),
  };
}

export function toSurfaceLocalPoint(
  surface: Surface,
  point: Point2D,
): Point2D {
  return {
    x: toMeters(point.x, surface.unit),
    y: toMeters(point.y, surface.unit),
  };
}

export function getConnectionSummary(
  surfaceId: string,
  surfaces: Surface[],
  connections: Connection[],
) {
  return connections
    .filter(
      (connection) =>
        connection.surfaceAId === surfaceId || connection.surfaceBId === surfaceId,
    )
    .map((connection) => {
      const otherSurfaceId =
        connection.surfaceAId === surfaceId
          ? connection.surfaceBId
          : connection.surfaceAId;
      const otherSurface = surfaces.find((surface) => surface.id === otherSurfaceId);

      return {
        connectionId: connection.id,
        otherSurfaceId,
        otherSurfaceName: otherSurface?.name ?? "이름 없는 면",
        localVertexId:
          connection.surfaceAId === surfaceId ? connection.vertexAId : connection.vertexBId,
        otherVertexId:
          connection.surfaceAId === surfaceId ? connection.vertexBId : connection.vertexAId,
      };
    });
}

export function getSurfaceLocalBounds(surface: Surface) {
  return getBoundingBox(surface.vertices);
}

export function getConnectedVertexTarget(
  surfaceId: string,
  connections: Connection[],
  surfaces: Surface[],
) {
  const connection = connections.find(
    (entry) => entry.surfaceAId === surfaceId || entry.surfaceBId === surfaceId,
  );

  if (!connection) {
    return null;
  }

  const otherSurfaceId =
    connection.surfaceAId === surfaceId ? connection.surfaceBId : connection.surfaceAId;
  const otherVertexId =
    connection.surfaceAId === surfaceId ? connection.vertexBId : connection.vertexAId;
  const otherSurface = surfaces.find((surface) => surface.id === otherSurfaceId);

  if (!otherSurface) {
    return null;
  }

  return getAbsoluteSurfaceVertex(otherSurface, otherVertexId);
}
