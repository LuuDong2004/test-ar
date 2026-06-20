/**
 * WebGL float-extension shim for DeepAR's (deprecated) wrist tracker.
 *
 * DeepAR's wrist/pose pipeline allocates FLOAT render targets but never enables
 * the WebGL2 extensions that make float colour buffers renderable. In WebGL2
 * these are NOT in core — you must call getExtension(). Without them the SDK
 * throws "renderbufferStorage: invalid internalformat" and wrist init stalls
 * forever (face effects use 8-bit targets, so they work).
 *
 * A WebGL extension stays enabled for a context once getExtension() is called by
 * ANYONE, so we pre-enable them on every context the page creates BEFORE DeepAR
 * makes its own. (Caveat: if DeepAR runs GL inside a Web Worker realm, this
 * main-thread patch can't reach it.)
 */
const FLOAT_EXTS = [
  'EXT_color_buffer_float',
  'EXT_color_buffer_half_float',
  'OES_texture_float_linear',
  'OES_texture_half_float_linear',
];

function patchGetContext(ctor: unknown) {
  const proto = (ctor as { prototype?: { getContext?: unknown } } | undefined)?.prototype;
  if (!proto || typeof proto.getContext !== 'function') return;
  const orig = proto.getContext as (...a: unknown[]) => unknown;
  proto.getContext = function (this: unknown, type: string, attrs?: unknown) {
    const ctx = orig.call(this, type, attrs) as { getExtension?: (n: string) => unknown } | null;
    if (ctx && typeof type === 'string' && /webgl2/i.test(type)) {
      for (const ext of FLOAT_EXTS) {
        try {
          ctx.getExtension?.(ext);
        } catch {
          /* ignore */
        }
      }
    }
    return ctx;
  };
}

patchGetContext((globalThis as { HTMLCanvasElement?: unknown }).HTMLCanvasElement);
patchGetContext((globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas);
