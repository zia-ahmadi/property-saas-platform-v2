import { test, expect, signIn } from './fixtures.ts'

test('a manager creates, searches, edits, and archives a renter', async ({ page, qa }) => {
  await signIn(page, await qa.account('MANAGER'))
  await page.getByRole('link', { name: 'Renters', exact: true }).click()
  await expect(page.getByText('No renters found.')).toBeVisible()

  await page.getByRole('link', { name: 'Add renter' }).click()
  await page.getByLabel('First name').fill('Ada')
  await page.getByLabel('Last name').fill('Lovelace')
  await page.getByLabel('Email (optional)').fill('ada@example.test')
  await page.getByRole('button', { name: 'Save renter' }).click()
  await expect(page.getByText('Renter created.')).toBeVisible()

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
