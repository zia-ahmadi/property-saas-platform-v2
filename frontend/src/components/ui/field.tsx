import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from 'cn'
import { Label } from './label'

interface FieldControlProps {
  id: string
  required: boolean
  disabled: boolean
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

interface FieldProps extends Omit<ComponentProps<'div'>, 'children'> {
  label: ReactNode
  description?: string
  error?: string
  required?: boolean
  disabled?: boolean
  children: (controlProps: FieldControlProps) => ReactNode
}

export function Field({
  id,
  label,
  description,
  error,
  required = false,
  disabled = false,
  className,
  children,
  ...props
}: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const descriptionId = `${controlId}-description`
  const errorId = `${controlId}-error`
  const describedBy =
    [description && descriptionId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div data-slot="field" className={cn('min-w-0 space-y-2', className)} {...props}>
      <Label htmlFor={controlId}>
        {label}
        {required ? ' (required)' : null}
      </Label>
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children({
        id: controlId,
        required,
        disabled,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
