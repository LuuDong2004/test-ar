import { useState } from 'react';
import { DeepARTryOn } from '../components/DeepARTryOn';
import { DEEPAR_EFFECTS, DEFAULT_DEEPAR_ID, getDeepAREffect } from '../config/deeparEffects';

/**
 * Standalone DeepAR watch try-on page, mounted at `?engine=deepar` so it can be
 * A/B-compared with the MediaPipe build at the same URL without `?engine`.
 */
export default function DeepARTryOnPage() {
  const [id, setId] = useState(DEFAULT_DEEPAR_ID);
  const current = getDeepAREffect(id);
  const effect = current?.effect ?? '';

  const backToMediaPipe = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('engine');
    window.location.href = url.toString();
  };

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
        <button
          onClick={backToMediaPipe}
          className="pointer-events-auto rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition active:scale-95 hover:bg-white/25"
        >
          ↩ MediaPipe
        </button>
      </div>

      {/* Hint for the current effect */}
      {current?.note && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
          <p className="max-w-md rounded-xl bg-black/55 px-4 py-2 text-center text-[11px] text-white/70 backdrop-blur">
            {current.note}
          </p>
        </div>
      )}

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
