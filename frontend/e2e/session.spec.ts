import { test, expect, signIn, visit, sql, uuid } from './fixtures.ts'

test('cold start, memory-only credentials, reload restoration and logout', async ({ page, context, qa }) => {
  const account = await qa.account()
  let refreshes = 0
  page.on('request', request => { if (request.url().endsWith('/browser-auth/refresh')) refreshes++ })
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  expect(refreshes).toBe(1)

  await signIn(page, account)
  const cookies = (await context.cookies()).filter(cookie => cookie.name.includes('refresh'))
  expect(cookies).toHaveLength(1)
  expect(cookies[0].httpOnly).toBe(true)
  // Wait for a coordinated refresh on the deliberately short test token lifetime.
  await expect.poll(() => refreshes, { timeout: 15000 }).toBeGreaterThan(1)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('property-saas:auth-recovery'))).toBeNull()
  await expect(page.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toBeVisible()
  expect(await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage).filter(key => key !== 'property-saas:auth-recovery'),
    readableRefresh: document.cookie.includes('refresh='),
  }))).toEqual({ local: [], session: [], readableRefresh: false })

  const logout = page.waitForResponse(response => response.url().endsWith('/browser-auth/logout'))
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect((await logout).status()).toBe(204)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('startup CSRF network failure keeps the protected URL and allows a safe retry', async ({ page }) => {
  await page.route('**/api/v1/browser-auth/csrf', route => route.abort('internetdisconnected'))
  let refreshes = 0
  page.on('request', request => { if (request.url().endsWith('/browser-auth/refresh')) refreshes++ })
  await page.goto('/dashboard')
  await expect(page.getByRole('alert')).toContainText('Unable to restore your session')
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(refreshes).toBe(0)
  await page.unroute('**/api/v1/browser-auth/csrf')
  await page.getByRole('button', { name: 'Retry verification' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(refreshes).toBe(1)
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
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('could not be refreshed safely')
  await expect(page.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toHaveCount(0)
  expect(attempts).toBe(1)
})
