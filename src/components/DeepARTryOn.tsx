import { useEffect, useRef, useState } from 'react';
import { initialize, type DeepAR } from 'deepar';
import { DEEPAR_ROOT_SELF, DEEPAR_ROOT_CDN } from '../config/deeparEffects';

const LICENSE_KEY = (import.meta.env.VITE_DEEPAR_LICENSE_KEY as string | undefined) ?? '';

// Wrist assets are self-hosted (public/deepar) and pinned explicitly:
//  - the smaller FAST tracker (2.4 MB vs 3.6 MB) for a quicker first load;
//  - the REAL pose-estimation file name (libxzimgPoseEstimation.wasm) — the
//    SDK's documented default (libPoseEstimation.wasm) 404s and stalls init.
const ROOT = DEEPAR_ROOT_SELF.replace(/\/$/, '');
const WRIST_TRACKING_CONFIG = {
  poseEstimationWasmPath: `${ROOT}/wasm/libxzimgPoseEstimation.wasm`,
  detectorPath: `${ROOT}/models/wrist/wrist-det-9.bin`,
  trackerPath: `${ROOT}/models/wrist/wrist-track-181-fast-q.bin`,
  objPath: `${ROOT}/models/wrist/wrist-track.obj`,
  tfjsBackendWasmPath: `${ROOT}/wasm/tfjs-backend-wasm.wasm`,
  tfjsBackendWasmSimdPath: `${ROOT}/wasm/tfjs-backend-wasm-simd.wasm`,
  tfjsBackendWasmThreadedSimdPath: `${ROOT}/wasm/tfjs-backend-wasm-threaded-simd.wasm`,
};

interface DeepARTryOnProps {
  /** URL of the .deepar effect to load. */
  effect: string;
  /** True when the effect needs wrist tracking (a watch). */
  wrist: boolean;
  /** Which camera to use. */
  facing: 'user' | 'environment';
}

/**
 * DeepAR Web SDK try-on surface (own canvas; cannot share the Three.js scene).
 *
 * Loading happens in stages so the user always sees what's going on:
 *   camera → effect file → WRIST MODELS (~5 MB, lazy) → wrist detected → watch.
 * The wrist models load AFTER switchEffect resolves, so we keep a "loading
 * recognition" status until onWristTrackingInitialized fires — otherwise the
 * screen looks broken while 5 MB downloads silently.
 *
 * We also manage the camera ourselves (disableDefaultCamera + startCamera) to
 * turn OFF DeepAR's default mirroring for the rear-camera watch try-on.
 */
export function DeepARTryOn({ effect, wrist, facing }: DeepARTryOnProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const deeparRef = useRef<DeepAR | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // bringing up the camera
  const [switching, setSwitching] = useState(false); // loading effect file
  const [wristReady, setWristReady] = useState(false); // wrist models initialised
  const [wristDetected, setWristDetected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const el = previewRef.current;
    if (!el) return;

    if (!LICENSE_KEY) {
      setError('Thiếu VITE_DEEPAR_LICENSE_KEY — thêm license key Web vào env rồi deploy lại.');
      setLoading(false);
      return;
    }

    const mirror = facing === 'user'; // selfie mirrored; rear (wrist) NOT mirrored
    // Wrist self-hosts its assets (fast, cached); the face smoke-test uses the CDN.
    const rootPath = wrist ? DEEPAR_ROOT_SELF : DEEPAR_ROOT_CDN;
    const log = (m: string) => console.log(`[try-on] ${m}`);
    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} quá ${ms / 1000}s`)), ms))]);

    (async () => {
      try {
        log(`init start · wrist=${wrist} · facing=${facing} · root=${rootPath}`);
        // Let DeepAR start its OWN camera here (cameraConfig.facingMode) so wrist
        // tracking init receives frames — initialising it with the camera disabled
        // appears to deadlock. Force wrist init via trackingInit. Mirror control is
        // sacrificed for now (default camera) until tracking is confirmed working.
        void mirror;
        const instance = await withTimeout(
          initialize({
            licenseKey: LICENSE_KEY,
            previewElement: el,
            rootPath,
            effect,
            effectOptions: wrist ? { trackingInit: { wrist: true } } : undefined,
            additionalOptions: {
              cameraConfig: { facingMode: facing },
              ...(wrist ? { wristTrackingConfig: WRIST_TRACKING_CONFIG } : {}),
            },
          }),
          45000,
          'initialize',
        );
        if (cancelled) {
          instance.shutdown();
          return;
        }
        deeparRef.current = instance;
        setLoading(false);
        log(`init done · wristInit=${instance.isWristTrackingInitialized?.()}`);

        instance.callbacks.onWristTrackingInitialized = () => {
          log('✅ onWristTrackingInitialized');
          if (!cancelled) setWristReady(true);
        };
        let firstWrist = true;
        instance.callbacks.onWristTracked = (d) => {
          if (firstWrist) {
            log(`onWristTracked first · detected=${d?.detected}`);
            firstWrist = false;
          }
          if (!cancelled) setWristDetected(!!d?.detected);
        };

        if (wrist) {
          if (instance.isWristTrackingInitialized?.()) setWristReady(true);
          let ticks = 0;
          const poll = setInterval(() => {
            ticks++;
            const ok = deeparRef.current?.isWristTrackingInitialized?.();
            log(`wrist init check #${ticks}: ${ok}`);
            if (ok && !cancelled) setWristReady(true);
            if (ok || cancelled || ticks > 20) clearInterval(poll);
          }, 2000);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[try-on] ERROR:', e);
        if (!cancelled) {
          setError(msg);
          setLoading(false);
          setSwitching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      deeparRef.current?.shutdown();
      deeparRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Status text for the loading pill.
  const showCameraLoading = loading && !error;
  const showEffectLoading = !loading && switching && !error;
  const showWristLoading = !loading && !switching && !error && wrist && !wristReady;
  const showWristHint = !error && wrist && wristReady && !wristDetected;

  return (
    <div className="absolute inset-0 h-full w-full bg-black">
      <div ref={previewRef} className="absolute inset-0 h-full w-full" />

      {showCameraLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <p className="rounded-2xl bg-black/60 px-5 py-3 text-sm text-white/90 backdrop-blur">
            Đang bật camera…
          </p>
        </div>
      )}

      {(showEffectLoading || showWristLoading) && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
          <p className="flex items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-xs text-white/85 backdrop-blur">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-[#B8924A]" />
            {showWristLoading
              ? 'Đang tải bộ nhận diện cổ tay (~5MB, lần đầu hơi lâu)…'
              : 'Đang tải hiệu ứng…'}
          </p>
        </div>
      )}

      {showWristHint && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="rounded-2xl bg-black/55 px-5 py-3 backdrop-blur">
            <p className="text-sm font-medium text-white/90">Đưa cổ tay vào khung hình</p>
            <p className="mt-1 text-xs text-white/55">Camera sau · mu bàn tay hướng lên · cách ~30&nbsp;cm</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-black/80 p-6 text-center backdrop-blur">
            <p className="text-sm font-semibold text-red-400">DeepAR lỗi</p>
            <p className="mt-2 break-words text-xs text-white/70">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
