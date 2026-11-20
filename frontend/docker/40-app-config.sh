#!/bin/sh
# Render the SPA runtime configuration at container start-up so a single image
# can be deployed to any hostname without a rebuild.
#
#   API_BASE_URL  absolute public origin of the API, e.g. https://app.example.com
#                 When unset the SPA calls its own origin (same-origin /api),
#                 which is what the bundled Nginx reverse proxy expects.
set -eu

target="/usr/share/nginx/html/config.js"
api_base_url="${API_BASE_URL:-}"

# The value is written into a JavaScript file, so refuse anything that could
# break out of the string literal.
case "$api_base_url" in
  *\"*|*\\*|*" "*|*"<"*|*">"*)
    echo "40-app-config: API_BASE_URL must be a bare http(s) origin without quotes, spaces or angle brackets" >&2
    exit 1
    ;;
esac

cat > "$target" <<EOF
window.__PROPERTY_SAAS_CONFIG__ = { apiBaseUrl: "${api_base_url}" || window.location.origin }
EOF
