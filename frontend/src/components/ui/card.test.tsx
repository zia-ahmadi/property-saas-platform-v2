import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'

it('composes a card with a contextual heading, readable content, and a keyboard action', async () => {
  const user = userEvent.setup()
  const onReview = vi.fn()
  render(
    <section aria-labelledby="summary-title">
      <Card>
        <CardHeader>
          <CardTitle id="summary-title" headingLevel={3}>
            Record summary
          </CardTitle>
          <CardDescription>Review recent changes.</CardDescription>
        </CardHeader>
        <CardContent>Two changes available.</CardContent>
        <CardFooter>
          <Button onClick={onReview}>Review changes</Button>
        </CardFooter>
      </Card>
    </section>,
  )

  const section = within(screen.getByRole('region', { name: 'Record summary' }))
  expect(section.getByRole('heading', { level: 3, name: 'Record summary' })).toBeVisible()
  expect(section.getByText('Review recent changes.')).toBeVisible()
  expect(section.getByText('Two changes available.')).toBeVisible()
  await user.tab()
  expect(section.getByRole('button', { name: 'Review changes' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(onReview).toHaveBeenCalledOnce()
})

it('allows optional parts to be omitted and forwards native props and refs', () => {
  const ref = { current: null as HTMLDivElement | null }
  render(
    <Card ref={ref} id="summary" className="max-w-sm">
      <CardTitle>Summary</CardTitle>
    </Card>,
  )

  expect(screen.getByRole('heading', { level: 2, name: 'Summary' })).toBeVisible()
  expect(ref.current).toHaveAttribute('id', 'summary')
  expect(ref.current).toHaveClass('max-w-sm', 'bg-card', 'text-card-foreground')
})
