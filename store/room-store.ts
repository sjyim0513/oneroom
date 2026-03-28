"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";

import {
  DEFAULT_FURNITURE_ASSETS,
  collectRoomSurfaceAssets,
  createFurniturePlacement,
  createSurfacePlacementFromAsset,
  getCeilingPlacementFromFloor,
  getFloorEdgeAnchors,
  getNearestSnapPreview,
  getPlacementModeLabel,
  getSuggestedCeilingHeight,
  getSurfaceSizeDisplay,
  getSurfaceTypeLabelForRoom,
  getSurfaceVertexWorldPoint,
  getSurfaceWorldVertices,
  getVertexSnapCandidates,
  snapPointToGrid,
} from "@/lib/geometry/room";
import { roomSnapshotSchema } from "@/lib/schemas/room";
import { loadPlannerSnapshot } from "@/lib/storage/planner-storage";
import { loadRoomSnapshot, saveRoomSnapshot } from "@/lib/storage/room-storage";
import type { SurfaceType } from "@/lib/types/planner";
import type {
  Point3D,
  RoomCharacterState,
  RoomConnection,
  RoomEditMode,
  RoomFurnitureAsset,
  RoomFurniturePlacement,
  RoomPlacementIntent,
  RoomSelection,
  RoomSidebarTab,
  RoomSnapPreview,
  RoomSurfaceAsset,
  RoomSurfacePlacement,
} from "@/lib/types/room";

interface RoomStoreState {
  initialized: boolean;
  availableSurfaceAssets: RoomSurfaceAsset[];
  furnitureCatalog: RoomFurnitureAsset[];
  placedSurfaces: RoomSurfacePlacement[];
  furniture: RoomFurniturePlacement[];
  lights: RoomStoreLight[];
  connections: RoomConnection[];
  selected: RoomSelection;
  activeSidebarTab: RoomSidebarTab;
  activePlacementIntent: RoomPlacementIntent | null;
  snapEnabled: boolean;
  editMode: RoomEditMode;
  wall2DTargetId: string | null;
  activeFloorEdgeIndex: number | null;
  snapPreview: RoomSnapPreview | null;
  character: RoomCharacterState;
  lastSavedAt: string | null;
  statusMessage: string | null;
  initialize: () => void;
  setSidebarTab: (tab: RoomSidebarTab) => void;
  toggleSnap: () => void;
  setEditMode: (mode: RoomEditMode) => void;
  setPlacementIntent: (intent: RoomPlacementIntent | null) => void;
  setSnapPreview: (preview: RoomSnapPreview | null) => void;
  setStatusMessage: (message: string | null) => void;
  selectSurface: (surfaceId: string | null) => void;
  selectFurniture: (furnitureId: string | null) => void;
  selectLight: (lightId: string | null) => void;
  selectCharacter: () => void;
  setActiveFloorEdgeIndex: (edgeIndex: number | null) => void;
  openWall2D: (surfaceId: string) => void;
  closeWall2D: () => void;
  placeFloorAsset: (assetId: string, point: Point3D) => void;
  placeWallAsset: (assetId: string, floorId: string, edgeIndex: number) => void;
  placeCeilingAsset: (assetId: string, floorId: string) => void;
  placeFurnitureAsset: (
    assetId: string,
    point: Point3D,
    snapPreview?: RoomSnapPreview | null,
  ) => void;
  placeWallFurnitureAsset: (
    assetId: string,
    wallId: string,
    vertexId: string,
  ) => void;
  placeLightOnVertex: (surfaceId: string, vertexId: string) => void;
  placeCharacter: (point: Point3D) => void;
  updateFurniturePosition: (axis: "x" | "y" | "z", value: number) => void;
  updateFurnitureSize: (axis: "x" | "y" | "z", value: number) => void;
  updateCharacterConfig: (
    patch: Partial<Pick<RoomCharacterState, "height" | "width">>,
  ) => void;
  syncCharacterPosition: (position: Point3D, rotationY?: number) => void;
  deleteSelected: () => void;
  saveRoom: () => void;
  loadRoom: () => void;
  downloadRoom: () => void;
}

interface RoomStoreLight {
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

const defaultCharacter: RoomCharacterState = {
  height: 1.72,
  width: 0.42,
  position: { x: 0, y: 0, z: 0 },
  rotationY: 0,
};

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  initialized: false,
  availableSurfaceAssets: [],
  furnitureCatalog: DEFAULT_FURNITURE_ASSETS,
  placedSurfaces: [],
  furniture: [],
  lights: [],
  connections: [],
  selected: { kind: null, id: null },
  activeSidebarTab: "floor",
  activePlacementIntent: null,
  snapEnabled: true,
  editMode: "editor",
  wall2DTargetId: null,
  activeFloorEdgeIndex: null,
  snapPreview: null,
  character: defaultCharacter,
  lastSavedAt: null,
  statusMessage: null,

  initialize: () => {
    if (get().initialized) {
      return;
    }

    const plannerSnapshot = loadPlannerSnapshot();
    const roomSnapshot = loadRoomSnapshot();
    const availableSurfaceAssets = collectRoomSurfaceAssets(plannerSnapshot);

    set({
      ...getInitialRoomState(availableSurfaceAssets, roomSnapshot),
      initialized: true,
    });
  },

  setSidebarTab: (tab) => {
    set({ activeSidebarTab: tab });
  },

  toggleSnap: () => {
    set((state) => ({
      snapEnabled: !state.snapEnabled,
      snapPreview: state.snapEnabled ? null : state.snapPreview,
    }));
  },

  setEditMode: (mode) => {
    set({
      editMode: mode,
      statusMessage:
        mode === "play"
          ? "플레이 모드로 전환했어요. 장면을 클릭한 뒤 WASD로 이동해 보세요."
          : "편집 모드로 돌아왔어요.",
    });
  },

  setPlacementIntent: (intent) => {
    set({
      activePlacementIntent: intent,
      snapPreview: null,
      statusMessage: intent ? getIntentMessage(intent) : null,
    });
  },

  setSnapPreview: (preview) => {
    set({ snapPreview: preview });
  },

  setStatusMessage: (message) => {
    set({ statusMessage: message });
  },

  selectSurface: (surfaceId) => {
    const surface = get().placedSurfaces.find((item) => item.id === surfaceId) ?? null;

    set({
      selected: surfaceId ? { kind: "surface", id: surfaceId } : { kind: null, id: null },
      wall2DTargetId: surface?.type === "wall" ? surface.id : get().wall2DTargetId,
      activeFloorEdgeIndex:
        surface?.type === "floor" ? get().activeFloorEdgeIndex ?? 0 : get().activeFloorEdgeIndex,
    });
  },

  selectFurniture: (furnitureId) => {
    set({
      selected: furnitureId
        ? { kind: "furniture", id: furnitureId }
        : { kind: null, id: null },
    });
  },

  selectLight: (lightId) => {
    set({
      selected: lightId ? { kind: "light", id: lightId } : { kind: null, id: null },
    });
  },

  selectCharacter: () => {
    set({
      selected: { kind: "character", id: "character" },
    });
  },

  setActiveFloorEdgeIndex: (edgeIndex) => {
    set({ activeFloorEdgeIndex: edgeIndex });
  },

  openWall2D: (surfaceId) => {
    const surface = get().placedSurfaces.find((item) => item.id === surfaceId);

    if (!surface || surface.type !== "wall") {
      return;
    }

    set({
      wall2DTargetId: surfaceId,
      selected: { kind: "surface", id: surfaceId },
      statusMessage: "벽 2D 보기에서 정점 기준으로 가구를 놓을 수 있어요.",
    });
  },

  closeWall2D: () => {
    set({
      wall2DTargetId: null,
      statusMessage: "벽 2D 보기를 닫았어요.",
    });
  },

  placeFloorAsset: (assetId, point) => {
    const asset = getSurfaceAsset(get().availableSurfaceAssets, assetId, "floor");

    if (!asset) {
      set({ statusMessage: "바닥 자산을 찾지 못했어요." });
      return;
    }

    const snappedPoint = snapPointToGrid({ ...point, y: 0 });
    const nextSurface = createSurfacePlacementFromAsset(asset, {
      position: snappedPoint,
    });

    set((state) => ({
      placedSurfaces: [...state.placedSurfaces, nextSurface],
      selected: { kind: "surface", id: nextSurface.id },
      activePlacementIntent: null,
      activeFloorEdgeIndex: 0,
      snapPreview: null,
      statusMessage: "바닥을 배치했어요. 이제 벽을 붙여 보세요.",
    }));
  },

  placeWallAsset: (assetId, floorId, edgeIndex) => {
    const state = get();
    const asset = getSurfaceAsset(state.availableSurfaceAssets, assetId, "wall");
    const floor = state.placedSurfaces.find(
      (item) => item.id === floorId && item.type === "floor",
    );

    if (!asset || !floor) {
      set({ statusMessage: "벽을 붙일 바닥을 먼저 선택해 주세요." });
      return;
    }

    const edge = getFloorEdgeAnchors(floor)[edgeIndex];

    if (!edge) {
      set({ statusMessage: "선택한 바닥 모서리를 찾지 못했어요." });
      return;
    }

    const nextSurface = getWallPlacementFromEdge(asset, floor, edge);
    const nextConnection: RoomConnection = {
      id: uuid(),
      kind: "wall-floor-edge",
      sourceId: nextSurface.id,
      targetId: floor.id,
      edgeIndex,
      sourceVertexId: null,
      targetVertexId: null,
    };

    set((currentState) => ({
      placedSurfaces: [...currentState.placedSurfaces, nextSurface],
      connections: [...currentState.connections, nextConnection],
      selected: { kind: "surface", id: nextSurface.id },
      activePlacementIntent: null,
      wall2DTargetId: nextSurface.id,
      snapPreview: null,
      statusMessage: "벽을 붙였어요. 벽 2D 보기에서 정점 기준 가구도 배치할 수 있어요.",
    }));
  },

  placeCeilingAsset: (assetId, floorId) => {
    const state = get();
    const asset = getSurfaceAsset(state.availableSurfaceAssets, assetId, "ceiling");
    const floor = state.placedSurfaces.find(
      (item) => item.id === floorId && item.type === "floor",
    );

    if (!asset || !floor) {
      set({ statusMessage: "천장을 맞출 바닥을 먼저 선택해 주세요." });
      return;
    }

    const ceilingHeight = getSuggestedCeilingHeight(floor.id, state.placedSurfaces);
    const nextSurface = getCeilingPlacementFromFloor(asset, floor, ceilingHeight);
    const nextConnection: RoomConnection = {
      id: uuid(),
      kind: "ceiling-floor",
      sourceId: nextSurface.id,
      targetId: floor.id,
      edgeIndex: null,
      sourceVertexId: null,
      targetVertexId: null,
    };

    set((currentState) => ({
      placedSurfaces: [...currentState.placedSurfaces, nextSurface],
      connections: [...currentState.connections, nextConnection],
      selected: { kind: "surface", id: nextSurface.id },
      activePlacementIntent: null,
      snapPreview: null,
      statusMessage: "천장을 추가했어요. 천장 정점에는 조명을 놓을 수 있어요.",
    }));
  },

  placeFurnitureAsset: (assetId, point, snapPreview) => {
    const state = get();
    const asset = state.furnitureCatalog.find((item) => item.id === assetId);

    if (!asset) {
      set({ statusMessage: "가구 자산을 찾지 못했어요." });
      return;
    }

    if (asset.placementMode === "wall") {
      set({ statusMessage: "이 가구는 벽 2D 보기에서 정점에 맞춰 배치해 주세요." });
      return;
    }

    const nextPoint = snapPreview?.position ?? snapPointToGrid(point);
    const nextFurniture = createFurniturePlacement(asset, {
      position: {
        x: nextPoint.x,
        y: asset.size.y / 2,
        z: nextPoint.z,
      },
      attachedSurfaceId: snapPreview?.surfaceId ?? null,
      attachedVertexId: snapPreview?.vertexId ?? null,
    });
    const nextConnections = snapPreview?.surfaceId && snapPreview.vertexId
      ? [
          ...state.connections,
          {
            id: uuid(),
            kind: "furniture-vertex" as const,
            sourceId: nextFurniture.id,
            targetId: snapPreview.surfaceId,
            edgeIndex: null,
            sourceVertexId: null,
            targetVertexId: snapPreview.vertexId,
          },
        ]
      : state.connections;

    set({
      furniture: [...state.furniture, nextFurniture],
      connections: nextConnections,
      selected: { kind: "furniture", id: nextFurniture.id },
      activePlacementIntent: null,
      snapPreview: null,
      statusMessage: snapPreview
        ? `${nextFurniture.label}을(를) 정점에 맞춰 배치했어요.`
        : `${nextFurniture.label}을(를) 배치했어요.`,
    });
  },

  placeWallFurnitureAsset: (assetId, wallId, vertexId) => {
    const state = get();
    const asset = state.furnitureCatalog.find((item) => item.id === assetId);
    const wall = state.placedSurfaces.find(
      (item) => item.id === wallId && item.type === "wall",
    );

    if (!asset || !wall) {
      set({ statusMessage: "벽과 가구를 다시 확인해 주세요." });
      return;
    }

    const vertex = wall.surface.vertices.find((entry) => entry.id === vertexId);

    if (!vertex) {
      set({ statusMessage: "벽 정점을 찾지 못했어요." });
      return;
    }

    const point = getSurfaceVertexWorldPoint(wall, vertex);
    const nextFurniture = createFurniturePlacement(asset, {
      position: {
        x: point.x,
        y: point.y + asset.size.y / 2,
        z: point.z + Math.cos(wall.rotationY) * 0.08,
      },
      attachedSurfaceId: wall.id,
      attachedVertexId: vertexId,
    });
    const nextConnection: RoomConnection = {
      id: uuid(),
      kind: "furniture-vertex",
      sourceId: nextFurniture.id,
      targetId: wall.id,
      edgeIndex: null,
      sourceVertexId: null,
      targetVertexId: vertexId,
    };

    set((currentState) => ({
      furniture: [...currentState.furniture, nextFurniture],
      connections: [...currentState.connections, nextConnection],
      selected: { kind: "furniture", id: nextFurniture.id },
      activePlacementIntent: null,
      statusMessage: `${nextFurniture.label}을(를) 벽 정점 ${vertexId}에 맞춰 배치했어요.`,
    }));
  },

  placeLightOnVertex: (surfaceId, vertexId) => {
    const state = get();
    const surface = state.placedSurfaces.find(
      (item) => item.id === surfaceId && item.type === "ceiling",
    );

    if (!surface) {
      set({ statusMessage: "천장을 먼저 선택해 주세요." });
      return;
    }

    const vertex = surface.surface.vertices.find((entry) => entry.id === vertexId);

    if (!vertex) {
      set({ statusMessage: "조명을 놓을 천장 정점을 찾지 못했어요." });
      return;
    }

    const point = getSurfaceVertexWorldPoint(surface, vertex);
    const now = new Date().toISOString();
    const nextLight: RoomStoreLight = {
      id: uuid(),
      label: `조명 ${state.lights.length + 1}`,
      color: "#fff7db",
      intensity: 1.6,
      position: {
        x: point.x,
        y: point.y + 0.02,
        z: point.z,
      },
      surfaceId: surface.id,
      vertexId,
      createdAt: now,
      updatedAt: now,
    };
    const nextConnection: RoomConnection = {
      id: uuid(),
      kind: "light-vertex",
      sourceId: nextLight.id,
      targetId: surface.id,
      edgeIndex: null,
      sourceVertexId: null,
      targetVertexId: vertexId,
    };

    set((currentState) => ({
      lights: [...currentState.lights, nextLight],
      connections: [...currentState.connections, nextConnection],
      selected: { kind: "light", id: nextLight.id },
      activePlacementIntent: null,
      statusMessage: `${nextLight.label}을(를) 천장 정점 ${vertexId}에 배치했어요.`,
    }));
  },

  placeCharacter: (point) => {
    set((state) => ({
      character: {
        ...state.character,
        position: {
          x: point.x,
          y: 0,
          z: point.z,
        },
      },
      selected: { kind: "character", id: "character" },
      activePlacementIntent: null,
      snapPreview: null,
      statusMessage: "캐릭터 위치를 정했어요. 플레이 버튼으로 직접 움직여 볼 수 있어요.",
    }));
  },

  updateFurniturePosition: (axis, value) => {
    const state = get();

    if (state.selected.kind === "furniture" && state.selected.id) {
      set({
        furniture: state.furniture.map((item) =>
          item.id === state.selected.id
            ? {
                ...item,
                position: {
                  ...item.position,
                  [axis]: value,
                },
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      });
      return;
    }

    if (state.selected.kind === "light" && state.selected.id) {
      set({
        lights: state.lights.map((light) =>
          light.id === state.selected.id
            ? {
                ...light,
                position: {
                  ...light.position,
                  [axis]: value,
                },
                updatedAt: new Date().toISOString(),
              }
            : light,
        ),
      });
      return;
    }

    if (state.selected.kind === "character") {
      set({
        character: {
          ...state.character,
          position: {
            ...state.character.position,
            [axis]: value,
          },
        },
      });
    }
  },

  updateFurnitureSize: (axis, value) => {
    const state = get();

    if (state.selected.kind !== "furniture" || !state.selected.id) {
      return;
    }

    set({
      furniture: state.furniture.map((item) =>
        item.id === state.selected.id
          ? {
              ...item,
              size: {
                ...item.size,
                [axis]: Math.max(value, 0.05),
              },
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
  },

  updateCharacterConfig: (patch) => {
    set((state) => ({
      character: {
        ...state.character,
        ...Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, Math.max(value ?? 0, 0.1)]),
        ),
      },
    }));
  },

  syncCharacterPosition: (position, rotationY) => {
    set((state) => ({
      character: {
        ...state.character,
        position,
        rotationY: rotationY ?? state.character.rotationY,
      },
    }));
  },

  deleteSelected: () => {
    const state = get();

    if (!state.selected.kind || !state.selected.id) {
      return;
    }

    const selectedId = state.selected.id;

    if (state.selected.kind === "surface") {
      set({
        placedSurfaces: state.placedSurfaces.filter((item) => item.id !== selectedId),
        furniture: state.furniture.filter((item) => item.attachedSurfaceId !== selectedId),
        lights: state.lights.filter((item) => item.surfaceId !== selectedId),
        connections: state.connections.filter(
          (connection) =>
            connection.sourceId !== selectedId && connection.targetId !== selectedId,
        ),
        selected: { kind: null, id: null },
        wall2DTargetId:
          state.wall2DTargetId === selectedId ? null : state.wall2DTargetId,
        statusMessage: "선택한 면을 삭제했어요.",
      });
      return;
    }

    if (state.selected.kind === "furniture") {
      set({
        furniture: state.furniture.filter((item) => item.id !== selectedId),
        connections: state.connections.filter(
          (connection) =>
            connection.sourceId !== selectedId && connection.targetId !== selectedId,
        ),
        selected: { kind: null, id: null },
        statusMessage: "선택한 가구를 삭제했어요.",
      });
      return;
    }

    if (state.selected.kind === "light") {
      set({
        lights: state.lights.filter((item) => item.id !== selectedId),
        connections: state.connections.filter(
          (connection) =>
            connection.sourceId !== selectedId && connection.targetId !== selectedId,
        ),
        selected: { kind: null, id: null },
        statusMessage: "선택한 조명을 삭제했어요.",
      });
      return;
    }

    if (state.selected.kind === "character") {
      set({
        character: defaultCharacter,
        selected: { kind: null, id: null },
        statusMessage: "캐릭터 위치를 초기화했어요.",
      });
    }
  },

  saveRoom: () => {
    const now = new Date().toISOString();
    const nextSnapshot = createRoomSnapshot({
      ...get(),
      lastSavedAt: now,
    });

    saveRoomSnapshot(nextSnapshot);
    set({
      lastSavedAt: now,
      statusMessage: "방 구성을 저장했어요.",
    });
  },

  loadRoom: () => {
    const plannerSnapshot = loadPlannerSnapshot();
    const availableSurfaceAssets = collectRoomSurfaceAssets(plannerSnapshot);
    const roomSnapshot = loadRoomSnapshot();

    if (!roomSnapshot) {
      set({
        availableSurfaceAssets,
        statusMessage: "불러올 저장본이 아직 없어요.",
      });
      return;
    }

    set({
      ...getInitialRoomState(availableSurfaceAssets, roomSnapshot),
      initialized: true,
      statusMessage: "저장한 방 구성을 불러왔어요.",
    });
  },

  downloadRoom: () => {
    if (typeof window === "undefined") {
      return;
    }

    const snapshot = createRoomSnapshot(get());
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      type: "oneroom-room-json",
      data: snapshot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `oneroom-room-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    set({ statusMessage: "JSON 파일로 다운로드했어요." });
  },
}));

function getInitialRoomState(
  availableSurfaceAssets: RoomSurfaceAsset[],
  snapshot: ReturnType<typeof roomSnapshotSchema.parse> | null,
) {
  return {
    availableSurfaceAssets,
    furnitureCatalog: DEFAULT_FURNITURE_ASSETS,
    placedSurfaces: snapshot?.placedSurfaces ?? [],
    furniture: snapshot?.furniture ?? [],
    lights: snapshot?.lights ?? [],
    connections: snapshot?.connections ?? [],
    selected: snapshot?.selected ?? { kind: null, id: null },
    activeSidebarTab: snapshot?.activeSidebarTab ?? "floor",
    activePlacementIntent: null,
    snapEnabled: snapshot?.snapEnabled ?? true,
    editMode: "editor" as RoomEditMode,
    wall2DTargetId: snapshot?.wall2DTargetId ?? null,
    activeFloorEdgeIndex: snapshot?.activeFloorEdgeIndex ?? null,
    snapPreview: null,
    character: snapshot?.character ?? defaultCharacter,
    lastSavedAt: snapshot?.lastSavedAt ?? null,
    statusMessage:
      availableSurfaceAssets.length === 0
        ? "먼저 면 만들기에서 바닥, 벽, 천장을 저장해 주세요."
        : "왼쪽 자산 패널에서 바닥부터 배치해 보세요.",
  };
}

function createRoomSnapshot(
  state: Pick<
    RoomStoreState,
    | "placedSurfaces"
    | "furniture"
    | "lights"
    | "connections"
    | "selected"
    | "activeSidebarTab"
    | "activePlacementIntent"
    | "snapEnabled"
    | "editMode"
    | "wall2DTargetId"
    | "activeFloorEdgeIndex"
    | "character"
    | "lastSavedAt"
  >,
) {
  return roomSnapshotSchema.parse({
    placedSurfaces: state.placedSurfaces,
    furniture: state.furniture,
    lights: state.lights,
    connections: state.connections,
    selected: state.selected,
    activeSidebarTab: state.activeSidebarTab,
    activePlacementIntent: state.activePlacementIntent,
    snapEnabled: state.snapEnabled,
    editMode: state.editMode,
    wall2DTargetId: state.wall2DTargetId,
    activeFloorEdgeIndex: state.activeFloorEdgeIndex,
    character: state.character,
    lastSavedAt: state.lastSavedAt,
  });
}

function getIntentMessage(intent: RoomPlacementIntent) {
  if (intent.kind === "light") {
    return "천장 정점을 클릭해 조명을 놓아 보세요.";
  }

  if (intent.kind === "character") {
    return "바닥 위를 클릭해 캐릭터 위치를 정해 주세요.";
  }

  if (intent.kind === "furniture") {
    return "정점에 가까이 가져가면 스냅 미리보기가 보여요.";
  }

  if (intent.surfaceType === "floor") {
    return "바닥을 놓을 위치를 클릭해 주세요.";
  }

  if (intent.surfaceType === "wall") {
    return "바닥을 선택하고 모서리를 고른 뒤 벽을 붙여 주세요.";
  }

  return "천장을 올릴 바닥을 먼저 선택해 주세요.";
}

function getSurfaceAsset(
  assets: RoomSurfaceAsset[],
  assetId: string,
  type: SurfaceType,
) {
  return assets.find((asset) => asset.id === assetId && asset.type === type) ?? null;
}

function getWallPlacementFromEdge(
  asset: RoomSurfaceAsset,
  floor: RoomSurfacePlacement,
  edge: ReturnType<typeof getFloorEdgeAnchors>[number],
) {
  const placement = createSurfacePlacementFromAsset(asset, {
    position: {
      x: edge.start.x,
      y: edge.start.y,
      z: edge.start.z,
    },
    rotationY: edge.rotationY,
    scale: {
      x: edge.length / Math.max(asset.surface.dimensions.length, 0.01),
      y: 1,
      z: 1,
    },
    attachedToSurfaceId: floor.id,
    attachedEdgeIndex: edge.index,
  });

  return placement;
}

export function getSelectedSurface(
  state: Pick<RoomStoreState, "placedSurfaces" | "selected">,
) {
  return state.selected.kind === "surface"
    ? state.placedSurfaces.find((surface) => surface.id === state.selected.id) ?? null
    : null;
}

export function getSelectedFurniture(
  state: Pick<RoomStoreState, "furniture" | "selected">,
) {
  return state.selected.kind === "furniture"
    ? state.furniture.find((item) => item.id === state.selected.id) ?? null
    : null;
}

export function getSelectedLight(
  state: Pick<RoomStoreState, "lights" | "selected">,
) {
  return state.selected.kind === "light"
    ? state.lights.find((item) => item.id === state.selected.id) ?? null
    : null;
}

export function getActiveFloorEdges(
  state: Pick<RoomStoreState, "placedSurfaces" | "selected">,
) {
  const selectedSurface = getSelectedSurface(state);

  if (!selectedSurface || selectedSurface.type !== "floor") {
    return [];
  }

  return getFloorEdgeAnchors(selectedSurface);
}

export function getSnapCandidatesForFurniture(
  placedSurfaces: RoomSurfacePlacement[],
  activePlacementIntent: RoomPlacementIntent | null,
) {
  if (!activePlacementIntent || activePlacementIntent.kind !== "furniture") {
    return [];
  }

  return getVertexSnapCandidates(placedSurfaces);
}

export function getSnapPreviewForPoint(
  state: Pick<RoomStoreState, "placedSurfaces" | "snapEnabled" | "activePlacementIntent">,
  point: Point3D,
) {
  if (!state.snapEnabled) {
    return null;
  }

  return getNearestSnapPreview(
    point,
    getSnapCandidatesForFurniture(state.placedSurfaces, state.activePlacementIntent),
  );
}

export function getSelectionSummary(
  state: Pick<
    RoomStoreState,
    "selected" | "placedSurfaces" | "furniture" | "lights" | "character"
  >,
) {
  const selectedSurface = getSelectedSurface(state);

  if (selectedSurface) {
    return {
      title: selectedSurface.label,
      subtitle: `${getSurfaceTypeLabelForRoom(selectedSurface.type)} 면`,
      position: selectedSurface.position,
      size: getSurfaceSizeDisplay(selectedSurface),
    };
  }

  const selectedFurniture = getSelectedFurniture(state);

  if (selectedFurniture) {
    return {
      title: selectedFurniture.label,
      subtitle: `${getPlacementModeLabel(selectedFurniture.placementMode)} 가구`,
      position: selectedFurniture.position,
      size: selectedFurniture.size,
    };
  }

  const selectedLight = getSelectedLight(state);

  if (selectedLight) {
    return {
      title: selectedLight.label,
      subtitle: "조명",
      position: selectedLight.position,
      size: { x: 0.12, y: 0.12, z: 0.12 },
    };
  }

  if (state.selected.kind === "character") {
    return {
      title: "캐릭터",
      subtitle: "플레이 기준점",
      position: state.character.position,
      size: {
        x: state.character.width,
        y: state.character.height,
        z: state.character.width,
      },
    };
  }

  return null;
}
