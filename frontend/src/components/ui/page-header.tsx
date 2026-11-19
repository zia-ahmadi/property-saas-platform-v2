import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode
  headingLevel?: 1 | 2
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  headingLevel = 1,
}: PageHeaderProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  return (
    <div className="min-w-0 space-y-3">
      {breadcrumbs}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 wrap-anywhere">
          <Heading className="text-2xl font-bold tracking-tight">{title}</Heading>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
