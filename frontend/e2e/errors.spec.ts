import { test, expect, signIn, visit } from './fixtures.ts'

test('dashboard errors never reveal bodies, retry safely, and announce loading', async ({ page, qa }) => {
  const account = await qa.account()
  await signIn(page, account)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/graphql', route => route.fulfill({ status: 503 }))
  await page.route('**/dashboard/summary', async route => { await gate; await route.fulfill({ status: 500, body: 'secret SQL stack trace' }) })
  await page.getByRole('button', { name: 'Refresh dashboard' }).click()
  release()
  await expect(page.getByText('Dashboard unavailable')).toBeVisible()
  await expect(page.getByText('secret SQL stack trace')).toHaveCount(0)
  await page.unroute('**/dashboard/summary')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByLabel('Total properties: 0')).toBeVisible()
  await page.route('**/dashboard/summary', route => route.abort('connectionrefused'))
  await page.getByRole('button', { name: 'Refresh dashboard' }).click()
  await expect(page.getByText(/Unable to reach the server/)).toBeVisible()
  await page.unroute('**/dashboard/summary')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByLabel('Total properties: 0')).toBeVisible()
  await page.route('**/dashboard/summary', route => route.fulfill({ status: 403, body: 'private authorization data' }))
  await page.getByRole('button', { name: 'Refresh dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  await expect(page.getByLabel('Total properties: 0')).toHaveCount(0)
})

test('registration succeeds, requires login and reports duplicate conflicts', async ({ page }) => {
  const suffix = crypto.randomUUID().replaceAll('-','')
  const fields = { firstName: 'QA', lastName: 'User', email: `ui-${suffix}@example.test`, password: `Qa-${suffix}!`, organizationName: `UI ${suffix}`, organizationSlug: `ui-${suffix}` }
  await page.goto('/register')
  for (const [id, value] of Object.entries(fields)) await page.locator(`#${id}`).fill(value)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('status')).toContainText('Account created')
  await page.getByRole('link', { name: 'Create an organization' }).click()
  for (const [id, value] of Object.entries(fields)) await page.locator(`#${id}`).fill(value)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already exists')
})

test('cancelled old property requests do not restore old page data', async ({ page, qa }) => {
  const account = await qa.account(); const { propertyId } = await qa.seed(account)
  await signIn(page, account)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requested = false
  await page.route(`**/properties/${propertyId}`, async route => { requested = true; const response = await route.fetch(); await gate; await route.fulfill({ response }).catch(() => {}) })
  await visit(page, `/properties/${propertyId}`)
  await expect.poll(() => requested).toBe(true)
  await visit(page, '/dashboard'); release()
  await expect(page.getByLabel('Total properties: 1')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'QA property' })).toHaveCount(0)
})
