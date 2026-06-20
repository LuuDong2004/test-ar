import { CameraView } from '../components/CameraView';
import { WatchSelector } from '../components/WatchSelector';
import { CaptureButton } from '../components/CaptureButton';
import { LoadingScreen } from '../components/LoadingScreen';
import { useARStore } from '../store/useARStore';

/* ------------------------------------------------------------- Intro modal */

function IntroModal() {
  const setStatus = useARStore((s) => s.setStatus);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-black via-[#0a0a0c] to-black px-6 animate-fade-in">
      <div className="glass w-full max-w-sm rounded-3xl p-7 text-center animate-slide-up">
        <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-gold">
          Virtual Boutique
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">AR Watch Studio</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Try luxury timepieces on your own wrist in real time. Allow camera access,
          then hold your wrist in view — the watch tracks, scales and wraps naturally.
        </p>

        <ul className="mt-6 space-y-2 text-left text-xs text-white/50">
          <li>• Real-time hand &amp; wrist tracking</li>
          <li>• Realistic occlusion &amp; PBR materials</li>
          <li>• Works in your browser — no app needed</li>
        </ul>

        <button
          onClick={() => setStatus('requesting')}
          className="mt-7 w-full rounded-2xl bg-gold py-3.5 text-sm font-semibold uppercase tracking-[0.2em] text-black transition active:scale-[0.98]"
        >
          Enable Camera
        </button>
        <p className="mt-3 text-[10px] text-white/30">
          Camera frames are processed on-device and never uploaded.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Denied screen */

function DeniedScreen() {
  const setStatus = useARStore((s) => s.setStatus);
  const setError = useARStore((s) => s.setError);
  const error = useARStore((s) => s.error);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black px-6 animate-fade-in">
      <div className="glass w-full max-w-sm rounded-3xl p-7 text-center">
        <h2 className="text-xl font-semibold">Camera unavailable</h2>
        <p className="mt-3 text-sm text-white/60">{error ?? 'Camera permission is required.'}</p>
        <button
          onClick={() => {
            setError(null);
            setStatus('requesting');
          }}
          className="mt-6 w-full rounded-2xl bg-white py-3 text-sm font-semibold uppercase tracking-[0.2em] text-black transition active:scale-[0.98]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Top controls */

function TopControls() {
  const toggleCamera = useARStore((s) => s.toggleCamera);
  const toggleDebug = useARStore((s) => s.toggleDebug);
  const debug = useARStore((s) => s.debug);
  const fps = useARStore((s) => s.fps);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        {debug && (
          <span className="glass rounded-full px-3 py-1 text-xs font-medium tabular-nums text-white/80">
            {fps} fps
          </span>
        )}
      </div>
      <div className="pointer-events-auto flex gap-2">
        <button
          onClick={toggleCamera}
          aria-label="Flip camera"
          className="glass flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 7h3l2-2h8l2 2h3v12H3z" />
            <circle cx="12" cy="13" r="3.2" />
            <path d="M9 13a3 3 0 0 1 4-2.8M15 13a3 3 0 0 1-4 2.8" />
          </svg>
        </button>
        <button
          onClick={toggleDebug}
          aria-label="Toggle debug overlay"
          className={`glass flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 ${
            debug ? 'text-gold' : 'text-white/60'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- Debug rotate controls */

function RotateControls() {
  const debug = useARStore((s) => s.debug);
  const rotAdjust = useARStore((s) => s.rotAdjust);
  const scaleAdjust = useARStore((s) => s.scaleAdjust);
  const flipDial = useARStore((s) => s.flipDial);
  const rotateAxis = useARStore((s) => s.rotateAxis);
  const nudgeScale = useARStore((s) => s.nudgeScale);
  const toggleFlip = useARStore((s) => s.toggleFlip);
  const resetAdjust = useARStore((s) => s.resetAdjust);
  if (!debug) return null;

  const deg = rotAdjust.map((r) => Math.round((r * 180) / Math.PI));
  return (
    <div className="pointer-events-auto absolute left-3 top-20 z-30 flex flex-col gap-1.5 animate-fade-in">
      <p className="text-[10px] uppercase tracking-widest text-white/40">Rotate +90°</p>
      {(['X', 'Y', 'Z'] as const).map((label, i) => (
        <button
          key={label}
          onClick={() => rotateAxis(i as 0 | 1 | 2)}
          className="glass flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-white/90 active:scale-95"
        >
          {label}
        </button>
      ))}
      <span className="glass rounded-md px-1.5 py-1 text-center text-[9px] tabular-nums text-gold">
        {deg[0]},{deg[1]},{deg[2]}
      </span>

      <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">Size</p>
      <button
        onClick={() => nudgeScale(1)}
        className="glass flex h-9 w-9 items-center justify-center rounded-lg text-lg font-semibold text-white/90 active:scale-95"
      >
        +
      </button>
      <button
        onClick={() => nudgeScale(-1)}
        className="glass flex h-9 w-9 items-center justify-center rounded-lg text-lg font-semibold text-white/90 active:scale-95"
      >
        −
      </button>
      <span className="glass rounded-md px-1.5 py-1 text-center text-[9px] tabular-nums text-gold">
        ×{scaleAdjust.toFixed(2)}
      </span>

      <button
        onClick={toggleFlip}
        className={`glass mt-2 flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-semibold active:scale-95 ${
          flipDial ? 'text-gold' : 'text-white/80'
        }`}
      >
        FLIP
      </button>

      <button
        onClick={resetAdjust}
        className="glass mt-2 flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-semibold text-white/70 active:scale-95"
      >
        RST
      </button>
    </div>
  );
}

/* --------------------------------------------------------------------- Page */

export default function WatchTryOnPage() {
  const status = useARStore((s) => s.status);

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-black">
      {(status === 'requesting' || status === 'ready') && (
        <>
          <CameraView />
          <TopControls />
          <RotateControls />
          <CaptureButton />
          <WatchSelector />
        </>
      )}

      {status === 'requesting' && <LoadingScreen label="Starting camera" />}
      {status === 'intro' && <IntroModal />}
      {status === 'denied' && <DeniedScreen />}
    </main>
  );
}
