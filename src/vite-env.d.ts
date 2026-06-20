/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DeepAR Web SDK license key (bound to the serving domain). */
  readonly VITE_DEEPAR_LICENSE_KEY?: string;
  /** Optional override for the DeepAR asset root (defaults to the pinned CDN). */
  readonly VITE_DEEPAR_ROOT_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
