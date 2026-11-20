/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Runtime configuration injected by the container entrypoint (public/config.js)
 * so one built image can be deployed to any hostname without a rebuild.
 */
interface PropertySaasRuntimeConfig {
  apiBaseUrl?: string
}

interface Window {
  __PROPERTY_SAAS_CONFIG__?: PropertySaasRuntimeConfig
}
