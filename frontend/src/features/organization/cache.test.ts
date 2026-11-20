import { QueryClient } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { discardOrganizationQueries } from './cache'

it('cancels obsolete reads without cancelling the verified scope mounted during refresh', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let oldSignal!: AbortSignal, currentSignal!: AbortSignal, finish!: (value: string) => void
  const obsolete = client.fetchQuery({ queryKey: ['organization','user','old','OWNER','property'], queryFn: ({ signal }) => { oldSignal = signal; return new Promise<string>(() => {}) } }).catch(() => undefined)
  const current = client.fetchQuery({ queryKey: ['organization','user','new','STAFF','dashboard'], queryFn: ({ signal }) => { currentSignal = signal; return new Promise<string>(resolve => { finish = resolve }) } })
  discardOrganizationQueries(client, ['user','new','STAFF'])
  await obsolete
  expect(oldSignal.aborted).toBe(true); expect(currentSignal.aborted).toBe(false)
  finish('new tenant data'); await expect(current).resolves.toBe('new tenant data')
  expect(client.getQueryData(['organization','user','old','OWNER','property'])).toBeUndefined()
  expect(client.getQueryData(['organization','user','new','STAFF','dashboard'])).toBe('new tenant data')
  client.clear()
})
it('removes old identities and roles, while leaving non-tenant entries alone', async () => {
  const client = new QueryClient()
  for (const key of [['organization','old-user','same','OWNER'], ['organization','user','same','OWNER'], ['organization','user','same','STAFF'], ['public']]) client.setQueryData(key, 'value')
  discardOrganizationQueries(client, ['user','same','STAFF'])
  await Promise.resolve()
  expect(client.getQueryData(['organization','old-user','same','OWNER'])).toBeUndefined()
  expect(client.getQueryData(['organization','user','same','OWNER'])).toBeUndefined()
  expect(client.getQueryData(['organization','user','same','STAFF'])).toBe('value')
  discardOrganizationQueries(client)
  expect(client.getQueryData(['organization','user','same','STAFF'])).toBeUndefined()
  expect(client.getQueryData(['public'])).toBe('value')
  client.clear()
})
