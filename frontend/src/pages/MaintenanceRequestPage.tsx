import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Wrench } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { useNotification } from '@/components/ui/use-notification'
import { useOrganization } from '@/features/organization/context'
import { ApiError } from '@/lib/api/errors'
import type { Property } from '@/features/properties/api'
import { PropertyPicker, UnitPicker, type LocationOption } from '@/features/maintenance/LocationPicker'
import { Select } from '@/components/ui/select'
import { categories, formatDate, maintenancePropertyId, priorities, statuses } from '@/features/maintenance/api'
import type { MaintenanceInput, MaintenanceRequest } from '@/features/maintenance/api'

export function MaintenanceRequestPage() {
  const org = useOrganization()
  const { requestId } = useParams()
  return <RequestScreen key={`${org.current?.organizationId}/${requestId ?? 'new'}`} requestId={requestId} />
}

function RequestScreen({ requestId }: { requestId?: string }) {
  const org = useOrganization()
  const { search } = useLocation()
  const propertyId = maintenancePropertyId(new URLSearchParams(search))
  const request = useQuery({
    queryKey: org.queryKey(['maintenance', 'request', requestId]),
    queryFn: ({ signal }) => org.request<MaintenanceRequest>('get', `maintenance/${encodeURIComponent(requestId ?? '')}`, undefined, { signal }),
    enabled: !!requestId,
    retry: false,
  })
  const property = useQuery({
    queryKey: org.queryKey(['maintenance', 'property', propertyId]),
    queryFn: ({ signal }) => org.request<Property>('get', `properties/${propertyId}`, undefined, { signal }),
    enabled: !requestId && !!propertyId,
    retry: false,
  })
  const queueLink = `/maintenance${search}`
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link to={queueLink} className={buttonVariants({ variant: 'ghost' })}>
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to maintenance
      </Link>
      {requestId && request.isPending ? <LoadingState label="Loading request…" /> :
        requestId && !request.data && request.isError ? <ErrorState title={request.error instanceof ApiError && request.error.status === 404 ? 'Request not found' : 'Couldn’t load request'} onRetry={() => void request.refetch()} retrying={request.isFetching} /> :
        !requestId && propertyId && property.isPending ? <LoadingState label="Loading property…" /> :
        <RequestForm request={request.data} initialProperty={property.data?.status === 'ACTIVE' ? property.data : undefined}
          queueLink={queueLink} reload={async () => {
            const result = await request.refetch()
            return result.isSuccess ? result.data : undefined
          }} />}
    </div>
  )
}

interface RequestFormProps {
  request?: MaintenanceRequest
  initialProperty?: Property
  queueLink: string
  reload: () => Promise<MaintenanceRequest | undefined>
}

function RequestForm({ request, initialProperty, queueLink, reload }: RequestFormProps) {
  const org = useOrganization()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { notify } = useNotification()
  const [baseline, setBaseline] = useState(request)
  const [property, setProperty] = useState<LocationOption | undefined>(
    request ? { id: request.propertyId, label: request.propertyName }
      : initialProperty && { id: initialProperty.id, label: initialProperty.name },
  )
  const [unit, setUnit] = useState<LocationOption | undefined>(
    request?.unitId ? { id: request.unitId, label: `Unit ${request.unitNumber}` } : undefined,
  )
  const [reloading, setReloading] = useState(false)
  const [reloadFailed, setReloadFailed] = useState(false)
  const mutation = useMutation({
    mutationFn: ({ input, status, notes }: { input: MaintenanceInput; status: MaintenanceRequest['status']; notes: string }) =>
      baseline
        ? org.request<MaintenanceRequest>('put', `maintenance/${baseline.id}`, { request: input, status, resolutionNotes: notes || null, version: baseline.version })
        : org.request<MaintenanceRequest>('post', 'maintenance', input),
    onSuccess: (saved) => {
      client.setQueryData(org.queryKey(['maintenance', 'request', saved.id]), saved)
      void client.invalidateQueries({ queryKey: org.queryKey(['maintenance']) })
      notify({ variant: 'success', title: baseline ? 'Maintenance request updated' : 'Maintenance request created' })
      if (baseline) setBaseline(saved)
      else void navigate(`/maintenance/${saved.id}${queueLink.slice('/maintenance'.length)}`, { replace: true })
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!property || mutation.isPending || reloading) return
    const form = new FormData(event.currentTarget)
    const value = (key: string) => String(form.get(key) ?? '').trim()
    mutation.mutate({
      input: {
        propertyId: property.id,
        unitId: unit?.id ?? null,
        title: value('title'),
        description: value('description'),
        category: value('category') as MaintenanceInput['category'],
        priority: value('priority') as MaintenanceInput['priority'],
        assignedTo: value('assignedTo') || null,
        dueDate: value('dueDate') || null,
      },
      status: (value('status') || 'OPEN') as MaintenanceRequest['status'],
      notes: value('resolutionNotes'),
    })
  }

  const conflict = mutation.error instanceof ApiError && mutation.error.status === 409
  const reloadRequest = async () => {
    setReloading(true)
    setReloadFailed(false)
    const latest = await reload()
    if (latest) {
      setBaseline(latest)
      setProperty({ id: latest.propertyId, label: latest.propertyName })
      setUnit(latest.unitId ? { id: latest.unitId, label: `Unit ${latest.unitNumber}` } : undefined)
      mutation.reset()
    } else setReloadFailed(true)
    setReloading(false)
  }

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-start gap-4 border-b bg-linear-to-br from-teal-500/10 to-transparent p-5 sm:p-7">
        <Wrench aria-hidden="true" className="size-11 shrink-0 rounded-xl bg-teal-500/15 p-2.5 text-teal-800 dark:text-teal-200" />
        <div className="min-w-0 space-y-1">
          <h2 className="wrap-anywhere text-2xl font-semibold tracking-tight">{baseline?.title ?? 'New maintenance request'}</h2>
          <p className="text-sm text-muted-foreground">
            {baseline ? `Reported ${formatDate(baseline.createdAt)} · Updated ${formatDate(baseline.updatedAt)}` : 'Record the issue, location, and urgency.'}
          </p>
          {baseline?.resolvedAt && <p className="text-sm text-muted-foreground">Resolved {formatDate(baseline.resolvedAt)}</p>}
        </div>
      </header>
      <form key={baseline?.version ?? 'new'} onSubmit={submit} className="p-5 sm:p-7">
        <fieldset disabled={mutation.isPending || reloading} className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <PropertyPicker selected={property} onChange={next => {
              if (next?.id !== property?.id) setUnit(undefined)
              setProperty(next)
            }} />
            {property && <UnitPicker key={property.id} propertyId={property.id} selected={unit} onChange={setUnit} />}
            {baseline && <Link to={`/properties/${baseline.propertyId}${baseline.unitId ? `/units/${baseline.unitId}` : ''}`}
              className="flex w-fit items-center gap-1 text-sm font-medium underline underline-offset-4">
              View {baseline.unitId ? 'unit' : 'property'} <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>}
          </div>
          <div className="space-y-4 border-t pt-5">
            <label className="block space-y-1 text-sm font-medium">
              <span>Title</span>
              <Input name="title" maxLength={150} required defaultValue={baseline?.title} placeholder="Kitchen sink leaking" />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>Description</span>
              <Textarea name="description" maxLength={4000} required rows={4} defaultValue={baseline?.description} placeholder="Describe the issue and any access instructions." />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Category" name="category" defaultValue={baseline?.category ?? 'GENERAL'}>
                {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select label="Priority" name="priority" defaultValue={baseline?.priority ?? 'NORMAL'}>
                {Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <label className="block space-y-1 text-sm font-medium">
                <span>Assigned to <span className="font-normal text-muted-foreground">(optional)</span></span>
                <Input name="assignedTo" maxLength={150} defaultValue={baseline?.assignedTo ?? ''} placeholder="Team member or contractor" />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                <span>Due date <span className="font-normal text-muted-foreground">(optional)</span></span>
                <Input name="dueDate" type="date" max="9999-12-31" defaultValue={baseline?.dueDate ?? ''} />
              </label>
            </div>
          </div>
          {baseline && <div className="grid gap-4 border-t pt-5">
            <div className="sm:max-w-xs">
              <Select label="Status" name="status" defaultValue={baseline.status}>
                {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              <span>Resolution notes <span className="font-normal text-muted-foreground">(optional)</span></span>
              <Textarea name="resolutionNotes" maxLength={4000} rows={3} defaultValue={baseline.resolutionNotes ?? ''} placeholder="Record the work completed or why the request was cancelled." />
            </label>
          </div>}
          {mutation.isError && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p>{mutation.error instanceof ApiError && mutation.error.status < 500 ? mutation.error.message : 'Couldn’t save the maintenance request. Try again.'}</p>
            {conflict && <Button type="button" variant="outline" onClick={() => void reloadRequest()}>Discard edits and reload</Button>}
            {reloadFailed && <p>Couldn’t reload the request. Try again.</p>}
          </div>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
            <Link to={queueLink} className={buttonVariants({ variant: 'outline' })}>Back to queue</Link>
            <Button type="submit" disabled={!property || conflict}>
              {mutation.isPending ? 'Saving…' : baseline ? 'Save changes' : 'Create request'}
            </Button>
          </div>
        </fieldset>
      </form>
    </article>
  )
}
