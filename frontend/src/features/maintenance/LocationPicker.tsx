import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pagination } from '@/components/ui/pagination'
import { useOrganization } from '@/features/organization/context'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/errors'
import type { UnitPage } from '@/features/units/api'
import { Select } from './Select'

export interface LocationOption { id: string; label: string }

interface PickerProps {
  selected?: LocationOption
  onChange: (next?: LocationOption) => void
}

export function PropertyPicker({ selected, onChange }: PickerProps) {
  const org = useOrganization()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: org.queryKey(['maintenance', 'property-options', search, page]),
    queryFn: ({ signal }) => org.request<{ content: { id: string; name: string }[]; totalPages: number }>(
      'get', 'maintenance/properties', undefined, { params: { search, page }, signal },
    ),
    retry: false,
  })
  const options = query.data?.content.map(property => ({ id: property.id, label: property.name })) ?? []
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        <span>Find a property</span>
        <Input type="search" value={search} maxLength={150} placeholder="Search active properties by name"
          onChange={event => {
            setSearch(event.target.value)
            setPage(0)
          }} />
      </label>
      <LocationSelect label="Property" placeholder="Choose a property" required selected={selected} onChange={onChange}
        options={options} page={page} totalPages={query.data?.totalPages ?? 0} onPageChange={setPage}
        emptyMessage={search.trim() ? 'No active properties match your search.' : 'This organization has no active properties.'}
        errorMessage={query.error instanceof ApiError && query.error.status === 404 ? 'The backend could not find the maintenance property list.' : 'Couldn’t load active properties.'}
        pending={query.isPending} retry={query.isError ? () => void query.refetch() : undefined} />
    </div>
  )
}

export function UnitPicker({ propertyId, selected, onChange }: PickerProps & { propertyId: string }) {
  const org = useOrganization()
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: org.queryKey(['maintenance', 'location-units', propertyId, page]),
    queryFn: ({ signal }) => org.request<UnitPage>('get', `properties/${propertyId}/units`, undefined, { params: { page, size: 25 }, signal }),
    retry: false,
  })
  const options = query.data?.content.map(unit => ({ id: unit.id, label: `Unit ${unit.unitNumber}` })) ?? []
  return (
    <LocationSelect label="Unit" placeholder="Property-wide request" selected={selected} onChange={onChange}
      options={options} page={page} totalPages={query.data?.totalPages ?? 0} onPageChange={setPage}
      pending={query.isPending} retry={query.isError ? () => void query.refetch() : undefined} />
  )
}

interface LocationSelectProps extends PickerProps {
  label: string
  placeholder: string
  required?: boolean
  options: LocationOption[]
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  pending: boolean
  retry?: () => void
  emptyMessage?: string
  errorMessage?: string
}

function LocationSelect({ label, placeholder, required, selected, onChange, options, page, totalPages, onPageChange, pending, retry, emptyMessage, errorMessage }: LocationSelectProps) {
  const choices = selected && !options.some(option => option.id === selected.id) ? [selected, ...options] : options
  return (
    <div className="min-w-0 space-y-2">
      <Select label={label} required={required} value={selected?.id ?? ''} aria-busy={pending}
        onChange={event => onChange(choices.find(option => option.id === event.target.value))}>
        <option value="">{pending && !selected ? 'Loading…' : placeholder}</option>
        {choices.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </Select>
      {retry && <div className="space-y-1 text-sm">
        <p role="alert" className="text-destructive">{errorMessage ?? 'Couldn’t load units.'}</p>
        <button type="button" className="underline" onClick={retry}>Retry loading {label.toLowerCase()} options</button>
      </div>}
      {!pending && !retry && !options.length && (!choices.length || emptyMessage) && <p role="status" className="text-xs text-muted-foreground">{emptyMessage ?? 'No units at this property.'}</p>}
      <Pagination label={`${label} options`} page={page + 1} totalPages={totalPages} onPageChange={next => onPageChange(next - 1)} />
    </div>
  )
}
