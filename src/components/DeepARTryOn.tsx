import { useEffect, useRef, useState } from 'react';
import { initialize, type DeepAR } from 'deepar';
import { DEEPAR_ROOT_PATH } from '../config/deeparEffects';

const LICENSE_KEY = (import.meta.env.VITE_DEEPAR_LICENSE_KEY as string | undefined) ?? '';

interface DeepARTryOnProps {
  /** URL of the .deepar effect to load. */
  effect: string;
  /** True when the effect needs wrist tracking (a watch). */
  wrist: boolean;
}

/**
 * DeepAR Web SDK try-on surface (own canvas; cannot share the Three.js scene).
 *
 * Init is decoupled from effect loading on purpose: initialize() only brings up
 * the camera (resolves fast), THEN switchEffect() loads the effect and lazily
 * pulls the wrist ML models (~5 MB). If we passed the effect + trackingInit into
 * initialize(), it would block on that whole download and look frozen on a
 * phone. This way the camera shows immediately and the watch appears when ready.
 */
export function DeepARTryOn({ effect, wrist }: DeepARTryOnProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const deeparRef = useRef<DeepAR | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // initialising camera
  const [switching, setSwitching] = useState(false); // loading the effect/models

  useEffect(() => {
    let cancelled = false;
    const el = previewRef.current;
    if (!el) return;

    if (!LICENSE_KEY) {
      setError('Thiếu VITE_DEEPAR_LICENSE_KEY — thêm license key Web vào env rồi deploy lại.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // 1) Camera + license only — no effect here so it resolves quickly.
        const instance = await initialize({
          licenseKey: LICENSE_KEY,
          previewElement: el,
          rootPath: DEEPAR_ROOT_PATH,
          additionalOptions: {
            cameraConfig: { facingMode: wrist ? 'environment' : 'user' },
          },
        });
        if (cancelled) {
          instance.shutdown();
          return;
        }
        deeparRef.current = instance;
        setLoading(false);

        // 2) Load the effect (lazily downloads + inits wrist tracking if needed).
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
    // The page remounts this component (key={id}) when the watch changes, so a
    // single init+load per mount is all we need.
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
