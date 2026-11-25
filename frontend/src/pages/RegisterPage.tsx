import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Building2 } from 'lucide-react'
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
  const [fieldError, setFieldError] = useState<{ key: keyof RegistrationRequest; message: string }>()
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setError('')
    setFieldError(undefined)
    const emptyField = fields.find(field => !values[field.key].trim())
    const invalidPassword = values.password.length < 12 || new TextEncoder().encode(values.password).length > 72
    const invalidSlug = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.organizationSlug)
    if (emptyField) {
      setFieldError({ key: emptyField.key, message: `Enter your ${emptyField.label.toLowerCase()}.` })
      return
    }
    if (invalidPassword) {
      setFieldError({ key: 'password', message: 'Use at least 12 characters and no more than 72 UTF-8 bytes.' })
      return
    }
    if (invalidSlug) {
      setFieldError({ key: 'organizationSlug', message: 'Use lowercase letters, numbers and single hyphens.' })
      return
    }
    setPending(true)
    try {
      await register({ ...values, email: values.email.trim(), firstName: values.firstName.trim(), lastName: values.lastName.trim(), organizationName: values.organizationName.trim() })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409 ? 'An account with this email or an organization with this slug already exists.' : failure instanceof ApiError && failure.status === 400 ? 'Please check your details and try again.' : failure instanceof ApiError && (failure.isNetworkError || failure.isTimeoutError) ? 'Unable to reach the server. Check that the backend is running and your connection is available.' : 'Registration could not be completed. Please try again.')
    } finally { setPending(false) }
  }
  function renderField(field: typeof fields[number]) {
    const message = fieldError?.key === field.key ? fieldError.message : undefined
    const hint = field.key === 'password'
      ? 'Use at least 12 characters.'
      : field.key === 'organizationSlug' ? 'Use lowercase letters, numbers and hyphens, e.g. cedar-court.' : undefined
    const describedBy = [hint && `${field.key}-hint`, message && `${field.key}-error`].filter(Boolean).join(' ')
    const props = {
      id: field.key,
      autoComplete: field.autoComplete,
      maxLength: field.max,
      required: true,
      value: values[field.key],
      'aria-invalid': !!message,
      'aria-describedby': describedBy || undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setValues({ ...values, [field.key]: event.target.value })
        if (message) setFieldError(undefined)
      },
    }
    return (
      <div className="space-y-2" key={field.key}>
        <Label htmlFor={field.key}>{field.label}</Label>
        {field.key === 'password' ? <PasswordInput {...props} className="h-10" /> : <Input {...props} type={'type' in field ? field.type : 'text'} className="h-10" />}
        {hint && <p id={`${field.key}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
        {message && <p id={`${field.key}-error`} role="alert" className="text-sm text-destructive">{message}</p>}
      </div>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8 sm:px-6">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        <Link to="/" className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" /> Home
        </Link>
        <div className="space-y-3">
          <Building2 aria-hidden="true" className="size-11 rounded-xl bg-primary p-2.5 text-primary-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Create your organization</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">The platform team reviews new organizations before opening workspace access. You can sign in and message support while you wait.</p>
        </div>
        <form onSubmit={submit} className="space-y-6">
          <fieldset className="space-y-4" disabled={pending}>
            <legend className="mb-3 font-semibold">Your account</legend>
            <div className="grid gap-4 sm:grid-cols-2">{fields.slice(0, 2).map(renderField)}</div>
            {fields.slice(2, 4).map(renderField)}
          </fieldset>
          <fieldset className="space-y-4" disabled={pending}>
            <legend className="mb-3 font-semibold">Organization details</legend>
            {fields.slice(4).map(renderField)}
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm">Already have an account? <Link className="font-medium underline underline-offset-4" to="/login">Sign in</Link></p>
      </div>
    </main>
  )
}
