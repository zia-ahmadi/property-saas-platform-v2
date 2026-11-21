# Frontend authentication

The tab-lifetime AuthLifecycleService holds access tokens in memory and exposes verified identity snapshots through AuthProvider. A protected page waits for startup restoration. The coordinator refreshes using the existing HttpOnly cookie and the lifecycle verifies the resulting access token before rendering the original URL. A missing, expired, or revoked refresh session leads to sign-in. React remounts reuse the same service. Login and refresh are followed by `/session` verification before protected routes render. A refreshed identity must match the established user. During refresh of an established session, the current session and its in-memory bearer stay usable, so mounted queries, forms and dialogs are not torn down mid-refresh. `verify` replaces the session atomically once the token is confirmed, and the previous bearer is never carried into the replacement. Cancelling sign-in invalidates its local result, but a dispatched login may still have created a server-side family and set a cookie.

The existing coordinator holds a Web Lock across CSRF bootstrap and cookie mutations. Refresh is single-flight and uncertain outcomes require explicit sign-in; they are never automatically retried. A startup network failure before refresh dispatch can be retried explicitly. A session-verification network error can be retried with the candidate bearer already in memory. A tab-scoped operation marker prevents replay on reload when refresh is pending or its outcome is uncertain. The backend enforces Origin, CSRF, cookie and tenant authorization rules described in `backend/property-core/BROWSER_AUTH.md`.

Logout clears local identity and query cache immediately. A successful 204 means the logout endpoint accepted the request; it does not prove that a particular family was revoked. A failed request leaves server revocation unconfirmed and blocks automatic restoration in that tab. Previously issued access JWTs can remain valid until expiry.

Cross-tab messages are invalidation hints. The refresh cookie is shared, so a stale tab can rotate or revoke another tab's current family; session verification does not establish cookie ownership. Web Locks coordinate cooperating tabs of one origin, but cannot settle uncertain server outcomes or replace backend session binding. Without Web Locks, cookie mutations fail closed. Without BroadcastChannel, other tabs do not receive hints. No tokens or credentials are stored in browser storage or broadcasts. The tab restores its previous organization selection only when the verified user still has that membership.

Run auth tests with `npm test -- src/features/auth` from `frontend`; run the full suite with `npm test`.

## Local browser integration

Use an isolated PostgreSQL database: the browser check registers randomly named test users and creates refresh families. Do not point it at a production or shared database. Start the existing Compose PostgreSQL service and create an empty test database, then start the backend with the `development` profile. Set `POSTGRES_PASSWORD` to the local database password and provide separate, randomly generated Base64 keys for `JWT_SECRET` and `BROWSER_CSRF_SECRET`. For example, from the repository root:

```sh
# Start infra/docker-compose.yml with your local POSTGRES_PASSWORD first.
# Create an empty local database named property_saas_f335_test.
export JWT_SECRET="$(openssl rand -base64 32)"
export BROWSER_CSRF_SECRET="$(openssl rand -base64 32)"
export BROWSER_DEV_ALLOWED_ORIGINS=http://localhost:5189
export SPRING_PROFILES_ACTIVE=development
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/property_saas_f335_test
export APP_JWT_ACCESS_TOKEN_EXPIRATION=35 # local browser test only
(cd backend/property-core && ./mvnw spring-boot:run)
```

In another terminal, run `VITE_API_BASE_URL=http://localhost:8081 npm run dev -- --host localhost --port 5189 --strictPort` from `frontend`. Then run `node frontend/scripts/auth-browser-integration.mjs` from the repository root. It requires local Google Chrome and Node.js; it uses Chrome DevTools Protocol, not Playwright, and removes its temporary browser profile. The 35-second lifetime is necessary for the expiry test and must not be used as a production configuration. The script writes test accounts to the isolated database.

The Chrome checks cover cold start, login, logout and its network failure, development cookie attributes, credentialed CORS, Origin/CSRF rejection, session-verification failure, cross-tab account changes, missed notifications, concurrent refresh, logout racing an in-flight refresh, and refresh after access-token expiry. These checks do not prove safe delivery ordering of delayed cookie responses or cover multiple backend instances. SameSite=Strict and browser third-party-cookie policies also constrain cross-site deployments. Production cookie attributes and settings are separately specified by the backend and are not relaxed by this local setup.

## Registration, organizations and permissions

`/register` calls the public `POST /api/v1/users/register` endpoint with the user and first-organization fields. A successful response creates the user, organization and OWNER membership but does not sign the user in; the UI directs them to `/login`. HTTP 409 is shown as a combined email-or-slug conflict because the shared API client does not expose untrusted error bodies. Password validation includes the backend's 72 UTF-8-byte limit.

After session verification, organization selection is limited to the active memberships returned by `/api/v1/browser-auth/session`. A user without an active organization sees a message instead of organization-scoped content. Selection is in memory and is not authorization proof. The header retrieves the selected organization through the authenticated organization endpoint. Organization requests must use the organization context's `request`, which constructs the organization path from the current selection; its `queryKey` includes user, organization and role. Switching cancels and clears cached queries scoped to the obsolete user, organization and role, and rejects late results; queries newly mounted for the current selection are left running, so a switch or refresh cannot leave the page stuck loading. The backend independently checks user status, membership, organization status and permissions on every protected request.

The UI permission mapping mirrors the current backend `RolePermissionMapping`: OWNER and ADMIN have all listed permissions; MANAGER lacks organization management, membership management and billing; STAFF has organization view, property view and maintenance management. The mapping is a UI convenience and must be updated alongside backend policy changes; it cannot enforce access or immediately know about server-side revocation. A 403 is shown as access denied and does not trigger refresh; a 401 invokes the established authentication recovery behavior. Property and unit pages use tenant-scoped backend integration (see `PROPERTY_MANAGEMENT.md`); settings remain a placeholder.

## F3 verification limits

F3 provides registration, sign-in, in-memory session handling, protected routes, logout, organization selection, and role-aware controls. Local HTTP browser checks do not verify production Secure cookie behavior. A real-browser flow with multiple memberships, delayed `Set-Cookie` delivery, and multiple backend instances has not been fully tested. The shared refresh cookie can be replaced or revoked by another tab; client-side coordination does not bind that cookie to an individual tab or prove family ownership.

## Registration troubleshooting

The development frontend reads `VITE_API_BASE_URL` at Vite startup. On a fresh checkout, copy `frontend/.env.example` to `frontend/.env.development`; the example targets `http://localhost:8081`. The local `.env.development` is ignored by Git. Registration sends a public JSON request directly to that server; there is no Vite proxy. Start PostgreSQL and the backend first, activate the backend `development` profile, provide its required database password and JWT/CSRF secrets, and set `BROWSER_DEV_ALLOWED_ORIGINS` to the exact Vite origin, for example `http://localhost:5173`. A different port, scheme, or `127.0.0.1` instead of `localhost` is a different origin and must be explicitly configured. Restart Vite or the backend after changing their environment. Verify Flyway reaches the latest version before registering.

An unreachable backend or a CORS rejection can both appear to the browser as a network error; inspect the browser Network panel and backend startup logs without exposing credentials. HTTP 409 indicates an email or organization slug conflict. Successful registration does not authenticate the user: continue to sign in. Avoid changing production cookie or CORS settings for local HTTP.
