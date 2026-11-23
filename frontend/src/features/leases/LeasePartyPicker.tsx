import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/features/organization/context'
import type { RenterPage } from '@/features/renters/api'
import type { LeasePage, LeaseUnit } from './api'

export interface PartyOption { id: string; label: string }

interface Props {
  kind: 'renter' | 'unit'
  selected?: PartyOption
  onChange: (option?: PartyOption) => void
}

export function LeasePartyPicker({ kind, selected, onChange }: Props) {
  const org = useOrganization()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const label = kind === 'renter' ? 'Renter' : 'Unit'
  const query = useQuery({
    queryKey: org.queryKey(['leases', 'options', kind, page, search.trim()]),
    queryFn: async ({ signal }) => {
      const options = { params: { page, search: search.trim(), size: 20 }, signal }
      if (kind === 'renter') {
        const result = await org.request<RenterPage>('get', 'renters', undefined, options)
        return { totalPages: result.totalPages, options: result.content.map(renter => ({
          id: renter.id, label: `${renter.firstName} ${renter.lastName}${renter.email ? ` · ${renter.email}` : ''}`,
        })) }
      }
      const result = await org.request<LeasePage<LeaseUnit>>('get', 'leases/units', undefined, options)
      return { totalPages: result.totalPages, options: result.content.map(unit => ({
        id: unit.id, label: `${unit.propertyName} · Unit ${unit.unitNumber} · ${unit.availabilityStatus.toLowerCase()}`,
      })) }
    },
    retry: false,
  })
  const options = query.data?.options ?? []
  const choices = selected && !options.some(option => option.id === selected.id) ? [selected, ...options] : options
  return (
    <div className="min-w-0 space-y-2">
      <label className="block space-y-1 text-sm font-medium">
        <span>Find a {kind}</span>
        <Input type="search" maxLength={150} value={search} placeholder={kind === 'renter' ? 'Search by name or email' : 'Search by property or unit number'}
          onChange={event => { setSearch(event.target.value); setPage(0) }} />
      </label>
      <Select label={label} value={selected?.id ?? ''} required aria-busy={query.isPending}
        onChange={event => onChange(choices.find(option => option.id === event.target.value))}>
        <option value="">{query.isPending ? 'Loading…' : `Choose a ${kind}`}</option>
        {choices.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </Select>
      {query.isError && <div className="space-y-1 text-sm">
        <p role="alert" className="text-destructive">Couldn’t load {kind} options.</p>
        <Button type="button" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
      </div>}
      {query.isSuccess && !options.length && <p role="status" className="text-sm text-muted-foreground">
        {search.trim() ? `No matching ${kind}s.` : kind === 'renter' ? 'Add a renter before creating a lease.' : 'Add a unit to an active property before creating a lease.'}
      </p>}
      {query.data && <Pagination label={`${label} options`} page={page + 1} totalPages={query.data.totalPages} onPageChange={next => setPage(next - 1)} />}
    </div>
  )
}
