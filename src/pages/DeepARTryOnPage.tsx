import { useState } from 'react';
import { DeepARTryOn } from '../components/DeepARTryOn';
import { DEEPAR_EFFECTS, DEFAULT_DEEPAR_ID, getDeepAREffect } from '../config/deeparEffects';

/**
 * DeepAR watch try-on page (default engine). MediaPipe stays at `?engine=mediapipe`.
 *
 * IMPORTANT: DeepAR is initialised ONLY after the user taps "Bắt đầu", never on
 * page load. DeepAR counts usage (MAU) when the SDK initialises, so gating it
 * behind a tap means just opening the link costs nothing — and it satisfies the
 * iOS Safari rule that the camera can only start from a user gesture.
 */
export default function DeepARTryOnPage() {
  const [id, setId] = useState(DEFAULT_DEEPAR_ID);
  const [started, setStarted] = useState(false);
  const current = getDeepAREffect(id);
  const effect = current?.effect ?? '';

  const goToMediaPipe = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('engine', 'mediapipe');
    window.location.href = url.toString();
  };

  // --- Intro / start gate (no SDK init, no camera, no usage counted) ---------
  if (!started) {
    return (
      <main className="relative flex h-[100dvh] w-screen flex-col items-center justify-center overflow-hidden bg-[#0b0b0d] px-6 text-center text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#B8924A]">
          DEEPAR · WRIST TRY-ON
        </p>
        <h1 className="mt-3 font-serif text-2xl font-bold">Thử đồng hồ bằng AR</h1>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/55">
          Chọn mẫu rồi bấm Bắt đầu. Camera chỉ bật khi bạn bấm — mở trang không tốn lượt dùng.
        </p>

        {/* Pick an effect before starting */}
        <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
          {DEEPAR_EFFECTS.map((e) => (
            <button
              key={e.id}
              onClick={() => setId(e.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                e.id === id
                  ? 'border-[#B8924A] bg-[#B8924A]/20 text-[#f0d9a8]'
                  : 'border-white/15 bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
        {current?.note && <p className="mt-3 max-w-sm text-[11px] text-white/40">{current.note}</p>}

        <button
          onClick={() => setStarted(true)}
          className="mt-8 rounded-full bg-[#B8924A] px-10 py-3.5 text-sm font-bold text-white shadow-lg transition active:scale-95 hover:bg-[#a6803f]"
        >
          ▶ Bắt đầu thử AR
        </button>

        <button
          onClick={goToMediaPipe}
          className="mt-4 text-xs font-semibold text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
        >
          Dùng bản MediaPipe (cũ)
        </button>
      </main>
    );
  }

  // --- Live try-on (SDK initialised here) -----------------------------------
  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white">
      {effect && <DeepARTryOn key={id} effect={effect} wrist={!!current?.wrist} />}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4">
        <div className="leading-tight">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#B8924A]">
            DEEPAR · WRIST TRY-ON
          </p>
          {current?.name && <p className="text-xs font-semibold text-white/95">{current.name}</p>}
        </div>
        {/* Stop: unmounts DeepAR → shutdown() releases camera + stops usage */}
        <button
          onClick={() => setStarted(false)}
          className="pointer-events-auto rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition active:scale-95 hover:bg-white/25"
        >
          ✕ Dừng
        </button>
      </div>

      {/* Effect selector */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center gap-2 overflow-x-auto p-4">
        {DEEPAR_EFFECTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setId(e.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur transition active:scale-95 ${
              e.id === id
                ? 'border-[#B8924A] bg-[#B8924A]/20 text-[#f0d9a8]'
                : 'border-white/15 bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {e.name}
          </button>
        ))}
      </div>
    </main>
  );
}
