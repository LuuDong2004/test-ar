import { version as deeparVersion } from 'deepar';

/**
 * DeepAR Web SDK asset root. The SDK fetches its wasm + ML models (including the
 * wrist detector/tracker) from here. We pin it to the EXACT installed version on
 * jsDelivr so the JS and the assets never drift. Override with
 * VITE_DEEPAR_ROOT_PATH (e.g. "/deepar") if you later self-host the SDK files.
 */
export const DEEPAR_ROOT_PATH =
  (import.meta.env.VITE_DEEPAR_ROOT_PATH as string | undefined) ||
  `https://cdn.jsdelivr.net/npm/deepar@${deeparVersion}/`;

/** Base URL for the effect files bundled with the SDK (face filters, used for the pipeline smoke-test). */
const SDK_EFFECTS = `https://cdn.jsdelivr.net/npm/deepar@${deeparVersion}/effects`;

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
