# syntax=docker/dockerfile:1
#
# Multi-stage image for the Property SaaS React frontend.
#
# Stage "build"   - compile the Vite/TypeScript bundle on a pinned Node.js LTS.
# Stage "runtime" - serve only the compiled assets from a non-root Nginx.
#
# The API base URL is deliberately NOT baked into the bundle. The SPA always
# calls relative /api/... paths on its own origin and Nginx reverse-proxies
# those to Spring Boot, so one image works unchanged on localhost, staging and
# production hostnames.

ARG NODE_VERSION=22-alpine
ARG NGINX_VERSION=1.27-alpine

# ---------------------------------------------------------------- build -------
FROM node:${NODE_VERSION} AS build

WORKDIR /app

# Reproducible dependency installation from the committed lockfile.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Only the sources required by `tsc -b` and `vite build` (see .dockerignore).
COPY index.html ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY public ./public
COPY src ./src

# `npm run build` runs `tsc -b && vite build`; no source maps are emitted.
RUN npm run build

# -------------------------------------------------------------- runtime -------
# nginx-unprivileged already runs as UID 101 and listens on port 8080, so no
# container process needs root at runtime.
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION} AS runtime

LABEL org.opencontainers.image.title="property-saas-frontend" \
      org.opencontainers.image.description="Property SaaS React SPA served by non-root Nginx"

# Drop the packaged demo pages so the image serves only the compiled SPA.
USER root
RUN rm -rf /usr/share/nginx/html

# Full server configuration: SPA fallback, asset caching, security headers,
# health probe and the /api reverse proxy (kept root-owned/read-only for UID 101).
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf

# Runtime configuration hook: the base image runs every /docker-entrypoint.d
# script before Nginx starts, so the SPA API origin can be set per deployment.
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod 755 /docker-entrypoint.d/40-app-config.sh

# Ship only the compiled frontend artifacts: no node_modules, sources,
# environment files or test artifacts reach the runtime image.
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -q -O- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
