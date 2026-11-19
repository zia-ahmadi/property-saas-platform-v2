import type { ReactNode } from 'react'
import { Skeleton } from './skeleton'
import { Spinner } from './spinner'

interface LoadingStateProps {
  label?: string
  placeholder?: ReactNode
}

export function LoadingState({
  label,
  placeholder = <Skeleton className="h-16 w-full" />,
}: LoadingStateProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-6">
      <Spinner label={label} showLabel />
      <div aria-busy="true">{placeholder}</div>
    </div>
  )
}
