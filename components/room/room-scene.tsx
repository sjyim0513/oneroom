"use client";

import {
  Bounds,
  Line,
  OrbitControls,
  PointerLockControls,
} from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  boundsIntersect,
  getCeilingPlacementFromFloor,
  getCharacterCollision,
  getFloorEdgeAnchors,
  getFurnitureWorldBounds,
  getNearestSnapPreview,
  getSuggestedCeilingHeight,
  getSurfaceWorldBounds,
  getSurfaceWorldVertices,
  getVertexSnapCandidates,
  getWallPlacementFromEdge,
  snapPointToGrid,
} from "@/lib/geometry/room";
import { normalizeLoop } from "@/lib/geometry/polygon";
import type { Point2D, Surface } from "@/lib/types/planner";
import type {
  Point3D,
  RoomFurniturePlacement,
  RoomSurfaceAsset,
  RoomSurfacePlacement,
} from "@/lib/types/room";
import {
  getActiveFloorEdges,
  getSelectedSurface,
  useRoomStore,
} from "@/store/room-store";

import { useElementSize } from "../surfaces/use-element-size";

export function RoomScene() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const {
    availableSurfaceAssets,
    placedSurfaces,
    furniture,
    lights,
    selected,
    activePlacementIntent,
    activeFloorEdgeIndex,
    snapEnabled,
    snapPreview,
    editMode,
    character,
    setSnapPreview,
    selectSurface,
    selectFurniture,
    selectLight,
    selectCharacter,
    placeFloorAsset,
    placeFurnitureAsset,
    placeCharacter,
    placeCeilingAsset,
    placeLightOnVertex,
    syncCharacterPosition,
  } = useRoomStore();
  const [hoverPoint, setHoverPoint] = useState<Point3D | null>(null);

  const selectedSurface = getSelectedSurface({ placedSurfaces, selected });
  const selectedFloor =
    selectedSurface?.type === "floor" ? selectedSurface : null;
  const activeFloorEdges = getActiveFloorEdges({ placedSurfaces, selected });
  const activeSurfaceAsset =
    activePlacementIntent?.kind === "surface"
      ? availableSurfaceAssets.find((asset) => asset.id === activePlacementIntent.assetId) ?? null
      : null;
  const previewFloor = useMemo(() => {
    if (
      !activeSurfaceAsset ||
      activePlacementIntent?.kind !== "surface" ||
      activePlacementIntent.surfaceType !== "floor" ||
      !hoverPoint
    ) {
      return null;
    }

    return {
      asset: activeSurfaceAsset,
      position: snapPointToGrid({ ...hoverPoint, y: 0 }),
    };
  }, [activePlacementIntent, activeSurfaceAsset, hoverPoint]);
  const previewWall = useMemo(() => {
    if (
      !activeSurfaceAsset ||
      activePlacementIntent?.kind !== "surface" ||
      activePlacementIntent.surfaceType !== "wall" ||
      !selectedFloor ||
      activeFloorEdgeIndex == null
    ) {
      return null;
    }

    const edge = getFloorEdgeAnchors(selectedFloor)[activeFloorEdgeIndex];

    if (!edge) {
      return null;
    }

    return getWallPlacementFromEdge(activeSurfaceAsset, selectedFloor, edge);
  }, [activeFloorEdgeIndex, activePlacementIntent, activeSurfaceAsset, selectedFloor]);
  const previewCeiling = useMemo(() => {
    if (
      !activeSurfaceAsset ||
      activePlacementIntent?.kind !== "surface" ||
      activePlacementIntent.surfaceType !== "ceiling" ||
      !selectedFloor
    ) {
      return null;
    }

    return getCeilingPlacementFromFloor(
      activeSurfaceAsset,
      selectedFloor,
      getSuggestedCeilingHeight(selectedFloor.id, placedSurfaces),
    );
  }, [activePlacementIntent, activeSurfaceAsset, placedSurfaces, selectedFloor]);
  const previewFurniture = useMemo(() => {
    if (
      activePlacementIntent?.kind !== "furniture" ||
      !hoverPoint
    ) {
      return null;
    }

    const asset = useRoomStore.getState().furnitureCatalog.find(
      (item) => item.id === activePlacementIntent.assetId,
    );

    if (!asset || asset.placementMode === "wall") {
      return null;
    }

    const previewPosition = snapPreview?.position ?? snapPointToGrid(hoverPoint);

    return {
      size: asset.size,
      color: asset.color,
      position: {
        x: previewPosition.x,
        y: asset.size.y / 2,
        z: previewPosition.z,
      },
    };
  }, [activePlacementIntent, hoverPoint, snapPreview]);

  return (
    <div
      ref={ref}
      className="relative h-full min-h-[480px] w-full overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#fbf8f1,#f0eadc)]"
    >
      {size.width > 0 && size.height > 0 ? (
        <Canvas
          camera={{ position: [6.4, 5.4, 7.2], fov: 48 }}
          onPointerMissed={() => {
            if (editMode === "editor") {
              selectSurface(null);
              selectFurniture(null);
              selectLight(null);
            }
          }}
        >
          <color attach="background" args={["#fbf8f1"]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[6, 8, 5]} intensity={1.2} castShadow />

          {lights.map((light) => (
            <pointLight
              key={light.id}
              position={[light.position.x, light.position.y, light.position.z]}
              intensity={light.intensity}
              distance={8}
              decay={2}
              color={light.color}
            />
          ))}

          <gridHelper args={[30, 30, "#d8d0bb", "#ece8dc"]} position={[0, 0, 0]} />

          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerMove={(event) => {
              if (editMode !== "editor") {
                return;
              }

              const nextPoint = {
                x: event.point.x,
                y: 0,
                z: event.point.z,
              };

              setHoverPoint(nextPoint);

              if (activePlacementIntent?.kind === "furniture" && snapEnabled) {
                setSnapPreview(
                  getNearestSnapPreview(nextPoint, getVertexSnapCandidates(placedSurfaces)),
                );
                return;
              }

              setSnapPreview(null);
            }}
            onClick={(event) => {
              if (editMode !== "editor" || !activePlacementIntent) {
                return;
              }

              const point = {
                x: event.point.x,
                y: 0,
                z: event.point.z,
              };

              if (
                activePlacementIntent.kind === "surface" &&
                activePlacementIntent.surfaceType === "floor"
              ) {
                placeFloorAsset(activePlacementIntent.assetId, point);
                return;
              }

              if (activePlacementIntent.kind === "furniture") {
                placeFurnitureAsset(activePlacementIntent.assetId, point, snapPreview);
                return;
              }

              if (activePlacementIntent.kind === "character") {
                placeCharacter(point);
                return;
              }
            }}
          >
            <planeGeometry args={[60, 60]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          <Bounds fit clip observe margin={1.3}>
            {placedSurfaces.map((surface) => (
              <PlacedSurfaceMesh
                key={surface.id}
                surface={surface}
                selected={selected.kind === "surface" && selected.id === surface.id}
                onSelect={() => {
                  if (
                    editMode === "editor" &&
                    activePlacementIntent?.kind === "surface" &&
                    activePlacementIntent.surfaceType === "ceiling" &&
                    surface.type === "floor"
                  ) {
                    placeCeilingAsset(activePlacementIntent.assetId, surface.id);
                    return;
                  }

                  selectSurface(surface.id);
                  selectFurniture(null);
                  selectLight(null);
                }}
              />
            ))}

            {furniture.map((item) => (
              <FurnitureMesh
                key={item.id}
                item={item}
                selected={selected.kind === "furniture" && selected.id === item.id}
                onSelect={() => {
                  selectFurniture(item.id);
                  selectSurface(null);
                  selectLight(null);
                }}
              />
            ))}

            {lights.map((light) => (
              <LightMarker
                key={light.id}
                light={light}
                selected={selected.kind === "light" && selected.id === light.id}
                onSelect={() => {
                  selectLight(light.id);
                  selectSurface(null);
                  selectFurniture(null);
                }}
              />
            ))}
          </Bounds>

          {selectedFloor && editMode === "editor"
            ? activeFloorEdges.map((edge) => (
                <FloorEdgeHandle
                  key={`${selectedFloor.id}-${edge.index}`}
                  edge={edge}
                  active={activeFloorEdgeIndex === edge.index}
                  clickable={
                    activePlacementIntent?.kind === "surface" &&
                    activePlacementIntent.surfaceType === "wall"
                  }
                />
              ))
            : null}

          {activePlacementIntent?.kind === "light" && editMode === "editor"
            ? placedSurfaces
                .filter((surface) => surface.type === "ceiling")
                .flatMap((surface) =>
                  getSurfaceWorldVertices(surface).map((entry) => (
                    <mesh
                      key={`${surface.id}-${entry.id}`}
                      position={[entry.position.x, entry.position.y + 0.02, entry.position.z]}
                      onClick={(event) => {
                        event.stopPropagation();
                        placeLightOnVertex(surface.id, entry.id);
                      }}
                    >
                      <sphereGeometry args={[0.07, 20, 20]} />
                      <meshStandardMaterial color="#f7d67d" emissive="#f7d67d" emissiveIntensity={0.4} />
                    </mesh>
                  )),
                )
            : null}

          {activePlacementIntent?.kind === "furniture" && editMode === "editor"
            ? getVertexSnapCandidates(placedSurfaces).map((candidate) => (
                <mesh
                  key={`${candidate.surfaceId}-${candidate.vertexId}`}
                  position={[candidate.position.x, candidate.position.y + 0.03, candidate.position.z]}
                >
                  <sphereGeometry args={[0.04, 12, 12]} />
                  <meshBasicMaterial color="#68824D" transparent opacity={0.7} />
                </mesh>
              ))
            : null}

          {previewFloor ? (
            <PreviewSurfaceMesh
              surface={createPreviewPlacement(previewFloor.asset, previewFloor.position)}
            />
          ) : null}

          {previewWall ? <PreviewSurfaceMesh surface={previewWall} /> : null}
          {previewCeiling ? <PreviewSurfaceMesh surface={previewCeiling} /> : null}

          {previewFurniture ? (
            <mesh
              position={[
                previewFurniture.position.x,
                previewFurniture.position.y,
                previewFurniture.position.z,
              ]}
            >
              <boxGeometry args={[previewFurniture.size.x, previewFurniture.size.y, previewFurniture.size.z]} />
              <meshStandardMaterial
                color={previewFurniture.color}
                transparent
                opacity={0.35}
              />
            </mesh>
          ) : null}

          {snapPreview ? (
            <mesh position={[snapPreview.position.x, snapPreview.position.y + 0.08, snapPreview.position.z]}>
              <boxGeometry args={[0.14, 0.14, 0.14]} />
              <meshStandardMaterial color="#C75F2F" transparent opacity={0.45} />
            </mesh>
          ) : null}

          {editMode === "editor" ? (
            <>
              <OrbitControls makeDefault enableDamping />
              <CharacterMarker
                character={character}
                selected={selected.kind === "character"}
                onSelect={selectCharacter}
              />
            </>
          ) : (
            <PlayController
              character={character}
              surfaces={placedSurfaces}
              furniture={furniture}
              onCommitPosition={syncCharacterPosition}
            />
          )}
        </Canvas>
      ) : null}

      {editMode === "play" ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-ink-900 shadow-panel">
          장면을 클릭한 뒤 WASD로 이동, 마우스로 시점 이동
        </div>
      ) : null}

      {placedSurfaces.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-white/88 px-6 py-5 text-center text-sm leading-6 text-[var(--text-muted)]">
            왼쪽에서 바닥 자산을 선택하고 장면을 클릭하면 방 구성을 시작할 수 있어요.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlacedSurfaceMesh({
  surface,
  selected,
  onSelect,
}: {
  surface: RoomSurfacePlacement;
  selected: boolean;
  onSelect: () => void;
}) {
  const geometry = useMemo(() => createGeometry(surface.surface), [surface.surface]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group
      position={[surface.position.x, surface.position.y, surface.position.z]}
      rotation={surface.type === "wall" ? [0, surface.rotationY, 0] : [Math.PI / 2, surface.rotationY, 0]}
      scale={[surface.scale.x, surface.scale.y, surface.scale.z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={surface.surface.color}
          transparent
          opacity={selected ? 0.9 : 0.78}
          emissive={selected ? "#201a12" : "#000000"}
          emissiveIntensity={selected ? 0.15 : 0}
        />
      </mesh>
    </group>
  );
}

function PreviewSurfaceMesh({ surface }: { surface: RoomSurfacePlacement }) {
  const geometry = useMemo(() => createGeometry(surface.surface), [surface.surface]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group
      position={[surface.position.x, surface.position.y, surface.position.z]}
      rotation={surface.type === "wall" ? [0, surface.rotationY, 0] : [Math.PI / 2, surface.rotationY, 0]}
      scale={[surface.scale.x, surface.scale.y, surface.scale.z]}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial color={surface.surface.color} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function FurnitureMesh({
  item,
  selected,
  onSelect,
}: {
  item: RoomFurniturePlacement;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <mesh
      position={[item.position.x, item.position.y, item.position.z]}
      rotation={[0, item.rotationY, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <boxGeometry args={[item.size.x, item.size.y, item.size.z]} />
      <meshStandardMaterial
        color={item.color}
        transparent
        opacity={selected ? 0.95 : 0.86}
        emissive={selected ? "#241d15" : "#000000"}
        emissiveIntensity={selected ? 0.12 : 0}
      />
    </mesh>
  );
}

function LightMarker({
  light,
  selected,
  onSelect,
}: {
  light: { position: Point3D; color: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <mesh
      position={[light.position.x, light.position.y, light.position.z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <sphereGeometry args={[selected ? 0.09 : 0.07, 18, 18]} />
      <meshStandardMaterial color={light.color} emissive={light.color} emissiveIntensity={0.4} />
    </mesh>
  );
}

function CharacterMarker({
  character,
  selected,
  onSelect,
}: {
  character: { height: number; width: number; position: Point3D };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <mesh
      position={[
        character.position.x,
        character.height / 2,
        character.position.z,
      ]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <cylinderGeometry args={[character.width / 2, character.width / 2, character.height, 18]} />
      <meshStandardMaterial
        color={selected ? "#C75F2F" : "#d2b08e"}
        transparent
        opacity={0.5}
      />
    </mesh>
  );
}

function FloorEdgeHandle({
  edge,
  active,
  clickable,
}: {
  edge: ReturnType<typeof getFloorEdgeAnchors>[number];
  active: boolean;
  clickable: boolean;
}) {
  const setActiveFloorEdgeIndex = useRoomStore((state) => state.setActiveFloorEdgeIndex);
  const activePlacementIntent = useRoomStore((state) => state.activePlacementIntent);
  const selected = useRoomStore((state) => state.selected);
  const placeWallAsset = useRoomStore((state) => state.placeWallAsset);

  return (
    <>
      <Line
        points={[
          [edge.start.x, edge.start.y + 0.01, edge.start.z],
          [edge.end.x, edge.end.y + 0.01, edge.end.z],
        ]}
        color={active ? "#C75F2F" : "#68824D"}
        lineWidth={active ? 3.4 : 2.2}
      />

      <mesh
        position={[edge.midpoint.x, edge.midpoint.y + 0.03, edge.midpoint.z]}
        rotation={[0, -edge.rotationY, 0]}
        onClick={(event) => {
          event.stopPropagation();
          setActiveFloorEdgeIndex(edge.index);

          if (
            clickable &&
            activePlacementIntent?.kind === "surface" &&
            activePlacementIntent.surfaceType === "wall" &&
            selected.kind === "surface" &&
            selected.id
          ) {
            placeWallAsset(activePlacementIntent.assetId, selected.id, edge.index);
          }
        }}
      >
        <boxGeometry args={[Math.max(edge.length, 0.08), 0.05, 0.12]} />
        <meshBasicMaterial transparent opacity={clickable ? 0.18 : 0.1} color="#68824D" />
      </mesh>
    </>
  );
}

function PlayController({
  character,
  surfaces,
  furniture,
  onCommitPosition,
}: {
  character: { height: number; width: number; position: Point3D; rotationY: number };
  surfaces: RoomSurfacePlacement[];
  furniture: RoomFurniturePlacement[];
  onCommitPosition: (position: Point3D, rotationY?: number) => void;
}) {
  const controlsRef = useRef<any>(null);
  const directionRef = useRef({ forward: false, backward: false, left: false, right: false });
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(
      character.position.x,
      character.position.y + character.height,
      character.position.z,
    );
    camera.rotation.order = "YXZ";
    camera.rotation.y = character.rotationY;
    controlsRef.current?.lock?.();
  }, [camera, character.height, character.position.x, character.position.y, character.position.z, character.rotationY]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w") directionRef.current.forward = true;
      if (key === "s") directionRef.current.backward = true;
      if (key === "a") directionRef.current.left = true;
      if (key === "d") directionRef.current.right = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w") directionRef.current.forward = false;
      if (key === "s") directionRef.current.backward = false;
      if (key === "a") directionRef.current.left = false;
      if (key === "d") directionRef.current.right = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const speed = 2.4;
    const moveX =
      Number(directionRef.current.right) - Number(directionRef.current.left);
    const moveZ =
      Number(directionRef.current.backward) - Number(directionRef.current.forward);

    if (moveX === 0 && moveZ === 0) {
      return;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const velocity = forward.multiplyScalar(moveZ).add(right.multiplyScalar(moveX));

    if (velocity.lengthSq() <= 1e-6) {
      return;
    }

    velocity.normalize().multiplyScalar(speed * delta);

    const nextPosition = {
      x: camera.position.x + velocity.x,
      y: 0,
      z: camera.position.z + velocity.z,
    };
    const characterBounds = getCharacterCollision(nextPosition, character.width);
    const collision = [
      ...surfaces
        .filter((surface) => surface.type === "wall")
        .map((surface) => getSurfaceWorldBounds(surface)),
      ...furniture.map((item) => getFurnitureWorldBounds(item)),
    ].some((bounds) => boundsIntersect(characterBounds, bounds));

    if (collision) {
      return;
    }

    camera.position.x = nextPosition.x;
    camera.position.z = nextPosition.z;
    onCommitPosition(nextPosition, camera.rotation.y);
  });

  return <PointerLockControls ref={controlsRef} makeDefault />;
}

function createGeometry(surface: Surface) {
  const outerLoop = normalizeLoop(
    surface.vertices.map((vertex) => ({
      x: vertex.x,
      y: vertex.y,
    })),
    false,
  );
  const shape = new THREE.Shape();
  traceLoop(shape, outerLoop);

  for (const hole of surface.holes) {
    const holeLoop = normalizeLoop(
      hole.vertices.map((vertex) => ({
        x: vertex.x,
        y: vertex.y,
      })),
      true,
    );
    const path = new THREE.Path();
    traceLoop(path, holeLoop);
    shape.holes.push(path);
  }

  return new THREE.ExtrudeGeometry(shape, {
    depth: surface.dimensions.thickness,
    bevelEnabled: false,
  });
}

function traceLoop(path: THREE.Shape | THREE.Path, points: Point2D[]) {
  if (points.length === 0) {
    return;
  }

  path.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }

  path.closePath();
}

function createPreviewPlacement(asset: RoomSurfaceAsset, position: Point3D): RoomSurfacePlacement {
  return {
    id: `preview-${asset.id}`,
    assetId: asset.id,
    label: asset.label,
    type: asset.type,
    surface: asset.surface,
    position,
    rotationY: 0,
    scale: { x: 1, y: 1, z: 1 },
    attachedToSurfaceId: null,
    attachedEdgeIndex: null,
    createdAt: "",
    updatedAt: "",
  };
}
