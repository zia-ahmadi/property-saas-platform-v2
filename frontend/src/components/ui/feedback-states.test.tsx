import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './empty-state'
import { ErrorState } from './error-state'
import { LoadingState } from './loading-state'
import { Skeleton } from './skeleton'
import { Spinner } from './spinner'

describe('loading feedback', () => {
  it('announces the spinner label while keeping the icon decorative', () => {
    render(<Spinner label="Refreshing results…" />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Refreshing results…')
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('announces section loading outside the busy placeholder region', () => {
    const { container } = render(
      <LoadingState label="Loading results…" placeholder={<Skeleton className="h-12" />} />,
    )

    const status = screen.getByRole('status')
    const busyRegion = container.querySelector('[aria-busy="true"]')
    expect(status).toHaveTextContent('Loading results…')
    expect(status.closest('[aria-busy="true"]')).toBeNull()
    expect(busyRegion?.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
  })

  it('renders a decorative skeleton with caller-defined dimensions', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />)

    const skeleton = container.querySelector('[data-slot="skeleton"]')
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(skeleton).toHaveClass('h-8', 'w-32')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders a named section and description without an action', () => {
    render(<EmptyState title="No results" description="Try a different search." />)

    const section = screen.getByRole('region', { name: 'No results' })
    expect(within(section).getByRole('heading')).toHaveTextContent('No results')
    expect(within(section).getByText('Try a different search.')).toBeVisible()
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps a supplied action operable and an icon decorative', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <EmptyState
        title="No results"
        description="There are no matches."
        icon={<svg role="img" aria-label="Search icon" />}
        action={<button onClick={onClick}>Clear filters</button>}
      />,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('ErrorState', () => {
  it('announces user-facing copy politely and calls the supplied retry handler', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(
      <ErrorState
        title="Results unavailable"
        description="Check your connection and try again."
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Check your connection and try again.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows a safe fallback without an implicit retry action', () => {
    render(<ErrorState title="Results unavailable" />)

    expect(screen.getByRole('status')).toHaveTextContent('Something went wrong.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('blocks retry while disabled or pending and announces progress', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<ErrorState title="Unavailable" onRetry={onRetry} retryDisabled />)

    const disabled = screen.getByRole('button', { name: 'Retry' })
    expect(disabled).toBeDisabled()
    await user.click(disabled)

    rerender(<ErrorState title="Unavailable" onRetry={onRetry} retrying />)
    const pending = screen.getByRole('button', { name: 'Retrying…' })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Retrying…')
    await user.click(pending)
    expect(onRetry).not.toHaveBeenCalled()

    rerender(<ErrorState title="Unavailable" onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
