/**
 * AR screenshot system.
 *
 * Composites the live camera video and the (transparent) WebGL overlay into a
 * single PNG, mirroring the video to match what the user sees on screen. The
 * WebGL canvas must be created with `preserveDrawingBuffer: true` (see
 * CameraView) so its pixels can be read on demand.
 */

let videoEl: HTMLVideoElement | null = null;
let glCanvas: HTMLCanvasElement | null = null;
let mirrored = true;

export function registerCaptureSources(
  video?: HTMLVideoElement | null,
  canvas?: HTMLCanvasElement | null,
) {
  if (video !== undefined) videoEl = video;
  if (canvas !== undefined) glCanvas = canvas;
}

export function setCaptureMirrored(value: boolean) {
  mirrored = value;
}

export async function captureComposite(): Promise<Blob | null> {
  if (!videoEl || !glCanvas) return null;
  if (videoEl.videoWidth === 0) return null;

  const tw = glCanvas.width;
  const th = glCanvas.height;
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  // object-fit: cover mapping of the video into the canvas rect.
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const scale = Math.max(tw / vw, th / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (tw - dw) / 2;
  const dy = (th - dh) / 2;

  ctx.save();
  if (mirrored) {
    ctx.translate(tw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, tw - dx - dw, dy, dw, dh);
  } else {
    ctx.drawImage(videoEl, dx, dy, dw, dh);
  }
  ctx.restore();

  // The WebGL overlay is already in display orientation.
  ctx.drawImage(glCanvas, 0, 0, tw, th);

  return new Promise<Blob | null>((resolve) => {
    out.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}

export async function shareOrDownload(blob: Blob, filename = 'ar-watch.png') {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My AR watch try-on' });
      return;
    } catch {
      // user cancelled share — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
