import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { WatchRenderer } from '../ar/WatchRenderer';
import { useARStore } from '../store/useARStore';
import { registerCaptureSources, setCaptureMirrored } from '../ar/capture';
import { handTracker, LM } from '../ar/HandTracker';

/* --------------------------------------------------- Adaptive render throttle */

/** Render FPS cap while a hand is tracked. */
const ACTIVE_FPS = 40;
/** Render FPS while idle (no hand) — just enough to detect re-acquisition. */
const IDLE_FPS = 8;

/**
 * Caps the WebGL render rate. With `frameloop="demand"` the scene only renders
 * when we call invalidate(); we drive that at ACTIVE_FPS when a hand is present
 * and drop to IDLE_FPS otherwise. This avoids re-drawing the watch 120×/s on
 * ProMotion displays (the pose only updates at the ~35 fps tracking rate) and
 * saves battery/heat when nothing is on screen.
 */
function RenderThrottle() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const fps = handTracker.latest.present ? ACTIVE_FPS : IDLE_FPS;
      if (t - last >= 1000 / fps) {
        last = t;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [invalidate]);
  return null;
}

/* ----------------------------------------------------------------- 3D scene */

function Scene() {
  return (
    <>
      <RenderThrottle />
      {/* Soft fill + key light. */}
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#ffffff', '#404048', 0.5]} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#aab4ff" />

      {/* Studio reflections for the metal — baked once, no external HDR download. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#0a0a0c']} />
        <Lightformer intensity={2.2} position={[0, 3, 2]} scale={[6, 3, 1]} color="#ffffff" />
        <Lightformer intensity={1.1} position={[-3, 1, 2]} scale={[3, 6, 1]} color="#c9d4ff" />
        <Lightformer intensity={1.1} position={[3, 1, 2]} scale={[3, 6, 1]} color="#fff0d0" />
        <Lightformer intensity={0.8} position={[0, -2, 1]} scale={[6, 2, 1]} color="#606070" />
      </Environment>

      <WatchRenderer />
    </>
  );
}

/* ------------------------------------------------------- Debug landmark dots */

function DebugOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mirrored = useARStore((s) => s.mirrored);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const w = (canvas.width = canvas.clientWidth);
        const h = (canvas.height = canvas.clientHeight);
        ctx.clearRect(0, 0, w, h);
        const f = handTracker.latest;
        // Verification HUD: confirms the NEW pipeline is live. "world" must read
        // 21 — if it shows 0, worldLandmarks aren't flowing (stale build/bug).
        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = f.present && f.worldLandmarks.length >= 21 ? '#39ff88' : '#ff5b5b';
        ctx.fillText(
          f.present
            ? `world LM: ${f.worldLandmarks.length}/21 · score ${f.score.toFixed(2)} · ${f.handedness}`
            : 'no hand',
          14,
          26,
        );
        if (f.present) {
          f.landmarks.forEach((p, i) => {
            const x = (mirrored ? 1 - p.x : p.x) * w;
            const y = p.y * h;
            const key = i === LM.WRIST || i === LM.INDEX_MCP || i === LM.PINKY_MCP;
            ctx.beginPath();
            ctx.arc(x, y, key ? 7 : 3, 0, Math.PI * 2);
            ctx.fillStyle = key ? '#c8a24a' : 'rgba(255,255,255,0.6)';
            ctx.fill();
          });
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mirrored]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/* ------------------------------------------------------------- Camera view */

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const facingMode = useARStore((s) => s.facingMode);
  const mirrored = useARStore((s) => s.mirrored);
  const debug = useARStore((s) => s.debug);
  const handVisible = useARStore((s) => s.handVisible);
  const setStatus = useARStore((s) => s.setStatus);
  const setError = useARStore((s) => s.setError);

  const [streamReady, setStreamReady] = useState(false);

  // Acquire (and re-acquire on camera flip) the video stream.
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    setStreamReady(false);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setStreamReady(true);
        setStatus('ready');
      } catch (e) {
        console.error('[camera] getUserMedia failed', e);
        if (!cancelled) {
          setError('Camera access was blocked. Enable camera permission and reload.');
          setStatus('denied');
        }
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, setStatus, setError]);

  const { error: mpError } = useMediaPipe(videoRef, streamReady);
  useEffect(() => {
    if (mpError) setError(mpError);
  }, [mpError, setError]);

  // Keep capture sources / mirror flag in sync.
  useEffect(() => setCaptureMirrored(mirrored), [mirrored]);
  useEffect(() => {
    registerCaptureSources(videoRef.current ?? null, undefined);
  }, [streamReady]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
      />

      <Canvas
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: 'none' }}
        frameloop="demand"
        dpr={[1, 2]}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        }}
        camera={{ fov: 45, position: [0, 0, 3], near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          registerCaptureSources(undefined, gl.domElement);
        }}
      >
        <Scene />
      </Canvas>

      {debug && <DebugOverlay />}

      {/* "Show your wrist" hint */}
      {!handVisible && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 animate-fade-in">
          <div className="glass rounded-2xl px-5 py-3 text-center">
            <p className="text-sm font-medium tracking-wide text-white/90">
              Point the camera at your wrist
            </p>
            <p className="mt-1 text-xs text-white/50">Hold your hand ~30&nbsp;cm away</p>
          </div>
        </div>
      )}
    </div>
  );
}
