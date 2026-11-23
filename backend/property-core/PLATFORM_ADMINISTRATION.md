# Platform administration

`PLATFORM_OWNER` is a platform authority stored separately from organization memberships. It is checked against the database on every platform request; neither public registration nor an invitation grants it. There are no default credentials.

To provision the first platform owner, an operator with controlled database access should create an account through the normal registration flow, verify the account email and identity out of band, and execute the following in a transaction with their PostgreSQL client, replacing the email with the verified account email:

```sql
BEGIN;
INSERT INTO platform_authorities (user_id, authority)
SELECT id, 'PLATFORM_OWNER' FROM users
WHERE lower(email) = lower('verified-operator@example.com') AND status = 'active';
-- Verify exactly one row was inserted before committing.
COMMIT;
```

Access to this SQL operation must be restricted and logged by the operator. To revoke the authority, delete the corresponding row. The organization created by registration remains pending until reviewed. The platform account can sign in without an active organization.

## Permissions

| Capability | OWNER | ADMIN | MANAGER | STAFF | PLATFORM_OWNER |
| --- | --- | --- | --- | --- | --- |
| Organization settings | manage | manage | view | view | no tenant access implied |
| Team and inbox | manage | no | no | no | send messages |
| Properties and units | manage | manage | manage | view | no tenant access implied |
| Renters | manage | manage | manage | read | no tenant access implied |
| Organization review | no | no | no | no | manage all organizations |
| Billing | manage | manage | no | no | no tenant access implied |
| Maintenance | manage | manage | manage | manage | no tenant access implied |

## Current API surface

All routes use `/api/v1`. Platform endpoints require a valid access token for an active user with the platform authority. Team and inbox endpoints require a current active OWNER membership in an active organization.

* `GET /platform/me`, `GET /platform/organizations?search=&status=&page=0&size=20`, `GET /platform/organizations/{id}`, `GET /platform/organizations/{id}/audit`.
* `POST /platform/organizations/{id}/decisions` accepts `{ "action": "approve|reject|suspend|reinstate|ban", "reason": "..." }`. Reject, suspend and ban require a reason. Transitions are pending → active/rejected/banned; active → suspended/banned; suspended → active/banned. Rejected and banned are terminal.
* `POST /platform/organizations/{id}/messages` accepts `{ "body": "..." }`. `GET /organizations/{id}/inbox` and `POST /organizations/{id}/inbox/{messageId}/read` provide an organization-scoped inbox.
* `GET /organizations/{id}/team`; `POST /organizations/{id}/invitations` accepts `{ "email": "...", "role": "ADMIN|MANAGER|STAFF" }`; `DELETE /organizations/{id}/invitations/{invitationId}`; `PATCH /organizations/{id}/members/{membershipId}` accepts `{ "role": "..." }`; `DELETE /organizations/{id}/members/{membershipId}`.
* Invitations expire after seven days. The invitation response includes a bearer secret in `token`: delivery is not configured, so the owner must share it securely. `POST /invitations/accept` accepts `{ "token": "..." }` for an authenticated matching user; `POST /invitations/accept-new` accepts the token plus `email`, `password`, `firstName`, and `lastName`. Only the token hash is stored. Owner memberships cannot currently be altered or revoked through these endpoints.

The browser provides a platform console, Team page, invitation acceptance, and owner inbox. Invitation links contain a bearer token in the URL fragment; share them privately. Email delivery is not configured.

## Manual API checks

Use a REST client with a bearer access token from `/auth/login` and set `Content-Type: application/json` for request bodies. Do not put invitation tokens in logs or public channels.

1. Register a new organization and sign in as the provisioned platform owner. List pending organizations with `GET /platform/organizations?status=pending`. Approve the new ID using a decision with action `approve`. The organization's owner can then sign in and select it.
2. With the platform token, submit `suspend` with a reason for that ID. Retry a renter request with the owner's previously issued token: it should return 403. Submit `reinstate` and retry. A different active membership should remain usable throughout.
3. With the organization owner's token, create an invitation for an email and role. Share the returned token securely; the intended existing user signs in and calls `/invitations/accept`, or a new user calls `/invitations/accept-new` with the required account details. Repeat acceptance to check that it is rejected. Change or revoke that membership and retry an operation using the same access token.
4. With the platform token, post a message to the organization. With its owner's token, list the inbox and mark the message read. Another organization's inbox must not contain it.

In the browser, sign in as a platform owner and open Platform administration. Organization owners can open Team to generate a copyable link, and Inbox to read messages.

## Local browser demonstration

1. Start PostgreSQL, the backend, and the frontend as described in the repository setup. Register an operator account, then run the provisioning SQL above using the verified operator email. Sign in and choose **Switch to platform workspace**. Use **Switch to organization workspace** in the header to return to your organization; organization permissions continue to depend on your membership. Register another organization and sign in as its owner in a separate browser profile. Its dashboard shows **Pending review**.
2. In the console, search for the new organization, open it, and approve it. In the owner profile, select **Refresh access**. For a suspension, enter a reason in the console and confirm **Suspend**. An already signed-in user is denied on their next organization request; a different active organization remains selectable. Reinstate it in the console and refresh access.
3. Open **Team** as the organization owner. Create invitations for ADMIN, MANAGER, and STAFF and copy each one-time link. Email delivery is not configured. Open each link in a separate browser profile: sign in for an existing account, or create an account for the invited email. The owner is the fourth role. Use **Refresh team** after someone accepts, then try role changes or revocation. Owner memberships cannot be changed through the Team page.
4. As platform owner, select the organization, enter a private message, and send it. As the organization owner, open **Inbox** and mark the message read. Other organizations have separate inboxes.
5. To compare permissions, sign in with each invitee. ADMIN and MANAGER can manage renters; STAFF can read renters. The owner alone can open Team and Inbox. Organization access lists restricted memberships even when another organization remains active.

### Two-way messages for restricted organizations

An active OWNER membership may exchange messages with platform owners even while the organization is pending, rejected, suspended, or banned. Open **Organization access** and choose **Messages with platform** beside the organization. Active owners can also use **Inbox**. Platform owners can open the organization in the console to read and reply. This exception only applies to messaging; normal tenant operations still require an active organization. Suspended user accounts and inactive memberships cannot use the messaging exception.
