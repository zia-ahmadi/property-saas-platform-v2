import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { register, type RegistrationRequest } from '@/features/auth/registration'
import { ApiError } from '@/lib/api/errors'

const empty: RegistrationRequest = { firstName: '', lastName: '', email: '', password: '', organizationName: '', organizationSlug: '' }
const fields = [
  { key: 'firstName', label: 'First name', max: 100, autoComplete: 'given-name' },
  { key: 'lastName', label: 'Last name', max: 100, autoComplete: 'family-name' },
  { key: 'email', label: 'Email address', max: 320, autoComplete: 'email', type: 'email' },
  { key: 'password', label: 'Password', max: 72, autoComplete: 'new-password', type: 'password' },
  { key: 'organizationName', label: 'Organization name', max: 150, autoComplete: 'organization' },
  { key: 'organizationSlug', label: 'Organization slug', max: 100, autoComplete: 'off' },
] as const

export function RegisterPage() {
  const [values, setValues] = useState(empty)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (Object.values(values).some(value => !value.trim())) { setError('Complete all fields.'); return }
    if (values.password.length < 12 || values.password.length > 72 || new TextEncoder().encode(values.password).length > 72) { setError('Password must be at least 12 characters and no more than 72 UTF-8 bytes.'); return }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.organizationSlug)) { setError('Use lowercase letters, numbers and single hyphens for the organization slug.'); return }
    setError(''); setPending(true)
    try {
      await register({ ...values, email: values.email.trim(), firstName: values.firstName.trim(), lastName: values.lastName.trim(), organizationName: values.organizationName.trim() })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409 ? 'An account with this email or an organization with this slug already exists.' : failure instanceof ApiError && failure.status === 400 ? 'Please check your details and try again.' : failure instanceof ApiError && (failure.isNetworkError || failure.isTimeoutError) ? 'Unable to reach the server. Check that the backend is running and your connection is available.' : 'Registration could not be completed. Please try again.')
    } finally { setPending(false) }
  }
  return <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6"><div className="w-full max-w-lg space-y-6 rounded-2xl border bg-card p-8 shadow-lg"><div className="flex flex-col items-center space-y-2 text-center"><Building2 aria-hidden="true" className="size-8" /><h1 className="text-2xl font-bold">Create your organization</h1><p className="text-sm text-muted-foreground">Create an account and your first organization.</p></div><form onSubmit={submit} className="space-y-4">{fields.map(field => <div className="space-y-2" key={field.key}><Label htmlFor={field.key}>{field.label}</Label>{field.key === 'password' ? <PasswordInput id={field.key} autoComplete={field.autoComplete} maxLength={field.max} required value={values[field.key]} onChange={event => setValues({ ...values, [field.key]: event.target.value })} /> : <Input id={field.key} type={'type' in field ? field.type : 'text'} autoComplete={field.autoComplete} maxLength={field.max} required value={values[field.key]} onChange={event => setValues({ ...values, [field.key]: event.target.value })} />}</div>)}<p className="text-sm text-muted-foreground">Password: at least 12 characters. Slug: lowercase letters, numbers and hyphens.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={pending} className="w-full">{pending ? 'Creating account…' : 'Create account'}</Button></form><p className="text-center text-sm">Already have an account? <Link className="underline" to="/login">Sign in</Link></p></div></main>
}
