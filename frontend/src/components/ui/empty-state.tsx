import { useId, type ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className="grid justify-items-center gap-3 rounded-xl border border-dashed border-border bg-card p-4 text-center text-card-foreground sm:p-8"
    >
      {icon && (
        <div aria-hidden="true" className="rounded-lg bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      )}
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {action}
    </section>
  )
}
