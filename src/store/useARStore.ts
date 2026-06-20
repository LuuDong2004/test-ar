import { create } from 'zustand';
import { DEFAULT_WATCH_ID } from '../config/watches';

export type ARStatus = 'intro' | 'requesting' | 'denied' | 'ready';
export type FacingMode = 'user' | 'environment';

interface ARState {
  /** High-level app flow. */
  status: ARStatus;
  /** Currently selected watch id. */
  selectedWatchId: string;
  /** True while a GLB is being fetched/parsed. */
  modelLoading: boolean;
  /** True when a hand is currently tracked (throttled, UI hint only). */
  handVisible: boolean;
  /** Which camera is active. */
  facingMode: FacingMode;
  /** Mirror the camera (true for front/selfie cameras). */
  mirrored: boolean;
  /** Last fatal error message, if any. */
  error: string | null;
  /** Smoothed tracking FPS, updated about once per second. */
  fps: number;
  /** Developer overlay (landmark dots + occluder visible). */
  debug: boolean;
  /** Live orientation tweak applied on top of the model's config rotation (radians). */
  rotAdjust: [number, number, number];
  /** Live size multiplier applied on top of the model's config scale. */
  scaleAdjust: number;
  /** Flip the dial to the other side of the wrist (orientation sign override). */
  flipDial: boolean;

  setStatus: (s: ARStatus) => void;
  selectWatch: (id: string) => void;
  setModelLoading: (v: boolean) => void;
  setHandVisible: (v: boolean) => void;
  setMirrored: (v: boolean) => void;
  toggleCamera: () => void;
  setError: (e: string | null) => void;
  setFps: (n: number) => void;
  toggleDebug: () => void;
  /** Rotate the current watch by +90° about an axis (live tuning). */
  rotateAxis: (axis: 0 | 1 | 2) => void;
  /** Scale the current watch up/down by 10% (live tuning). */
  nudgeScale: (dir: 1 | -1) => void;
  /** Flip the dial to the other side of the wrist. */
  toggleFlip: () => void;
  resetAdjust: () => void;
}

export const useARStore = create<ARState>((set) => ({
  status: 'intro',
  selectedWatchId: DEFAULT_WATCH_ID,
  modelLoading: false,
  handVisible: false,
  facingMode: 'environment',
  mirrored: false,
  error: null,
  fps: 0,
  debug: false,
  rotAdjust: [0, 0, 0],
  scaleAdjust: 1,
  flipDial: false,

  setStatus: (status) => set({ status }),
  selectWatch: (selectedWatchId) => set({ selectedWatchId, modelLoading: true }),
  setModelLoading: (modelLoading) => set({ modelLoading }),
  setHandVisible: (handVisible) =>
    set((s) => (s.handVisible === handVisible ? s : { handVisible })),
  setMirrored: (mirrored) => set({ mirrored }),
  toggleCamera: () =>
    set((s) => {
      const facingMode: FacingMode = s.facingMode === 'user' ? 'environment' : 'user';
      return { facingMode, mirrored: facingMode === 'user' };
    }),
  setError: (error) => set({ error }),
  setFps: (fps) => set({ fps }),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  rotateAxis: (axis) =>
    set((s) => {
      const next: [number, number, number] = [...s.rotAdjust];
      next[axis] = (next[axis] + Math.PI / 2) % (Math.PI * 2);
      const deg = next.map((r) => Math.round((r * 180) / Math.PI));
      // Copy these into the watch's `rotation` (radians) in config/watches.ts.
      console.log(`[rotAdjust] degrees=[${deg.join(', ')}]  radians=[${next.join(', ')}]`);
      return { rotAdjust: next };
    }),
  nudgeScale: (dir) =>
    set((s) => {
      const scaleAdjust = Math.max(0.2, Math.min(5, s.scaleAdjust * (dir === 1 ? 1.1 : 1 / 1.1)));
      console.log(`[scaleAdjust] ${scaleAdjust.toFixed(3)}  → multiply the watch's config.scale by this`);
      return { scaleAdjust };
    }),
  toggleFlip: () =>
    set((s) => {
      console.log(`[flipDial] ${!s.flipDial}`);
      return { flipDial: !s.flipDial };
    }),
  resetAdjust: () => set({ rotAdjust: [0, 0, 0], scaleAdjust: 1, flipDial: false }),
}));
