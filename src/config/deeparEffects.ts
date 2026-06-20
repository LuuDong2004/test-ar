import { version as deeparVersion } from 'deepar';

const CDN = `https://cdn.jsdelivr.net/npm/deepar@${deeparVersion}`;

/**
 * DeepAR asset roots.
 *  - WRIST self-hosts the wasm + wrist models from `public/deepar` (same origin
 *    as the app, served by Vercel with a 1-year immutable cache) so it loads
 *    fast and is cached after the first visit — no repeated CDN fetch.
 *  - The face smoke-test stays on the CDN (we don't self-host face models).
 * Override the self-hosted root with VITE_DEEPAR_ROOT_PATH if needed.
 */
// Versioned path (matches deepar@5.6.3) so a future SDK bump gets a fresh URL —
// the 1-year immutable cache below would otherwise serve a stale, version-skewed
// deepar.wasm and crash with an embind LinkError.
export const DEEPAR_ROOT_SELF =
  (import.meta.env.VITE_DEEPAR_ROOT_PATH as string | undefined) || '/deepar563';
export const DEEPAR_ROOT_CDN = `${CDN}/`;

/** Base URL for the effect files bundled with the SDK (face filters, smoke-test). */
const SDK_EFFECTS = `${CDN}/effects`;

export interface DeepAREffect {
  /** Stable id (kept parallel to config/watches.ts where it maps to a watch). */
  id: string;
  name: string;
  /** URL of the .deepar effect (CDN face filter, or /effects/*.deepar you author). */
  effect: string;
  /** Whether the effect needs wrist tracking (a watch) vs face (the smoke-test). */
  wrist: boolean;
  /** Short hint shown in the UI. */
  note?: string;
}

/**
 * Effects shown in the DeepAR try-on page.
 *
 *  - The first entry is a FACE filter served from the CDN. It needs NO custom
 *    asset, so it verifies the whole pipeline (license key + camera + SDK init +
 *    switchEffect) works BEFORE you invest in authoring a wrist effect.
 *  - The wrist entries point at `/effects/<id>.deepar` — drop the .deepar files
 *    you export from DeepAR Studio into `public/effects/` and they light up.
 */
export const DEEPAR_EFFECTS: DeepAREffect[] = [
  {
    id: 'face-test',
    name: 'Test SDK (kính — mặt)',
    effect: `${SDK_EFFECTS}/aviators`,
    wrist: false,
    note: 'Xác minh DeepAR + camera + license key chạy được (không cần file cổ tay).',
  },
  {
    id: 'chrono',
    name: 'Đồng hồ Chronograph (cổ tay)',
    effect: '/effects/chrono.deepar',
    wrist: true,
    note: 'Cần file chrono.deepar (tạo từ GLB trong DeepAR Studio) đặt ở public/effects/.',
  },
];

export const DEFAULT_DEEPAR_ID = DEEPAR_EFFECTS[0]?.id ?? '';

export function getDeepAREffect(id: string): DeepAREffect | undefined {
  return DEEPAR_EFFECTS.find((e) => e.id === id);
}
