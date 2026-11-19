import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" data-slot="skeleton" className={cn('rounded-md bg-muted', className)} />
  )
}
