import { test as base, expect, request, type APIRequestContext, type Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

export const apiURL = process.env.QA_API_URL ?? 'http://localhost:8097'
export const appURL = process.env.QA_APP_URL ?? 'http://localhost:5197'
export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF'
export interface Account { userId: string; organizationId: string; email: string; password: string; organizationName: string; organizationSlug: string }
export function sql(query: string): string {
  const container = process.env.QA_DB_CONTAINER ?? ''
  if (!/^property-saas-f7-[a-f0-9]{12}$/.test(container)) throw new Error('Use npm run qa:e2e: dedicated QA container is required')
  const label = spawnSync('docker', ['inspect', '--format', '{{index .Config.Labels "property-saas.qa"}}', container], { encoding: 'utf8' })
  if (label.status !== 0 || label.stdout.trim() !== 'f7') throw new Error('Refusing SQL outside a labelled disposable F7 container')
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'qa_admin', '-d', 'qa_e2e', '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8' })
  if (result.status !== 0) throw new Error('QA fixture SQL failed')
  return result.stdout.trim()
}
export function uuid(value: string): string {
  if (!/^[a-f0-9-]{36}$/.test(value)) throw new Error('Invalid fixture UUID')
  return value
}
export function scope(account: Account): string { return `/api/v1/organizations/${uuid(account.organizationId)}` }
export async function signIn(page: Page, account: Account) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toBeVisible()
  const selection = page.getByLabel('Organization', { exact: true })
  await selection.selectOption(account.organizationId)
  await expect(selection).toHaveValue(account.organizationId)
}
export async function visit(page: Page, path: string) {
  // In-app history retains F3's memory-only session. Full reload deliberately signs out.
  await page.evaluate(path => { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
}
export const propertyInput = { name: 'QA property', propertyType: 'HOUSE', addressLine1: 'Test street', addressLine2: null, city: 'Kabul', countryCode: 'AF' }
export const unitInput = { unitNumber: 'QA-101', unitType: 'APARTMENT', floorNumber: 1, areaSqm: 50.25 }
export const test = base.extend<{ qa: {
  account: (role?: Role) => Promise<Account>
  loginAPI: (account: Account) => Promise<{ client: APIRequestContext; token: string; csrf: string }>
  seed: (account: Account) => Promise<{ propertyId: string; unitId: string }>
} }>({
  qa: async ({}, use) => {
    const accounts: Account[] = [], clients: APIRequestContext[] = []
    const registration = await request.newContext({ baseURL: apiURL })
    const account = async (role: Role = 'OWNER'): Promise<Account> => {
      const suffix = randomBytes(8).toString('hex')
      const input = { email: `f7-${suffix}@example.test`, password: randomBytes(20).toString('hex') + 'A1!', firstName: 'QA', lastName: 'User', organizationName: `QA ${suffix}`, organizationSlug: `f7-${suffix}` }
      const result = await registration.post('/api/v1/users/register', { data: input })
      expect(result.status()).toBe(201)
      const created = { ...input, ...await result.json() } as Account
      accounts.push(created)
      if (role !== 'OWNER') sql(`UPDATE organization_memberships SET role='${role.toLowerCase()}' WHERE user_id='${uuid(created.userId)}' AND organization_id='${uuid(created.organizationId)}';`)
      return created
    }
    const loginAPI = async (account: Account) => {
      const client = await request.newContext({ baseURL: apiURL, extraHTTPHeaders: { Origin: appURL } })
      clients.push(client)
      const csrfResponse = await client.get('/api/v1/browser-auth/csrf')
      expect(csrfResponse.status()).toBe(200)
      const { csrfToken: csrf } = await csrfResponse.json() as { csrfToken: string }
      const response = await client.post('/api/v1/browser-auth/login', { headers: { 'X-CSRF-TOKEN': csrf }, data: { email: account.email, password: account.password } })
      expect(response.status()).toBe(200)
      const { accessToken: token } = await response.json() as { accessToken: string }
      await client.dispose()
      const authenticated = await request.newContext({ baseURL: apiURL, extraHTTPHeaders: { Origin: appURL, Authorization: `Bearer ${token}` } })
      clients.push(authenticated)
      return { client: authenticated, token, csrf }
    }
    const seed = async (account: Account) => {
      const p = sql(`INSERT INTO properties(organization_id,name,property_type,address_line1,city,country_code) VALUES ('${uuid(account.organizationId)}','QA property','house','Test street','Kabul','AF') RETURNING id;`)
      const u = sql(`INSERT INTO units(property_id,unit_number,unit_type,area_sqm) VALUES ('${uuid(p)}','QA-101','apartment',50.25) RETURNING id;`)
      return { propertyId: uuid(p), unitId: uuid(u) }
    }
    try { await use({ account, loginAPI, seed }) } finally {
      await registration.dispose()
      await Promise.all(clients.map(client => client.dispose()))
      if (accounts.length) {
        const orgs = accounts.map(a => `'${uuid(a.organizationId)}'`).join(',')
        const users = accounts.map(a => `'${uuid(a.userId)}'`).join(',')
        sql(`BEGIN; DELETE FROM units WHERE property_id IN (SELECT id FROM properties WHERE organization_id IN (${orgs})); DELETE FROM properties WHERE organization_id IN (${orgs}); DELETE FROM organization_memberships WHERE organization_id IN (${orgs}) OR user_id IN (${users}); DELETE FROM users WHERE id IN (${users}); DELETE FROM organizations WHERE id IN (${orgs}); COMMIT;`)
      }
    }
  },
})
export { expect }
