import { request as apiRequest } from '@playwright/test'
import { test, expect, apiURL, appURL, scope, propertyInput, unitInput } from './fixtures.ts'

test('real API contracts: validation, conflicts, pagination, missing IDs, aggregates and tenant boundaries', async ({ qa, page, request }) => {
  const a = await qa.account(), b = await qa.account()
  const own = await qa.loginAPI(a)
  const seeded = await qa.seed(b)
  const ownSeed = await qa.seed(a)
  const base = `${scope(a)}/properties`
  expect((await request.get(apiURL + base)).status()).toBe(401)
  expect((await own.client.post(base, { data: { ...propertyInput, name: '' } })).status()).toBe(400)
  const created = await own.client.post(base, { data: propertyInput }); expect(created.status()).toBe(201)
  const property = await created.json() as { id: string }
  expect((await own.client.patch(`${base}/${property.id}`, { data: { name: 'API edited' } })).status()).toBe(200)
  const unitBase = `${base}/${property.id}/units`
  expect((await own.client.post(unitBase, { data: unitInput })).status()).toBe(201)
  expect((await own.client.post(unitBase, { data: unitInput })).status()).toBe(409)
  const units = await own.client.get(`${unitBase}?page=0&size=1`)
  const body = await units.json() as { content: { id: string; availabilityStatus: string }[]; totalElements: number; size: number }
  expect({ count: body.totalElements, size: body.size, status: body.content[0].availabilityStatus }).toEqual({ count: 1, size: 1, status: 'AVAILABLE' })
  expect((await own.client.get(`${unitBase}?size=101`)).status()).toBe(400)
  const unit = `${unitBase}/${body.content[0].id}`
  expect((await own.client.patch(unit, { data: { availabilityStatus: 'OCCUPIED' } })).status()).toBe(400)
  expect((await own.client.patch(`${unit}/availability`, { data: { availabilityStatus: 'OCCUPIED' } })).status()).toBe(409)
  expect((await own.client.patch(unit, { data: { floorNumber: 2, areaSqm: null } })).status()).toBe(200)
  expect((await own.client.patch(`${unit}/availability`, { data: { availabilityStatus: 'UNAVAILABLE' } })).status()).toBe(200)
  const summary = await own.client.get(`${scope(a)}/dashboard/summary`)
  expect(await summary.json()).toMatchObject({ totalProperties: 2, totalUnits: 2, availableUnits: 1, unavailableUnits: 1, occupiedUnits: 0 })
  const unsupported = await own.client.post(`${scope(a)}/dashboard/summary`)
  expect(unsupported.status()).toBe(405); expect(unsupported.headers()['allow']).toContain('GET')
  expect((await own.client.get(`${base}/00000000-0000-0000-0000-000000000000`)).status()).toBe(404)
  for (const path of [scope(b), `${scope(b)}/properties`, `${scope(b)}/properties/${seeded.propertyId}`, `${scope(b)}/properties/${seeded.propertyId}/units`, `${scope(b)}/properties/${seeded.propertyId}/units/${seeded.unitId}`, `${scope(b)}/dashboard/summary`]) expect((await own.client.get(path)).status()).toBe(403)
  expect((await own.client.get(`${base}/${seeded.propertyId}`)).status()).toBe(404)
  expect((await own.client.get(`${base}/${ownSeed.propertyId}/units/${seeded.unitId}`)).status()).toBe(404)
  expect((await own.client.patch(`${base}/${seeded.propertyId}`, { data: { name: 'Attack' } })).status()).toBe(404)
  expect((await own.client.patch(`${base}/${ownSeed.propertyId}/units/${seeded.unitId}`, { data: { unitNumber: 'Attack' } })).status()).toBe(404)
  expect((await own.client.patch(`${base}/${property.id}/archive`)).status()).toBe(200)
  expect((await own.client.post(unitBase, { data: { ...unitInput, unitNumber: 'ARCHIVED' } })).status()).toBe(409)
  expect((await own.client.patch(unit, { data: { floorNumber: 4 } })).status()).toBe(409)
  expect((await own.client.patch(`${unit}/availability`, { data: { availabilityStatus: 'AVAILABLE' } })).status()).toBe(409)
  // Direct application URLs must also remain tenant scoped, independently of the API tests above.
  await page.goto('/login'); await page.getByLabel('Email address').fill(a.email); await page.getByLabel('Password', { exact: true }).fill(a.password); await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toBeVisible()
  await page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')) }, `/properties/${seeded.propertyId}/units/${seeded.unitId}`)
  await expect(page.getByRole('alert')).toContainText('not found')
  await expect(page.getByRole('heading', { name: 'QA-101' })).toHaveCount(0)
})

test('CSRF, exact Origin, session verification, rotation, reuse rejection and logout', async ({ qa, request }) => {
  const account = await qa.account()
  const client = await apiRequest.newContext({ baseURL: apiURL, extraHTTPHeaders: { Origin: appURL } })
  let stale: Awaited<ReturnType<typeof apiRequest.newContext>> | undefined
  try {
    const csrfResponse = await client.get('/api/v1/browser-auth/csrf')
    const { csrfToken } = await csrfResponse.json() as { csrfToken: string }
    const headers = { 'X-CSRF-TOKEN': csrfToken }
    expect((await client.post('/api/v1/browser-auth/login', { data: account })).status()).toBe(403)
    expect((await client.post('/api/v1/browser-auth/login', { data: account, headers: { ...headers, Origin: appURL + '.evil.test' } })).status()).toBe(403)
    expect((await client.post('/api/v1/browser-auth/login', { data: { email: account.email, password: 'incorrect-password' }, headers })).status()).toBe(401)
    const login = await client.post('/api/v1/browser-auth/login', { data: { email: account.email, password: account.password }, headers })
    expect(login.status()).toBe(200)
    const token = (await login.json() as { accessToken: string }).accessToken
    expect((await client.get('/api/v1/browser-auth/session', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200)
    const old = await client.storageState()
    const cookie = old.cookies.find(c => c.name === 'dev-refresh')!
    expect({ httpOnly: cookie.httpOnly, secure: cookie.secure, sameSite: cookie.sameSite, path: cookie.path }).toEqual({ httpOnly: true, secure: false, sameSite: 'Strict', path: '/' })
    expect((await client.post('/api/v1/browser-auth/refresh', { headers })).status()).toBe(200)
    const current = await client.storageState()
    expect(current.cookies.find(c => c.name === 'dev-refresh')?.value !== cookie.value).toBe(true)
    stale = await apiRequest.newContext({ baseURL: apiURL, storageState: old, extraHTTPHeaders: { Origin: appURL } })
    expect((await stale.post('/api/v1/browser-auth/refresh', { headers })).status()).toBe(401)
    expect((await client.post('/api/v1/browser-auth/refresh', { headers })).status()).toBe(401)
    // Explicit sign-in creates a new family after replay invalidates the old family.
    expect((await client.post('/api/v1/browser-auth/login', { data: { email: account.email, password: account.password }, headers })).status()).toBe(200)
    expect((await client.post('/api/v1/browser-auth/logout', { headers })).status()).toBe(204)
    expect((await client.post('/api/v1/browser-auth/refresh', { headers })).status()).toBe(401)
    const cors = await request.fetch(apiURL + '/api/v1/browser-auth/login', { method: 'OPTIONS', headers: { Origin: appURL, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-csrf-token' } })
    expect(cors.status()).toBe(200); expect(cors.headers()['access-control-allow-origin']).toBe(appURL)
    expect((await request.fetch(apiURL + '/api/v1/browser-auth/login', { method: 'OPTIONS', headers: { Origin: appURL + '/', 'Access-Control-Request-Method': 'POST' } })).status()).toBe(403)
  } finally { await client.dispose(); await stale?.dispose() }
})
