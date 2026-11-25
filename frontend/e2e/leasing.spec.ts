import { expect, scope, signIn, sql, test, uuid, visit } from './fixtures.ts'

function leaseDateAfter(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

test('manager creates, edits, activates and ends a lease with occupancy updates', async ({ page, qa }) => {
  test.setTimeout(90_000)
  const manager = await qa.account('MANAGER')
  const { propertyId, unitId } = await qa.seed(manager)
  const { client } = await qa.loginAPI(manager)
  const base = scope(manager)
  const renter = await client.post(`${base}/renters`, { data: { firstName: 'Ada', lastName: 'Hassan' } })
  expect(renter.status()).toBe(201)
  const renterId = (await renter.json()).id
  const unitPath = `${base}/properties/${propertyId}/units/${unitId}`

  await signIn(page, manager)
  await page.getByRole('link', { name: 'Leasing', exact: true }).click()
  await page.getByRole('link', { name: 'New lease', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Find a renter' }).fill('Ada')
  await page.getByRole('combobox', { name: 'Renter', exact: true }).selectOption(renterId)
  await page.getByRole('searchbox', { name: 'Find a unit' }).fill('QA-101')
  await page.getByRole('combobox', { name: 'Unit', exact: true }).selectOption(unitId)
  await page.getByLabel('Start date', { exact: true }).fill(leaseDateAfter(-1))
  await page.getByLabel('End date').fill(leaseDateAfter(14))
  await page.getByRole('combobox', { name: 'Currency' }).selectOption('AFN')
  await page.getByLabel('Monthly rent').fill('7500')
  await page.getByLabel('Payment instructions').fill('Rent is due on the fifth day of each month.')
  const additionalTerms = [
    'The renter pays for electricity.',
    ...Array.from({ length: 85 }, (_, index) => `Signed attachment reference ${index + 1}.`),
  ].join('\n')
  await page.getByLabel('Additional terms').fill(additionalTerms)
  await page.getByLabel('Internal notes').fill('Internal follow-up only.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByRole('heading', { name: 'Ada Hassan' })).toBeVisible()
  expect((await (await client.get(unitPath)).json()).availabilityStatus).toBe('AVAILABLE')

  await page.getByRole('link', { name: 'Edit draft' }).click()
  await page.getByLabel('Security deposit').fill('500')
  await expect(page.getByLabel('Payment instructions')).toHaveValue('Rent is due on the fifth day of each month.')
  await page.getByLabel('Payment instructions').fill('Rent is due on the first day of each month.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft updated')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  const leasePath = new URL(page.url()).pathname
  await page.getByRole('link', { name: 'Print lease' }).click()
  await expect(page.getByRole('heading', { name: 'Lease agreement' })).toBeVisible()
  await expect(page.getByText('Draft', { exact: true })).toBeVisible()
  await expect(page.getByText('Test street, Kabul, AF')).toBeVisible()
  await expect(page.getByText('Rent is due on the first day of each month.')).toBeVisible()
  await expect(page.getByText('The renter pays for electricity.', { exact: false })).toBeVisible()
  await expect(page.getByText('Internal follow-up only.')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Signatures' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.evaluate(() => {
    window.print = () => { document.documentElement.dataset.printRequested = 'yes' }
  })
  await page.getByRole('button', { name: 'Print or save as PDF' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'yes')
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('navigation', { name: 'Lease print controls' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Lease agreement' })).toBeVisible()
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true })
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length).toBeGreaterThan(1)
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('link', { name: 'Back to lease' }).click()

  await page.getByRole('button', { name: 'Activate lease' }).click()
  await page.getByRole('dialog', { name: 'Activate this lease?' }).getByRole('button', { name: 'Activate lease' }).click()
  await expect(page.getByText('Lease activated')).toBeVisible()
  expect((await (await client.get(unitPath)).json()).availabilityStatus).toBe('OCCUPIED')
  const documentEndpoint = `${base}${leasePath}/document`
  const printData = async () => {
    const result = await client.get(documentEndpoint)
    expect(result.status()).toBe(200)
    return result.json()
  }
  expect(await printData()).not.toHaveProperty('notes')
  sql(`UPDATE properties SET address_line1='Renamed street' WHERE id='${uuid(propertyId)}';`)
  expect(await printData()).toMatchObject({
    status: 'ACTIVE', propertyAddress: 'Test street, Kabul, AF',
    organizationName: manager.organizationName, renterName: 'Ada Hassan', deposit: 500,
  })
  expect((await client.patch(`${unitPath}/availability`, { data: { availabilityStatus: 'UNAVAILABLE' } })).status()).toBe(409)

  await page.getByRole('link', { name: 'Back to leasing' }).click()
  await page.getByRole('combobox', { name: 'Status' }).selectOption('ENDING_SOON')
  const item = page.getByRole('link', { name: /Ada Hassan/ })
  await expect(page.getByRole('row').filter({ has: item })).toContainText('Active')
  await item.click()
  await page.getByRole('button', { name: 'End lease' }).click()
  await page.getByRole('dialog', { name: 'End this lease?' }).getByRole('button', { name: 'End lease' }).click()
  await expect(page.getByText('Lease ended')).toBeVisible()
  expect((await (await client.get(unitPath)).json()).availabilityStatus).toBe('AVAILABLE')
  expect(await printData()).toMatchObject({ status: 'ENDED', propertyAddress: 'Test street, Kabul, AF' })
})

test('backend enforces lease access, date windows and exclusive unit occupancy', async ({ qa }) => {
  const owner = await qa.account()
  const staff = await qa.account('STAFF')
  const { unitId } = await qa.seed(owner)
  const foreign = await qa.seed(staff)
  const { client } = await qa.loginAPI(owner)
  const staffSession = await qa.loginAPI(staff)
  const base = scope(owner)
  const response = await client.post(`${base}/renters`, { data: { firstName: 'Sam', lastName: 'Khan' } })
  expect(response.status()).toBe(201)
  const terms = {
    unitId, renterId: (await response.json()).id, startsOn: leaseDateAfter(-1), endsOn: null,
    monthlyRent: 4900, deposit: 0, currency: 'AFN',
  }
  expect((await staffSession.client.get(`${scope(staff)}/leases`)).status()).toBe(403)
  expect((await client.get(`${scope(staff)}/leases/units`)).status()).toBe(403)
  expect((await client.post(`${base}/leases`, { data: { ...terms, unitId: foreign.unitId } })).status()).toBe(400)
  expect((await client.post(`${base}/leases`, { data: { ...terms, endsOn: leaseDateAfter(-2) } })).status()).toBe(400)

  async function draft(startsOn = terms.startsOn) {
    const created = await client.post(`${base}/leases`, { data: { ...terms, startsOn } })
    expect(created.status()).toBe(201)
    return (await created.json()).id as string
  }
  const transition = (id: string, action = 'ACTIVATE', version = 0) =>
    client.post(`${base}/leases/${id}/transition`, { data: { action, version } })
  const future = await draft(leaseDateAfter(5))
  expect((await staffSession.client.get(`${scope(staff)}/leases/${future}/document`)).status()).toBe(403)
  const otherOwner = await qa.account()
  const { client: otherClient } = await qa.loginAPI(otherOwner)
  expect((await otherClient.get(`${scope(otherOwner)}/leases/${future}/document`)).status()).toBe(404)
  expect((await transition(future)).status()).toBe(409)
  expect((await transition(future, 'CANCEL')).status()).toBe(200)

  const ids = await Promise.all([draft(), draft()])
  const activated = await Promise.all(ids.map(id => transition(id)))
  expect(activated.map(result => result.status()).sort()).toEqual([200, 409])
  const winner = ids[activated.findIndex(result => result.ok())]
  expect((await transition(winner, 'END')).status()).toBe(409)
  expect((await transition(winner, 'END', 1)).status()).toBe(200)
})

test('staff cannot open the leasing workspace', async ({ page, qa }) => {
  const staff = await qa.account('STAFF')
  await signIn(page, staff)
  await expect(page.getByRole('link', { name: 'Leasing', exact: true })).toHaveCount(0)
  await visit(page, '/leases')
  await expect(page).toHaveURL(/\/forbidden$/)
})
