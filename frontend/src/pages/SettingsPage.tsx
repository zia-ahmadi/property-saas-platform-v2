import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, Building2, Monitor, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { OrganizationImage } from '@/components/OrganizationImage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { useOptionalAuth } from '@/features/auth/context'
import type { AuthLifecycleService } from '@/features/auth/lifecycle'
import type { SessionOrganization, SessionUser } from '@/features/auth/api'
import { useOptionalOrganization } from '@/features/organization/context'
import { updateDevicePreferences, useDevicePreferences, type Theme } from '@/features/settings/devicePreferences'
import { ApiError } from '@/lib/api/errors'

type WorkspaceResponse = { id: string; name: string; slug: string; status: string }

export function SettingsPage() {
  const auth = useOptionalAuth()
  const org = useOptionalOrganization()
  const user = auth?.state.status === 'authenticated' ? auth.state.session.user : undefined
  const workspace = org?.forbidden ? undefined : org?.current

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader headingLevel={2} title="Settings" description="Manage your account, workspace, and preferences for this device." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          {auth && user && <AccountSettings key={user.id} user={user} service={auth.service} />}
          <DeviceSettings />
        </div>
        <WorkspaceSettings key={workspace?.organizationId} workspace={workspace} />
      </div>
    </div>
  )
}

function Section({ Icon, title, description, children }: {
  Icon: typeof Building2; title: string; description: string; children: ReactNode
}) {
  return (
    <Card className="gap-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="size-10 shrink-0 rounded-xl bg-accent p-2.5 text-accent-foreground" />
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

function AccountSettings({ user, service }: { user: Readonly<SessionUser>; service: AuthLifecycleService }) {
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const save = useMutation({
    mutationFn: () => service.request<SessionUser>('put', 'api/v1/me/profile', {
      firstName: firstName.trim(), lastName: lastName.trim(),
    }),
    onSuccess: saved => {
      service.updateProfile(saved)
      setFirstName(saved.firstName)
      setLastName(saved.lastName)
    },
  })
  const dirty = firstName.trim() !== user.firstName || lastName.trim() !== user.lastName
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (dirty && firstName.trim() && lastName.trim() && !save.isPending) save.mutate()
  }

  return (
    <Section Icon={UserRound} title="Account profile" description="Update how your name appears in the platform.">
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="sr-only">Profile name</legend>
          <div className="space-y-2">
            <Label htmlFor="account-first-name">First name</Label>
            <Input id="account-first-name" autoComplete="given-name" required maxLength={100} className="h-10"
              value={firstName} onChange={event => { save.reset(); setFirstName(event.target.value) }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-last-name">Last name</Label>
            <Input id="account-last-name" autoComplete="family-name" required maxLength={100} className="h-10"
              value={lastName} onChange={event => { save.reset(); setLastName(event.target.value) }} />
          </div>
        </fieldset>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Sign-in email</p>
          <p className="mt-1 wrap-anywhere text-muted-foreground">{user.email}</p>
        </div>
        {save.isError && <p role="alert" className="text-sm text-destructive">Couldn’t save your profile. Please try again.</p>}
        {save.isSuccess && <p role="status" className="text-sm text-muted-foreground">Profile saved.</p>}
        <Button type="submit" className="h-10" disabled={!dirty || !firstName.trim() || !lastName.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </Section>
  )
}

function WorkspaceSettings({ workspace }: { workspace?: Readonly<SessionOrganization> }) {
  const org = useOptionalOrganization()
  const auth = useOptionalAuth()
  const [name, setName] = useState(workspace?.organizationName ?? '')
  const [baseline, setBaseline] = useState(workspace?.organizationName ?? '')
  const canManage = !!workspace && !!auth && !!org?.can('ORGANIZATION_MANAGE')
  const update = (saved: WorkspaceResponse) => {
    setBaseline(saved.name)
    setName(saved.name)
    auth?.service.updateOrganizationName(saved.id, saved.name)
  }
  const save = useMutation({
    mutationFn: () => org!.request<WorkspaceResponse>('patch', '', { name: name.trim(), expectedName: baseline }),
    onSuccess: update,
  })
  const reload = useMutation({
    mutationFn: () => org!.request<WorkspaceResponse>('get', ''),
    onSuccess: saved => { update(saved); save.reset() },
  })
  const conflict = save.error instanceof ApiError && save.error.status === 409
  const dirty = name.trim() !== baseline

  return (
    <Section Icon={Building2} title="Organization workspace" description="View workspace details and manage its identity.">
      {workspace ? <>
        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          {!canManage && <div className="col-span-2 min-w-0"><dt className="font-medium">Workspace name</dt><dd className="wrap-anywhere text-muted-foreground">{workspace.organizationName}</dd></div>}
          <div className="min-w-0"><dt className="font-medium">Workspace slug</dt><dd className="wrap-anywhere text-muted-foreground">{workspace.organizationSlug}</dd></div>
          <div><dt className="font-medium">Your role</dt><dd className="capitalize text-muted-foreground">{workspace.role.toLowerCase()}</dd></div>
        </dl>
        {canManage && <>
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault()
            if (dirty && name.trim() && !save.isPending && !reload.isPending && !conflict) save.mutate()
          }}>
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input id="workspace-name" autoComplete="organization" className="h-10" required maxLength={150}
                value={name} disabled={save.isPending || reload.isPending}
                onChange={event => { if (!conflict) save.reset(); setName(event.target.value) }} />
            </div>
            {save.isError && <p role="alert" className="text-sm text-destructive">
              {conflict ? 'The workspace name changed. Reload the current name before saving.' : 'Couldn’t save the workspace name. Please try again.'}
            </p>}
            {reload.isError && <p role="alert" className="text-sm text-destructive">Couldn’t reload the workspace name.</p>}
            {save.isSuccess && <p role="status" className="text-sm text-muted-foreground">Workspace name saved.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" className="h-10" disabled={!dirty || !name.trim() || save.isPending || reload.isPending || conflict}>{save.isPending ? 'Saving…' : 'Save workspace name'}</Button>
              {conflict && <Button type="button" variant="outline" className="h-10" disabled={reload.isPending} onClick={() => reload.mutate()}>Reload workspace name</Button>}
            </div>
          </form>
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium">Workspace logo</h4>
            <p className="text-sm text-muted-foreground">JPEG or PNG, up to 5 MB. Shown in the workspace sidebar.</p>
            <OrganizationImage resourceType="organization" resourceId={workspace.organizationId} alt="Workspace logo" className="max-w-72" canManage />
          </div>
        </>}
      </> : <p className="text-sm text-muted-foreground">Organization settings are available when you have access to an active workspace.</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm font-medium">
        <Link to="/access" className="text-primary underline underline-offset-4">Organization access and support</Link>
        {workspace && org?.can('MEMBERSHIP_MANAGE') && <Link to="/team" className="text-primary underline underline-offset-4">Manage team</Link>}
      </div>
    </Section>
  )
}

function DeviceSettings() {
  const { theme, showUnreadCount } = useDevicePreferences()
  return (
    <Section Icon={Monitor} title="Device preferences" description="These choices apply to this browser.">
      <Select label="Appearance" value={theme}
        onChange={event => updateDevicePreferences({ theme: event.target.value as Theme })}>
        <option value="system">Use device appearance</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>
      <label className="flex items-start gap-3 rounded-lg border p-3">
        <Bell aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">Show unread count on notification bell</span>
          <span className="mt-1 block text-muted-foreground">Turn this off to use a dot for unread notifications.</span>
        </span>
        <input type="checkbox" checked={showUnreadCount}
          onChange={event => updateDevicePreferences({ showUnreadCount: event.target.checked })}
          className="mt-1 size-4 shrink-0 accent-primary" />
      </label>
    </Section>
  )
}
