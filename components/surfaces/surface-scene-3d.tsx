"use client";

import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { normalizeLoop } from "@/lib/geometry/polygon";
import type { Surface } from "@/lib/types/planner";

import { useElementSize } from "./use-element-size";

interface SurfaceScene3DProps {
  surfaces: Surface[];
  selectedSurfaceId: string | null;
  onSelectSurface: (surfaceId: string | null) => void;
}

export function SurfaceScene3D({
  surfaces,
  selectedSurfaceId,
  onSelectSurface,
}: SurfaceScene3DProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();

  return (
    <div ref={ref} className="relative h-full min-h-[420px] w-full overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#fbf8f1,#f2ecdd)]">
      {size.width > 0 && size.height > 0 ? (
        <Canvas
          camera={{ position: [4.6, 3.8, 6.2], fov: 48 }}
          onPointerMissed={() => onSelectSurface(null)}
        >
          <color attach="background" args={["#fbf8f1"]} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 6, 5]} intensity={1.15} />
          <gridHelper
            args={[20, 20, "#d8d0bb", "#ece8dc"]}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, -0.05]}
          />

          <Bounds fit clip observe margin={1.4}>
            {surfaces.map((surface) => (
              <SurfaceMesh
                key={surface.id}
                surface={surface}
                selected={surface.id === selectedSurfaceId}
                onSelectSurface={onSelectSurface}
              />
            ))}
          </Bounds>

          <OrbitControls makeDefault enableDamping />
        </Canvas>
      ) : null}

      {surfaces.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-white/85 px-5 py-4 text-center text-sm leading-6 text-[var(--text-muted)]">
            왼쪽 패널에서 면을 추가하면 3D로 바로 확인할 수 있어요.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SurfaceMesh({
  surface,
  selected,
  onSelectSurface,
}: {
  surface: Surface;
  selected: boolean;
  onSelectSurface: (surfaceId: string) => void;
}) {
  const geometry = useMemo(() => createGeometry(surface), [surface]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[surface.position.x, -surface.position.y, -surface.dimensions.thickness / 2]}
      onClick={(event) => {
        event.stopPropagation();
        onSelectSurface(surface.id);
      }}
    >
      <meshStandardMaterial
        color={surface.color}
        transparent
        opacity={selected ? 0.92 : 0.75}
        roughness={0.45}
        metalness={0.04}
      />
    </mesh>
  );
}

function createGeometry(surface: Surface) {
  const outerLoop = normalizeLoop(
    surface.vertices.map((vertex) => ({
      x: vertex.x,
      y: -vertex.y,
    })),
    false,
  );

  const shape = new THREE.Shape();
  traceLoop(shape, outerLoop);

  for (const hole of surface.holes) {
    const holeLoop = normalizeLoop(
      hole.vertices.map((vertex) => ({
        x: vertex.x,
        y: -vertex.y,
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

function traceLoop(path: THREE.Shape | THREE.Path, points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return;
  }

  path.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }

  path.closePath();
}
