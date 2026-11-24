# Deployment (Milestone F8)

Reproducible, Dockerized full stack for the Property SaaS platform:

```
browser ──► frontend (Nginx, SPA + /api reverse proxy)
                 │  internal Docker network only
                 ▼
            property-core (Spring Boot 4, Java 21)
                 │  internal Docker network only
                 ▼
            postgres (PostgreSQL 15, named volume)
```

Only the Nginx container publishes a host port. PostgreSQL and the backend stay
on the internal bridge network and are never reachable from the host or the
browser.

## Contents

| Path | Purpose |
| --- | --- |
| `docker-compose.yml` | The production-shaped stack (project `property-saas-f8`) |
| `docker-compose.qa.yml` | Overlay that names/labels the disposable QA database |
| `.env.example` | Placeholder-only template for `.env` |
| `../frontend/Dockerfile` | Multi-stage Node build → non-root Nginx runtime |
| `../frontend/nginx/` | SPA routing, caching, security headers, `/api` proxy |
| `../frontend/docker/40-app-config.sh` | Renders `/config.js` at container start-up |
| `../backend/property-core/Dockerfile` | Multi-stage Maven build → JRE 21 runtime |

## 1. Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose version`).
- ~4 GB free disk for images plus a build cache.
- `openssl` (only to generate secrets).
- For local, non-Docker development: Node.js 22 + npm, and JDK 21 (or use the
  committed `./mvnw` wrapper).

## 2. Required environment variables

Copy the template and replace every placeholder:

```sh
cd deploy
cp .env.example .env
```

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | yes | – | Database password. |
| `JWT_SECRET` | yes | – | Base64, ≥ 32 decoded bytes (HS256). |
| `BROWSER_CSRF_SECRET` | yes | – | Base64, ≥ 32 decoded bytes (CSRF HMAC). |
| `POSTGRES_DB` | no | `property_management` | |
| `POSTGRES_USER` | no | `property_admin` | |
| `PUBLIC_ORIGIN` | yes in practice | `http://localhost:8080` | Exact browser Origin for the CSRF/Origin allowlist. |
| `SPRING_PROFILES_ACTIVE` | no | `development` | Must be **empty** in production. |
| `FRONTEND_PORT` | no | `8080` | The only host-published port. |
| `API_BASE_URL` | no | empty | Empty ⇒ the SPA calls its own origin (`/api`). |
| `BROWSER_ALLOWED_ORIGINS` / `BROWSER_DEV_ALLOWED_ORIGINS` | no | `PUBLIC_ORIGIN` | Comma-separated exact Origins. |

`.env` is git-ignored (root `.gitignore`: `.env`, `.env.*`, `!.env.example`).
Never commit real secrets.

## 3. Secure secret generation

```sh
POSTGRES_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)
BROWSER_CSRF_SECRET=$(openssl rand -base64 32)
```

The backend validates at start-up that both signing secrets decode to at least
32 bytes; a short value fails fast instead of silently weakening the tokens.

## 4. Docker build commands

```sh
cd deploy

# Build both images (no buildx required).
docker compose build

# …or build a single service.
docker compose build property-core
docker compose build frontend
```

Build arguments (optional, in the Dockerfiles):

- frontend: `NODE_VERSION` (default `22-alpine`), `NGINX_VERSION` (default `1.27-alpine`).
- backend: `MAVEN_IMAGE` (default `maven:3.9-eclipse-temurin-21`), `JRE_IMAGE` (default `eclipse-temurin:21-jre-alpine`).

## 5. Docker Compose startup

```sh
cd deploy

# Start the whole stack (build if needed).
docker compose up -d --build

# Start and follow logs.
docker compose up --build

# Stop and remove containers (named volumes are preserved).
docker compose down
```

Then open `http://localhost:${FRONTEND_PORT}` (default `http://localhost:8080`).

Startup order is health-gated: `postgres` must pass `pg_isready`, then
`property-core` must report healthy on `/actuator/health` (datasource + Flyway
ready), then `frontend` starts. Because the backend waits for a healthy
database, Flyway migrations run exactly once on the first start.

Property, unit, and renter identifying images are stored in PostgreSQL (JPEG or
PNG, up to 5 MB and 10 megapixels each). They are included in PostgreSQL backups
and persist with the database volume.

## 6. Local development

Start PostgreSQL and make sure the repository-root `.env` contains its
`POSTGRES_PASSWORD`, a base64-encoded `JWT_SECRET`, and a separate
base64-encoded `BROWSER_CSRF_SECRET`. Generate each missing signing key
independently with `openssl rand -base64 32`.

Open the repository root in VS Code and choose **Property Core (local development)**
from **Run and Debug**. The launch profile reads the root `.env` and activates the
Spring development profile. To start the same backend from a terminal at the
repository root, run:

```sh
(
  set -a
  . ./.env
  set +a
  cd backend/property-core
  ./mvnw -Dspring-boot.run.profiles=development spring-boot:run
)
```

From a second terminal at the repository root, run:

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

Open `http://localhost:5173`. The frontend's development API URL defaults to
`http://localhost:8081` in `frontend/.env.development`. If Vite uses another port,
set `BROWSER_DEV_ALLOWED_ORIGINS` to the exact URL Vite prints and restart the
backend. Use the same hostname for both services so browser session cookies work.
The development profile uses the `dev-refresh` cookie with `Secure=false`.

## 7. Dockerized development / testing

The QA path uses a **disposable** PostgreSQL container so it can never touch the
long-lived development volume:

```sh
cd frontend
npm run qa:e2e     # spins up a throwaway Postgres, runs backend + Playwright
```

To run the browser suites against the Compose stack instead, start it with the
QA overlay and point Playwright at it:

```sh
cd deploy
docker compose -f docker-compose.yml -f docker-compose.qa.yml up -d --build

cd ../frontend
QA_DB_CONTAINER=property-saas-f8-postgres-qa \
QA_DB_LABEL=f8 \
QA_DB_USER=property_admin \
QA_DB_NAME=property_management \
QA_API_URL=http://localhost:8091 \
QA_APP_URL=http://localhost:8091 \
npx playwright test
```

The fixture refuses to run any SQL unless the target container carries the
`property-saas.qa` label, keeping seeding/cleanup away from real data.

## 8. Production deployment considerations

- **HTTPS is mandatory.** Run the stack behind a TLS-terminating reverse proxy
  (or ingress) that sends `X-Forwarded-Proto: https`.
- Set `SPRING_PROFILES_ACTIVE=` **empty** so `app.browser.cookie-mode=production`
  applies and the refresh cookie becomes `__Host-refresh` with `Secure`.
- Set `PUBLIC_ORIGIN` (and/or `BROWSER_ALLOWED_ORIGINS`) to the exact public
  `https://` origin, e.g. `https://app.example.com`. Mismatched Origins are
  rejected with `403` on every unsafe `/api/v1/browser-auth/**` request.
- Leave `API_BASE_URL` empty to use same-origin `/api`, or set it to the API's
  public origin if the API is served from a different hostname.
- No build-time secrets: the SPA bundle contains no URLs or credentials; the
  API origin is injected at container start-up via `/config.js`.
- Run one image per environment; changing only configuration needs no rebuild.

### Reverse proxy / HTTPS notes

- The backend uses `server.forward-headers-strategy=none`, so it trusts the
  Origin/Host it receives rather than proxy headers. Terminate TLS at the proxy
  and forward the original `Host` and `Origin` unchanged.
- Preserve the `/api` prefix end to end; the Spring controllers are mapped under
  `/api/v1/...` and Nginx (`proxy_pass http://property-core:8081;`, no URI part)
  forwards the path verbatim.
- Do not strip or rewrite cookies; the refresh cookie relies on its
  `HttpOnly`/`Secure`/`SameSite=Strict`/`Path=/` attributes.

## 9. Cookie and CSRF requirements

- Access tokens live **in memory only** in the browser.
- The refresh token is an **HttpOnly** cookie (`__Host-refresh` in production,
  `dev-refresh` under the `development` profile) with `SameSite=Strict`,
  `Path=/`, and `Secure` in production.
- CSRF is **double-submit**: the SPA sends the `X-CSRF-TOKEN` header matching a
  signed CSRF cookie; the backend verifies the HMAC signature and a 3600 s TTL.
- Cookies are **not** disabled and the exact-Origin check is **not** weakened by
  the Docker setup. Proxy awareness is limited to what the app already trusts.

## 10. Database persistence

- Data lives in the named volume `f8_property_postgres_data`.
- `docker compose down` keeps the volume; only an explicit
  `docker compose down -v` deletes it.
- The development database (`infra/docker-compose.yml`, volume
  `infra_property_postgres_data`, container `property-saas-postgres`) is a
  **separate** stack and is never modified by these commands.

## 11. Health checks

| Service | Probe |
| --- | --- |
| `postgres` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` |
| `property-core` | `wget -q -O- http://127.0.0.1:8081/actuator/health` |
| `frontend` | `wget -q -O- http://127.0.0.1:8080/healthz` |

```sh
docker compose ps          # STATUS column shows (healthy)
curl -s localhost:8091/healthz
curl -s localhost:8091/api/actuator     # not exposed; health is internal only
```

## 12. Logs

```sh
docker compose logs -f                 # everything
docker compose logs -f property-core   # a single service
docker compose logs --tail 100 frontend
```

The backend logs to stdout; Nginx sends `access_log`/`error_log` to the
container stream.

## 13. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `POSTGRES_PASSWORD must be set` | `.env` missing or a required secret unset. |
| Backend restarts repeatedly | Bad datasource URL/credentials — check `docker compose logs property-core`. |
| `403 Request rejected` on login | Browser Origin not exactly in `BROWSER_ALLOWED_ORIGINS`. Add scheme + host + port, no trailing slash. |
| Login works, refresh fails over HTTP | You are in production cookie mode; use the `development` profile for local HTTP. |
| SPA loads but API 404s | Backend not healthy yet, or `/api` prefix was stripped in the proxy. |
| Port already in use | Another service owns `FRONTEND_PORT`; set a free port in `.env`. |
| Flyway validation error | Do not run schema auto-generation; migrations are the source of truth. |

## 14. Backup and restore

```sh
# Backup (creates a gzip'd SQL dump without touching any volume directly).
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz

# Restore into a fresh, empty database.
gunzip -c backup-2026-11-21.sql.gz | \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Restore only into a database you intend to overwrite.

## 15. Safe shutdown commands

```sh
cd deploy

docker compose stop            # stop containers, keep everything
docker compose down            # remove containers + network, KEEP volumes
docker compose down --rmi local  # also remove the built images (volumes kept)
```

**Never run** on this machine:

```sh
docker compose down -v         # deletes the named volume (all data)
docker volume prune
docker system prune --volumes
```

## 16. Test commands

```sh
# Frontend
cd frontend
npm ci
npm run typecheck     # tsc -b + tsc -p tsconfig.e2e.json
npm run lint          # eslint .
npm test              # vitest run
npm run build         # tsc -b && vite build
npm run qa:e2e        # disposable Postgres + backend + Playwright

# Backend (requires a reachable PostgreSQL)
cd backend/property-core
./mvnw test

# Compose configuration sanity
cd deploy
docker compose -f docker-compose.yml -f docker-compose.qa.yml config
```
