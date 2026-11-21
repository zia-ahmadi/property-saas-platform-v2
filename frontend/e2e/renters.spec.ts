import { test, expect, signIn, sql, uuid } from './fixtures.ts'

test('a manager creates, searches, edits, and archives a renter', async ({ page, qa }) => {
  const manager = await qa.account('MANAGER')
  const second = await qa.account()
  sql(`INSERT INTO organization_memberships (organization_id, user_id, role)
       VALUES ('${uuid(second.organizationId)}', '${uuid(manager.userId)}', 'manager');`)
  await signIn(page, manager)
  await page.getByLabel('Organization', { exact: true }).selectOption(second.organizationId)
  await page.getByRole('link', { name: 'Renters', exact: true }).click()
  await expect(page.getByText('No renters found.')).toBeVisible()

  await page.getByRole('link', { name: 'Add renter' }).click()
  await page.getByLabel('First name').fill('Ada')
  await page.getByLabel('Last name').fill('Lovelace')
  await page.getByLabel('Email (optional)').fill('ada@example.test')
  await page.getByRole('button', { name: 'Save renter' }).click()
  await expect(page.getByText('Renter created.')).toBeVisible()

  const profileURL = page.url()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('property-saas:auth-recovery'))).toBeNull()
  let releaseVerification!: () => void
  const verificationGate = new Promise<void>(resolve => { releaseVerification = resolve })
  await page.route('**/api/v1/browser-auth/session', async route => {
    await verificationGate
    await route.continue()
  })
  await page.reload()
  try {
    await expect(page.getByRole('status')).toHaveText('Verifying your session…')
    await expect(page).toHaveURL(profileURL)
    await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toHaveCount(0)
  } finally {
    releaseVerification()
  }
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible()
  await expect(page).toHaveURL(profileURL)
  await expect(page.getByLabel('Organization', { exact: true })).toHaveValue(second.organizationId)
  await page.unroute('**/api/v1/browser-auth/session')

  await page.getByRole('link', { name: 'Back to renters' }).click()
  await page.getByLabel('Search renters').fill('ADA@EXAMPLE')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('link', { name: 'Ada Lovelace' }).click()

  await page.getByRole('link', { name: 'Edit renter' }).click()
  await page.getByLabel('Last name').fill('Byron')
  await page.getByLabel('Email (optional)').clear()
  await page.getByLabel('Phone (optional)').fill('+1 555 0100')
  await page.getByRole('button', { name: 'Save renter' }).click()
  await expect(page.getByRole('heading', { name: 'Ada Byron' })).toBeVisible()
  await expect(page.getByText('+1 555 0100')).toBeVisible()

  await page.getByRole('button', { name: 'Archive renter' }).click()
  const dialog = page.getByRole('dialog', { name: 'Archive renter?' })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Archive renter' }).click()
  await dialog.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByText('Renter archived.')).toBeVisible()
  await page.getByRole('link', { name: 'Back to renters' }).click()
  await expect(page.getByText('No renters found.')).toBeVisible()
})
