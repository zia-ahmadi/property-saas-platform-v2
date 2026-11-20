import { test, expect, signIn, visit, sql, uuid } from './fixtures.ts'

test('cold start, memory-only credentials, expiry recovery and logout', async ({ page, context, qa }) => {
  const account = await qa.account()
  let refreshes = 0
  page.on('request', request => { if (request.url().endsWith('/browser-auth/refresh')) refreshes++ })
  await page.goto('/dashboard'); await expect(page).toHaveURL(/\/login$/); expect(refreshes).toBe(0)
  await signIn(page, account)
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), readableRefresh: document.cookie.includes('refresh=') }))).toEqual({ local: [], session: [], readableRefresh: false })
  expect((await context.cookies()).filter(cookie => cookie.name.includes('refresh')).every(cookie => cookie.httpOnly)).toBe(true)
  // Wait for at least one real coordinated refresh on the deliberately short test token lifetime.
  await expect.poll(() => refreshes, { timeout: 15000 }).toBeGreaterThanOrEqual(1)
  await expect(page.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page, account)
  await page.reload(); await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
})

test('same-context cross-tab account change invalidates the established tab', async ({ page, context, qa }) => {
  const first = await qa.account(), second = await qa.account()
  await signIn(page, first)
  const other = await context.newPage()
  await signIn(other, second)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toContainText('another tab')
  await other.close()
})

test('multi-membership selection cancels delayed data and isolates cached portfolio', async ({ page, qa }) => {
  const first = await qa.account(), second = await qa.account()
  await qa.seed(first)
  sql(`INSERT INTO organization_memberships(organization_id,user_id,role) VALUES ('${uuid(second.organizationId)}','${uuid(first.userId)}','staff');`)
  await signIn(page, first)
  const select = page.getByLabel('Organization', { exact: true })
  await expect(select.locator('option')).toHaveCount(2)
  await expect(page.getByLabel('Total properties: 1')).toBeVisible()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let delayed = false
  await page.route(`**/organizations/${first.organizationId}/dashboard/summary`, async route => {
    const response = await route.fetch()
    delayed = true
    await gate
    await route.fulfill({ response }).catch(() => {})
  })
  await page.getByRole('button', { name: 'Refresh dashboard' }).click()
  await expect.poll(() => delayed).toBe(true)
  await select.selectOption(second.organizationId)
  await expect(page.getByLabel('Total properties: 0')).toBeVisible()
  release()
  await expect(page.getByLabel('Total properties: 1')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Add property', exact: true })).toHaveCount(0)
  await visit(page, '/properties')
  await expect(page.getByText('No properties found.')).toBeVisible()
})

test('ambiguous refresh fails closed with no automatic replay', async ({ page, qa }) => {
  const account = await qa.account()
  let attempts = 0
  await page.route('**/api/v1/browser-auth/refresh', async route => { attempts++; await route.abort('failed') })
  await signIn(page, account)
  await expect(page.getByRole('alert')).toContainText('could not be refreshed safely', { timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toHaveCount(0)
  await page.waitForTimeout(1500)
  expect(attempts).toBe(1)
})
