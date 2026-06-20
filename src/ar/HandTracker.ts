/**
 * HandTracker — the bridge between the MediaPipe detection loop and the
 * Three.js render loop.
 *
 * The detection loop (useMediaPipe) and the render loop (WatchRenderer's
 * useFrame) run at different rates. Pushing every landmark frame through React
 * state would trigger hundreds of re-renders per second. Instead we keep the
 * latest frame in this mutable singleton; the render loop reads `latest` each
 * frame. Discrete UI state (selected watch, tracking on/off) stays in Zustand.
 */

/** MediaPipe hand-landmark indices we rely on. */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
  RING_MCP: 13,
  PINKY_MCP: 17,
} as const;

export interface Landmark {
  x: number; // normalized 0..1, image space, origin top-left
  y: number; // normalized 0..1
  z: number; // relative depth (smaller = closer to camera), ~same scale as x
}

export type Handedness = 'Left' | 'Right';

export interface HandFrame {
  present: boolean;
  /** 21 normalized landmarks in image space (origin top-left, 0..1). */
  landmarks: Landmark[];
  /**
   * 21 world landmarks — real-world 3D coordinates in METRES, origin at the
   * hand's geometric centre. Unlike the image landmarks these preserve the true
   * 3D shape regardless of how the hand is rotated, so a palm normal computed
   * from them does not collapse when the palm faces the camera. This is the
   * foundation for a stable wrist basis. May be empty if MediaPipe omitted it.
   */
  worldLandmarks: Landmark[];
  handedness: Handedness;
  /** Detection confidence 0..1. */
  score: number;
  /** performance.now() timestamp of this frame. */
  timestamp: number;
}

const EMPTY: HandFrame = {
  present: false,
  landmarks: [],
  worldLandmarks: [],
  handedness: 'Right',
  score: 0,
  timestamp: 0,
};

class HandTrackerStore {
  latest: HandFrame = EMPTY;

  /** True once any hand has been seen this session (drives "show your wrist" hint). */
  hasSeenHand = false;

  set(frame: HandFrame) {
    this.latest = frame;
    if (frame.present) this.hasSeenHand = true;
  }

  clear() {
    this.latest = EMPTY;
  }
}

/** Process-wide singleton. */
export const handTracker = new HandTrackerStore();
