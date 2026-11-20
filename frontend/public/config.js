// Default runtime configuration for the local Vite development server.
//
// The production image overwrites this file at container start-up (see
// docker/40-app-config.sh) so a single build works on any hostname. An absent
// `apiBaseUrl` falls back to the build-time VITE_API_BASE_URL value.
window.__PROPERTY_SAAS_CONFIG__ = window.__PROPERTY_SAAS_CONFIG__ || {}
