import { useEffect, useRef, useState } from 'react';
import { initialize, type DeepAR } from 'deepar';
import { DEEPAR_ROOT_PATH } from '../config/deeparEffects';

const LICENSE_KEY = (import.meta.env.VITE_DEEPAR_LICENSE_KEY as string | undefined) ?? '';

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
 * We manage the camera ourselves (disableDefaultCamera + startCamera) because
 * DeepAR mirrors the preview by default — wrong for a rear-camera watch try-on.
 * Mirror is on only for the selfie/face camera. Init is also decoupled from the
 * effect download so the camera shows immediately and the watch loads after.
 */
export function DeepARTryOn({ effect, wrist, facing }: DeepARTryOnProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const deeparRef = useRef<DeepAR | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // bringing up the camera
  const [switching, setSwitching] = useState(false); // loading effect/models
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

    (async () => {
      try {
        // 1) Init SDK only — we start the camera ourselves for mirror control.
        const instance = await initialize({
          licenseKey: LICENSE_KEY,
          previewElement: el,
          rootPath: DEEPAR_ROOT_PATH,
          additionalOptions: { cameraConfig: { disableDefaultCamera: true } },
        });
        if (cancelled) {
          instance.shutdown();
          return;
        }
        deeparRef.current = instance;

        // Wrist detection signal (only fires while a wrist effect is loaded).
        instance.callbacks.onWristTracked = (d) => {
          if (!cancelled) setWristDetected(!!d?.detected);
        };

        // 2) Start the chosen camera with correct mirroring.
        await instance.startCamera({
          mirror,
          mediaStreamConstraints: {
            video: { facingMode: { ideal: facing } },
            audio: false,
          },
        });
        if (cancelled) return;
        setLoading(false);

        // 3) Load the effect (lazily pulls the wrist models on first use).
        setSwitching(true);
        await instance.switchEffect(effect);
        if (!cancelled) setSwitching(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
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
    // Remounted (key) when watch/camera changes, so a single setup per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 h-full w-full bg-black">
      <div ref={previewRef} className="absolute inset-0 h-full w-full" />

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <p className="rounded-2xl bg-black/60 px-5 py-3 text-sm text-white/90 backdrop-blur">
            Đang bật camera…
          </p>
        </div>
      )}

      {switching && !error && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
          <p className="rounded-full bg-black/60 px-4 py-2 text-xs text-white/85 backdrop-blur">
            {wrist ? 'Đang tải mẫu đồng hồ (lần đầu hơi lâu)…' : 'Đang tải hiệu ứng…'}
          </p>
        </div>
      )}

      {/* Wrist not found hint — the watch only appears when a wrist is detected. */}
      {wrist && !loading && !switching && !error && !wristDetected && (
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
