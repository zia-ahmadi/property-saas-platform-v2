import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowRight, DoorOpen, Plus, RefreshCw } from 'lucide-react'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { OrganizationImage } from '@/components/OrganizationImage'

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
  const isList = mode === 'list'
  const isForm = mode === 'create' || mode === 'edit'
  const units = list.data?.content ?? []
  const availableOnPage = units.filter((unit) => unit.availabilityStatus === 'AVAILABLE').length
  const occupiedOnPage = units.filter((unit) => unit.availabilityStatus === 'OCCUPIED').length
  const title =
    mode === 'create'
      ? 'Create unit'
      : mode === 'edit'
        ? 'Edit unit'
        : mode === 'details'
          ? 'Unit details'
          : 'Units'
  return (
    <div className="mx-auto w-full max-w-[1200px] min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ variant: 'outline' })} to={`/properties/${propertyId}`}>
            Back to property
          </Link>
          {!isList && (
            <Link className={buttonVariants({ variant: 'outline' })} to={route}>
              Back to units
            </Link>
          )}
        </div>
        <Button
          variant="outline"
          disabled={
            property.isFetching || list.isFetching || detail.isFetching || mutation.isPending
          }
          onClick={refresh}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          {property.isFetching || list.isFetching || detail.isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Portfolio / Property / Units
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            {property.data && (
              <p className="mt-1 text-sm text-muted-foreground">
                {property.data.name} · {property.data.status === 'ACTIVE' ? 'Active property' : 'Archived property'}
              </p>
            )}
          </div>
          {isList && writable && (
            <Link className={buttonVariants()} to={`${route}/new`}>
              <Plus aria-hidden="true" className="size-4" />
              Create unit
            </Link>
          )}
        </div>
      </div>

      {(feedback || (location.state as { saved?: boolean } | null)?.saved) && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          {feedback || 'Unit saved successfully.'}
        </p>
      )}
      {property.isPending && (
        <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
          Loading property…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          {unitError(error)}
        </p>
      )}
      {property.data && !property.isError && (
        <>
          {property.data.status === 'ARCHIVED' && (
            <p
              role="status"
              className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm"
            >
              This property is archived. Units remain readable; creation, editing and availability
              changes are unavailable.
            </p>
          )}
          {!org.can('PROPERTY_MANAGE') && (
            <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Read-only access. Managing units requires property management permission.
            </p>
          )}

          {isList && (
            <section aria-label="Property units" className="space-y-5">
              {list.data && (
                <dl className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Units in this property', list.data.totalElements],
                    ['Available on this page', availableOnPage],
                    ['Occupied on this page', occupiedOnPage],
                  ].map(([label, count]) => (
                    <Card key={label} className="gap-2 border-border/70 p-4 sm:p-5">
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="text-3xl font-semibold tracking-tight tabular-nums">
                        {count}
                      </dd>
                    </Card>
                  ))}
                </dl>
              )}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Unit directory</h3>
                  <p className="text-sm text-muted-foreground">
                    Availability counts reflect the units on the current page.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Page size
                  <select
                    aria-label="Page size"
                    value={size}
                    onChange={(event) => {
                      setPage(0)
                      setSize(Number(event.target.value))
                    }}
                    className="min-h-10 rounded-lg border bg-card px-3 text-foreground"
                  >
                    {[10, 25, 50, 100].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {list.isPending && (
                <div role="status" aria-label="Loading units" className="grid gap-3 sm:grid-cols-2">
                  <span className="sr-only">Loading units…</span>
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-36 rounded-2xl" />
                  ))}
                </div>
              )}
              {list.data && !list.isError && list.data.content.length === 0 && (
                <EmptyState
                  icon={<DoorOpen className="size-5" />}
                  title="No units yet"
                  description={
                    writable
                      ? 'Create the first unit for this property to start tracking its availability.'
                      : 'No units have been added to this property yet.'
                  }
                  action={
                    writable ? (
                      <Link className={buttonVariants()} to={`${route}/new`}>
                        <Plus aria-hidden="true" className="size-4" />
                        Create first unit
                      </Link>
                    ) : undefined
                  }
                />
              )}
              {list.data && list.data.content.length > 0 && (
                <>
                  <ul aria-label="Units" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {list.data.content.map((unit) => (
                      <li key={unit.id} className="min-w-0">
                        <Card className="h-full gap-4 rounded-2xl p-4 transition hover:border-primary/25 hover:shadow-sm motion-reduce:transition-none sm:p-5">
                          <OrganizationImage
                            resourceType="unit"
                            resourceId={unit.id}
                            alt={`Unit ${unit.unitNumber}`}
                          />
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
                              <DoorOpen aria-hidden="true" className="size-5" />
                            </span>
                            <UnitStatus status={unit.availabilityStatus} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="wrap-anywhere text-lg font-semibold">
                              <Link
                                className="rounded-sm outline-offset-4 hover:text-primary focus-visible:text-primary"
                                to={`${route}/${unit.id}`}
                              >
                                {unit.unitNumber}
                              </Link>
                            </h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {unit.unitType.replaceAll('_', ' ')}
                            </p>
                          </div>
                          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                            <span>Floor {unit.floorNumber ?? '—'}</span>
                            <span>{unit.areaSqm == null ? 'Area not specified' : `${unit.areaSqm} m²`}</span>
                          </div>
                          <Link
                            className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary"
                            to={`${route}/${unit.id}`}
                            aria-label={`View unit ${unit.unitNumber}`}
                          >
                            View details <ArrowRight aria-hidden="true" className="size-4" />
                          </Link>
                        </Card>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {list.data.page + 1} of {Math.max(1, list.data.totalPages)} ·{' '}
                      {list.data.totalElements}{' '}
                      {list.data.totalElements === 1 ? 'unit' : 'units'}
                    </p>
                    <Pagination
                      page={page + 1}
                      totalPages={list.data.totalPages}
                      onPageChange={(nextPage) => setPage(nextPage - 1)}
                    />
                  </div>
                </>
              )}
            </section>
          )}

          {(mode === 'details' || mode === 'edit') && detail.isPending && (
            <p role="status" className="rounded-xl border bg-card p-5 text-muted-foreground">
              Loading unit…
            </p>
          )}
          {mode === 'details' && detail.data && !detail.isError && (
            <section className="space-y-5">
              <OrganizationImage
                resourceType="unit"
                resourceId={detail.data.id}
                alt={`Unit ${detail.data.unitNumber}`}
                canManage={writable}
              />
              <Card className="gap-5 rounded-2xl p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                      <DoorOpen aria-hidden="true" className="size-6" />
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold">{detail.data.unitNumber}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {detail.data.unitType.replaceAll('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <UnitStatus status={detail.data.availabilityStatus} />
                </div>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Unit ID', detail.data.id],
                    ['Type', detail.data.unitType.replaceAll('_', ' ')],
                    ['Floor', detail.data.floorNumber ?? 'Not specified'],
                    ['Area', detail.data.areaSqm == null ? 'Not specified' : `${detail.data.areaSqm} m²`],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-1 wrap-anywhere font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                  Occupancy is controlled through lease management. Manual changes to or from
                  OCCUPIED are unavailable.
                </div>
                {writable && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className={buttonVariants({ variant: 'outline' })}
                      to={`${route}/${unitId}/edit`}
                    >
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
              </Card>
              {mutation.isError && (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  {unitError(mutation.error)}
                </p>
              )}
            </section>
          )}
          {isForm &&
            writable &&
            (mode === 'create' || (detail.data && !detail.isError)) && (
              <Card className="max-w-2xl rounded-2xl p-5 sm:p-7">
                <div className="mb-5">
                  <h3 className="text-lg font-semibold">
                    {mode === 'create' ? 'Unit information' : 'Update unit details'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Set the unit number, type, floor, and optional area.
                  </p>
                </div>
                <UnitForm
                  initial={mode === 'create' ? emptyUnit : detail.data!}
                  saving={mutation.isPending}
                  error={mutation.isError ? unitError(mutation.error) : undefined}
                  onSave={(input) => mutation.mutateAsync({ input }).catch(() => undefined)}
                />
              </Card>
            )}
        </>
      )}
    </div>
  )
}
