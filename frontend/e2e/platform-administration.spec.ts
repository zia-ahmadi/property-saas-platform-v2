import { test, expect, sql, uuid, apiURL } from './fixtures.ts'
import { randomBytes } from 'node:crypto'
import { request } from '@playwright/test'

test('platform approval and private inbox with real sessions', async ({ browser }) => {
  const api = await request.newContext({baseURL: apiURL}); const suffix = randomBytes(6).toString('hex'); const password = 'QA-password-12345!'
  async function register(kind: string) {
    const data = {email:`${kind}-${suffix}@example.test`,password,firstName:'QA',lastName:kind,organizationName:`${kind} ${suffix}`,organizationSlug:`${kind}-${suffix}`}
    const response = await api.post('/api/v1/users/register',{data}); expect(response.status()).toBe(201)
    return {...data,...await response.json()} as typeof data & { userId: string; organizationId: string }
  }
  const platform=await register('platform'), owner=await register('owner')
  sql(`INSERT INTO platform_authorities(user_id,authority) VALUES ('${uuid(platform.userId)}','PLATFORM_OWNER');`)
  const platformContext=await browser.newContext(), ownerContext=await browser.newContext()
  const admin=await platformContext.newPage(), member=await ownerContext.newPage()
  async function login(page: typeof admin, user: typeof owner) {
    await page.goto('/login'); await page.getByLabel('Email address').fill(user.email); await page.getByLabel('Password',{exact:true}).fill(password); await page.getByRole('button',{name:'Sign in',exact:true}).click(); await expect(page).toHaveURL(/\/dashboard/)
  }
  try {
    await login(member,owner); await expect(member.getByText(`${owner.organizationName}: Pending review`)).toBeVisible()
    await login(admin,platform); await admin.getByRole('link',{name:'Switch to platform workspace'}).click(); await expect(admin.getByRole('heading',{name:'Platform workspace'})).toBeVisible(); await expect(admin.getByLabel('Organization',{exact:true})).toHaveCount(0); await expect(admin.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Renters'})).toHaveCount(0); await admin.getByRole('link',{name:'Switch to organization workspace'}).click(); await expect(admin.getByRole('heading',{name:'No active organizations'})).toBeVisible(); await admin.getByRole('link',{name:'Switch to platform workspace'}).click(); await admin.getByLabel('Search').fill(owner.organizationName); await admin.getByRole('button',{name:owner.organizationName}).click(); await admin.getByRole('button',{name:'approve',exact:true}).click(); await expect(admin.getByText('Decision recorded.')).toBeVisible()
    await member.reload(); await expect(member.getByLabel('Organization',{exact:true})).toHaveValue(owner.organizationId)
    await admin.getByLabel('Private message').fill('Private QA message'); await admin.getByRole('button',{name:'Send message'}).click(); await member.getByRole('link',{name:'Inbox',exact:true}).first().click(); await expect(member.getByText('Private QA message')).toBeVisible(); await member.getByRole('button',{name:'Mark read'}).click(); await expect(member.getByText(/^Platform · Read/)).toBeVisible()
    await admin.getByLabel('Reason for adverse decisions').fill('QA suspension'); admin.once('dialog',d=>d.accept()); await admin.getByRole('button',{name:'suspend',exact:true}).click(); await member.getByRole('link',{name:'Renters',exact:true}).first().click(); await expect(member.getByText('Organization access restricted')).toBeVisible(); await expect(member.getByText(`${owner.organizationName}: Access suspended`)).toBeVisible()
    await member.getByRole('link',{name:'Messages with platform'}).click(); await member.getByLabel('Message to platform').fill('Please review suspension'); await member.getByRole('button',{name:'Send message'}).click(); await expect(member.getByText('Please review suspension')).toBeVisible()
    await admin.getByRole('button',{name:'Refresh messages'}).click(); await expect(admin.getByText('Please review suspension')).toBeVisible(); await admin.getByRole('button',{name:'Mark read'}).click(); await expect(admin.getByText('Organization · Read')).toBeVisible()
    await admin.getByLabel('Reason for adverse decisions').fill('QA ban'); admin.once('dialog',d=>d.accept()); await admin.getByRole('button',{name:'ban',exact:true}).click(); await expect(admin.getByText('Decision recorded.')).toBeVisible()
    await member.getByLabel('Message to platform').fill('Please review ban'); await member.getByRole('button',{name:'Send message'}).click(); await expect(member.getByText('Please review ban')).toBeVisible(); await admin.getByRole('button',{name:'Refresh messages'}).click(); await expect(admin.getByText('Please review ban')).toBeVisible()
    await admin.getByLabel('Private message').fill('We received your appeal'); await admin.getByRole('button',{name:'Send message'}).click(); await member.reload(); await expect(member.getByText('We received your appeal')).toBeVisible()

  } finally { await platformContext.close(); await ownerContext.close(); await api.dispose() }
})

test('new and existing users accept invitations and team role changes', async ({ browser }) => {
  const api=await request.newContext({baseURL:apiURL}); const suffix=randomBytes(6).toString('hex'); const password='QA-password-12345!'
  async function register(kind: string) { const input={email:`${kind}-${suffix}@example.test`,password,firstName:'QA',lastName:kind,organizationName:`${kind} ${suffix}`,organizationSlug:`${kind}-${suffix}`}; const response=await api.post('/api/v1/users/register',{data:input}); expect(response.status()).toBe(201); return {...input,...await response.json()} as typeof input & {organizationId:string} }
  const owner=await register('teamowner'), existing=await register('existing'); sql(`UPDATE organizations SET status='active' WHERE id IN ('${uuid(owner.organizationId)}','${uuid(existing.organizationId)}');`)
  const context=await browser.newContext(), freshContext=await browser.newContext(), existingContext=await browser.newContext(); const page=await context.newPage(), fresh=await freshContext.newPage(), other=await existingContext.newPage()
  async function signIn(p: typeof page, email: string) { await p.goto('/login'); await p.getByLabel('Email address').fill(email); await p.getByLabel('Password',{exact:true}).fill(password); await p.getByRole('button',{name:'Sign in',exact:true}).click(); await expect(p).toHaveURL(/\/dashboard/) }
  try {
    await signIn(page,owner.email); await page.getByRole('link',{name:'Team',exact:true}).first().click()
    const newEmail=`new-${suffix}@example.test`; await page.getByLabel('Email',{exact:true}).fill(newEmail); await page.getByLabel('Invitation role',{exact:true}).selectOption('STAFF'); await page.getByRole('button',{name:'Create invitation'}).click(); const link=await page.getByLabel('Invitation link').inputValue()
    await fresh.goto(link); await fresh.getByLabel('First name').fill('New'); await fresh.getByLabel('Last name').fill('Member'); await fresh.getByLabel('Invited email').fill(newEmail); await fresh.getByLabel('Password').fill(password); await fresh.getByRole('button',{name:'Create account and accept'}).click(); await expect(fresh).toHaveURL(/\/login/); await signIn(fresh,newEmail); await expect(fresh.getByLabel('Organization',{exact:true})).toHaveValue(owner.organizationId); await expect(fresh.getByRole('link',{name:'Team',exact:true})).toHaveCount(0)
    await page.getByLabel('Email',{exact:true}).fill(existing.email); await page.getByLabel('Invitation role',{exact:true}).selectOption('MANAGER'); await page.getByRole('button',{name:'Create invitation'}).click(); const existingLink=await page.getByLabel('Invitation link').inputValue()
    await other.goto(existingLink); await other.getByRole('link',{name:'Sign in to accept'}).click(); await other.getByLabel('Email address').fill(existing.email); await other.getByLabel('Password',{exact:true}).fill(password); await other.getByRole('button',{name:'Sign in',exact:true}).click(); await other.getByRole('button',{name:'Accept invitation'}).click(); await expect(other).toHaveURL(/\/dashboard/); await expect(other.getByLabel('Organization',{exact:true}).locator('option')).toHaveCount(2)
    await page.getByRole('button',{name:'Refresh team'}).click(); await page.getByLabel(`Role for ${existing.email}`).selectOption('STAFF'); await expect(page.getByLabel(`Role for ${existing.email}`)).toHaveValue('STAFF'); await other.getByLabel('Organization',{exact:true}).selectOption(owner.organizationId); await other.getByRole('link',{name:'Renters',exact:true}).first().click(); await other.getByRole('link',{name:'Add renter'}).click(); await other.getByLabel('First name').fill('Denied'); await other.getByLabel('Last name').fill('Renter'); await other.getByRole('button',{name:'Save renter'}).click(); await expect(other.getByRole('heading',{name:'Access denied'})).toBeVisible(); await other.getByRole('button',{name:'Refresh access'}).click(); await other.getByRole('link',{name:'Renters',exact:true}).first().click(); await expect(other.getByRole('link',{name:'Add renter'})).toHaveCount(0)
  } finally { await context.close(); await freshContext.close(); await existingContext.close(); await api.dispose() }
})
