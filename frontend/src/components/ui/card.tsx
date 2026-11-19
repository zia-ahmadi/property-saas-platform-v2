import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs sm:p-6',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('grid min-w-0 gap-1', className)} {...props} />
}

interface CardTitleProps extends ComponentProps<'h2'> {
  headingLevel?: 2 | 3 | 4
}

export function CardTitle({ className, headingLevel = 2, ...props }: CardTitleProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <Heading
      data-slot="card-title"
      className={cn('text-base font-semibold wrap-anywhere', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground wrap-anywhere', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('min-w-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
}
