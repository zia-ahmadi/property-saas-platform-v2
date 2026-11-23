import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { useOrganization } from '@/features/organization/context'
import { renterError, type Renter, type RenterInput } from '@/features/renters/api'
import { OrganizationImage } from '@/components/OrganizationImage'

type Mode = 'details' | 'create' | 'edit'

export function RenterProfilePage({ mode = 'details' }: { mode?: Mode }) {
  const org = useOrganization()
  const { renterId = '' } = useParams()
  return (
    <RenterProfile
      key={`${org.current?.organizationId}:${mode}:${renterId}`}
      mode={mode}
      renterId={renterId}
    />
  )
}

function RenterProfile({ mode, renterId }: { mode: Mode; renterId: string }) {
  const org = useOrganization()
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const path = `renters/${renterId}`
  const detailsKey = org.queryKey(['renter', renterId])
  const listKey = org.queryKey(['renters'])
  const profile = useQuery({
    queryKey: detailsKey,
    queryFn: ({ signal }) => org.request<Renter>('get', path, undefined, { signal }),
    enabled: mode !== 'create',
    retry: false,
  })
  const save = useMutation({
    mutationFn: (input: RenterInput) =>
      mode === 'create'
        ? org.request<Renter>('post', 'renters', input)
        : org.request<Renter>('patch', path, input),
    onSuccess: (renter) => {
      client.setQueryData(org.queryKey(['renter', renter.id]), renter)
      void client.invalidateQueries({ queryKey: listKey })
      navigate(`/renters/${renter.id}`, {
        state: { saved: mode === 'create' ? 'created' : 'updated' },
      })
    },
  })
  const archive = useMutation({
    mutationFn: () => org.request<Renter>('patch', `${path}/archive`),
    onSuccess: (renter) => {
      setConfirmOpen(false)
      client.setQueryData(detailsKey, renter)
      void client.invalidateQueries({ queryKey: listKey })
    },
    onError: () => setConfirmOpen(false),
  })
  const renter = profile.data
  const saved = (location.state as { saved?: string } | null)?.saved
  const title =
    mode === 'create' ? 'Add renter' : mode === 'edit' ? 'Edit renter' : 'Renter details'

  return (
    <div className="space-y-5">
      <Link className="underline" to="/renters">
        Back to renters
      </Link>
      <PageHeader title={title} headingLevel={2} />
      {mode !== 'create' && profile.isPending && <p role="status">Loading renter…</p>}
      {profile.isError && <p role="alert">{renterError(profile.error)}</p>}
      {mode === 'edit' && renter?.archivedAt && <p role="alert">This renter has been archived.</p>}
      {(mode === 'create' || (mode === 'edit' && renter && !renter.archivedAt)) && (
        <RenterForm
          renter={renter}
          saving={save.isPending}
          onSave={(input) => save.mutate(input)}
          error={save.isError ? renterError(save.error) : undefined}
          cancelTo={mode === 'edit' ? `/renters/${renterId}` : '/renters'}
        />
      )}
      {mode === 'details' && renter && (
        <section className="space-y-4 rounded-xl border bg-card p-6 break-words">
          <OrganizationImage
            resourceType="renter"
            resourceId={renter.id}
            alt={`${renter.firstName} ${renter.lastName}`}
            canManage={org.can('PROPERTY_MANAGE')}
            editable={!renter.archivedAt}
            className="max-w-md"
          />
          <h3 className="text-xl font-semibold">
            {renter.firstName} {renter.lastName}
          </h3>
          {renter.archivedAt ? (
            <p role="status">Renter archived.</p>
          ) : (
            (saved === 'created' || saved === 'updated') && <p role="status">Renter {saved}.</p>
          )}
          <dl className="space-y-2">
            <div>
              <dt className="font-medium">Email</dt>
              <dd>{renter.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium">Phone</dt>
              <dd>{renter.phone ?? '—'}</dd>
            </div>
          </dl>
          {!renter.archivedAt && org.can('PROPERTY_MANAGE') && (
            <div className="flex flex-wrap gap-3">
              <Link
                className={buttonVariants({ variant: 'outline' })}
                to={`/renters/${renterId}/edit`}
              >
                Edit renter
              </Link>
              <ConfirmationDialog
                trigger={<Button variant="destructive">Archive renter</Button>}
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Archive renter?"
                description="The renter will be removed from the active directory."
                confirmLabel="Archive"
                destructive
                loading={archive.isPending}
                onConfirm={() => archive.mutate()}
              />
            </div>
          )}
          {archive.isError && <p role="alert">{renterError(archive.error)}</p>}
        </section>
      )}
    </div>
  )
}

interface FormProps {
  renter?: Renter
  saving: boolean
  error?: string
  cancelTo: string
  onSave: (input: RenterInput) => void
}

function RenterForm({ renter, saving, error, cancelTo, onSave }: FormProps) {
  const [validationError, setValidationError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const firstName = String(data.get('firstName') ?? '').trim()
    const lastName = String(data.get('lastName') ?? '').trim()
    if (!firstName || !lastName) {
      setValidationError('Enter a first name and a last name.')
      return
    }
    setValidationError('')
    onSave({
      firstName,
      lastName,
      email: String(data.get('email') ?? '').trim() || null,
      phone: String(data.get('phone') ?? '').trim() || null,
    })
  }

  return (
    <form className="max-w-xl space-y-4 rounded-xl border bg-card p-6" onSubmit={submit}>
      <fieldset className="grid gap-4" disabled={saving}>
        <label>
          First name
          <Input
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={100}
            defaultValue={renter?.firstName}
          />
        </label>
        <label>
          Last name
          <Input
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={100}
            defaultValue={renter?.lastName}
          />
        </label>
        <label>
          Email (optional)
          <Input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            defaultValue={renter?.email ?? ''}
          />
        </label>
        <label>
          Phone (optional)
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={50}
            defaultValue={renter?.phone ?? ''}
          />
        </label>
      </fieldset>
      {(validationError || error) && <p role="alert">{validationError || error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save renter'}
        </Button>
        <Link className={buttonVariants({ variant: 'outline' })} to={cancelTo}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
