import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { StatusBadge } from './status-badge'

it.each(['neutral', 'success', 'warning', 'destructive'] as const)(
  'renders an explicit text label for the %s tone without announcing decorative icons',
  (tone) => {
    render(<StatusBadge tone={tone} role="status">{`${tone} state`}</StatusBadge>)
    expect(screen.getByRole('status')).toHaveTextContent(`${tone} state`)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  },
)

it('defaults to a non-live badge while preserving caller attributes', () => {
  render(<StatusBadge title="Additional context">Pending review</StatusBadge>)
  expect(screen.getByTitle('Additional context')).toHaveTextContent('Pending review')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
