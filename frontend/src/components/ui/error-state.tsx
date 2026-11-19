import { useId } from 'react'
import { Button } from './button'

interface ErrorStateProps {
  title: string
  /** User-facing copy authored by the caller. Pass technical errors to your error reporting code. */
  description?: string
  onRetry?: () => void
  retrying?: boolean
  retryDisabled?: boolean
}

export function ErrorState({
  title,
  description = 'Something went wrong. Please try again later.',
  onRetry,
  retrying = false,
  retryDisabled = false,
}: ErrorStateProps) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className="grid justify-items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-6"
    >
      <div role="status" className="grid gap-1">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {onRetry && retrying && <span className="sr-only">Retrying…</span>}
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={retryDisabled || retrying}
          aria-busy={retrying || undefined}
          className="motion-reduce:transition-none"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      )}
    </section>
  )
}
