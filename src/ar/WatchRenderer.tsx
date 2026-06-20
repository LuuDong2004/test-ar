import { Component, ReactNode, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Group, Mesh, Object3D, Vector3 } from 'three';
import { handTracker } from './HandTracker';
import { WristAnchor, createWristPose } from './WristAnchor';
import {
  QuaternionSmoother,
  ScalarSmoother,
  Vector3Smoother,
} from './Smoothing';
import { OcclusionCylinder } from './OcclusionCylinder';
import { ProceduralWatch } from './ProceduralWatch';
import { getWatch, type WatchConfig } from '../config/watches';
import { useARStore } from '../store/useARStore';

/** Maps world-space wrist width → watch local-unit scale. Slightly under 1 so
 *  the case hugs the wrist instead of overhanging it. */
const WATCH_SCALE_FACTOR = 0.9;
/** Seat the watch this many wrist-widths down the forearm (behind the crease). */
const FOREARM_OFFSET = 0.4;

/* ----------------------------------------------------- Tracking-quality gate */

/** Minimum detection score below which a frame is treated as untrusted. */
const MIN_TRACK_SCORE = 0.5;
/** Consecutive trustworthy frames required before the watch appears. */
const SHOW_AFTER_GOOD = 3;
/** Consecutive bad frames tolerated (pose held) before the watch is hidden. */
const HIDE_AFTER_BAD = 5;
/** Reject a frame whose position teleports more than this × wrist width. */
const MAX_POSE_JUMP = 1.6;

/* ------------------------------------------------------------------ GLB load */

/**
 * Normalize an arbitrary GLB so it drops into the wrist frame:
 *  1. Auto-orient — rotate the thinnest bounding-box axis (the watch's
 *     through-thickness / dial normal) to point up (+Y), matching the anchor
 *     convention. Handles models authored lying on any axis.
 *  2. Recenter on the (re-oriented) bounding box.
 *  3. Scale by the ACROSS-WRIST (X) dimension — i.e. the watch case width — to
 *     ~0.9 local units. Scaling by the largest dimension is wrong for watches
 *     because that dimension is usually the *strap*, which shrinks the case to
 *     a tiny, unworn-looking size. Matching the case to the wrist width fixes
 *     that for both closed-bracelet and straight-strap models.
 * Per-model `rotation`/`offset` in the config compose on top of this.
 */
function normalizeGltf(source: Object3D, autoOrient: boolean): Group {
  const model = source.clone(true);
  model.traverse((o) => {
    if ((o as Mesh).isMesh) {
      const m = o as Mesh;
      m.castShadow = true;
      m.receiveShadow = false;
      m.frustumCulled = false;
    }
  });

  const oriented = new Group();
  oriented.add(model);

  if (autoOrient) {
    const pre = new Box3().setFromObject(model);
    const s = pre.getSize(new Vector3());
    if (s.x <= s.y && s.x <= s.z) {
      oriented.rotation.z = Math.PI / 2; // thinnest X → Y
    } else if (s.z <= s.x && s.z <= s.y) {
      oriented.rotation.x = -Math.PI / 2; // thinnest Z → Y
    }
  }

  const box = new Box3().setFromObject(oriented);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  oriented.position.sub(center);

  // Scale by the across-wrist (X) extent = case width ≈ wrist width.
  const widthDim = size.x > 1e-4 ? size.x : Math.max(size.x, size.y, size.z) || 1;
  const wrapper = new Group();
  wrapper.add(oriented);
  wrapper.scale.setScalar(0.9 / widthDim);
  return wrapper;
}

function GltfWatch({ config }: { config: WatchConfig }) {
  const { scene } = useGLTF(config.model);
  const setModelLoading = useARStore((s) => s.setModelLoading);
  const object = useMemo(
    () => normalizeGltf(scene, config.autoOrient ?? true),
    [scene, config.autoOrient],
  );
  useEffect(() => {
    setModelLoading(false);
  }, [object, setModelLoading]);
  return <primitive object={object} />;
}

function FallbackWatch({ config }: { config: WatchConfig }) {
  const setModelLoading = useARStore((s) => s.setModelLoading);
  useEffect(() => {
    setModelLoading(false);
  }, [config.id, setModelLoading]);
  return <ProceduralWatch config={config} />;
}

/* ------------------------------------------------------- Error boundary shim */

class ModelErrorBoundary extends Component<
  { fallback: ReactNode; resetKey: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* --------------------------------------------------------------- Watch model */

function WatchModel({ config }: { config: WatchConfig }) {
  // No GLB configured → render the procedural watch directly (no 404 fetch).
  if (!config.model) return <FallbackWatch config={config} />;
  // GLB present → use it; on a 404 / parse error fall back to procedural.
  return (
    <ModelErrorBoundary resetKey={config.id} fallback={<FallbackWatch config={config} />}>
      <Suspense fallback={<FallbackWatch config={config} />}>
        <GltfWatch config={config} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

/* ------------------------------------------------------------ Main renderer */

export function WatchRenderer() {
  const selectedWatchId = useARStore((s) => s.selectedWatchId);
  const mirrored = useARStore((s) => s.mirrored);
  const rotAdjust = useARStore((s) => s.rotAdjust);
  const scaleAdjust = useARStore((s) => s.scaleAdjust);
  const flipDial = useARStore((s) => s.flipDial);
  const config = getWatch(selectedWatchId);

  const groupRef = useRef<Group>(null);

  const anchor = useMemo(() => new WristAnchor(), []);
  const pose = useMemo(() => createWristPose(), []);
  // Tighter rest cutoff + gentler scale easing = a steady "locked" feel.
  const posSmoother = useMemo(() => new Vector3Smoother(1.0, 0.02), []);
  const quatSmoother = useMemo(() => new QuaternionSmoother(0.2, 1.5), []);
  const scaleSmoother = useMemo(() => new ScalarSmoother(0.12), []);

  const lastT = useRef(performance.now());
  const shown = useRef(false);
  const goodStreak = useRef(0);
  const badStreak = useRef(0);
  const lastPos = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT.current) / 1000));
    lastT.current = now;

    const frame = handTracker.latest;
    const ok = anchor.compute(
      frame,
      camera,
      { mirrored, forearmOffset: FOREARM_OFFSET, flipDial },
      pose,
    );

    // Trust a frame only when the solve succeeded, the score clears the bar, the
    // numbers are finite and (while shown) the pose didn't teleport. Everything
    // else is a misdetection we hold/hide rather than render as jitter.
    let good =
      ok &&
      pose.valid &&
      frame.score >= MIN_TRACK_SCORE &&
      Number.isFinite(pose.position.x) &&
      Number.isFinite(pose.position.y) &&
      Number.isFinite(pose.scale) &&
      pose.scale > 1e-4;
    if (good && shown.current && pose.position.distanceTo(lastPos) > MAX_POSE_JUMP * pose.scale) {
      good = false; // sudden teleport → glitch frame
    }

    if (good) {
      goodStreak.current++;
      badStreak.current = 0;
    } else {
      badStreak.current++;
      goodStreak.current = 0;
    }

    // Hysteresis: appear only after a few solid frames; disappear only after a
    // short bad run. Kills flicker and the jitter on shaky detections.
    if (!shown.current && goodStreak.current >= SHOW_AFTER_GOOD) {
      shown.current = true;
      posSmoother.reset();
      quatSmoother.reset();
      scaleSmoother.reset();
    } else if (shown.current && badStreak.current >= HIDE_AFTER_BAD) {
      shown.current = false;
    }

    if (shown.current && good) {
      const sp = posSmoother.update(pose.position, dt);
      const sq = quatSmoother.update(pose.quaternion, dt);
      const ss = scaleSmoother.update(pose.scale, dt);

      group.position.copy(sp);
      group.quaternion.copy(sq);
      group.scale.setScalar(ss * config.scale * WATCH_SCALE_FACTOR * scaleAdjust);
      group.visible = true;
      lastPos.copy(pose.position);
    } else if (shown.current) {
      // Bad frame within the grace period — hold the last good pose (no update)
      // so the watch stays put instead of jittering.
      group.visible = true;
    } else {
      group.visible = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Depth-only forearm — wraps the bracelet around the wrist. */}
      <OcclusionCylinder />
      {/* Per-model fine-tuning offset/rotation applied to the visible watch only. */}
      <group position={config.offset} rotation={config.rotation}>
        {/* Live debug rotation tweak (composed on top of config rotation). */}
        <group rotation={rotAdjust}>
          {/* Baked dial spin (native frame) — same axis the debug Z button uses. */}
          <group rotation={config.spin ?? [0, 0, 0]}>
            <WatchModel config={config} />
          </group>
        </group>
      </group>
    </group>
  );
}
