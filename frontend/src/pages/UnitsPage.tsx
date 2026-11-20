import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useOrganization } from '@/features/organization/context'
import type { Property } from '@/features/properties/api'
import {
  emptyUnit,
  manualTarget,
  type Unit,
  type UnitInput,
  type UnitPage,
} from '@/features/units/api'
import { unitError } from '@/features/units/errors'
import { UnitForm } from '@/features/units/UnitForm'
import { UnitStatus } from '@/features/units/UnitStatus'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

type Mode = 'list' | 'create' | 'details' | 'edit'
export function UnitsPage({ mode = 'list' }: { mode?: Mode }) {
  const org = useOrganization()
  const { propertyId = '', unitId = '' } = useParams()
  return (
    <UnitWorkspace
      key={`${org.queryKey([]).join(':')}:${propertyId}:${unitId}:${mode}`}
      mode={mode}
      propertyId={propertyId}
      unitId={unitId}
    />
  )
}
function UnitWorkspace({
  mode,
  propertyId,
  unitId,
}: {
  mode: Mode
  propertyId: string
  unitId: string
}) {
  const org = useOrganization()
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const active = useRef(true)
  const busy = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const base = `properties/${propertyId}/units`
  const route = `/properties/${propertyId}/units`
  const propertyKey = org.queryKey(['property', propertyId])
  const unitsKey = org.queryKey(['units', propertyId])
  const detailKey = org.queryKey(['unit', propertyId, unitId])
  const property = useQuery({
    queryKey: propertyKey,
    queryFn: ({ signal }) =>
      org.request<Property>('get', `properties/${propertyId}`, undefined, { signal }),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  })
  const list = useQuery({
    queryKey: [...unitsKey, page, size],
    queryFn: ({ signal }) =>
      org.request<UnitPage>('get', base, undefined, { params: { page, size }, signal }),
    enabled: mode === 'list' && !!property.data && !property.isError,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => org.request<Unit>('get', `${base}/${unitId}`, undefined, { signal }),
    enabled: (mode === 'details' || mode === 'edit') && !!property.data && !property.isError,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  })
  if (list.data && page > 0 && page >= list.data.totalPages)
    setPage(Math.max(0, list.data.totalPages - 1))
  const writable =
    org.can('PROPERTY_MANAGE') && property.data?.status === 'ACTIVE' && !property.isError
  const mutation = useMutation({
    mutationFn: async (action: { input: UnitInput } | { status: 'AVAILABLE' | 'UNAVAILABLE' }) => {
      if (busy.current || !active.current || !writable) throw new Error('Action unavailable')
      busy.current = true
      try {
        // Revalidate parent immediately before writing; the backend remains authoritative.
        const parent = await org.request<Property>('get', `properties/${propertyId}`)
        if (!active.current) throw new Error('Scope changed')
        client.setQueryData(propertyKey, parent)
        if (parent.status !== 'ACTIVE')
          throw new Error('Property is archived. Refresh to view its current state.')
        return 'input' in action
          ? await org.request<Unit>(
              mode === 'create' ? 'post' : 'patch',
              mode === 'create' ? base : `${base}/${unitId}`,
              action.input,
            )
          : await org.request<Unit>('patch', `${base}/${unitId}/availability`, {
              availabilityStatus: action.status,
            })
      } finally {
        busy.current = false
      }
    },
    onSuccess: async (result) => {
      if (active.current) {
        setOpen(false)
        setFeedback('Unit saved successfully.')
      }
      // Invalidate captured scope even after navigation; never write old response data.
      await Promise.all([
        client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) }),
        client.invalidateQueries({ queryKey: unitsKey }),
        client.invalidateQueries({ queryKey: org.queryKey(['unit', propertyId]) }),
        client.invalidateQueries({ queryKey: propertyKey }),
      ])
      if (active.current && (mode === 'create' || mode === 'edit'))
        navigate(`${route}/${result.id}`, { state: { saved: true } })
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: org.queryKey(['dashboard']) })
      if (active.current) {
        setOpen(false)
        void client.invalidateQueries({ queryKey: propertyKey })
        void client.invalidateQueries({ queryKey: detailKey })
        void client.invalidateQueries({ queryKey: unitsKey })
      }
    },
  })
  const refresh = () => {
    void property.refetch()
    if (mode === 'list') void list.refetch()
    if (unitId) void detail.refetch()
  }
  const target = detail.data && manualTarget(detail.data.availabilityStatus)
  const error = property.error || (mode === 'list' ? list.error : detail.error)
  return (
    <div className="space-y-5">
      <Link className="underline" to={`/properties/${propertyId}`}>
        Back to property
      </Link>
      {mode !== 'list' && (
        <Link className="ml-4 underline" to={route}>
          Back to units
        </Link>
      )}
      <h2 className="text-2xl font-bold">
        {mode === 'create'
          ? 'Create unit'
          : mode === 'edit'
            ? 'Edit unit'
            : mode === 'details'
              ? 'Unit details'
              : 'Units'}
      </h2>
      <Button
        variant="outline"
        disabled={property.isFetching || list.isFetching || detail.isFetching || mutation.isPending}
        onClick={refresh}
      >
        Refresh
      </Button>
      {(feedback || (location.state as { saved?: boolean } | null)?.saved) && (
        <p role="status">{feedback || 'Unit saved successfully.'}</p>
      )}
      {property.isPending && <p role="status">Loading property…</p>}
      {error && <p role="alert">{unitError(error)}</p>}
      {property.data && !property.isError && (
        <>
          <p>
            Property:{' '}
            <Link className="underline" to={`/properties/${propertyId}`}>
              {property.data.name}
            </Link>{' '}
            · {property.data.status}
          </p>
          {property.data.status === 'ARCHIVED' && (
            <p role="status">
              This property is archived. Units remain readable; creation, editing and availability
              changes are unavailable.
            </p>
          )}
          {!org.can('PROPERTY_MANAGE') && (
            <p>Read-only access. Managing units requires property management permission.</p>
          )}
          {mode === 'list' && (
            <>
              {writable && (
                <Link className="underline" to={`${route}/new`}>
                  Create unit
                </Link>
              )}
              <label className="block">
                Page size{' '}
                <select
                  value={size}
                  onChange={(e) => {
                    setPage(0)
                    setSize(Number(e.target.value))
                  }}
                  className="rounded border bg-background p-2"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              {list.isPending && <p role="status">Loading units…</p>}
              {list.data && !list.isError && (
                <>
                  {list.data.content.length ? (
                    <ul className="space-y-3">
                      {list.data.content.map((unit) => (
                        <li key={unit.id} className="space-y-2 rounded border p-4">
                          <Link className="font-semibold underline" to={`${route}/${unit.id}`}>
                            {unit.unitNumber}
                          </Link>
                          <p>
                            {unit.unitType} · Floor: {unit.floorNumber ?? 'Not specified'} · Area:{' '}
                            {unit.areaSqm == null ? 'Not specified' : `${unit.areaSqm} m²`}
                          </p>
                          <UnitStatus status={unit.availabilityStatus} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No units found for this property.</p>
                  )}
                  <p>
                    Page {list.data.page + 1} of {Math.max(1, list.data.totalPages)} ·{' '}
                    {list.data.totalElements} units
                  </p>
                  <Pagination
                    page={page + 1}
                    totalPages={list.data.totalPages}
                    onPageChange={(n) => setPage(n - 1)}
                  />
                </>
              )}
            </>
          )}
          {(mode === 'details' || mode === 'edit') && detail.isPending && (
            <p role="status">Loading unit…</p>
          )}
          {mode === 'details' && detail.data && !detail.isError && (
            <section className="space-y-3 rounded border p-5">
              <h3 className="text-xl font-semibold">{detail.data.unitNumber}</h3>
              <p>Unit ID: {detail.data.id}</p>
              <p>Type: {detail.data.unitType}</p>
              <p>Floor: {detail.data.floorNumber ?? 'Not specified'}</p>
              <p>
                Area: {detail.data.areaSqm == null ? 'Not specified' : `${detail.data.areaSqm} m²`}
              </p>
              <UnitStatus status={detail.data.availabilityStatus} />
              <p>Created: {detail.data.createdAt}</p>
              <p>Updated: {detail.data.updatedAt}</p>
              <p>
                Occupancy is controlled through lease management. Manual changes to or from OCCUPIED
                are unavailable.
              </p>
              {writable && (
                <div className="flex gap-4">
                  <Link className="underline" to={`${route}/${unitId}/edit`}>
                    Edit unit
                  </Link>
                  {target && (
                    <ConfirmationDialog
                      trigger={<Button disabled={mutation.isPending}>Mark {target}</Button>}
                      open={open}
                      onOpenChange={setOpen}
                      title={`Mark unit ${target}?`}
                      description="This changes whether the unit is available. The server will verify the current state."
                      confirmLabel="Change availability"
                      loading={mutation.isPending}
                      onConfirm={() => {
                        if (!mutation.isPending) mutation.mutate({ status: target })
                      }}
                    />
                  )}
                </div>
              )}
            </section>
          )}
          {(mode === 'create' || mode === 'edit') &&
            writable &&
            (mode === 'create' || (detail.data && !detail.isError)) && (
              <UnitForm
                initial={mode === 'create' ? emptyUnit : detail.data!}
                saving={mutation.isPending}
                error={mutation.isError ? unitError(mutation.error) : undefined}
                onSave={(input) => mutation.mutateAsync({ input }).catch(() => undefined)}
              />
            )}
          {mutation.isError && (mode === 'details' || !writable) && (
            <p role="alert">{unitError(mutation.error)}</p>
          )}
        </>
      )}
    </div>
  )
}
