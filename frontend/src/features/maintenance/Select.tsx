import { useId, type ComponentProps } from 'react'

export function Select({ id, label, children, ...props }: ComponentProps<'select'> & { label: string }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <div className="space-y-1 text-sm font-medium">
      <label htmlFor={fieldId} className="block">{label}</label>
      <select id={fieldId} className="min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" {...props}>
        {children}
      </select>
    </div>
  )
}
