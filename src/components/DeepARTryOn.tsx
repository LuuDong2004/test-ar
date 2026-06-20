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
 * DeepAR Web SDK try-on surface.
 *
 * DeepAR renders into its OWN canvas/engine (it cannot share the Three.js/R3F
 * scene), so this is a standalone page used to A/B against the MediaPipe build.
 * The SDK is initialised once; switching watches just calls switchEffect().
 *
 * Requires:
 *  - VITE_DEEPAR_LICENSE_KEY (a Web license key bound to this domain), and
 *  - for wrist effects, a `.deepar` file authored in DeepAR Studio.
 */
export function DeepARTryOn({ effect, wrist }: DeepARTryOnProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const deeparRef = useRef<DeepAR | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialise the SDK exactly once. The `cancelled` flag guards against React
  // StrictMode's double-mount grabbing the camera twice.
  useEffect(() => {
    let cancelled = false;
    const el = previewRef.current;
    if (!el) return;

    if (!LICENSE_KEY) {
      setError('Thiếu VITE_DEEPAR_LICENSE_KEY — thêm license key Web vào .env.local rồi chạy lại.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const instance = await initialize({
          licenseKey: LICENSE_KEY,
          previewElement: el, // DeepAR appends its canvas here and sizes it to fit
          rootPath: DEEPAR_ROOT_PATH, // wasm + ML models (incl. wrist) load from here
          effect,
          // Pre-init wrist tracking for watch effects so the first detection is fast.
          effectOptions: { trackingInit: { wrist } },
          additionalOptions: {
            // Wrist (watch) → rear camera to film the forearm; face effects (the
            // glasses smoke-test) → front camera so you can see your own face.
            cameraConfig: { facingMode: wrist ? 'environment' : 'user' },
          },
        });
        if (cancelled) {
          instance.shutdown();
          return;
        }
        deeparRef.current = instance;
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      deeparRef.current?.shutdown(); // releases the camera + GPU resources
      deeparRef.current = null;
    };
    // Init once; effect changes are handled by the switch effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch watches without re-initialising (keeps the camera running).
  useEffect(() => {
    const inst = deeparRef.current;
    if (!inst) return;
    inst.switchEffect(effect).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [effect]);

  return (
    <div className="absolute inset-0 h-full w-full bg-black">
      <div ref={previewRef} className="absolute inset-0 h-full w-full" />

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <p className="rounded-2xl bg-black/60 px-5 py-3 text-sm text-white/90 backdrop-blur">
            Đang khởi tạo DeepAR…
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
