import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  label?: string
  showLabel?: boolean
  className?: string
}

export function Spinner({ label = 'Loading…', showLabel = false, className }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-foreground', className)}>
      <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
      <span className={showLabel ? undefined : 'sr-only'}>{label}</span>
    </span>
  )
}
