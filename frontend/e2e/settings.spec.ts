import AxeBuilder from '@axe-core/playwright'
import { test, expect, signIn, scope, sql, uuid, apiURL } from './fixtures.ts'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lVQAAAAASUVORK5CYII=', 'base64')

test('owners can update their profile, workspace name, logo, and device preferences', async ({ page, qa }) => {
  test.setTimeout(90_000)
  const owner = await qa.account()
  const { client } = await qa.loginAPI(owner)
  const { propertyId } = await qa.seed(owner)
  const workspace = scope(owner)
  try {
    await signIn(page, owner)
    await page.goto('/setting')
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByLabel('First name').fill('Zia')
    await page.getByLabel('Last name').fill('Ahmadi')
    await page.getByRole('button', { name: 'Save profile' }).click()
    await expect(page.getByText('Profile saved.')).toBeVisible()

    const name = page.getByLabel('Workspace name', { exact: true })
    const slug = page.getByText(owner.organizationSlug, { exact: true })
    await expect(slug).toBeVisible()
    await name.fill('Cedar Court')
    await page.getByRole('button', { name: 'Save workspace name' }).click()
    await expect(page.getByText('Workspace name saved.')).toBeVisible()
    await expect(page.getByLabel('Organization', { exact: true }).locator('option:checked')).toHaveText('Cedar Court')
    expect((await client.patch(workspace, { data: { name: 'Cedar Court North', expectedName: 'Cedar Court' } })).status()).toBe(200)
    await name.fill('Old draft')
    await page.getByRole('button', { name: 'Save workspace name' }).click()
    await expect(page.getByRole('alert')).toContainText('The workspace name changed.')
    await page.getByRole('button', { name: 'Reload workspace name' }).click()
    await expect(name).toHaveValue('Cedar Court North')

    await page.getByLabel('Upload image for Workspace logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByRole('img', { name: 'Workspace logo', exact: true })).toBeVisible()
    await expect(page.getByRole('complementary').locator('img')).toHaveAttribute('src', /^blob:/)

    await page.getByLabel('Appearance', { exact: true }).selectOption('dark')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    const maintenance = await client.post(`${workspace}/maintenance`, { data: {
      propertyId, title: 'Check door lock', description: 'The front door will not lock.',
      category: 'OTHER', priority: 'NORMAL',
    } })
    expect(maintenance.status()).toBe(201)
    const bell = page.getByRole('banner').getByRole('link', { name: 'Notifications (1 unread)' })
    await expect(bell).toHaveText('1')
    const badge = page.getByRole('checkbox', { name: /Show unread count/ })
    await badge.uncheck()
    await expect(bell).toHaveText('')
    await page.reload()
    await expect(page.getByLabel('First name')).toHaveValue('Zia')
    await expect(page.getByLabel('Last name')).toHaveValue('Ahmadi')
    await expect(name).toHaveValue('Cedar Court North')
    await expect(badge).not.toBeChecked()
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    const { violations } = await new AxeBuilder({ page }).analyze()
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([])
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Remove image' }).click()
    await expect(page.getByText('No image uploaded')).toBeVisible()
  } finally {
    sql(`DELETE FROM organization_images WHERE organization_id = '${uuid(owner.organizationId)}';`)
  }
})

test('staff can update their own account while workspace edits remain restricted', async ({ page, qa, request }) => {
  const staff = await qa.account('STAFF')
  await signIn(page, staff)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Account profile' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save workspace name' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Upload image' })).toHaveCount(0)
  await page.getByLabel('First name').fill('New name')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText('Profile saved.')).toBeVisible()

  const { client } = await qa.loginAPI(staff)
  const path = scope(staff)
  expect((await client.patch(path, { data: { name: 'Unauthorized', expectedName: staff.organizationName } })).status()).toBe(403)
  expect((await client.put(`${path}/images/organization/${staff.organizationId}`, {
    multipart: { file: { name: 'logo.png', mimeType: 'image/png', buffer: png } },
  })).status()).toBe(403)
  expect((await client.put('/api/v1/me/profile', { data: { firstName: '  ', lastName: 'Valid' } })).status()).toBe(400)
  expect((await request.put(`${apiURL}/api/v1/me/profile`, { data: { firstName: 'First', lastName: 'Last' } })).status()).toBe(401)
})
