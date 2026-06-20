import { useMemo } from 'react';
import { DoubleSide } from 'three';
import type { WatchConfig, ProceduralStyle } from '../config/watches';

/**
 * Parametric procedural watch built from Three.js primitives with PBR
 * materials. This is the zero-asset fallback so the entire AR pipeline (anchor,
 * smoothing, occlusion, scaling) works before you drop real GLBs into
 * /public/models. It is intentionally normalized so the case diameter ≈ 1 local
 * unit, matching the occlusion cylinder and the wrist-fit scale.
 *
 * Local frame (matches WristAnchor): +Y = dial up, +Z = toward fingers
 * (12 o'clock), X = across the wrist. The bracelet is a ring in the X/Y plane
 * wrapping the forearm (which runs along Z).
 */

const ARM_RADIUS = 0.62; // must match OcclusionCylinder radius
const BAND_CENTER_Y = -0.52; // arm axis height (matches occluder yOffset)

function styleParams(style: ProceduralStyle) {
  switch (style) {
    case 'dive':
      return { rect: false, bezel: 'dive' as const, band: 'metal' as const, caseR: 0.5, thickness: 0.26 };
    case 'steel-sport':
      return { rect: false, bezel: 'thin' as const, band: 'metal' as const, caseR: 0.48, thickness: 0.2 };
    case 'dress':
      return { rect: false, bezel: 'thin' as const, band: 'metal' as const, caseR: 0.46, thickness: 0.16 };
    case 'g-shock':
      return { rect: false, bezel: 'thick' as const, band: 'resin' as const, caseR: 0.54, thickness: 0.34 };
    case 'smart':
      return { rect: true, bezel: 'none' as const, band: 'sport' as const, caseR: 0.5, thickness: 0.22 };
  }
}

export function ProceduralWatch({ config }: { config: WatchConfig }) {
  const p = useMemo(() => styleParams(config.style), [config.style]);

  const caseTopY = p.thickness / 2;
  const dialY = caseTopY + 0.011;

  // Hour markers around a round dial.
  const markers = useMemo(() => {
    if (p.rect) return [];
    const r = p.caseR * 0.74;
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return { x: Math.sin(a) * r, z: Math.cos(a) * r, ry: a, major: i % 3 === 0 };
    });
  }, [p.rect, p.caseR]);

  return (
    <group>
      {/* ---------------------------------------------------------------- Band */}
      {p.band === 'metal' && (
        <mesh position={[0, BAND_CENTER_Y, 0]} castShadow>
          <torusGeometry args={[ARM_RADIUS + 0.05, 0.085, 16, 48]} />
          <meshStandardMaterial color={config.metal} metalness={1} roughness={0.28} />
        </mesh>
      )}
      {p.band === 'resin' && (
        <mesh position={[0, BAND_CENTER_Y, 0]} castShadow>
          <torusGeometry args={[ARM_RADIUS + 0.04, 0.1, 12, 40]} />
          <meshStandardMaterial color={config.metal} metalness={0.1} roughness={0.7} />
        </mesh>
      )}
      {p.band === 'sport' && (
        <mesh position={[0, BAND_CENTER_Y, 0]} castShadow>
          <torusGeometry args={[ARM_RADIUS + 0.03, 0.075, 12, 40]} />
          <meshStandardMaterial color={config.accent} metalness={0.05} roughness={0.85} />
        </mesh>
      )}

      {/* ---------------------------------------------------------------- Case */}
      {p.rect ? (
        // Smart-watch style rounded rectangle case + glass screen.
        <group position={[0, caseTopY, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[p.caseR * 1.7, p.thickness, p.caseR * 2.05]} />
            <meshStandardMaterial color={config.metal} metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0, p.thickness / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[p.caseR * 1.45, p.caseR * 1.8]} />
            <meshStandardMaterial
              color={config.dial}
              metalness={0.2}
              roughness={0.12}
              emissive={config.accent}
              emissiveIntensity={0.18}
              side={DoubleSide}
            />
          </mesh>
          {/* Digital crown */}
          <mesh position={[p.caseR * 0.92, 0, 0.1]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 20]} />
            <meshStandardMaterial color={config.accent} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ) : (
        <group position={[0, caseTopY, 0]}>
          {/* Case body */}
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[p.caseR, p.caseR * 1.02, p.thickness, 48]} />
            <meshStandardMaterial color={config.metal} metalness={1} roughness={0.22} />
          </mesh>

          {/* Bezel */}
          {p.bezel === 'dive' && (
            <mesh position={[0, p.thickness / 2 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[p.caseR * 0.93, 0.06, 16, 48]} />
              <meshStandardMaterial color={config.accent} metalness={0.6} roughness={0.35} />
            </mesh>
          )}
          {p.bezel === 'thin' && (
            <mesh position={[0, p.thickness / 2 - 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[p.caseR * 0.95, 0.035, 16, 48]} />
              <meshStandardMaterial color={config.metal} metalness={1} roughness={0.12} />
            </mesh>
          )}
          {p.bezel === 'thick' && (
            <mesh position={[0, p.thickness / 2 - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[p.caseR * 0.98, 0.1, 12, 40]} />
              <meshStandardMaterial color={config.metal} metalness={0.2} roughness={0.6} />
            </mesh>
          )}

          {/* Dial face */}
          <mesh position={[0, p.thickness / 2 + 0.001, 0]}>
            <cylinderGeometry args={[p.caseR * 0.82, p.caseR * 0.82, 0.02, 48]} />
            <meshStandardMaterial color={config.dial} metalness={0.35} roughness={0.42} />
          </mesh>

          {/* Hour markers */}
          {markers.map((m, i) => (
            <mesh key={i} position={[m.x, dialY, m.z]} rotation={[0, m.ry, 0]}>
              <boxGeometry args={m.major ? [0.04, 0.012, 0.085] : [0.022, 0.01, 0.06]} />
              <meshStandardMaterial
                color={config.accent}
                metalness={0.9}
                roughness={0.25}
                emissive={config.accent}
                emissiveIntensity={0.15}
              />
            </mesh>
          ))}

          {/* Hands */}
          <group position={[0, dialY + 0.012, 0]} rotation={[0, Math.PI * 0.18, 0]}>
            <mesh position={[0, 0, 0.12]}>
              <boxGeometry args={[0.022, 0.01, 0.3]} />
              <meshStandardMaterial color="#f4f4f5" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
          <group position={[0, dialY + 0.02, 0]} rotation={[0, -Math.PI * 0.42, 0]}>
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[0.03, 0.01, 0.2]} />
              <meshStandardMaterial color="#f4f4f5" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>

          {/* Crown */}
          <mesh position={[p.caseR * 1.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.07, 20]} />
            <meshStandardMaterial color={config.metal} metalness={1} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Lugs connecting case to band (front + back) */}
      {!p.rect &&
        [1, -1].map((dir) => (
          <mesh key={dir} position={[0, caseTopY - p.thickness * 0.2, dir * p.caseR * 0.7]} castShadow>
            <boxGeometry args={[p.caseR * 0.7, p.thickness * 0.5, 0.18]} />
            <meshStandardMaterial color={config.metal} metalness={1} roughness={0.25} />
          </mesh>
        ))}
    </group>
  );
}
