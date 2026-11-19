import { ChevronRight } from 'lucide-react'
import { Link, type To } from 'react-router'

interface BreadcrumbsProps {
  ancestors: readonly { label: string; to: To }[]
  current: string
}

export function Breadcrumbs({ ancestors, current }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        {ancestors.map(({ label, to }, index) => (
          <li key={index} className="min-w-0 wrap-anywhere">
            <Link to={to} className="text-muted-foreground underline-offset-4 hover:underline">
              {label}
            </Link>
            <ChevronRight aria-hidden="true" className="ms-2 inline size-4 align-text-bottom" />
          </li>
        ))}
        <li aria-current="page" className="min-w-0 font-medium wrap-anywhere">
          {current}
        </li>
      </ol>
    </nav>
  )
}
