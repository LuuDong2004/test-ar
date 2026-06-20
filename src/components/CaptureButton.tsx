import { useState } from 'react';
import { captureComposite, shareOrDownload } from '../ar/capture';

/** Shutter button: composites video + AR overlay and shares/saves a PNG. */
export function CaptureButton() {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  async function onCapture() {
    if (busy) return;
    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    try {
      const blob = await captureComposite();
      if (blob) await shareOrDownload(blob);
    } catch (e) {
      console.error('[capture] failed', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Capture flash overlay */}
      {flash && <div className="pointer-events-none absolute inset-0 z-50 bg-white animate-fade-in" />}

      <button
        onClick={onCapture}
        disabled={busy}
        aria-label="Capture photo"
        className="pointer-events-auto absolute bottom-32 left-1/2 z-30 flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-full ring-2 ring-white/70 backdrop-blur-sm transition active:scale-95"
      >
        <span
          className={`h-14 w-14 rounded-full bg-white transition-transform ${
            busy ? 'scale-75' : 'scale-100'
          }`}
        />
      </button>
    </>
  );
}
