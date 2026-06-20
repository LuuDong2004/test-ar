import { useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { handTracker, Handedness } from '../ar/HandTracker';
import { useARStore } from '../store/useARStore';

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** Cap detection rate; rendering still runs at full display rate. */
const MAX_DETECT_FPS = 35;

/**
 * Loads the MediaPipe Hand Landmarker and runs the detection loop against the
 * given (already playing) video element. Results are pushed into the
 * `handTracker` singleton for the render loop to consume.
 */
export function useMediaPipe(videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const vfcRef = useRef<number | null>(null);

  const setHandVisible = useARStore((s) => s.setHandVisible);
  const setFps = useARStore((s) => s.setFps);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const minInterval = 1000 / MAX_DETECT_FPS;
    let lastDetect = 0;
    let lastTs = -1;
    // FPS accounting
    let frames = 0;
    let fpsWindowStart = 0;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        if (cancelled) return;
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }).catch(async (gpuErr) => {
          // Some mobile GPUs/drivers reject the GPU delegate — fall back to CPU.
          console.warn('[MediaPipe] GPU delegate failed, falling back to CPU', gpuErr);
          return HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
        startLoop();
      } catch (e) {
        console.error('[MediaPipe] init failed', e);
        if (!cancelled) setError('Failed to load hand-tracking model. Check your connection.');
      }
    }

    function process(nowMs: number) {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker) return;
      if (video.readyState < 2 || video.videoWidth === 0) return;
      if (nowMs - lastDetect < minInterval) return;
      lastDetect = nowMs;

      // detectForVideo requires a strictly increasing timestamp.
      let ts = Math.round(nowMs);
      if (ts <= lastTs) ts = lastTs + 1;
      lastTs = ts;

      let result: HandLandmarkerResult;
      try {
        result = landmarker.detectForVideo(video, ts);
      } catch (e) {
        console.warn('[MediaPipe] detect error', e);
        return;
      }

      const hasHand = result.landmarks.length > 0;
      if (hasHand) {
        const handednessLabel = result.handednesses?.[0]?.[0];
        const world = result.worldLandmarks?.[0];
        handTracker.set({
          present: true,
          landmarks: result.landmarks[0].map((p) => ({ x: p.x, y: p.y, z: p.z })),
          // Metric 3D landmarks drive the stable wrist basis + rotation-invariant
          // scale; fall back to empty if the runtime did not provide them.
          worldLandmarks: world ? world.map((p) => ({ x: p.x, y: p.y, z: p.z })) : [],
          handedness: (handednessLabel?.categoryName as Handedness) ?? 'Right',
          score: handednessLabel?.score ?? 1,
          timestamp: nowMs,
        });
      } else {
        handTracker.clear();
      }
      setHandVisible(hasHand);

      // FPS (averaged over ~1s windows)
      frames++;
      if (fpsWindowStart === 0) fpsWindowStart = nowMs;
      const elapsed = nowMs - fpsWindowStart;
      if (elapsed >= 1000) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        fpsWindowStart = nowMs;
      }
    }

    function startLoop() {
      const video = videoRef.current;
      if (!video) return;

      if (typeof video.requestVideoFrameCallback === 'function') {
        const onFrame = (now: number) => {
          if (cancelled) return;
          process(now);
          vfcRef.current = video.requestVideoFrameCallback(onFrame);
        };
        vfcRef.current = video.requestVideoFrameCallback(onFrame);
      } else {
        const onRaf = () => {
          if (cancelled) return;
          process(performance.now());
          rafRef.current = requestAnimationFrame(onRaf);
        };
        rafRef.current = requestAnimationFrame(onRaf);
      }
    }

    init();

    return () => {
      cancelled = true;
      const video = videoRef.current;
      if (vfcRef.current != null && video && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(vfcRef.current);
      }
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      handTracker.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { ready, error };
}
