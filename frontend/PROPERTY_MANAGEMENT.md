# Property management

Property requests use the active verified organization and authenticated in-memory session. The backend checks active membership and tenant ownership for each request. The organization context includes the user, organization and role in query keys, cancels queries on organization changes, and rejects late results. UI permission checks use the existing `PROPERTY_MANAGE` role mapping and do not replace server authorization.

The property API is rooted at `/api/v1/organizations/{organizationId}/properties`:

- `GET` lists server-side pages using zero-based `page` and `size` parameters.
- `POST` creates a property.
- `GET /{propertyId}` loads details.
- `PATCH /{propertyId}` updates the editable fields.
- `PATCH /{propertyId}/archive` archives without deleting the record. Archived properties remain listed.

The UI supports list refresh, paging, create, details, edit and archive confirmation. Property details link to the integrated F5 unit workflow. Registration setup and browser-authentication limits are documented in `AUTHENTICATION.md`.

From `frontend`, run `npm test`, `npm run lint`, and `npm run build`. With the isolated local setup in `AUTHENTICATION.md`, run `node frontend/scripts/property-browser-integration.mjs` from the repository root to exercise create, view, edit and archive against PostgreSQL. The script creates isolated test users and records; do not run it against valuable or production data.

## Unit management (F5)

Open Properties → property details → Manage Units. The property remains the context for listing, creation, details and editing. Routes are `/properties/:propertyId/units`, `/new`, `/:unitId`, and `/:unitId/edit` under that base. No demonstration unit data is used.

The unit API base is `/api/v1/organizations/{organizationId}/properties/{propertyId}/units`:

| Request | Contract |
| --- | --- |
| GET base | Zero-based `page`, `size` 1–100; response `content`, `page`, `size`, `totalElements`, `totalPages`, `first`, `last` |
| POST base | `unitNumber` (required, trimmed, max 50), `unitType` (APARTMENT/OFFICE/SHOP/OTHER), nullable `floorNumber` (32-bit integer), nullable `areaSqm` (positive, max 10 integer digits and 2 fractional digits) |
| GET /{unitId} | Unit attributes plus `id`, `propertyId`, `availabilityStatus`, `createdAt`, `updatedAt` |
| PATCH /{unitId} | Editable attribute fields only; null clears floor or area. The form sends these four allowed fields, never identifiers or availability. |
| PATCH /{unitId}/availability | `{ availabilityStatus: AVAILABLE or UNAVAILABLE }`, through a separate confirmation |

Creation defaults to AVAILABLE on the backend. All three statuses (AVAILABLE, UNAVAILABLE, OCCUPIED) have text labels and distinct colors. Unknown statuses display an explicit fallback and offer no availability action. Only AVAILABLE ↔ UNAVAILABLE is exposed manually. OCCUPIED cannot be selected in any form; manual transitions both to and from it are reserved for lease management. Backend conflicts trigger authoritative detail/list/parent refresh.

OWNER, ADMIN and MANAGER have PROPERTY_MANAGE and can mutate units; STAFF can read. Routes and controls reuse F3 permissions. The backend verifies membership, permission, property organization and unit ownership for every applicable operation. Unit list and detail query keys contain verified organization/user/role plus property ID (and unit ID or paging). Requests use F3 transport, refresh coordination and memory-only access tokens. Organization changes cancel and clear scoped queries; keyed workspaces reset drafts/paging and ignore old mutation completion, navigation and feedback. Abort signals are passed to reads.

Archived properties preserve unit list/details access, but prohibit unit creation, attribute editing and availability changes. The UI explains this, removes write controls, rechecks the parent immediately before writes, refreshes on focus and polls parent state every 30 seconds. The server remains authoritative if archiving races a write.

Lists support refresh, page sizes 10/25/50/100, current page and totals, and server-driven navigation. An invalid final page moves to the final remaining page and fetches it. There is no unit removal or filtering API exposed by this milestone.

Forms validate the backend constraints, label required fields, announce validation/errors, prevent duplicate submissions and show pending state. Successful create/edit opens details with confirmation; availability changes refresh details and cached lists. HTTP 400, 401, 403, 404, 409 and network/timeout failures have safe messages. Error payloads are intentionally discarded by the shared transport, so a 409 explains duplicate number, archive and occupancy possibilities rather than claiming one specific cause. A 403 may also activate the existing F3 organization access-denied screen.

### F5 verification

From `frontend` run `npx tsc -b`, `npm test -- --maxWorkers=2`, `npm run lint`, and `npm run build`. Limiting Vitest workers avoids resource contention in constrained environments; it runs the entire suite. Unit tests cover server pages and final-page recovery, create/edit DTOs, duplicate conflicts, detail/status display, both manual availability transitions, occupancy prevention, archived/read-only controls, organization changes, stale list and mutation completion, input precision, HTTP failures and network failure.

Use a dedicated PostgreSQL database and login for backend and browser validation. Configure `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `BROWSER_CSRF_SECRET` and `BROWSER_ALLOWED_ORIGINS` as described in the backend authentication documentation. From `backend/property-core`, run:

```sh
./mvnw -o '-Dtest=Unit*Test,PropertyArchiveEndpointIntegrationTest,PropertyOwnershipValidationIntegrationTest' test
```

For Chrome, start the backend with `SERVER_PORT=8085`, `SPRING_PROFILES_ACTIVE=development`, and `BROWSER_DEV_ALLOWED_ORIGINS=http://localhost:5190`; start Vite with `VITE_API_BASE_URL=http://localhost:8085 npm run dev -- --host localhost --port 5190 --strictPort`. From the repository root run `node frontend/scripts/unit-browser-integration.mjs`. Optional `F5_API_URL` and `F5_APP_URL` override those defaults. The harness requires local Google Chrome and Node with fetch/WebSocket debugging-pipe support. It registers unique users, logs in, verifies organization context, creates/edits a property and unit, changes availability in both directions, verifies the list, archives only its own property, checks read-only restrictions and verifies a second tenant cannot read the first tenant's unit URL. Test records remain confined to the configured database; the harness does not delete existing records.

### Limitations

The backend has no unit delete, filtering, version/ETag or lease-assignment contract here. Concurrent attribute edits follow the existing backend update semantics; occupancy and archive conflicts are enforced by the server. Parent archive changes become visible on refresh/focus, polling or the next write, rather than via live push. Browser coverage uses owners in separate organizations; STAFF controls and stale organization switching are covered by component/F3 tests and backend authorization tests. No backend changes or migrations were needed for F5.

F5 validation on 2026-11-20: all 256 frontend tests across 23 files passed, including 32 unit-management cases; TypeScript, ESLint, production build and `git diff --check` passed. The selected PostgreSQL suite passed 107 tests with no skips. The Chrome harness passed all 13 checks against the dedicated F5 database. Temporary validation servers were stopped after the browser run; generated artifacts and test data are excluded from Git.
