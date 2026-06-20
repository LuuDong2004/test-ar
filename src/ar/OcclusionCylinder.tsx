import { useMemo, useRef } from 'react';
import { CylinderGeometry, Mesh, MeshBasicMaterial } from 'three';
import { useARStore } from '../store/useARStore';

interface OcclusionCylinderProps {
  /** Arm radius in watch-local units (watch case diameter ≈ 1). */
  radius?: number;
  /** Length of the simulated forearm in local units. */
  length?: number;
  /** Push the arm volume below the watch case (negative = away from dial). */
  yOffset?: number;
}

/**
 * Invisible wrist depth-blocker.
 *
 * A cylinder approximating the forearm is written into the DEPTH buffer only
 * (colorWrite = false, depthWrite = true). Because it renders before the watch,
 * any bracelet fragment that lies *behind* the arm fails the depth test and is
 * discarded — so the band convincingly wraps around the wrist and disappears on
 * the far side instead of floating in front of it.
 *
 * The cylinder is a child of the watch anchor group, so it inherits the wrist
 * pose automatically. Its axis is rotated to run along the forearm (local Z).
 */
export function OcclusionCylinder({
  radius = 0.62,
  length = 3.4,
  yOffset = -0.52,
}: OcclusionCylinderProps) {
  const debug = useARStore((s) => s.debug);
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(
    () => new CylinderGeometry(radius, radius * 1.04, length, 24, 1, true),
    [radius, length],
  );

  const material = useMemo(() => {
    const m = new MeshBasicMaterial();
    m.colorWrite = false; // do not draw any color …
    m.depthWrite = true; // … but DO occupy the depth buffer
    m.depthTest = true;
    return m;
  }, []);

  // Debug visualization: show the occluder as a translucent red volume.
  const debugMaterial = useMemo(() => {
    const m = new MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.25 });
    m.depthWrite = false;
    return m;
  }, []);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={debug ? debugMaterial : material}
      // Align the cylinder's Y axis with the forearm direction (local Z).
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, yOffset, 0]}
      // Render before the watch so the depth buffer is primed first.
      renderOrder={-1}
    />
  );
}
