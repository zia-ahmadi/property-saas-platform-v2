import { test, expect, sql, uuid, apiURL, visit } from './fixtures.ts'
import AxeBuilder from '@axe-core/playwright'
import { randomBytes } from 'node:crypto'
import { request } from '@playwright/test'

test('platform approval and private inbox with real sessions', async ({ browser }) => {
  const api = await request.newContext({baseURL: apiURL}); const suffix = randomBytes(6).toString('hex'); const password = 'QA-password-12345!'
  async function register(kind: string) {
    const data = {email:`${kind}-${suffix}@example.test`,password,firstName:'QA',lastName:kind,organizationName:`${kind} ${suffix}`,organizationSlug:`${kind}-${suffix}`}
    const response = await api.post('/api/v1/users/register',{data}); expect(response.status()).toBe(201)
    return {...data,...await response.json()} as typeof data & { userId: string; organizationId: string }
  }
  const platform = await register('platform')
  sql(`INSERT INTO platform_authorities(user_id,authority) VALUES ('${uuid(platform.userId)}','PLATFORM_OWNER');`)
  const platformContext = await browser.newContext()
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const admin = await platformContext.newPage()
  const member = await ownerContext.newPage()
  const email = `owner-${suffix}@example.test`
  const organizationName = `Owner ${suffix}`

  async function auditOwnerPage() {
    expect(await member.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    const { violations } = await new AxeBuilder({ page: member }).analyze()
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([])
  }

  async function signIn(page: typeof admin, address: string) {
    await page.getByLabel('Email address').fill(address)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/access$/)
  }

  try {
    await member.goto('/')
    await expect(member.getByRole('heading', { name: 'Manage your properties in one workspace.' })).toBeVisible()
    await auditOwnerPage()
    await member.getByRole('link', { name: 'Support', exact: true }).click()
    await expect(member).toHaveURL(/\/login$/)
    await member.getByRole('link', { name: 'Home', exact: true }).click()
    await member.getByRole('link', { name: 'Create an organization' }).click()
    await member.getByLabel('First name').fill('QA')
    await member.getByLabel('Last name').fill('Owner')
    await member.getByLabel('Email address').fill(email)
    await member.getByLabel('Password', { exact: true }).fill(password)
    await member.getByLabel('Organization name').fill(organizationName)
    await member.getByLabel('Organization slug').fill(`owner-${suffix}`)
    await member.getByRole('button', { name: 'Create account' }).click()
    await expect(member.getByRole('status')).toContainText('Your organization is pending review')
    await signIn(member, email)
    await expect(member.getByRole('heading', { name: organizationName })).toBeVisible()
    await expect(member.getByText('Pending review', { exact: true })).toBeVisible()
    await auditOwnerPage()
    await member.goto('/leases')
    await expect(member).toHaveURL(/\/access$/)
    await member.getByRole('link', { name: `Message support for ${organizationName}` }).click()
    await expect(member.getByRole('heading', { name: 'Platform support' })).toBeVisible()
    await expect(member.getByText(organizationName, { exact: true })).toBeVisible()
    await auditOwnerPage()
    const ownerConversation = member.url()
    const composer = member.getByLabel('Message the platform team')
    await composer.fill('Can you check our registration?')
    await member.getByRole('button', { name: 'Send message' }).click()
    await expect(member.getByText('Can you check our registration?')).toBeVisible()

    await admin.goto('/login')
    await signIn(admin, platform.email)
    await admin.goto(ownerConversation)
    await expect(admin.getByRole('alert')).toContainText('You do not have permission')
    await admin.getByRole('link', { name: 'Switch to platform workspace' }).click()
    await expect(admin.getByRole('heading', { name: 'Platform workspace' })).toBeVisible()
    await expect(admin.getByLabel('Organization', { exact: true })).toHaveCount(0)
    await expect(admin.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Renters' })).toHaveCount(0)
    await admin.getByLabel('Search').fill(organizationName)
    await admin.getByRole('button', { name: organizationName }).click()
    await expect(admin.getByText('Can you check our registration?')).toBeVisible()
    await admin.getByRole('button', { name: 'Mark read' }).click()
    await expect(member.getByText('Read by platform')).toBeVisible()
    await admin.getByLabel('Private message').fill('We received your registration.')
    await admin.getByRole('button', { name: 'Send message' }).click()
    await expect(member.getByText('We received your registration.')).toBeVisible()
    await member.getByRole('button', { name: 'Mark as read' }).click()
    await expect(member.getByText('Read', { exact: true })).toBeVisible()

    await admin.getByRole('button', { name: 'approve', exact: true }).click()
    await expect(admin.getByText('Organization status updated.')).toBeVisible()
    await visit(member, '/access')
    await member.getByRole('button', { name: 'Refresh access' }).click()
    await member.getByRole('link', { name: 'Open dashboard' }).click()
    await expect(member.getByRole('heading', { name: 'Enterprise Portfolio Dashboard' })).toBeVisible()

    await admin.getByLabel('Reason for adverse decisions').fill('QA suspension')
    admin.once('dialog', dialog => dialog.accept())
    await admin.getByRole('button', { name: 'suspend', exact: true }).click()
    await expect(admin.getByText('Organization status updated.')).toBeVisible()
    await member.goto('/access')
    await expect(member.getByText('Access suspended', { exact: true })).toBeVisible()
    await member.getByRole('link', { name: `Message support for ${organizationName}` }).click()
    await composer.fill('Please review suspension')
    await member.getByRole('button', { name: 'Send message' }).click()
    await expect(member.getByText('Please review suspension')).toBeVisible()
    await admin.getByRole('button', { name: 'Refresh messages' }).click()
    await expect(admin.getByText('Please review suspension')).toBeVisible()

    await admin.getByLabel('Reason for adverse decisions').fill('QA ban')
    admin.once('dialog', dialog => dialog.accept())
    await admin.getByRole('button', { name: 'ban', exact: true }).click()
    await expect(admin.getByText('Organization status updated.')).toBeVisible()
    await composer.fill('Please review ban')
    await member.getByRole('button', { name: 'Send message' }).click()
    await expect(member.getByText('Please review ban')).toBeVisible()
    await admin.getByRole('button', { name: 'Refresh messages' }).click()
    await expect(admin.getByText('Please review ban')).toBeVisible()
    await admin.getByLabel('Private message').fill('We received your appeal.')
    await admin.getByRole('button', { name: 'Send message' }).click()
    await member.reload()
    await expect(member.getByText('We received your appeal.')).toBeVisible()
  } finally {
    await platformContext.close()
    await ownerContext.close()
    await api.dispose()
  }
})

test('new and existing users accept invitations and team role changes', async ({ browser }) => {
  const api=await request.newContext({baseURL:apiURL}); const suffix=randomBytes(6).toString('hex'); const password='QA-password-12345!'
  async function register(kind: string) { const input={email:`${kind}-${suffix}@example.test`,password,firstName:'QA',lastName:kind,organizationName:`${kind} ${suffix}`,organizationSlug:`${kind}-${suffix}`}; const response=await api.post('/api/v1/users/register',{data:input}); expect(response.status()).toBe(201); return {...input,...await response.json()} as typeof input & {organizationId:string} }
  const owner=await register('teamowner'), existing=await register('existing'); sql(`UPDATE organizations SET status='active' WHERE id IN ('${uuid(owner.organizationId)}','${uuid(existing.organizationId)}');`)
  const context=await browser.newContext(), freshContext=await browser.newContext(), existingContext=await browser.newContext(); const page=await context.newPage(), fresh=await freshContext.newPage(), other=await existingContext.newPage()
  async function signIn(p: typeof page, email: string) { await p.goto('/login'); await p.getByLabel('Email address').fill(email); await p.getByLabel('Password',{exact:true}).fill(password); await p.getByRole('button',{name:'Sign in',exact:true}).click(); await expect(p).toHaveURL(/\/dashboard/) }
  try {
    await signIn(page,owner.email); await page.getByRole('link',{name:'Team',exact:true}).first().click()
    const newEmail=`new-${suffix}@example.test`; await page.getByLabel('Email address',{exact:true}).fill(newEmail); await page.getByLabel('Invitation role',{exact:true}).selectOption('STAFF'); await page.getByRole('button',{name:'Create invitation'}).click(); const link=await page.getByLabel('Invitation link').inputValue()
    await fresh.goto(link); await fresh.getByLabel('First name').fill('New'); await fresh.getByLabel('Last name').fill('Member'); await fresh.getByLabel('Invited email').fill(newEmail); await fresh.getByLabel('Password').fill(password); await fresh.getByRole('button',{name:'Create account and accept'}).click(); await expect(fresh).toHaveURL(/\/login/); await signIn(fresh,newEmail); await expect(fresh.getByLabel('Organization',{exact:true})).toHaveValue(owner.organizationId); await expect(fresh.getByRole('link',{name:'Team',exact:true})).toHaveCount(0)
    await page.getByLabel('Email address',{exact:true}).fill(existing.email); await page.getByLabel('Invitation role',{exact:true}).selectOption('MANAGER'); await page.getByRole('button',{name:'Create invitation'}).click(); const existingLink=await page.getByLabel('Invitation link').inputValue()
    await other.goto(existingLink); await other.getByRole('link',{name:'Sign in to accept'}).click(); await other.getByLabel('Email address').fill(existing.email); await other.getByLabel('Password',{exact:true}).fill(password); await other.getByRole('button',{name:'Sign in',exact:true}).click(); await other.getByRole('button',{name:'Accept invitation'}).click(); await expect(other).toHaveURL(/\/dashboard/); await expect(other.getByLabel('Organization',{exact:true}).locator('option')).toHaveCount(2)
    await page.getByRole('button',{name:'Refresh team'}).click(); await page.getByLabel(`Role for ${existing.email}`).selectOption('STAFF'); await expect(page.getByLabel(`Role for ${existing.email}`)).toHaveValue('STAFF'); await other.getByLabel('Organization',{exact:true}).selectOption(owner.organizationId); await other.getByRole('link',{name:'Renters',exact:true}).first().click(); await other.getByRole('link',{name:'Add renter'}).click(); await other.getByLabel('First name').fill('Denied'); await other.getByLabel('Last name').fill('Renter'); await other.getByRole('button',{name:'Save renter'}).click(); await expect(other.getByRole('heading',{name:'Access denied'})).toBeVisible(); await other.getByRole('button',{name:'Refresh access'}).click(); await other.getByRole('link',{name:'Renters',exact:true}).first().click(); await expect(other.getByRole('link',{name:'Add renter'})).toHaveCount(0)
  } finally { await context.close(); await freshContext.close(); await existingContext.close(); await api.dispose() }
})
