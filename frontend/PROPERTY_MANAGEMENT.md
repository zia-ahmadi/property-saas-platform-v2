# Property management

Property requests use the active verified organization and authenticated in-memory session. The backend checks active membership and tenant ownership for each request. The organization context includes the user, organization and role in query keys, cancels queries on organization changes, and rejects late results. UI permission checks use the existing `PROPERTY_MANAGE` role mapping and do not replace server authorization.

The property API is rooted at `/api/v1/organizations/{organizationId}/properties`:

- `GET` lists server-side pages using zero-based `page` and `size` parameters.
- `POST` creates a property.
- `GET /{propertyId}` loads details.
- `PATCH /{propertyId}` updates the editable fields.
- `PATCH /{propertyId}/archive` archives without deleting the record. Archived properties remain listed.

The UI supports list refresh, paging, create, details, edit and archive confirmation. The unit screen is a placeholder and is not part of F4. Registration setup and browser-authentication limits are documented in `AUTHENTICATION.md`.

From `frontend`, run `npm test`, `npm run lint`, and `npm run build`. With the isolated local setup in `AUTHENTICATION.md`, run `node frontend/scripts/property-browser-integration.mjs` from the repository root to exercise create, view, edit and archive against PostgreSQL. The script creates isolated test users and records; do not run it against valuable or production data.
