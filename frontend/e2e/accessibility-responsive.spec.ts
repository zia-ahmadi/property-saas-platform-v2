import AxeBuilder from '@axe-core/playwright'
import { test, expect, signIn, visit } from './fixtures.ts'

for (const width of [360, 768, 1440]) test(`WCAG scan and responsive workflows at ${width}px`, async ({ page, qa }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width, height: 900 })
  const audit = async (label: string) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    const result = await new AxeBuilder({ page }).analyze()
    const violations = result.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(node => node.target) }))
    if (overflow || violations.length) {
      await page.screenshot({ path: testInfo.outputPath(`${label}.png`), fullPage: true })
      await testInfo.attach(`${label}-accessibility`, { body: JSON.stringify({ overflow, violations }), contentType: 'application/json' })
    }
    expect.soft(overflow, `${label}: horizontal overflow`).toBe(false)
    expect.soft(violations, `${label}: axe findings`).toEqual([])
  }
  await page.goto('/login'); await audit('login')
  await page.getByLabel('Password', { exact: true }).fill('temporary-test-value')
  await page.getByRole('button', { name: 'Show password' }).focus()
  await page.keyboard.press('Space'); await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type','text')
  await page.keyboard.press('Space'); await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type','password')
  await page.getByRole('link', { name: 'Create an organization' }).click(); await audit('registration')
  const account = await qa.account(); const { propertyId, unitId } = await qa.seed(account)
  await signIn(page, account); await expect(page.getByLabel('Total units: 1')).toBeVisible(); await audit('dashboard')
  if (width === 360) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    const menu = page.getByRole('dialog', { name: 'Property SaaS navigation' })
    await expect(menu).toBeVisible(); await audit('mobile-navigation')
    await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused()
  }
  for (const [path, label, ready] of [
    ['/properties', 'property-list', 'QA property'],
    ['/properties/new', 'property-create', 'Add property'],
    [`/properties/${propertyId}`, 'property-details', 'QA property'],
    [`/properties/${propertyId}/edit`, 'property-edit', 'Edit property'],
    [`/properties/${propertyId}/units`, 'unit-list', 'QA-101'],
    [`/properties/${propertyId}/units/new`, 'unit-create', 'Create unit'],
    [`/properties/${propertyId}/units/${unitId}`, 'unit-details', 'QA-101'],
    [`/properties/${propertyId}/units/${unitId}/edit`, 'unit-edit', 'Edit unit'],
  ]) {
    await visit(page, path)
    await expect(page.getByRole('main').getByRole(label.endsWith('-list') ? 'link' : 'heading', { name: ready, exact: true })).toBeVisible()
    if (label.endsWith('edit')) await expect(page.locator('form input').first()).toHaveValue(label.startsWith('property') ? 'QA property' : 'QA-101')
    await audit(label)
    if (label === 'property-list' && width === 360) {
      const register = page.getByRole('region', { name: 'Property register' })
      const search = register.getByRole('searchbox', { name: 'Search properties' })
      await search.fill('missing property')
      await search.press('Enter')
      await expect(register.getByRole('heading', { name: 'No matching properties' })).toBeVisible()
      await register.getByRole('button', { name: 'Clear filters' }).click()
      await expect(register.getByRole('link', { name: ready, exact: true })).toBeVisible()
      await register.getByRole('combobox', { name: 'Property type' }).selectOption('APARTMENT')
      await expect(register.getByRole('heading', { name: 'No matching properties' })).toBeVisible()
      await register.getByRole('button', { name: 'Clear filters' }).click()
      await register.getByRole('button', { name: /^Archived/ }).click()
      await expect(register.getByRole('heading', { name: 'No matching properties' })).toBeVisible()
    }
  }
  for (const [path, heading] of [['/leases', 'Lease register'], ['/billing', 'Invoice register'], ['/maintenance', 'Request queue'], ['/renters', 'Renter directory']]) {
    await visit(page, path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await audit(path.slice(1))
  }
  await visit(page, `/properties/${propertyId}/units/${unitId}`)
  await page.getByRole('button', { name: 'Mark UNAVAILABLE' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mark unit UNAVAILABLE?' })
  await expect(dialog).toBeVisible(); await audit('availability-dialog')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  for (const path of ['/unauthorized','/forbidden','/missing-page']) { await visit(page,path); await expect(page.locator('h1')).toBeVisible(); await audit(path.slice(1)) }
})
