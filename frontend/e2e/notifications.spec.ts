import { test, expect, scope, signIn, sql, uuid, appURL } from './fixtures.ts'

const feed = `query Feed($org: ID!, $limit: Int) {
  notifications(organizationId: $org, limit: $limit) { cursor kind resourceId maintenanceStatus }
}`

test('GraphQL streams committed events and applies current organization permissions', async ({ page, request, qa }) => {
  test.setTimeout(90_000)
  const owner = await qa.account()
  const staff = await qa.account('STAFF')
  const { propertyId, unitId } = await qa.seed(owner)
  const { client, token } = await qa.loginAPI(owner)
  const { token: staffToken } = await qa.loginAPI(staff)
  const org = owner.organizationId
  const base = scope(owner)
  const endpoint = `${appURL}/api/graphql`
  const query = (bearer: string, organizationId: string, limit = 20) =>
    request.post(endpoint, {
      headers: { Authorization: `Bearer ${bearer}` },
      data: { query: feed, variables: { org: organizationId, limit } },
    })

  expect((await request.post(endpoint, { data: { query: feed } })).status()).toBe(401)
  expect((await (await query(staffToken, org)).json()).errors[0].extensions.classification).toBe('FORBIDDEN')
  expect((await (await query(token, org, 101)).json()).errors[0].extensions.classification).toBe('BAD_REQUEST')
  sql(`INSERT INTO organization_memberships (user_id, organization_id, role, status)
       VALUES ('${uuid(staff.userId)}', '${uuid(org)}', 'staff', 'active');`)

  const portfolioResponse = page.waitForResponse(response =>
    response.url() === endpoint && response.request().postData()?.includes('query PortfolioDashboard') === true)
  await signIn(page, owner)
  const portfolio = await portfolioResponse
  expect(await portfolio.json()).toMatchObject({ data: { portfolioDashboard: { totalProperties: 1, totalUnits: 1 } } })
  expect(portfolio.headers()['x-request-id']).toBeTruthy()

  const bell = page.getByRole('banner').getByRole('link', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName('Notifications')
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: /^Notifications/ })).toHaveCount(0)
  const maintenance = { title: 'Leaking faucet', description: 'Repair the faucet', category: 'PLUMBING', priority: 'NORMAL', propertyId, unitId }
  const created = await client.post(`${base}/maintenance`, { data: maintenance })
  expect(created.status()).toBe(201)
  const { id: maintenanceId } = await created.json()
  await expect(bell).toHaveAccessibleName('Notifications (1 unread)')
  await bell.click()
  await expect(page).toHaveURL(/\/notifications$/)
  await expect(page.getByRole('link', { name: 'Maintenance request created' })).toHaveAttribute('href', `/maintenance/${maintenanceId}`)
  await page.getByRole('button', { name: 'Mark as read', exact: true }).click()
  await expect(bell).toHaveAccessibleName('Notifications')
  await page.reload()
  await expect(page.getByRole('link', { name: 'Maintenance request created' })).toBeVisible()
  await expect(bell).toHaveAccessibleName('Notifications')
  const changed = await client.put(`${base}/maintenance/${maintenanceId}`, {
    data: { request: maintenance, status: 'IN_PROGRESS', version: 0 },
  })
  expect(changed.status()).toBe(200)
  await expect(page.getByRole('link', { name: 'Maintenance status updated' })).toBeVisible()

  try {
    const renter = await client.post(`${base}/renters`, { data: { firstName: 'Test', lastName: 'Renter' } })
    expect(renter.status()).toBe(201)
    const today = new Date().toISOString().slice(0, 10)
    const lease = await client.post(`${base}/leases`, { data: {
      unitId, renterId: (await renter.json()).id, startsOn: today, monthlyRent: 250, deposit: 0, currency: 'AFN',
    } })
    expect(lease.status()).toBe(201)
    const leaseId = (await lease.json()).id
    expect((await client.post(`${base}/leases/${leaseId}/transition`, {
      data: { action: 'ACTIVATE', version: 0 },
    })).status()).toBe(200)
    const invoice = await client.post(`${base}/billing/invoices`, { data: {
      leaseId, billingMonth: `${today.slice(0, 7)}-01`, dueOn: today,
    } })
    expect(invoice.status()).toBe(201)
    const invoiceId = (await invoice.json()).invoice.id
    const paymentPath = `${base}/billing/invoices/${invoiceId}/payments`
    const payment = { amount: 100, receivedOn: today, method: 'CASH', version: 0 }
    expect((await client.post(paymentPath, { data: payment })).status()).toBe(200)
    expect((await client.post(paymentPath, { data: payment })).status()).toBe(409)
    await expect(page.getByRole('link', { name: 'Rent payment recorded' })).toHaveAttribute('href', `/billing/${invoiceId}`)

    const ownerFeed = await (await query(token, org)).json()
    expect(ownerFeed.data.notifications.map((item: { kind: string }) => item.kind)).toEqual([
      'PAYMENT_RECORDED', 'MAINTENANCE_STATUS_CHANGED', 'MAINTENANCE_CREATED',
    ])
    const staffFeed = await (await query(staffToken, org)).json()
    expect(staffFeed.data.notifications.map((item: { kind: string }) => item.kind)).toEqual([
      'MAINTENANCE_STATUS_CHANGED', 'MAINTENANCE_CREATED',
    ])
    await page.getByRole('button', { name: 'Mark all as read' }).click()
    await expect(bell).toHaveAccessibleName('Notifications')
    sql(`UPDATE organization_memberships SET status = 'suspended'
         WHERE organization_id = '${uuid(org)}' AND user_id = '${uuid(staff.userId)}';`)
    expect((await (await query(staffToken, org)).json()).errors[0].extensions.classification).toBe('FORBIDDEN')
  } finally {
    sql(`DELETE FROM rent_payments WHERE organization_id = '${uuid(org)}';
         DELETE FROM rent_invoices WHERE organization_id = '${uuid(org)}';`)
  }
})

test('pending owners are notified about platform replies and can open the exact message', async ({ page, request, qa }) => {
  const owner = await qa.account()
  const admin = await qa.account()
  const staff = await qa.account('STAFF')
  sql(`UPDATE organizations SET status = 'pending' WHERE id = '${uuid(owner.organizationId)}';
       INSERT INTO platform_authorities (user_id, authority) VALUES ('${uuid(admin.userId)}', 'PLATFORM_OWNER');
       INSERT INTO organization_memberships (user_id, organization_id, role, status)
       VALUES ('${uuid(staff.userId)}', '${uuid(owner.organizationId)}', 'staff', 'active');`)
  const { client } = await qa.loginAPI(admin)
  const { token: staffToken } = await qa.loginAPI(staff)
  await page.goto('/login')
  await page.getByLabel('Email address').fill(owner.email)
  await page.getByLabel('Password', { exact: true }).fill(owner.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/access$/)
  const bell = page.getByRole('banner').getByRole('link', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName('Notifications')

  try {
    const reply = await client.post(`/api/v1/platform/organizations/${owner.organizationId}/messages`, {
      data: { body: 'We received your organization application.' },
    })
    expect(reply.status()).toBe(201)
    const { id } = await reply.json()
    await expect(bell).toHaveAccessibleName('Notifications (1 unread)')
    const outsider = await request.post(`${appURL}/api/graphql`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      data: { query: '{ supportNotifications { unreadCount replies { messageId } } }' },
    })
    expect(await outsider.json()).toMatchObject({ data: { supportNotifications: { unreadCount: 0, replies: [] } } })
    await bell.click()
    await expect(page).toHaveURL(/\/notifications$/)
    const item = page.getByRole('link', { name: 'New message from platform support' })
    await expect(item).toHaveAttribute('href', `/organization-messages/${owner.organizationId}#message-${id}`)
    await item.click()
    await expect(page.getByText('We received your organization application.')).toBeVisible()
    await expect(bell).toHaveAccessibleName('Notifications')
  } finally {
    sql(`DELETE FROM organization_messages WHERE organization_id = '${uuid(owner.organizationId)}';
         DELETE FROM platform_authorities WHERE user_id = '${uuid(admin.userId)}';`)
  }
})
